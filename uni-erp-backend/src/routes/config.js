const express = require("express");
const { State, City, FinancialYear, Menu, SubMenu, Role } = require("../models/Config");
const Student = require("../models/Student");
const Center = require("../models/Center");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");
const { guarded } = require("../lib/util");
const { SCREENS, CENTER_MENUS, ALL_MENUS, PROTECTED_MENUS, PROTECTED_SUBMENUS } = require("../lib/screens");

const router = express.Router();
router.use(requireAuth);
const admin = requireRole("admin");

const pick = (body, fields) => Object.fromEntries(fields.filter((f) => body?.[f] !== undefined).map((f) => [f, body[f]]));

// Small CRUD factory: GET list, POST create, PUT update, DELETE (blocked for system rows and rows in use)
function crud(path, Model, { fields, createOnly = [], filters = [], populate, sort = { createdAt: 1 }, readAll = false, inUse, before, after, label, filterFor }) {
  router.get(`/${path}`, ...(readAll ? [] : [admin]), async (req, res) => {
    const filter = filterFor ? await filterFor(req) : {};
    for (const f of filters) if (req.query[f]) filter[f] = req.query[f];
    if (readAll && req.user.role !== "admin" && Model.schema.path("active")) filter.active = true; // non-admins only see active rows
    let q = Model.find(filter).sort(sort);
    if (populate) q = q.populate(populate);
    res.json(await q);
  });

  router.post(`/${path}`, admin, (req, res) =>
    guarded(res, async () => {
      const data = pick(req.body, [...fields, ...createOnly]);
      if (before) { const err = await before(data, null); if (err) return res.status(400).json({ message: err }); }
      const doc = await Model.create(data);
      if (after) await after(doc);
      res.status(201).json(doc);
    }, `That ${label} already exists`)
  );

  router.put(`/${path}/:id`, admin, (req, res) =>
    guarded(res, async () => {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });
      const data = pick(req.body, fields); // createOnly fields never change after creation
      if (before) { const err = await before(data, doc); if (err) return res.status(400).json({ message: err }); }
      doc.set(data);
      await doc.save();
      if (after) await after(doc);
      res.json(doc);
    }, `That ${label} already exists`)
  );

  router.delete(`/${path}/:id`, admin, async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: `${label} not found` });
    if (doc.system) return res.status(409).json({ message: `This ${label} is built in and cannot be deleted. You can switch it off instead.` });
    if (inUse) { const msg = await inUse(doc); if (msg) return res.status(409).json({ message: msg }); }
    await doc.deleteOne();
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
  label: "role", fields: ["name", "menus", "active"], createOnly: ["key", "baseRole"], sort: { createdAt: 1 },
  before: async (data, doc) => {
    const baseRole = doc ? doc.baseRole : data.baseRole;
    if (doc?.key === "admin") { delete data.menus; if (data.active === false) return "The head office role cannot be switched off."; }
    if (data.menus && !Array.isArray(data.menus)) return "Menus must be a list.";
    if (data.menus) {
      const allowed = baseRole === "admin" ? ALL_MENUS : CENTER_MENUS;
      const bad = data.menus.filter((m) => !allowed.includes(m));
      if (bad.length) return baseRole === "center" ? "Center roles can only use Student Registration, Center Details, Fill Exam Form, Admit Card, ID Card, Book Allocated and Change Password." : "Unknown menu selected.";
      if (!data.menus.includes("change-password")) data.menus.push("change-password"); // everyone can change their own password
    }
    if (doc?.key === "center" && data.active === false) return "The default center role cannot be switched off.";
    return null;
  },
  inUse: async (r) => ((await User.exists({ roleRef: r._id })) ? "Users have this role. Move them to another role first." : null),
});

// ----- Navigation for the signed-in user -----
router.get("/navigation", async (req, res) => {
  const role = req.user.roleRef ? await Role.findById(req.user.roleRef) : await Role.findOne({ key: req.user.role });
  const fallback = req.user.role === "admin" ? ALL_MENUS : CENTER_MENUS;
  const allowed = role ? (role.active ? role.menus : ["change-password"]) : fallback;
  // The API stays limited to the base role, whatever a role's menu list says
  const ceiling = req.user.role === "admin" ? ALL_MENUS : CENTER_MENUS;
  const keys = allowed.filter((k) => ceiling.includes(k));

  const menus = await Menu.find({ active: true, key: { $in: keys } }).sort({ order: 1 });
  const subs = await SubMenu.find({ active: true, menu: { $in: menus.map((m) => m._id) } }).sort({ order: 1 });
  res.json(menus.map((m) => ({ key: m.key, label: m.label, group: m.group, order: m.order, submenus: subs.filter((s) => String(s.menu) === String(m._id)).map((s) => ({ label: s.label })) })));
});

router.get("/screens", admin, (_req, res) => res.json(SCREENS));

module.exports = router;
