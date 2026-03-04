require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sequelize, User } = require("./server/models");

const DEFAULT_PASSWORD = "cedar123!";
const SALT_ROUNDS = 10;

const users = [
  { name: "Nelson", username: "nelson", email: "nelson@thebetterwaytobuild.com", role: "Admin" },
  { name: "John", username: "john", email: "john@thebetterwaytobuild.com", role: "Admin" },
  { name: "Glenn", username: "glenn", email: "glenn@thebetterwaytobuild.com", role: "Admin" },
  { name: "Gail", username: "gail", email: "logistics@thebetterwaytobuild.com", role: "Admin" },
  { name: "Heather", username: "heather", email: "info@thebetterwaytobuild.com", role: "Staff" },
  { name: "Liz", username: "liz", email: "liz@thebetterwaytobuild.com", role: "Staff" },
  { name: "Evan", username: "evan", email: "evanrklatt@gmail.com", role: "Staff" },
  { name: "JP", username: "jp", email: "jdotpdot@live.ca", role: "Staff" },
  { name: "Kelly", username: "kelly", email: "kellycarson479@gmail.com", role: "Staff" },
  { name: "Mark", username: "mark", email: "flintmark92@gmail.com", role: "Staff" },
  { name: "Mason", username: "mason", email: "masonkooistra2007@gmail.com", role: "Staff" },
  { name: "PM", username: "pm", email: "pm@thebetterwaytobuild.com", role: "Staff" }
];

async function seedUsers() {
  console.log("Connecting to database...");

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    console.log("Creating users...");
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    for (const user of users) {
      const [record, created] = await User.findOrCreate({
        where: { email: user.email },
        defaults: {
          name: user.name,
          username: user.username,
          email: user.email,
          passwordHash,
          role: user.role,
          passwordResetRequired: true
        }
      });

      if (!created) {
        console.log(`User already exists: ${record.email}`);
      }
    }

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
