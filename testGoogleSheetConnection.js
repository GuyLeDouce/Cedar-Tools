require("dotenv").config();

const { createSheetsClient, getSyncConfig } = require("./server/services/syncToolsFromSheet");

async function testGoogleSheetConnection() {
  const config = getSyncConfig();

  if (!config.enabled) {
    console.error(
      `Google Sheets test disabled. Missing required environment variables: ${config.missing.join(", ")}`
    );
    process.exit(1);
  }

  console.log("Testing Google Sheets connection...");
  console.log(`Sheet ID: ${config.sheetId}`);
  console.log(`Range: ${config.range}`);

  try {
    const sheets = await createSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: config.range
    });

    const rows = response.data.values || [];
    console.log(`Rows fetched: ${rows.length}`);
    console.log("First 5 rows:");
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    process.exit(0);
  } catch (error) {
    if (error.code === "GOOGLE_AUTH_FAILED") {
      console.error(error.message);
      if (error.cause?.message) {
        console.error("Google auth error details:", error.cause.message);
      }
    } else {
      console.error("Google Sheets connection test failed:", error.message);
    }
    process.exit(1);
  }
}

testGoogleSheetConnection();
