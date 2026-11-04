// Screens that exist in the application code. Menus can only point at these, so the sidebar can never link to a missing page.
const SCREENS = [
  { key: "students", label: "Student Registration", group: "Admissions" },
  { key: "centers", label: "Center Details", group: "Admissions" },
  { key: "employees", label: "Employee Details", group: "Admissions" },
  { key: "exam-form", label: "Fill Exam Form", group: "Examinations" },
  { key: "marks", label: "Mark Information", group: "Examinations" },
  { key: "admit-cards", label: "Admit Card details", group: "Examinations" },
  { key: "results", label: "Publish Result", group: "Examinations" },
  { key: "certificates", label: "Certificate Printing", group: "Documents" },
  { key: "id-cards", label: "ID Card Printing", group: "Documents" },
  { key: "books", label: "Book Allocated", group: "Resources" },
  { key: "stock", label: "Stock Details", group: "Resources" },
  { key: "misc", label: "Miscellaneous", group: "Resources" },
  { key: "change-password", label: "Change Password", group: "Account" },
];

const MISC_SCREENS = ["Course Type", "Course Details", "Subject Details", "Print Templates", "User Role", "Financial year", "State", "City", "Menu", "Sub Menu"];
const GROUPS = ["Admissions", "Examinations", "Documents", "Resources", "Account"];

// The API only lets a center login use these, so a center role can never be given more in the sidebar than it can use
const CENTER_MENUS = ["students", "centers", "exam-form", "admit-cards", "id-cards", "books", "change-password"];
const ALL_MENUS = SCREENS.map((s) => s.key);

// Turning these off would lock head office out of the screens that fix them
const PROTECTED_MENUS = ["misc", "change-password"];
const PROTECTED_SUBMENUS = ["User Role", "Menu", "Sub Menu"];

module.exports = { SCREENS, MISC_SCREENS, GROUPS, CENTER_MENUS, ALL_MENUS, PROTECTED_MENUS, PROTECTED_SUBMENUS };
