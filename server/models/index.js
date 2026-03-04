require("dotenv").config();

const { Sequelize } = require("sequelize");
const createUser = require("./User");
const createTool = require("./Tool");
const createTransaction = require("./Transaction");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

const User = createUser(sequelize);
const Tool = createTool(sequelize);
const Transaction = createTransaction(sequelize);

User.hasMany(Tool, { foreignKey: "currentHolder", as: "assignedTools" });
Tool.belongsTo(User, { foreignKey: "currentHolder", as: "holder" });

User.hasMany(Transaction, { foreignKey: "userId", as: "transactions" });
Transaction.belongsTo(User, { foreignKey: "userId", as: "user" });

Tool.hasMany(Transaction, { foreignKey: "toolId", as: "transactions" });
Transaction.belongsTo(Tool, { foreignKey: "toolId", as: "tool" });

module.exports = {
  sequelize,
  User,
  Tool,
  Transaction
};
