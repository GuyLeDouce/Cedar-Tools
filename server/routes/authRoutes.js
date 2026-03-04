const express = require("express");
const {
  login,
  logout,
  me,
  changePassword,
  listUsers,
  createUser,
  resetUserPassword,
  debugLoginCheck
} = require("../controllers/authController");
const { authenticate, requireAdmin, requireActivePassword } = require("../middleware/auth");

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/api/me", authenticate, me);
router.post("/api/change-password", authenticate, changePassword);
router.get("/api/debug/login-check", debugLoginCheck);
router.get("/api/users", authenticate, requireActivePassword, requireAdmin, listUsers);
router.post("/api/users", authenticate, requireActivePassword, requireAdmin, createUser);
router.post("/api/users/:id/reset-password", authenticate, requireActivePassword, requireAdmin, resetUserPassword);

module.exports = router;
