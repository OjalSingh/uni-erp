const express = require("express");
const { State, City, FinancialYear, Menu, SubMenu, Role } = require("../models/Config");
const Student = require("../models/Student");
const Center = require("../models/Center");
const User = require("../models/User");
const { requireAuth, requirePermission, clearRoleCache } = require("../middleware/auth");
const { guarded } = require("../lib/util");
const { SCREENS, ALL_MENUS, PROTECTED_MENUS, PROTECTED_SUBMENUS } = require("../lib/screens");
const { PERMISSIONS, forScope, MENU_PERMISSION, effectivePermissions, SCOPE_OF } = require("../lib/permissions");

const router = express.Router();
router.use(requireAuth);
const admin = requirePermission("settings:manage");
const adminOrUsers = requirePermission("settings:manage", "employees:manage"); // the user screen needs the role list too

const pick = (body, fields) => Object.fromEntries(fields.filter((f) => body?.[f] !== undefined).map((f) => [f, body[f]]));

// Small CRUD factory: GET list, POST create, PUT update, DELETE (blocked for system rows and rows in use)
function crud(path, Model, { fields, createOnly = [], filters = [], populate, sort = { createdAt: 1 }, readAll = false, inUse, before, after, label, filterFor, readGuard, onChange }) {
  router.get(`/${path}`, ...(readAll ? [] : [readGuard || admin]), async (req, res) => {
    const filter = filterFor ? await filterFor(req) : {};
    for (const f of filters) if (req.query[f]) filter[f] = req.query[f];
    if (readAll && !req.perms.has("settings:manage") && Model.schema.path("active")) filter.active = true; // non-admins only see active rows
    let q = Model.find(filter).sort(sort);
    if (populate) q = q.populate(populate);
    res.json(await q);
  });

  router.post(`/${path}`, admin, (req, res) =>
    guarded(res, async () => {
      const data = pick(req.body, [...fields, ...createOnly]);
      if (before) { const err = await before(data, null, req); if (err) return res.status(400).json({ message: err }); }
      const doc = await Model.create(data);
      if (after) await after(doc);
      if (onChange) onChange();
      res.status(201).json(doc);
    }, `That ${label} already exists`)
  );

  router.put(`/${path}/:id`, admin, (req, res) =>
    guarded(res, async () => {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });
      const data = pick(req.body, fields); // createOnly fields never change after creation
      if (before) { const err = await before(data, doc, req); if (err) return res.status(400).json({ message: err }); }
      doc.set(data);
      await doc.save();
      if (after) await after(doc);
      if (onChange) onChange();
      res.json(doc);
    }, `That ${label} already exists`)
  );

  router.delete(`/${path}/:id`, admin, async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: `${label} not found` });
    if (doc.system) return res.status(409).json({ message: `This ${label} is built in and cannot be deleted. You can switch it off instead.` });
    if (inUse) { const msg = await inUse(doc); if (msg) return res.status(409).json({ message: msg }); }
    await doc.deleteOne();
    if (onChange) onChange();
    res.json({ message: `${label} deleted` });
  });
}

// ----- State -----
crud("states", State, {
  label: "state", fields: ["name", "active"], sort: { name: 1 }, readAll: true,
  inUse: async (s) =>
    (await City.exists({ state: s._id })) ? "This state has cities. Delete them first, or switch the state off."
    : (await Student.exists({ state: s.name })) || (await Center.exists({ state: s.name })) ? "Students or centers use this state. Switch it off instead of deleting it." : null,
});

// ----- City (?state=<id> or ?stateName=<name>) -----
crud("cities", City, {
  label: "city", fields: ["name", "active"], createOnly: ["state"], filters: ["state"],
  filterFor: async (req) => {
    if (!req.query.stateName) return {};
    const st = await State.findOne({ name: String(req.query.stateName) });
    return { state: st ? st._id : null }; // unknown state name: no cities
  }, populate: { path: "state", select: "name" }, sort: { name: 1 }, readAll: true,
  inUse: async (c) => {
    const state = await State.findById(c.state);
    const where = { city: c.name, ...(state ? { state: state.name } : {}) };
    return (await Student.exists(where)) || (await Center.exists(where)) ? "Students or centers use this city. Switch it off instead of deleting it." : null;
  },
});

// ----- Financial year (also the session list) -----
crud("financial-years", FinancialYear, {
  label: "financial year", fields: ["label", "startDate", "endDate", "current"], sort: { label: -1 }, readAll: true,
  // Only one year can be current
  after: async (doc) => { if (doc.current) await FinancialYear.updateMany({ _id: { $ne: doc._id } }, { current: false }); },
  inUse: async (fy) => ((await Student.exists({ session: fy.label })) ? "Students are registered in this session. It cannot be deleted." : null),
});

// ----- Menu / Sub menu -----
crud("menus", Menu, {
  label: "menu", fields: ["label", "group", "order", "active"], createOnly: ["key"], sort: { order: 1 },
  before: async (data, doc) => {
    if (doc && PROTECTED_MENUS.includes(doc.key) && data.active === false) return "This menu has to stay on so you can still manage the system.";
    return null;
  },
  inUse: async (m) => ((await SubMenu.exists({ menu: m._id })) ? "This menu has sub menus. Delete them first." : null),
});

crud("sub-menus", SubMenu, {
  label: "sub menu", fields: ["order", "active"], createOnly: ["menu", "label"], populate: { path: "menu", select: "label key" }, sort: { order: 1 },
  before: async (data, doc) => {
    if (!doc && data.menu) {
      const m = await Menu.findById(data.menu);
      if (!m || m.key !== "misc") return "Only the Miscellaneous menu has sub menus.";
    }
    if (doc && PROTECTED_SUBMENUS.includes(doc.label) && data.active === false) return "This screen has to stay on so you can still manage the system.";
    return null;
  },
});

// ----- Roles -----
crud("roles", Role, {
  label: "role", fields: ["name", "permissions", "active"], createOnly: ["key", "baseRole"], sort: { createdAt: 1 },
  readGuard: adminOrUsers, onChange: clearRoleCache,
  before: async (data, doc, req) => {
    const baseRole = doc ? doc.baseRole : data.baseRole;
    if (!doc && !["admin", "center"].includes(baseRole)) return "Choose which records the role covers: all centers or its own center only.";
    if (doc?.key === "admin") { delete data.permissions; if (data.active === false) return "The Super Admin role cannot be switched off."; }
    if (doc?.key === "center" && data.active === false) return "The default Center Admin role cannot be switched off.";
    // Nobody can edit a role that has more access than they have
    if (doc && !effectivePermissions(doc).every((p) => req.perms.has(p))) return "You cannot change a role that has more access than you.";
    if (data.permissions !== undefined) {
      if (!Array.isArray(data.permissions)) return "Permissions must be a list.";
      const known = new Set(forScope(SCOPE_OF(baseRole)));
      const unknown = data.permissions.filter((p) => !known.has(p));
      if (unknown.length) return baseRole === "center" ? `A center role cannot be given head-office permissions (${unknown.join(", ")}).` : `Unknown permission: ${unknown.join(", ")}.`;
      if (data.permissions.some((p) => !req.perms.has(p))) return "You cannot give a role permissions that you do not have yourself.";
      data.permissions = [...new Set(data.permissions)];
    }
    return null;
  },
  inUse: async (r) => ((await User.exists({ roleRef: r._id })) ? "Users have this role. Move them to another role first." : null),
});

router.get("/permissions", adminOrUsers, (_req, res) => res.json(PERMISSIONS));

// ----- Navigation for the signed-in user -----
router.get("/navigation", async (req, res) => {
  // A menu shows when the user holds the permission that opens it
  const keys = ALL_MENUS.filter((k) => MENU_PERMISSION[k] === null || (MENU_PERMISSION[k] && req.perms.has(MENU_PERMISSION[k])));
  const menus = await Menu.find({ active: true, key: { $in: keys } }).sort({ order: 1 });
  const subs = await SubMenu.find({ active: true, menu: { $in: menus.map((m) => m._id) } }).sort({ order: 1 });
  res.json(menus.map((m) => ({ key: m.key, label: m.label, group: m.group, order: m.order, submenus: subs.filter((s) => String(s.menu) === String(m._id)).map((s) => ({ label: s.label })) })));
});

router.get("/screens", admin, (_req, res) => res.json(SCREENS));

module.exports = router;
