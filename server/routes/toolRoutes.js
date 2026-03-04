const express = require("express");
const multer = require("multer");
const path = require("path");
const {
  getTools,
  getTool,
  checkoutTool,
  returnTool,
  createTool,
  updateTool,
  dashboardSummary
} = require("../controllers/toolController");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(process.cwd(), "public", "uploads"),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

router.get("/tools", authenticate, getTools);
router.get("/api/tool/:id", authenticate, getTool);
router.post("/checkout", authenticate, checkoutTool);
router.post("/return", authenticate, returnTool);
router.post("/tools", authenticate, requireAdmin, upload.single("photo"), createTool);
router.put("/tools/:id", authenticate, requireAdmin, upload.single("photo"), updateTool);
router.get("/api/dashboard", authenticate, requireAdmin, dashboardSummary);

module.exports = router;
