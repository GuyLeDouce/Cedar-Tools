const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Tool",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      toolId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "tool_id"
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT
      },
      status: {
        type: DataTypes.ENUM("Available", "Checked Out"),
        allowNull: false,
        defaultValue: "Available"
      },
      currentHolder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "current_holder"
      },
      photoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "photo_url"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "created_at"
      }
    },
    {
      tableName: "tools",
      updatedAt: false
    }
  );
