const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { Op } = require("sequelize");
const { Tool, Transaction, User, sequelize } = require("../models");

async function formatTool(tool) {
  const lastActivity = await Transaction.findOne({
    where: { toolId: tool.id },
    include: [{ model: User, as: "user", attributes: ["name"] }],
    order: [["timestamp", "DESC"]]
  });

  return {
    id: tool.id,
    toolId: tool.toolId,
    name: tool.name,
    description: tool.description,
    location: tool.location,
    status: tool.status,
    photoUrl: tool.photoUrl,
    currentHolder: tool.holder
      ? {
          id: tool.holder.id,
          name: tool.holder.name,
          email: tool.holder.email
        }
      : null,
    lastActivity: lastActivity
      ? {
          action: lastActivity.action,
          timestamp: lastActivity.timestamp,
          user: lastActivity.user ? lastActivity.user.name : null
        }
      : null
  };
}

async function getTools(req, res) {
  const { status, userId } = req.query;
  const where = {};

  if (status && ["Available", "Checked Out"].includes(status)) {
    where.status = status;
  }

  if (userId) {
    where.currentHolder = userId;
  }

  const tools = await Tool.findAll({
    where,
    include: [{ model: User, as: "holder", attributes: ["id", "name", "email"] }],
    order: [["toolId", "ASC"]]
  });

  const payload = await Promise.all(tools.map((tool) => formatTool(tool)));
  return res.json({ tools: payload });
}

async function getTool(req, res) {
  const tool = await Tool.findOne({
    where: { toolId: req.params.id.toUpperCase() },
    include: [{ model: User, as: "holder", attributes: ["id", "name", "email"] }]
  });

  if (!tool) {
    return res.status(404).json({ error: "Tool not found." });
  }

  return res.json({ tool: await formatTool(tool) });
}

async function checkoutTool(req, res) {
  const toolId = req.body.toolId?.toUpperCase()?.trim();

  if (!toolId) {
    return res.status(400).json({ error: "Tool ID is required." });
  }

  try {
    await sequelize.transaction(async (transaction) => {
      const [updatedRows] = await Tool.update(
        {
          status: "Checked Out",
          currentHolder: req.user.id
        },
        {
          where: {
            toolId,
            status: "Available"
          },
          transaction
        }
      );

      if (!updatedRows) {
        const existing = await Tool.findOne({
          where: { toolId },
          transaction
        });

        const error = new Error(existing ? "Tool is already checked out." : "Tool not found.");
        error.status = existing ? 409 : 404;
        throw error;
      }

      const tool = await Tool.findOne({
        where: { toolId },
        transaction
      });

      await Transaction.create(
        {
          toolId: tool.id,
          userId: req.user.id,
          action: "checkout"
        },
        { transaction }
      );
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    throw error;
  }

  return getTool({ ...req, params: { id: toolId } }, res);
}

async function returnTool(req, res) {
  const tool = await Tool.findOne({ where: { toolId: req.body.toolId?.toUpperCase() } });

  if (!tool) {
    return res.status(404).json({ error: "Tool not found." });
  }

  if (tool.status === "Available") {
    return res.status(409).json({ error: "Tool is already available." });
  }

  if (req.user.role !== "Admin" && tool.currentHolder !== req.user.id) {
    return res.status(403).json({ error: "Only the current holder or an admin can return this tool." });
  }

  tool.status = "Available";
  tool.currentHolder = null;
  await tool.save();

  await Transaction.create({
    toolId: tool.id,
    userId: req.user.id,
    action: "return"
  });

  return getTool({ ...req, params: { id: tool.toolId } }, res);
}

async function createTool(req, res) {
  const toolId = req.body.toolId?.toUpperCase().trim();

  if (!toolId || !req.body.name) {
    return res.status(400).json({ error: "Tool ID and name are required." });
  }

  const existing = await Tool.findOne({ where: { [Op.or]: [{ toolId }, { name: req.body.name.trim() }] } });

  if (existing) {
    return res.status(409).json({ error: "Tool already exists." });
  }

  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const tool = await Tool.create({
    toolId,
    name: req.body.name.trim(),
    description: req.body.description?.trim() || "",
    location: req.body.location?.trim() || "",
    status: "Available",
    photoUrl
  });

  await generateQrForTool(tool.toolId);

  return res.status(201).json({
    tool,
    qrLabelUrl: `/qr-labels/${tool.toolId}.png`
  });
}

async function updateTool(req, res) {
  const tool = await Tool.findOne({ where: { toolId: req.params.id.toUpperCase() } });

  if (!tool) {
    return res.status(404).json({ error: "Tool not found." });
  }

  tool.name = req.body.name?.trim() || tool.name;
  tool.description = req.body.description?.trim() || tool.description;
  tool.location = req.body.location?.trim() || tool.location;

  if (req.file) {
    tool.photoUrl = `/uploads/${req.file.filename}`;
  }

  await tool.save();
  await generateQrForTool(tool.toolId);
  return res.json({
    tool,
    qrLabelUrl: `/qr-labels/${tool.toolId}.png`
  });
}

async function generateToolQr(req, res) {
  const tool = await Tool.findOne({ where: { toolId: req.params.id.toUpperCase() } });

  if (!tool) {
    return res.status(404).json({ error: "Tool not found." });
  }

  await generateQrForTool(tool.toolId);

  return res.json({
    success: true,
    toolId: tool.toolId,
    qrLabelUrl: `/qr-labels/${tool.toolId}.png`
  });
}

async function dashboardSummary(req, res) {
  const tools = await Tool.findAll({
    include: [{ model: User, as: "holder", attributes: ["id", "name", "email"] }],
    order: [["toolId", "ASC"]]
  });
  const transactions = await Transaction.findAll({
    include: [
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: Tool, as: "tool", attributes: ["toolId", "name"] }
    ],
    order: [["timestamp", "DESC"]]
  });

  const toolPayload = await Promise.all(tools.map((tool) => formatTool(tool)));
  const usageMap = {};
  const history = [];

  transactions.forEach((transaction) => {
    const key = transaction.tool?.toolId || "unknown";
    usageMap[key] = (usageMap[key] || 0) + 1;
    history.push({
      action: transaction.action,
      timestamp: transaction.timestamp,
      user: transaction.user?.name || "Unknown",
      toolId: transaction.tool?.toolId || "Unknown",
      toolName: transaction.tool?.name || "Unknown"
    });
  });

  const overdueTools = toolPayload.filter((tool) => {
    if (tool.status !== "Checked Out" || !tool.lastActivity?.timestamp) {
      return false;
    }

    const age = Date.now() - new Date(tool.lastActivity.timestamp).getTime();
    return age > 24 * 60 * 60 * 1000;
  });

  const mostUsedTools = Object.entries(usageMap)
    .map(([toolId, count]) => ({ toolId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return res.json({
    tools: toolPayload,
    mostUsedTools,
    usageHistory: history.slice(0, 20),
    overdueTools
  });
}

async function generateQrForTool(toolId) {
  const outputDir = path.join(process.cwd(), "public", "qr-labels");
  fs.mkdirSync(outputDir, { recursive: true });
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const targetPath = path.join(outputDir, `${toolId}.png`);

  await QRCode.toFile(targetPath, `${baseUrl}/tool/${toolId}`, {
    width: 400,
    margin: 2
  });

  return targetPath;
}

module.exports = {
  getTools,
  getTool,
  checkoutTool,
  returnTool,
  createTool,
  updateTool,
  generateToolQr,
  dashboardSummary,
  generateQrForTool
};
