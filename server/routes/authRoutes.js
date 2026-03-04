const express = require("express");
const { login, logout, me } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/api/me", authenticate, me);

module.exports = router;
