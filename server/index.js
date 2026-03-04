require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { sequelize } = require("./models");
const authRoutes = require("./routes/authRoutes");
const toolRoutes = require("./routes/toolRoutes");
const {
  runToolSheetSync,
  scheduleToolSheetSync,
  logSyncConfigurationStatus
} = require("./services/syncToolsFromSheet");
const { ensureDefaultUsers } = require("./services/bootstrapUsers");

const app = express();
const port = process.env.PORT || 3000;

fs.mkdirSync(path.join(process.cwd(), "public", "uploads"), { recursive: true });
fs.mkdirSync(path.join(process.cwd(), "public", "qr-labels"), { recursive: true });
fs.mkdirSync(path.join(process.cwd(), "qr-codes"), { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));

app.use(authRoutes);
app.use(toolRoutes);

app.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "login.html"));
});

app.get("/set-password", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "set-password.html"));
});

app.get("/scanner", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "scanner", "index.html"));
});

app.get("/dashboard", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "dashboard", "index.html"));
});

app.get("/tool/:id", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "tool", "index.html"));
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log("Database connected");
    await sequelize.sync();
    console.log("Tables synced");
    await ensureDefaultUsers();
    console.log("Default users ensured");
    const syncEnabled = logSyncConfigurationStatus();
    if (syncEnabled) {
      await runToolSheetSync();
      scheduleToolSheetSync();
    }
    app.listen(port, () => {
      console.log(`Server running on ${port}`);
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

start();
