const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// "admin" = head office; "center" = a study centre's own login (scoped to its center)
const ROLES = ["admin", "center"];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"] },
    mobile: { type: String, trim: true, match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits and start with 6, 7, 8 or 9"] },
    role: { type: String, enum: ROLES, required: true },
    // Which configurable role (Miscellaneous > User Role) the user holds; "role" above is that role's base role
    roleRef: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    center: { type: mongoose.Schema.Types.ObjectId, ref: "Center" },
    password: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
module.exports.ROLES = ROLES;
