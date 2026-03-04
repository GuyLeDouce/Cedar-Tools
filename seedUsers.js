require("dotenv").config();

const { sequelize } = require("./server/models");
const { ensureDefaultUsers } = require("./server/services/bootstrapUsers");

async function seedUsers() {
  console.log("Connecting to database...");

  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("Creating users...");
    await ensureDefaultUsers();
    console.log("Users seeded successfully.");
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed users:", error);

    try {
      await sequelize.close();
    } catch (_closeError) {
      // Ignore close failures during error handling.
    }

    process.exit(1);
  }
}

seedUsers();
