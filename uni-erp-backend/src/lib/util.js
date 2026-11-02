// Small helpers shared by route files

const validationMessage = (e) => Object.values(e.errors).map((x) => x.message).join(". ");

// Run a mongoose write and turn validation / duplicate-key errors into 400 / 409 responses
async function guarded(res, fn, duplicateMessage = "That record already exists") {
  try {
    return await fn();
  } catch (e) {
    if (e.name === "ValidationError") return res.status(400).json({ message: validationMessage(e) });
    if (e.name === "CastError") return res.status(400).json({ message: "Invalid value for " + e.path });
    if (e.code === 11000) return res.status(409).json({ message: duplicateMessage });
    throw e;
  }
}

function paging(query, defaultLimit = 10) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function nextNumber(Model, field) {
  const last = await Model.findOne().sort({ [field]: -1 }).select(field);
  return last ? last[field] + 1 : 1;
}

module.exports = { validationMessage, guarded, paging, escapeRegex, nextNumber };
