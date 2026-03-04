require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const QRCode = require("qrcode");
const { google } = require("googleapis");
const { Tool } = require("../models");

const SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || "Tools!A:E";
const CRON_SCHEDULE = "0 * * * *";

function isSyncConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
  );
}

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  return google.sheets({ version: "v4", auth });
}

function normalizeRow(row) {
  const [rawToolId, rawName, rawCategory, rawDescription, rawLocation] = row;
  const toolId = String(rawToolId || "").trim().toUpperCase();
  const name = String(rawName || "").trim();
  const category = String(rawCategory || "").trim();
  const description = String(rawDescription || "").trim();
  const location = String(rawLocation || "").trim();

  if (!toolId || !name) {
    return null;
  }

  const mergedDescription = [category, description].filter(Boolean).join(" | ");

  return {
    toolId,
    name,
    description: mergedDescription,
    location,
    status: "Available"
  };
}

function removeHeaderRow(rows) {
  if (!rows.length) {
    return rows;
  }

  const firstRow = rows[0].map((value) => String(value || "").trim().toLowerCase());
  const looksLikeHeader =
    firstRow[0] === "tool id" &&
    firstRow[1] === "name" &&
    firstRow[2] === "category" &&
    firstRow[3] === "description" &&
    firstRow[4] === "location";

  return looksLikeHeader ? rows.slice(1) : rows;
}

async function generateQrCode(toolId) {
  const outputDir = path.join(process.cwd(), "qr-codes");
  fs.mkdirSync(outputDir, { recursive: true });
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const targetPath = path.join(outputDir, `${toolId}.png`);

  await QRCode.toFile(targetPath, `${baseUrl}/tool/${toolId}`, {
    width: 400,
    margin: 2
  });

  return targetPath;
}

async function fetchToolRows() {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: SHEET_RANGE
  });

  return removeHeaderRow(response.data.values || []);
}

async function runToolSheetSync() {
  if (!isSyncConfigured()) {
    console.log("Google Sheets sync is disabled. Missing Google Sheets environment variables.");
    return;
  }

  console.log("Fetching tools from Google Sheet...");

  let newToolsAdded = 0;
  let existingToolsSkipped = 0;
  let qrCodesGenerated = 0;

  try {
    const rows = await fetchToolRows();
    const tools = rows.map(normalizeRow).filter(Boolean);

    for (const tool of tools) {
      const [record, created] = await Tool.findOrCreate({
        where: { toolId: tool.toolId },
        defaults: tool
      });

      if (!created) {
        existingToolsSkipped += 1;
        console.log(`Tool already exists: ${record.toolId}`);
        continue;
      }

      newToolsAdded += 1;
      await generateQrCode(tool.toolId);
      qrCodesGenerated += 1;
    }

    console.log(`New tools added: ${newToolsAdded}`);
    console.log(`Existing tools skipped: ${existingToolsSkipped}`);
    console.log(`QR codes generated: ${qrCodesGenerated}`);
  } catch (error) {
    console.error("Google Sheets sync failed:", error.message);
    console.error("The sync job will retry on the next scheduled run.");
  }
}

function scheduleToolSheetSync() {
  if (!isSyncConfigured()) {
    return null;
  }

  return cron.schedule(CRON_SCHEDULE, async () => {
    await runToolSheetSync();
  });
}

module.exports = {
  runToolSheetSync,
  scheduleToolSheetSync
};
