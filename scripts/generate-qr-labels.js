require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sequelize, Tool } = require("../server/models");
const { generateQrForTool } = require("../server/controllers/toolController");

async function exportLabels() {
  try {
    await sequelize.authenticate();
    const tools = await Tool.findAll({ order: [["toolId", "ASC"]] });

    if (!tools.length) {
      console.log("No tools found. Seed the database first.");
      process.exit(0);
    }

    const outputDir = path.join(process.cwd(), "public", "qr-labels");
    fs.mkdirSync(outputDir, { recursive: true });

    for (const tool of tools) {
      await generateQrForTool(tool.toolId);
      console.log(`Generated ${tool.toolId}.png`);
    }

    console.log(`Printable PNG labels exported to ${outputDir}`);
    process.exit(0);
  } catch (error) {
    console.error("QR export failed:", error);
    process.exit(1);
  }
}

exportLabels();
