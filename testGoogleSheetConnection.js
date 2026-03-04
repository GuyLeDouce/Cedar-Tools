require("dotenv").config();

const { getSyncConfig, testGoogleConnection: runGoogleConnectionTest } = require("./server/services/syncToolsFromSheet");

async function testGoogleConnection() {
  const config = getSyncConfig();

  if (!config.enabled) {
    if (config.missing.includes("GOOGLE_SERVICE_ACCOUNT_JSON")) {
      console.error("Google Sheets test disabled. Missing service account credentials.");
    } else {
      console.error(
        `Google Sheets test disabled. Missing required environment variables: ${config.missing.join(", ")}`
      );
    }
    process.exit(1);
  }

  console.log("Testing Google Sheets connection...");
  console.log(`Sheet ID: ${config.sheetId}`);
  console.log(`Range: ${config.range}`);

  try {
    await runGoogleConnectionTest();
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

testGoogleConnection();
