const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { Role } = require("../models/Config");
const { forScope, ALL_PERMISSIONS, ROLE_DEFAULTS, SCOPE_OF } = require("../lib/permissions");

// Roles change rarely, so each request reuses a short-lived copy instead of reading the role every time
const TTL_MS = 10_000;
const roleCache = new Map();
const clearRoleCache = () => roleCache.clear();

async function loadRole(user) {
  const cacheKey = String(user.roleRef || `key:${user.role}`);
  const hit = roleCache.get(cacheKey);
  if (hit && hit.until > Date.now()) return hit.role;
  const role = user.roleRef ? await Role.findById(user.roleRef).lean() : await Role.findOne({ key: user.role }).lean();
  roleCache.set(cacheKey, { role, until: Date.now() + TTL_MS });
  return role;
}

// What this user may do. A role that has not been given a permission list yet (database not re-seeded) falls back to the defaults.
async function permissionsFor(user) {
  const role = await loadRole(user);
  if (role && role.active === false) return new Set();
  const fallback = ROLE_DEFAULTS.find((r) => r.key === (role?.key || user.role));
  const listed = role?.permissions ?? fallback?.permissions ?? (user.role === "admin" ? ALL_PERMISSIONS : []);
  // Even if the database was edited by hand, a center login can never hold a head-office-only permission
  const allowed = new Set(forScope(SCOPE_OF(user.role)));
  return new Set(listed.filter((p) => allowed.has(p)));
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || !user.active) return res.status(401).json({ message: "Account unavailable" });
    req.user = user;
    req.perms = await permissionsFor(user);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

const deny = (res) => res.status(403).json({ message: "You do not have permission to do this" });

// Allowed when the user holds at least one of the listed permissions
const requirePermission = (...keys) => (req, res, next) => (keys.some((k) => req.perms.has(k)) ? next() : deny(res));

// One permission for reading and another for changing: GET/HEAD need `read`, everything else needs `write`
const byMethod = (read, write) => (req, res, next) => requirePermission(req.method === "GET" || req.method === "HEAD" ? read : write)(req, res, next);

// Which records the user may see: a center login only its own center's, everyone else all
const centerScope = (req) => (req.user.role === "center" ? { center: req.user.center } : {});

module.exports = { requireAuth, requirePermission, byMethod, centerScope, permissionsFor, clearRoleCache };
