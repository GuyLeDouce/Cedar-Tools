require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sequelize, User, Tool, Transaction } = require("../server/models");

const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "Cedar123!";

const users = [
  { name: "Gail Kent", email: "gail.kent@cedarwinds.ca", role: "Logistics" },
  { name: "Nelson Evans", email: "nelson.evans@cedarwinds.ca", role: "Admin" },
  { name: "John Szpara", email: "john.szpara@cedarwinds.ca", role: "Admin" },
  { name: "Glenn Evans", email: "glenn.evans@cedarwinds.ca", role: "Admin" },
  { name: "Alex Killingbeck", email: "alex.killingbeck@cedarwinds.ca", role: "Staff" },
  { name: "Liz Jones", email: "liz.jones@cedarwinds.ca", role: "Staff" },
  { name: "Heather Kennedy", email: "heather.kennedy@cedarwinds.ca", role: "Staff" },
  { name: "Mark Flint", email: "mark.flint@cedarwinds.ca", role: "Staff" },
  { name: "J.P. Gervais", email: "jp.gervais@cedarwinds.ca", role: "Staff" },
  { name: "Kelly Routcliffe", email: "kelly.routcliffe@cedarwinds.ca", role: "Staff" },
  { name: "Evan Klatt", email: "evan.klatt@cedarwinds.ca", role: "Staff" },
  { name: "Mason Kooistra", email: "mason.kooistra@cedarwinds.ca", role: "Staff" }
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
