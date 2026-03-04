const bcrypt = require("bcryptjs");
const { User } = require("../models");
const { issueToken, clearSession } = require("../middleware/auth");

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = issueToken(user);

  res.cookie("cedar_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}

function logout(req, res) {
  clearSession(res);
  return res.json({ success: true });
}

function me(req, res) {
  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
}

module.exports = {
  login,
  logout,
  me
};
