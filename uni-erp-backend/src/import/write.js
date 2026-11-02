// Writes transformed documents through a minimal collection interface (a native MongoDB Db, or the fake one in selftest.js).
const crypto = require("crypto");

// Collections where every document comes from the old system. Anything else in them means someone entered data in the app.
const TRANSACTIONAL = ["student", "examSchedule", "examForm", "mark", "partOneMark", "resultPublish", "supplier", "stockEntry", "invoice"];
const INSERT_ORDER_REVERSED = [...TRANSACTIONAL].reverse();

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no look-alike characters
const randomPassword = (len = 12) => Array.from({ length: len }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

// Remove undefined values (the driver would otherwise store them as null) without touching dates or ids
function strip(v) {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, strip(x)]));
  }
  return v;
}

async function writeAll(result, { db, names, newId, hash, replace = false, log = () => {} }) {
  const col = (key) => db.col(names[key]);
  const ids = {};
  const stats = {};
  const credentials = [];
  const warnings = [];
  const now = new Date();
  const defs = result.collections;

  // ----- Safety checks before anything is written -----
  if (replace) {
    for (const key of INSERT_ORDER_REVERSED) {
      const r = await col(key).deleteMany({ legacyId: { $exists: true } });
      log(`  cleared ${r.deletedCount} previously imported ${key} records`);
    }
  }
  for (const key of TRANSACTIONAL) {
    const foreign = await col(key).countDocuments({ legacyId: { $exists: false } });
    if (foreign > 0) throw new Error(`The ${names[key]} collection already has ${foreign} records that were entered in the app. Clear them first, or import into an empty database.`);
    const imported = await col(key).countDocuments({ legacyId: { $exists: true } });
    if (imported > 0) throw new Error(`The ${names[key]} collection already holds imported records. Run again with --replace to import again.`);
  }
  const roles = {};
  for (const key of ["admin", "center"]) {
    const r = await db.col(names.role).findOne({ key });
    if (!r) throw new Error(`The "${key}" role is missing. Run "npm run seed" once, then import.`);
    roles[key] = r;
  }

  const refId = (target, legacy) => ids[target]?.get(legacy);

  for (const def of defs) {
    const c = col(def.key);
    ids[def.key] = new Map();
    let written = 0, failed = 0;
    const prepared = [];

    for (const raw of def.docs) {
      const d = { ...raw };
      for (const [field, target] of Object.entries(def.refs || {})) {
        if (d[field] == null) continue;
        const id = refId(target, d[field]);
        if (id === undefined) { warnings.push(`${def.key}: a ${field} reference could not be matched and was left blank`); delete d[field]; } else d[field] = id;
      }
      if (def.invoiceLines) d.lines = d.lines.map((l) => ({ ...l, item: refId("item", l.item) }));
      if (def.isUser) {
        d.roleRef = roles[d.roleKey]._id;
        delete d.roleKey;
      }
      if (def.noLegacyId) delete d.legacyId;
      const createdAt = d.createdAt || now;
      delete d.createdAt;
      prepared.push({ doc: d, createdAt });
    }

    if (def.upsert) {
      for (const { doc, createdAt } of prepared) {
        const filter = Object.fromEntries(def.upsert.map((k) => [k, doc[k]]));
        const legacy = doc.legacyId;
        let existing = await c.findOne(filter, { projection: { _id: 1 } });
        const update = { $set: strip({ ...doc, updatedAt: now }) };
        if (def.isUser) {
          if (!existing) {
            const password = randomPassword();
            update.$set.password = await hash(password);
            credentials.push({ username: doc.username, password });
          }
        }
        update.$setOnInsert = { createdAt };
        await c.updateOne(filter, update, { upsert: true });
        if (!existing) existing = await c.findOne(filter, { projection: { _id: 1 } });
        if (legacy !== undefined) ids[def.key].set(legacy, existing._id);
        written++;
      }
    } else {
      const rows = prepared.map(({ doc, createdAt }) => {
        const _id = newId();
        if (doc.legacyId !== undefined) ids[def.key].set(doc.legacyId, _id);
        return strip({ _id, ...doc, createdAt, updatedAt: now });
      });
      for (let i = 0; i < rows.length; i += 1000) {
        const batch = rows.slice(i, i + 1000);
        try {
          const r = await c.insertMany(batch, { ordered: false });
          written += r.insertedCount ?? batch.length;
        } catch (e) {
          const errs = e.writeErrors || [];
          written += e.result?.insertedCount ?? e.insertedCount ?? batch.length - errs.length;
          failed += errs.length || batch.length;
          warnings.push(`${def.key}: ${errs.length || batch.length} records were rejected (${(errs[0]?.errmsg || e.message || "").slice(0, 160)})`);
          // keep ids only for what was really stored, so later references to rejected rows are dropped
          for (const f of errs) { const rej = batch[f.index]; if (rej?.legacyId !== undefined) ids[def.key].delete(rej.legacyId); }
        }
      }
    }
    stats[def.key] = { written, failed };
    log(`  ${def.key}: ${written} written${failed ? `, ${failed} rejected` : ""}`);
  }
  return { stats, credentials, warnings };
}

module.exports = { writeAll, randomPassword, TRANSACTIONAL };
