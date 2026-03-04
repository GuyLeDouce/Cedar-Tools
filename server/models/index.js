const sequelize = require("../config/database");
const createUser = require("./User");
const createTool = require("./Tool");
const createTransaction = require("./Transaction");

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
