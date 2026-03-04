require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sequelize, User } = require("./server/models");

const DEFAULT_PASSWORD = "cedar123";
const SALT_ROUNDS = 10;

const users = [
  { name: "Gail Kent", email: "gail@cedarwinds.ca", role: "Logistics" },
  { name: "Nelson Evans", email: "nelson@cedarwinds.ca", role: "Admin" },
  { name: "John Szpara", email: "john@cedarwinds.ca", role: "Admin" },
  { name: "Glenn Evans", email: "glenn@cedarwinds.ca", role: "Admin" },
  { name: "Alex Killingbeck", email: "alex@cedarwinds.ca", role: "Staff" },
  { name: "Liz Jones", email: "liz@cedarwinds.ca", role: "Staff" },
  { name: "Heather Kennedy", email: "heather@cedarwinds.ca", role: "Staff" },
  { name: "Mark Flint", email: "mark@cedarwinds.ca", role: "Staff" },
  { name: "J.P. Gervais", email: "jp@cedarwinds.ca", role: "Staff" },
  { name: "Kelly Routcliffe", email: "kelly@cedarwinds.ca", role: "Staff" },
  { name: "Evan Klatt", email: "evan@cedarwinds.ca", role: "Staff" },
  { name: "Mason Kooistra", email: "mason@cedarwinds.ca", role: "Staff" }
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
