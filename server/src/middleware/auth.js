const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { User } = require("../models");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

function readToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7);
  if (req.cookies && req.cookies[env.cookieName]) return req.cookies[env.cookieName];
  return null;
}

function setAuthCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function clearAuthCookie(res) {
  res.clearCookie(env.cookieName, { httpOnly: true, sameSite: "lax", path: "/" });
}

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

const optionalAuth = asyncHandler(async function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = await User.findById(payload.sub);
  } catch (error) {
    req.user = null;
  }
  next();
});

const requireAuth = asyncHandler(async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) throw new AppError("Please log in to continue.", 401);
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    throw new AppError("Your session has expired. Please log in again.", 401);
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError("Account not found.", 401);
  req.user = user;
  next();
});

function requireRole(role) {
  return function roleCheck(req, res, next) {
    if (!req.user || req.user.role !== role) {
      return next(new AppError("You do not have permission to do that.", 403));
    }
    next();
  };
}

module.exports = {
  optionalAuth,
  requireAuth,
  requireRole,
  setAuthCookie,
  clearAuthCookie,
  signToken
};
