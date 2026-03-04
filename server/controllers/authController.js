const bcrypt = require("bcryptjs");
const { Op, where, fn, col } = require("sequelize");
const { User } = require("../models");
const { issueToken, clearSession } = require("../middleware/auth");

function buildUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    passwordResetRequired: user.passwordResetRequired
  };
}

async function login(req, res) {
  const identifier = String(req.body.identifier || req.body.email || "").trim();
  const { password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: "Username or email and password are required." });
  }

  const normalizedIdentifier = identifier.toLowerCase();
  const user = await User.findOne({
    where: {
      [Op.or]: [
        where(fn("lower", col("email")), normalizedIdentifier),
        where(fn("lower", col("username")), normalizedIdentifier)
      ]
    }
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid username, email, or password." });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    return res.status(401).json({ error: "Invalid username, email, or password." });
  }

  const token = issueToken(user);

  res.cookie("cedar_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    user: serializeUser(user)
  });
}

function logout(req, res) {
  clearSession(res);
  return res.json({ success: true });
}

function me(req, res) {
  return res.json({
    user: serializeUser(req.user)
  });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  if (req.user.passwordResetRequired) {
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required." });
    }

    const validPassword = await bcrypt.compare(currentPassword, req.user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
  } else if (currentPassword) {
    const validPassword = await bcrypt.compare(currentPassword, req.user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
  } else {
    return res.status(400).json({ error: "Current password is required." });
  }

  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  req.user.passwordResetRequired = false;
  await req.user.save();

  const token = issueToken(req.user);

  res.cookie("cedar_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    success: true,
    user: serializeUser(req.user)
  });
}

async function listUsers(req, res) {
  const users = await User.findAll({
    attributes: ["id", "name", "username", "email", "role", "passwordResetRequired", "createdAt", "updatedAt"],
    order: [["name", "ASC"]]
  });

  return res.json({ users });
}

async function createUser(req, res) {
  const { name, email, role, password, username } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ error: "Name, email, and role are required." });
  }

  if (!["Admin", "Logistics", "Staff"].includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = buildUsername(username || name);

  if (!normalizedUsername) {
    return res.status(400).json({ error: "A valid username is required." });
  }

  const existing = await User.findOne({ where: { email: normalizedEmail } });

  if (existing) {
    return res.status(409).json({ error: "A user with that email already exists." });
  }

  const existingUsername = await User.findOne({ where: { username: normalizedUsername } });

  if (existingUsername) {
    return res.status(409).json({ error: "A user with that username already exists." });
  }

  const tempPassword = password?.trim() || "cedar123!";

  if (tempPassword.length < 8) {
    return res.status(400).json({ error: "Temporary password must be at least 8 characters." });
  }

  const user = await User.create({
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    role,
    passwordHash: await bcrypt.hash(tempPassword, 10),
    passwordResetRequired: true
  });

  return res.status(201).json({
    user: serializeUser(user),
    temporaryPassword: tempPassword
  });
}

async function resetUserPassword(req, res) {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const tempPassword = req.body.password?.trim() || "cedar123!";

  if (tempPassword.length < 8) {
    return res.status(400).json({ error: "Temporary password must be at least 8 characters." });
  }

  user.passwordHash = await bcrypt.hash(tempPassword, 10);
  user.passwordResetRequired = true;
  await user.save();

  return res.json({
    success: true,
    user: serializeUser(user),
    temporaryPassword: tempPassword
  });
}

async function debugLoginCheck(req, res) {
  const debugKey = process.env.DEBUG_LOGIN_KEY;
  const providedKey = String(req.query.key || "");

  if (!debugKey) {
    return res.status(503).json({ error: "Debug login check is disabled on this deployment." });
  }

  if (providedKey !== debugKey) {
    return res.status(403).json({ error: "Invalid debug key." });
  }

  const identifier = String(req.query.identifier || "").trim().toLowerCase();
  const password = String(req.query.password || "");

  if (!identifier || !password) {
    return res.status(400).json({ error: "identifier and password query params are required." });
  }

  const user = await User.findOne({
    where: {
      [Op.or]: [
        where(fn("lower", col("email")), identifier),
        where(fn("lower", col("username")), identifier)
      ]
    }
  });

  if (!user) {
    return res.json({
      success: false,
      found: false,
      identifier
    });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  return res.json({
    success: true,
    found: true,
    identifier,
    passwordMatch,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      passwordResetRequired: user.passwordResetRequired,
      hashPrefix: String(user.passwordHash || "").slice(0, 4)
    }
  });
}

module.exports = {
  login,
  logout,
  me,
  changePassword,
  listUsers,
  createUser,
  resetUserPassword,
  debugLoginCheck
};
