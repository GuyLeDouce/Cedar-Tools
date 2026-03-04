require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const QRCode = require("qrcode");
const { google } = require("googleapis");
const { Tool, sequelize } = require("../models");

const CRON_SCHEDULE = "0 * * * *";

function getSyncConfig() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const range = process.env.GOOGLE_SHEET_RANGE || "Tools!A:E";
  const missing = [];
  let credentials = null;

  if (!serviceAccountJson) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
  } else {
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (_error) {
      missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
    }
  }

  if (!sheetId) {
    missing.push("GOOGLE_SHEET_ID");
  }

  return {
    enabled: missing.length === 0,
    missing,
    sheetId,
    credentials,
    range
  };
}

function getParsedCredentials() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!rawJson) {
    const error = new Error("Missing service account credentials.");
    error.code = "SERVICE_ACCOUNT_JSON_MISSING";
    throw error;
  }

  try {
    return JSON.parse(rawJson);
  } catch (_error) {
    const error = new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON format.");
    error.code = "SERVICE_ACCOUNT_JSON_INVALID";
    throw error;
  }
}

function getNormalizedPrivateKey(rawPrivateKey) {
  return String(rawPrivateKey || "").replace(/\\n/g, "\n").replace(/\n/g, "\n");
}

function validateServiceAccountCredentials(creds, privateKey) {
  const hasClientEmail = Boolean(creds.client_email);
  const hasPrivateKey = Boolean(privateKey);
  const includesBeginPrivateKey = privateKey.includes("BEGIN PRIVATE KEY");

  console.log(`Google service account client_email present: ${hasClientEmail}`);
  console.log(`Google service account private_key present: ${hasPrivateKey}`);
  console.log(`Google service account private_key length: ${privateKey.length}`);
  console.log(`Google service account private_key includes BEGIN PRIVATE KEY: ${includesBeginPrivateKey}`);

  if (!hasClientEmail || !hasPrivateKey || !includesBeginPrivateKey) {
    const error = new Error("Missing client_email or private_key in GOOGLE_SERVICE_ACCOUNT_JSON");
    error.code = "SERVICE_ACCOUNT_JSON_FIELDS_MISSING";
    throw error;
  }
}

async function createSheetsClient() {
  const config = getSyncConfig();

  if (!config.enabled) {
    const error = new Error(`Missing required variables: ${config.missing.join(", ")}`);
    error.code = "SYNC_CONFIG_MISSING";
    throw error;
  }

  const creds = getParsedCredentials();
  const privateKey = getNormalizedPrivateKey(creds.private_key);
  validateServiceAccountCredentials(creds, privateKey);

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  try {
    await auth.authorize();
  } catch (error) {
    const authError = new Error("Google authentication failed. Check GOOGLE_SERVICE_ACCOUNT_JSON formatting.");
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
    category,
    description: mergedDescription,
    qrCode: `/tool/${toolId}`,
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

async function ensureToolSyncColumns() {
  await sequelize.query(`
    ALTER TABLE tools
    ADD COLUMN IF NOT EXISTS category VARCHAR(120),
    ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255);
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS tools_qr_code_unique
    ON tools (qr_code);
  `);
}

async function testGoogleConnection() {
  const config = getSyncConfig();

  if (!config.enabled) {
    if (config.missing.includes("GOOGLE_SERVICE_ACCOUNT_JSON")) {
      console.warn("Google Sheets sync disabled. Missing service account credentials.");
    } else {
      console.warn(
        `Google Sheets sync disabled. Missing required environment variables: ${config.missing.join(", ")}`
      );
    }

    return {
      success: false,
      missing: config.missing,
      rowsFetched: 0,
      rows: []
    };
  }

  const sheets = await createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: config.range
  });

  const rows = response.data.values || [];
  console.log(`Rows fetched: ${rows.length}`);
  console.log("First 5 rows:");
  console.log(JSON.stringify(rows.slice(0, 5), null, 2));

  return {
    success: true,
    rowsFetched: rows.length,
    rows: rows.slice(0, 5)
  };
}

async function runToolSheetSync() {
  const config = getSyncConfig();

  if (!config.enabled) {
    if (config.missing.includes("GOOGLE_SERVICE_ACCOUNT_JSON")) {
      console.warn("Google Sheets sync disabled. Missing service account credentials.");
    } else {
      console.warn(
        `Google Sheets sync disabled. Missing required environment variables: ${config.missing.join(", ")}`
      );
    }
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
    await ensureToolSyncColumns();
    const rows = await fetchToolRows();
    rowsFetched = rows.length;
    console.log(`Rows fetched: ${rowsFetched}`);
    const tools = rows.map(normalizeRow).filter(Boolean);

    for (const tool of tools) {
      const existing = await Tool.findOne({
        where: {
          qrCode: tool.qrCode
        }
      });

      await sequelize.query(
        `
        INSERT INTO tools (tool_id, name, category, description, location, status, qr_code, created_at)
        VALUES (:tool_id, :name, :category, :description, :location, :status, :qr_code, NOW())
        ON CONFLICT (qr_code)
        DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          location = EXCLUDED.location;
        `,
        {
          replacements: {
            tool_id: tool.toolId,
            name: tool.name,
            category: tool.category,
            description: tool.description,
            location: tool.location,
            status: tool.status,
            qr_code: tool.qrCode
          }
        }
      );

      if (existing) {
        existingToolsSkipped += 1;
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
    if (config.missing.includes("GOOGLE_SERVICE_ACCOUNT_JSON")) {
      console.warn("Google Sheets sync disabled. Missing service account credentials.");
    } else {
      console.warn(
        `Google Sheets sync disabled. Missing required environment variables: ${config.missing.join(", ")}`
      );
    }
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
  testGoogleConnection,
  runToolSheetSync,
  scheduleToolSheetSync,
  logSyncConfigurationStatus
};
