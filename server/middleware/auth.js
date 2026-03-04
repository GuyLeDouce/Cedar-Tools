const jwt = require("jsonwebtoken");
const { User } = require("../models");

function issueToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

async function authenticate(req, res, next) {
  const token = req.cookies?.cedar_session;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.id);

    if (!user) {
      return res.status(401).json({ error: "Session is invalid." });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "Admin") {
    return res.status(403).json({ error: "Admin access required." });
  }

  return next();
}

function clearSession(res) {
  res.clearCookie("cedar_session");
}

module.exports = {
  authenticate,
  requireAdmin,
  issueToken,
  clearSession
};
