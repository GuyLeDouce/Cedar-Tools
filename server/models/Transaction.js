const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Transaction",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      toolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "tool_id"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "user_id"
      },
      action: {
        type: DataTypes.ENUM("checkout", "return"),
        allowNull: false
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: "transactions",
      updatedAt: false,
      createdAt: false
    }
  );
