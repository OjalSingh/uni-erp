const mongoose = require("mongoose");
const { ALL_MENUS, GROUPS, MISC_SCREENS } = require("../lib/screens");

const stateSchema = new mongoose.Schema(
  { name: { type: String, required: [true, "State name is required"], unique: true, trim: true }, active: { type: Boolean, default: true } },
  { timestamps: true }
);

const citySchema = new mongoose.Schema(
  {
    state: { type: mongoose.Schema.Types.ObjectId, ref: "State", required: [true, "Choose a state"] },
    name: { type: String, required: [true, "City name is required"], trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
citySchema.index({ state: 1, name: 1 }, { unique: true });

// "2025-26" style labels, used as the session list across the app
const financialYearSchema = new mongoose.Schema(
  {
    label: { type: String, required: [true, "Label is required"], unique: true, trim: true, match: [/^\d{4}-\d{2}$/, "Label must look like 2026-27"] },
    startDate: { type: Date },
    endDate: { type: Date },
    current: { type: Boolean, default: false },
  },
  { timestamps: true }
);
financialYearSchema.pre("validate", function () {
  if (this.label && /^\d{4}-\d{2}$/.test(this.label)) {
    const start = Number(this.label.slice(0, 4));
    if ((start + 1) % 100 !== Number(this.label.slice(5))) this.invalidate("label", "The second year must follow the first, for example 2026-27");
  }
  if (this.startDate && this.endDate && this.endDate <= this.startDate) this.invalidate("endDate", "End date must be after the start date");
});

const menuSchema = new mongoose.Schema(
  {
    key: { type: String, required: [true, "Choose a screen"], unique: true, enum: { values: ALL_MENUS, message: "That screen does not exist" } },
    label: { type: String, required: [true, "Label is required"], trim: true },
    group: { type: String, required: true, enum: { values: GROUPS, message: "Choose a valid group" } },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    system: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const subMenuSchema = new mongoose.Schema(
  {
    menu: { type: mongoose.Schema.Types.ObjectId, ref: "Menu", required: [true, "Choose a menu"] },
    label: { type: String, required: [true, "Choose a screen"], enum: { values: MISC_SCREENS, message: "That screen does not exist" } },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    system: { type: Boolean, default: false },
  },
  { timestamps: true }
);
subMenuSchema.index({ menu: 1, label: 1 }, { unique: true });

// baseRole decides what the API allows (admin = everything, center = own center only).
// menus decides what shows up in the sidebar and dashboard.
const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: [true, "Role key is required"], unique: true, trim: true, lowercase: true, match: [/^[a-z][a-z0-9-]{1,30}$/, "Key must be lowercase letters, digits or hyphens"] },
    name: { type: String, required: [true, "Role name is required"], trim: true },
    baseRole: { type: String, enum: ["admin", "center"], required: true },
    menus: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    system: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = {
  State: mongoose.model("State", stateSchema),
  City: mongoose.model("City", citySchema),
  FinancialYear: mongoose.model("FinancialYear", financialYearSchema),
  Menu: mongoose.model("Menu", menuSchema),
  SubMenu: mongoose.model("SubMenu", subMenuSchema),
  Role: mongoose.model("Role", roleSchema),
};
