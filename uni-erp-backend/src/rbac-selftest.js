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
const fixtures = {}; // per-test overrides such as fixtures["Mark.findOne"] = () => chain(doc)
const users = new Map();
const roles = new Map();
const fakeMongoose = {
  Schema, Types: { ObjectId: class {} },
  model(name) {
    return new Proxy(function () {}, {
      get(_t, prop) {
        if (fixtures[`${name}.${String(prop)}`]) return fixtures[`${name}.${String(prop)}`];
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
for (const [path, file] of [["students", "students"], ["centers", "centers"], ["employees", "employees"], ["exams", "exams"], ["marks", "marks"], ["results", "results"], ["certificates", "certificates"], ["stock", "stock"], ["invoices", "invoices"], ["masters", "masters"], ["config", "config"], ["dashboard", "dashboard"], ["public", "public"]]) app.use(`/api/${path}`, require(`./routes/${file}`));
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
  ["GET", "/marks?schedule=x", ["marks:view"]], ["GET", "/marks/entry?schedule=x&rollNo=1", ["marks:edit"]], ["POST", "/marks/entry", ["marks:edit"]], ["DELETE", "/marks/abc", ["marks:edit"]],
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

  // ---- Public result page: no login, captcha, roll number ----
  const digitsOf = (svg) => [...svg.matchAll(/>(\d)<\/text>/g)].map((m) => m[1]).join("");
  const freshCaptcha = async () => { const r = await call("GET", "/public/captcha", ""); return { token: r.body.token, code: digitsOf(r.body.svg) }; };
  const lookup = async (rollNo, extra = {}) => { const c = await freshCaptcha(); return call("POST", "/public/result", "", JSON.stringify({ rollNo, captchaToken: c.token, captchaAnswer: c.code, ...extra })); };
  let publicWrong = 0;
  const pcheck = (label, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!ok) publicWrong++; };

  const day = 86400000;
  const publish = { publishId: 7, published: true, publishDate: new Date(Date.now() - day), endDate: new Date(Date.now() + day), schedule: { _id: "s1", examTerm: "May-June", year: 2025, session: "2024-25" } };
  const sm = (type, code, subject, max, marks) => ({ type, code, subject, maxMarks: max, marks });
  const form = { part: 1, rollNo: "24251234", status: "Accepted", student: { _id: "st1", name: "A Student", fatherName: "A Father", enrollNo: "2451234", dob: new Date("2000-05-17T00:00:00Z") }, course: { _id: "c1", name: "One Year Diploma", parts: 1, courseType: { name: "NTT" } }, schedule: { _id: "s1", examTerm: "May-June", year: 2025, session: "2024-25" } };
  const expected = [{ type: "Theory", code: "I", name: "T1", maxMarks: 100 }, { type: "Practical", code: "I", name: "P1", maxMarks: 100 }];
  fixtures["ResultPublish.find"] = () => chain([publish]);
  fixtures["ExamForm.find"] = () => chain([form]);
  fixtures["Subject.find"] = () => chain(expected);
  fixtures["Mark.findOne"] = () => chain({ subjectMarks: [sm("Theory", "I", "T1", 100, 80), sm("Practical", "I", "P1", 100, 70)] });
  delete process.env.RESULT_REQUIRE_DOB;

  pcheck("status needs no login", (await call("GET", "/public/result-status", "")).status === 200);
  pcheck("a published result inside its dates is open", (await call("GET", "/public/result-status", "")).body.open?.length === 1);
  const good = await lookup("24251234");
  pcheck("roll number + correct captcha returns the result", good.status === 200 && good.body.statements?.[0]?.result?.total?.obtained === 150 && good.body.statements[0].result.theory.division === "I", JSON.stringify(good.body).slice(0, 80));
  pcheck("result shows no date of birth or center", !JSON.stringify(good.body).includes("dob") && !JSON.stringify(good.body).includes("center"));
  const wrongCaptcha = await call("POST", "/public/result", "", JSON.stringify({ rollNo: "24251234", captchaToken: (await freshCaptcha()).token, captchaAnswer: "000000" }));
  pcheck("wrong captcha is refused and asks for a new picture", wrongCaptcha.status === 400 && wrongCaptcha.body.refreshCaptcha === true);
  const reuse = await freshCaptcha();
  await call("POST", "/public/result", "", JSON.stringify({ rollNo: "24251234", captchaToken: reuse.token, captchaAnswer: reuse.code }));
  pcheck("a captcha picture works only once", (await call("POST", "/public/result", "", JSON.stringify({ rollNo: "24251234", captchaToken: reuse.token, captchaAnswer: reuse.code }))).status === 400);
  pcheck("a roll number that is not digits is refused", (await lookup("12ab")).status === 400);

  fixtures["Mark.findOne"] = () => chain({ subjectMarks: [sm("Theory", "I", "T1", 100, 95)] }); // practical paper missing
  const incomplete = await lookup("24251234");
  pcheck("incomplete result is flagged and shows no marks or division", incomplete.status === 200 && incomplete.body.statements[0].result.incomplete === true && !JSON.stringify(incomplete.body).includes("division"), JSON.stringify(incomplete.body.statements?.[0]?.result));

  fixtures["Mark.findOne"] = () => chain({ subjectMarks: [sm("Theory", "I", "T1", 100, 80), sm("Practical", "I", "P1", 100, 70)] });
  process.env.RESULT_REQUIRE_DOB = "true";
  pcheck("with the date-of-birth option on, a missing date is refused", (await lookup("24251234")).status === 400);
  pcheck("with the option on, a wrong date gives the same 'no result' answer", (await lookup("24251234", { dob: "01/01/1999" })).status === 404);
  pcheck("with the option on, the right date returns the result", (await lookup("24251234", { dob: "17/05/2000" })).status === 200);
  delete process.env.RESULT_REQUIRE_DOB;

  fixtures["ExamForm.find"] = () => chain([]);
  const miss = await lookup("24259999");
  pcheck("unknown roll number gets the generic answer", miss.status === 404 && /No result found/.test(miss.body.message));
  fixtures["ResultPublish.find"] = () => chain([{ ...publish, published: true, publishDate: new Date(Date.now() + 5 * day), endDate: new Date(Date.now() + 9 * day) }]);
  pcheck("a result whose date has not come is not available", (await lookup("24251234")).status === 404);
  pcheck("status then announces the date instead", !!(await call("GET", "/public/result-status", "")).body.upcoming);

  let limited = false;
  for (let i = 0; i < 80 && !limited; i++) limited = (await call("POST", "/public/result", "", JSON.stringify({ rollNo: "1" }))).status === 429;
  pcheck("repeated attempts from one address are rate limited", limited);
  wrong += publicWrong; checks += 14;

  console.log(`\n${checks} endpoint checks across 6 levels, ${wrong} wrong`);
  if (server) server.close();
  process.exit(wrong ? 1 : 0);
})();
