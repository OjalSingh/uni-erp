// Calls every protected endpoint as each of the six user levels and checks the server allows or blocks it exactly as the permissions say.
// Uses the real route files with a fake database layer, so it needs no MongoDB. Run: node src/rbac-selftest.js
const Module = require("module");
const http = require("http");
// Where the real packages are not installed (testing only), RBAC_TEST_SHIM points at a folder with small stand-ins
const SHIM = process.env.RBAC_TEST_SHIM;

// ---- Fake mongoose: enough for the model files to load and for requests to run without a database ----
const chain = (value = []) => {
  const c = { then: (res, rej) => Promise.resolve(value).then(res, rej), catch: (r) => Promise.resolve(value).catch(r), lean: () => c };
  for (const m of ["populate", "sort", "skip", "limit", "select"]) c[m] = () => c;
  return c;
};
class Schema {
  constructor(def) { this.def = def; this.methods = {}; }
  index() {} pre() {} set() {} path() { return undefined; } invalidate() {}
  virtual() { return { get() {} }; }
}
Schema.Types = { ObjectId: "ObjectId" };
const users = new Map();
const roles = new Map();
const fakeMongoose = {
  Schema, Types: { ObjectId: class {} },
  model(name) {
    return new Proxy(function () {}, {
      get(_t, prop) {
        if (name === "User" && prop === "findById") return async (id) => users.get(String(id)) || null;
        if (name === "Role" && prop === "findById") return (id) => chain(roles.get(String(id)) || null);
        if (name === "Role" && prop === "findOne") return (f) => chain([...roles.values()].find((r) => r.key === f.key) || null);
        if (prop === "schema") return { path: () => undefined };
        if (prop === "countDocuments") return () => chain(0);
        if (prop === "findOne" || prop === "findById" || prop === "exists") return () => chain(null);
        return () => chain([]);
      },
    });
  },
};
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "mongoose") return fakeMongoose;
  if (SHIM && request === "express") return realLoad.call(this, SHIM + "/express.js", ...rest);
  if (SHIM && request === "bcrypt") return {};
  if (SHIM && request === "jsonwebtoken") return realLoad.call(this, SHIM + "/jwt.js", ...rest);
  if (request === "multer") return Object.assign(() => ({ single: () => (_q, _s, n) => n() }), { diskStorage: () => ({}) });
  return realLoad.call(this, request, ...rest);
};

process.env.JWT_SECRET = "test-secret";
const express = require("express");
const jwt = require("jsonwebtoken");
const { ROLE_DEFAULTS } = require("./lib/permissions");

const app = express();
app.use(express.json());
for (const [path, file] of [["students", "students"], ["centers", "centers"], ["employees", "employees"], ["exams", "exams"], ["marks", "marks"], ["results", "results"], ["certificates", "certificates"], ["stock", "stock"], ["invoices", "invoices"], ["masters", "masters"], ["config", "config"], ["dashboard", "dashboard"]]) app.use(`/api/${path}`, require(`./routes/${file}`));
app.use((err, _req, res, _next) => res.status(500).json({ message: "handler ran: " + err.message }));

// ---- Endpoint table: [method, path, permissions where holding ANY one allows it (null = any signed-in user)] ----
const E = [
  ["GET", "/students", ["students:view"]], ["GET", "/students/next-enroll-no?session=2026-27", ["students:create"]], ["GET", "/students/id-cards?session=2026-27", ["idcards:print"]],
  ["GET", "/students/abc", ["students:view", "students:edit"]], ["POST", "/students", ["students:create"]], ["PUT", "/students/abc", ["students:edit"]], ["DELETE", "/students/abc", ["students:deactivate"]],
  ["GET", "/centers", null], ["POST", "/centers", ["centers:manage"]], ["PUT", "/centers/abc", ["centers:manage"]], ["DELETE", "/centers/abc", ["centers:manage"]],
  ["GET", "/employees", ["employees:manage"]], ["POST", "/employees", ["employees:manage"]], ["PUT", "/employees/abc", ["employees:manage"]],
  ["GET", "/exams/schedules", ["exams:view", "marks:view", "results:view", "admitcards:print"]], ["POST", "/exams/schedules", ["exams:schedule"]], ["PUT", "/exams/schedules/abc", ["exams:schedule"]],
  ["GET", "/exams/admit-cards?schedule=x", ["admitcards:print"]], ["GET", "/exams/forms?schedule=x", ["exams:view"]], ["POST", "/exams/forms", ["exams:create"]], ["PUT", "/exams/forms/abc", ["exams:create"]],
  ["POST", "/exams/forms/status", ["exams:review"]], ["DELETE", "/exams/forms/abc", ["exams:create"]],
  ["GET", "/marks?schedule=x", ["marks:view"]], ["POST", "/marks", ["marks:edit"]], ["PUT", "/marks/abc", ["marks:edit"]], ["DELETE", "/marks/abc", ["marks:edit"]],
  ["GET", "/results", ["results:view"]], ["POST", "/results", ["results:manage"]], ["POST", "/results/abc/publish", ["results:manage"]],
  ["GET", "/certificates", ["certificates:print"]], ["GET", "/certificates/schedules", ["certificates:print"]],
  ["GET", "/stock/summary", ["stock:view"]], ["GET", "/stock/entries", ["stock:view"]], ["POST", "/stock/entries", ["stock:manage"]], ["DELETE", "/stock/items/abc", ["stock:manage"]],
  ["GET", "/invoices", ["invoices:view"]], ["GET", "/invoices/abc", ["invoices:view"]], ["GET", "/invoices/report", ["invoices:manage"]], ["POST", "/invoices", ["invoices:manage"]], ["POST", "/invoices/abc/payments", ["invoices:manage"]], ["DELETE", "/invoices/abc", ["invoices:manage"]],
  ["GET", "/masters/courses", null], ["POST", "/masters/courses", ["settings:manage"]], ["PUT", "/masters/subjects/abc", ["settings:manage"]],
  ["GET", "/config/states", null], ["POST", "/config/states", ["settings:manage"]], ["GET", "/config/menus", ["settings:manage"]], ["POST", "/config/menus", ["settings:manage"]],
  ["GET", "/config/roles", ["settings:manage", "employees:manage"]], ["POST", "/config/roles", ["settings:manage"]], ["PUT", "/config/roles/abc", ["settings:manage"]],
  ["GET", "/config/permissions", ["settings:manage", "employees:manage"]], ["GET", "/config/screens", ["settings:manage"]], ["GET", "/config/navigation", null], ["GET", "/dashboard", null],
];

(async () => {
  // call(): over real HTTP normally, or straight into the stand-in router
  let server;
  let call;
  if (SHIM) {
    call = async (method, path, token, body) => app.dispatch(method, "/api" + path, { authorization: token ? "Bearer " + token : "" }, body ? JSON.parse(body) : {});
  } else {
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    call = async (method, path, token, body) => {
      const res = await fetch(base + path, { method, headers: { Authorization: token ? "Bearer " + token : "", "Content-Type": "application/json" }, body });
      return { status: res.status };
    };
  }
  let wrong = 0, checks = 0;

  for (const def of ROLE_DEFAULTS) {
    const roleId = "role-" + def.key, userId = "user-" + def.key;
    roles.set(roleId, { _id: roleId, key: def.key, active: true, baseRole: def.baseRole, permissions: def.permissions });
    users.set(userId, { id: userId, active: true, role: def.baseRole, roleRef: roleId, center: "c1" });
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
    const has = new Set(def.permissions);
    const problems = [];
    for (const [method, path, needs] of E) {
      const res = await call(method, path, token, method === "GET" || method === "DELETE" ? undefined : "{}");
      const blocked = res.status === 403;
      const shouldBlock = needs !== null && !needs.some((p) => has.has(p));
      checks++;
      if (blocked !== shouldBlock) { wrong++; problems.push(`${method} ${path}: expected ${shouldBlock ? "403" : "allowed"}, got ${res.status}`); }
    }
    console.log(`${problems.length ? "FAIL" : "PASS"}  ${def.name.padEnd(14)} (${def.permissions.length} permissions)${problems.length ? "\n      " + problems.join("\n      ") : ""}`);
  }

  // No token, bad token, and a switched-off role
  const anon = await call("GET", "/students", "");
  const bad = await call("GET", "/students", "nope");
  console.log(`${anon.status === 401 && bad.status === 401 ? "PASS" : "FAIL"}  signed-out and invalid tokens get 401`);
  roles.get("role-staff").active = false; // the cache lasts a few seconds, so use a fresh role for this check
  roles.set("role-off", { _id: "role-off", key: "off", active: false, baseRole: "admin", permissions: ["students:view"] });
  users.set("user-off", { id: "user-off", active: true, role: "admin", roleRef: "role-off" });
  const off = await call("GET", "/students", jwt.sign({ sub: "user-off" }, process.env.JWT_SECRET));
  console.log(`${off.status === 403 ? "PASS" : "FAIL"}  a user whose role is switched off can do nothing (got ${off.status})`);
  // A center login can never hold a head-office permission, even if the database says so
  roles.set("role-sneaky", { _id: "role-sneaky", key: "sneaky", active: true, baseRole: "center", permissions: ["students:view", "marks:edit", "stock:manage"] });
  users.set("user-sneaky", { id: "user-sneaky", active: true, role: "center", roleRef: "role-sneaky", center: "c1" });
  const t = jwt.sign({ sub: "user-sneaky" }, process.env.JWT_SECRET);
  const a = await call("POST", "/marks", t, "{}");
  const b = await call("POST", "/stock/entries", t, "{}");
  const c = await call("GET", "/students", t);
  console.log(`${a.status === 403 && b.status === 403 && c.status !== 403 ? "PASS" : "FAIL"}  center role with head-office permissions in the database still cannot use them`);

  console.log(`\n${checks} endpoint checks across 6 levels, ${wrong} wrong`);
  if (server) server.close();
  process.exit(wrong ? 1 : 0);
})();
