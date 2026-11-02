const express = require("express");
const mongoose = require("mongoose");
const { Supplier, Item, StockEntry } = require("../models/Inventory");
const Invoice = require("../models/Invoice");
const { requireAuth, requireRole } = require("../middleware/auth");
const { guarded } = require("../lib/util");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

// quantity received and quantity invoiced, per item
async function totalsByItem() {
  const [received, sold] = await Promise.all([
    StockEntry.aggregate([{ $group: { _id: "$item", qty: { $sum: "$quantity" } } }]),
    Invoice.aggregate([{ $unwind: "$lines" }, { $match: { "lines.item": { $ne: null } } }, { $group: { _id: "$lines.item", qty: { $sum: "$lines.quantity" } } }]),
  ]);
  const map = new Map();
  for (const r of received) map.set(String(r._id), { totalQty: r.qty, totalSold: 0 });
  for (const s of sold) {
    const cur = map.get(String(s._id)) || { totalQty: 0, totalSold: 0 };
    cur.totalSold = s.qty;
    map.set(String(s._id), cur);
  }
  return map;
}

// ----- Summary: one row per item -----
router.get("/summary", async (_req, res) => {
  const [items, totals] = await Promise.all([Item.find().sort({ code: 1 }), totalsByItem()]);
  res.json(items.map((i) => ({ ...i.toJSON(), totalQty: totals.get(String(i._id))?.totalQty ?? 0, totalSold: totals.get(String(i._id))?.totalSold ?? 0, available: (totals.get(String(i._id))?.totalQty ?? 0) - (totals.get(String(i._id))?.totalSold ?? 0) })));
});

// ----- Suppliers -----
router.get("/suppliers", async (_req, res) => res.json(await Supplier.find().sort({ businessName: 1 })));

const SUPPLIER = ["name", "businessName", "mobile", "email", "pan", "gst", "address"];
const clean = (body, fields) => Object.fromEntries(fields.filter((f) => body?.[f] !== undefined && body[f] !== "").map((f) => [f, body[f]]));

router.post("/suppliers", (req, res) => guarded(res, async () => res.status(201).json(await Supplier.create(clean(req.body, SUPPLIER)))));

router.put("/suppliers/:id", (req, res) =>
  guarded(res, async () => {
    const s = await Supplier.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Supplier not found" });
    s.set(Object.fromEntries(SUPPLIER.filter((f) => req.body?.[f] !== undefined).map((f) => [f, req.body[f] === "" ? undefined : req.body[f]])));
    await s.save();
    res.json(s);
  })
);

router.delete("/suppliers/:id", async (req, res) => {
  if (await StockEntry.exists({ supplier: req.params.id })) return res.status(409).json({ message: "This supplier has stock entries and cannot be deleted" });
  const s = await Supplier.findByIdAndDelete(req.params.id);
  return s ? res.json({ message: "Supplier deleted" }) : res.status(404).json({ message: "Supplier not found" });
});

// ----- Items -----
router.get("/items", async (_req, res) => res.json(await Item.find().sort({ code: 1 })));

router.post("/items", (req, res) => guarded(res, async () => res.status(201).json(await Item.create(clean(req.body, ["code", "name"]))), "An item with that code already exists"));

router.put("/items/:id", (req, res) =>
  guarded(res, async () => {
    const i = await Item.findByIdAndUpdate(req.params.id, { name: req.body?.name }, { new: true, runValidators: true });
    return i ? res.json(i) : res.status(404).json({ message: "Item not found" });
  })
);

router.delete("/items/:id", async (req, res) => {
  const used = (await StockEntry.exists({ item: req.params.id })) || (await Invoice.exists({ "lines.item": req.params.id }));
  if (used) return res.status(409).json({ message: "This item has stock entries or invoices and cannot be deleted" });
  const i = await Item.findByIdAndDelete(req.params.id);
  return i ? res.json({ message: "Item deleted" }) : res.status(404).json({ message: "Item not found" });
});

// ----- Stock entries (optionally ?item=<id>) -----
router.get("/entries", async (req, res) => {
  const filter = req.query.item ? { item: req.query.item } : {};
  res.json(await StockEntry.find(filter).sort({ receivedAt: -1 }).populate("supplier", "businessName").populate("item", "code name"));
});

const ENTRY = ["supplier", "item", "purchasePrice", "sellPrice", "discountPercent", "quantity", "receivedAt"];

router.post("/entries", (req, res) => guarded(res, async () => res.status(201).json(await StockEntry.create(clean(req.body, ENTRY)))));

router.put("/entries/:id", (req, res) =>
  guarded(res, async () => {
    const e = await StockEntry.findById(req.params.id);
    if (!e) return res.status(404).json({ message: "Stock entry not found" });
    const before = e.quantity;
    e.set(clean(req.body, ENTRY));
    // Lowering a quantity must not drop stock below what has already been invoiced
    if (e.quantity < before) {
      const t = (await totalsByItem()).get(String(e.item)) || { totalQty: 0, totalSold: 0 };
      if (t.totalQty - (before - e.quantity) < t.totalSold) return res.status(400).json({ message: "That would leave less stock than has already been invoiced" });
    }
    await e.save();
    res.json(e);
  })
);

router.delete("/entries/:id", async (req, res) => {
  const e = await StockEntry.findById(req.params.id);
  if (!e) return res.status(404).json({ message: "Stock entry not found" });
  const t = (await totalsByItem()).get(String(e.item)) || { totalQty: 0, totalSold: 0 };
  if (t.totalQty - e.quantity < t.totalSold) return res.status(400).json({ message: "Deleting this would leave less stock than has already been invoiced" });
  await e.deleteOne();
  res.json({ message: "Stock entry deleted" });
});

module.exports = router;
module.exports.totalsByItem = totalsByItem;
