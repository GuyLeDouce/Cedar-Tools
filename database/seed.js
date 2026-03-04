require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sequelize, User, Tool, Transaction } = require("../server/models");

const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "cedar123!";

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

const tools = [
  { toolId: "T001", name: "Paslode Framing Nailer", description: "Cordless framing nailer for structural work." },
  { toolId: "T002", name: "Makita Drill", description: "18V drill/driver for general installation." },
  { toolId: "T003", name: "Milwaukee Impact", description: "Impact driver for fastener-heavy tasks." },
  { toolId: "T004", name: "Paslode Finish Nailer", description: "Finish nailer for trim and detail work." },
  { toolId: "T005", name: "Laser Level", description: "Self-leveling laser for layout and alignment." }
];

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    await Transaction.destroy({ where: {} });
    await Tool.destroy({ where: {} });
    await User.destroy({ where: {} });

    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const createdUsers = await User.bulkCreate(
      users.map((user) => ({
        ...user,
        passwordHash,
        passwordResetRequired: true
      }))
    );

    await Tool.bulkCreate(
      tools.map((tool) => ({
        toolId: tool.toolId,
        name: tool.name,
        description: tool.description,
        status: "Available",
        currentHolder: null
      }))
    );

    console.log(`Seeded ${createdUsers.length} users and ${tools.length} tools.`);
    console.log(`Default password: ${defaultPassword}`);
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
