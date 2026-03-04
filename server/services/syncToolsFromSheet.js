require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const QRCode = require("qrcode");
const { google } = require("googleapis");
const { Tool } = require("../models");

const CRON_SCHEDULE = "0 * * * *";

function getSyncConfig() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const range = process.env.GOOGLE_SHEET_RANGE || "Tools!A:E";
  const missing = [];

  if (!sheetId) {
    missing.push("GOOGLE_SHEET_ID");
  }

  if (!serviceAccountEmail) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  }

  if (!privateKey) {
    missing.push("GOOGLE_PRIVATE_KEY");
  }

  return {
    enabled: missing.length === 0,
    missing,
    sheetId,
    serviceAccountEmail,
    privateKey,
    range
  };
}

function getNormalizedPrivateKey(rawPrivateKey) {
  return String(rawPrivateKey).replace(/\\n/g, "\n").replace(/\n/g, "\n");
}

async function createSheetsClient() {
  const config = getSyncConfig();

  if (!config.enabled) {
    const error = new Error(`Missing required variables: ${config.missing.join(", ")}`);
    error.code = "SYNC_CONFIG_MISSING";
    throw error;
  }

  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: getNormalizedPrivateKey(config.privateKey),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  try {
    await auth.authorize();
  } catch (error) {
    const authError = new Error("Google authentication failed. Check GOOGLE_PRIVATE_KEY formatting.");
    authError.code = "GOOGLE_AUTH_FAILED";
    authError.cause = error;
    throw authError;
  }

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
  const config = getSyncConfig();
  const sheets = await createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: config.range
  });

  return removeHeaderRow(response.data.values || []);
}

async function runToolSheetSync() {
  const config = getSyncConfig();

  if (!config.enabled) {
    console.warn(
      `Google Sheets sync disabled. Missing required environment variables: ${config.missing.join(", ")}`
    );
    return {
      success: false,
      disabled: true,
      reason: "missing_configuration",
      missing: config.missing,
      rowsFetched: 0,
      toolsAdded: 0,
      skipped: 0,
      qrCodesGenerated: 0
    };
  }

  console.log("Fetching tools from Google Sheet...");

  let rowsFetched = 0;
  let newToolsAdded = 0;
  let existingToolsSkipped = 0;
  let qrCodesGenerated = 0;

  try {
    const rows = await fetchToolRows();
    rowsFetched = rows.length;
    console.log(`Rows fetched: ${rowsFetched}`);
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
    return {
      success: true,
      rowsFetched,
      toolsAdded: newToolsAdded,
      skipped: existingToolsSkipped,
      qrCodesGenerated
    };
  } catch (error) {
    if (error.code === "GOOGLE_AUTH_FAILED") {
      console.error(error.message);
      if (error.cause?.message) {
        console.error("Google auth error details:", error.cause.message);
      }
    } else {
      console.error("Google Sheets sync failed:", error.message);
    }
    console.error("The sync job will retry on the next scheduled run.");
    return {
      success: false,
      rowsFetched,
      toolsAdded: newToolsAdded,
      skipped: existingToolsSkipped,
      qrCodesGenerated,
      error: error.message,
      code: error.code || "SYNC_FAILED"
    };
  }
}

function logSyncConfigurationStatus() {
  const config = getSyncConfig();

  if (!config.enabled) {
    console.warn(
      `Google Sheets sync disabled. Missing required environment variables: ${config.missing.join(", ")}`
    );
    return false;
  }

  console.log("Google Sheets sync enabled");
  console.log(`Sheet ID: ${config.sheetId}`);
  console.log(`Range: ${config.range}`);
  return true;
}

function scheduleToolSheetSync() {
  const config = getSyncConfig();

  if (!config.enabled) {
    return null;
  }

  return cron.schedule(CRON_SCHEDULE, async () => {
    await runToolSheetSync();
  });
}

module.exports = {
  getSyncConfig,
  createSheetsClient,
  fetchToolRows,
  runToolSheetSync,
  scheduleToolSheetSync,
  logSyncConfigurationStatus
};
