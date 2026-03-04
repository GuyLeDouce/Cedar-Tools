require("dotenv").config();

const { sequelize } = require("../server/models");

async function init() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("Database synchronized.");
    process.exit(0);
  } catch (error) {
    console.error("Database init failed:", error);
    process.exit(1);
  }
}

init();
