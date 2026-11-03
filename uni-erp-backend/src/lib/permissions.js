// Everything a role can be allowed to do. The server checks these on every request;
// the sidebar and buttons only mirror them.
// scopes: "all" = head-office style roles (all centers), "center" = roles limited to their own center.
// Anything that reaches across centers is "all" only, so a center role can never be given it.
const A = ["all"];
const AC = ["all", "center"];

const PERMISSIONS = [
  { key: "students:view", label: "View students", group: "Students", scopes: AC },
  { key: "students:create", label: "Register students", group: "Students", scopes: AC },
  { key: "students:edit", label: "Edit students", group: "Students", scopes: AC },
  { key: "students:deactivate", label: "Deactivate students", group: "Students", scopes: AC },

  { key: "centers:view", label: "View centers", group: "Centers", scopes: AC },
  { key: "centers:manage", label: "Add, edit and deactivate centers", group: "Centers", scopes: A },

  { key: "exams:view", label: "View exam schedules and forms", group: "Examinations", scopes: AC },
  { key: "exams:create", label: "Fill, change and remove exam forms", group: "Examinations", scopes: AC },
  { key: "exams:review", label: "Accept or deny exam forms", group: "Examinations", scopes: A },
  { key: "exams:schedule", label: "Create and edit exam schedules", group: "Examinations", scopes: A },
  { key: "marks:view", label: "View marks", group: "Examinations", scopes: A },
  { key: "marks:edit", label: "Enter and change marks", group: "Examinations", scopes: A },
  { key: "results:view", label: "View published results", group: "Examinations", scopes: A },
  { key: "results:manage", label: "Publish and unpublish results", group: "Examinations", scopes: A },

  { key: "admitcards:print", label: "Print admit cards", group: "Documents", scopes: AC },
  { key: "idcards:print", label: "Print ID cards", group: "Documents", scopes: AC },
  { key: "certificates:print", label: "Print certificates", group: "Documents", scopes: A },

  { key: "invoices:view", label: "View invoices", group: "Books and stock", scopes: AC },
  { key: "invoices:manage", label: "Create invoices and receive payments", group: "Books and stock", scopes: A },
  { key: "stock:view", label: "View stock", group: "Books and stock", scopes: A },
  { key: "stock:manage", label: "Change stock, items and suppliers", group: "Books and stock", scopes: A },

  { key: "employees:manage", label: "Manage users", group: "Administration", scopes: A },
  { key: "settings:manage", label: "Change settings (courses, states, menus, roles)", group: "Administration", scopes: A },
];

const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key);
const forScope = (scope) => PERMISSIONS.filter((p) => p.scopes.includes(scope)).map((p) => p.key);

// Which permission shows a menu in the sidebar (Change Password is always available)
const MENU_PERMISSION = {
  students: "students:view", centers: "centers:view", employees: "employees:manage", "exam-form": "exams:view", marks: "marks:view",
  "admit-cards": "admitcards:print", results: "results:view", certificates: "certificates:print", "id-cards": "idcards:print",
  books: "invoices:view", stock: "stock:view", misc: "settings:manage", "change-password": null,
};

const without = (list, ...drop) => list.filter((p) => !drop.includes(p));

// The six levels. "admin" and "center" keep their old keys because imported users already hold them.
const ROLE_DEFAULTS = [
  { key: "admin", name: "Super Admin", baseRole: "admin", system: true, permissions: ALL_PERMISSIONS },
  { key: "head-admin", name: "Admin", baseRole: "admin", permissions: without(ALL_PERMISSIONS, "employees:manage", "settings:manage") },
  {
    key: "staff", name: "Normal User", baseRole: "admin",
    permissions: ["students:view", "students:create", "students:edit", "centers:view", "exams:view", "exams:create", "exams:review", "admitcards:print", "idcards:print", "marks:view", "results:view"],
  },
  { key: "guest", name: "Guest User", baseRole: "admin", permissions: ["students:view", "centers:view", "exams:view", "marks:view", "results:view"] },
  {
    key: "center", name: "Center Admin", baseRole: "center", system: true,
    permissions: ["students:view", "students:create", "students:edit", "students:deactivate", "centers:view", "exams:view", "exams:create", "admitcards:print", "idcards:print", "invoices:view"],
  },
  {
    key: "center-staff", name: "Center Staff", baseRole: "center",
    permissions: ["students:view", "students:create", "students:edit", "exams:view", "exams:create", "admitcards:print", "idcards:print"],
  },
];

// Scope is stored on users as "admin" (all centers) or "center" (own center only); roles use the same two words
const SCOPE_OF = (baseRole) => (baseRole === "center" ? "center" : "all");

module.exports = { PERMISSIONS, ALL_PERMISSIONS, forScope, MENU_PERMISSION, ROLE_DEFAULTS, SCOPE_OF };

// A role's permissions as they apply right now: its own list, or the built-in default if it has none yet
module.exports.effectivePermissions = (role) => role.permissions ?? ROLE_DEFAULTS.find((r) => r.key === role.key)?.permissions ?? [];
