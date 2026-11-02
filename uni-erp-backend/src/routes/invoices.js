const express = require("express");
const Invoice = require("../models/Invoice");
const { Item } = require("../models/Inventory");
const Center = require("../models/Center");
const { requireAuth, requireRole } = require("../middleware/auth");
const { guarded, nextNumber } = require("../lib/util");
const { totalsByItem } = require("./stock");

const router = express.Router();
router.use(requireAuth);

const round2 = (n) => Math.round(n * 100) / 100;
// Centers only ever see their own invoices
const scope = (req) => (req.user.role === "center" ? { center: req.user.center } : {});

router.get("/", async (req, res) => {
  const rows = await Invoice.find(scope(req)).sort({ invoiceNo: -1 }).populate("center", "code name email mobile");
  res.json(rows);
});

// Per-center totals for the Report button
router.get("/report", requireRole("admin"), async (_req, res) => {
  const rows = await Invoice.find().populate("center", "code name");
  const byCenter = new Map();
  for (const inv of rows) {
    const key = String(inv.center._id);
    const cur = byCenter.get(key) || { center: inv.center, invoices: 0, invoiced: 0, received: 0, outstanding: 0 };
    cur.invoices += 1;
    cur.invoiced = round2(cur.invoiced + inv.grandTotal);
    cur.received = round2(cur.received + inv.paid);
    cur.outstanding = round2(cur.outstanding + inv.outstanding);
    byCenter.set(key, cur);
  }
  res.json([...byCenter.values()].sort((a, b) => b.outstanding - a.outstanding));
});

router.get("/:id", async (req, res) => {
  const inv = await Invoice.findOne({ _id: req.params.id, ...scope(req) }).populate("center", "code name address email mobile").populate("lines.item", "code name");
  return inv ? res.json(inv) : res.status(404).json({ message: "Invoice not found" });
});

// Totals are always computed here; whatever the browser sends for totals is ignored
router.post("/", requireRole("admin"), (req, res) => {
  const { center, lines = [], gstPercent = 0, discount = 0 } = req.body || {};
  return guarded(res, async () => {
    if (!(await Center.exists({ _id: center, status: "Active" }))) return res.status(400).json({ message: "Choose an active center" });
    if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ message: "Add at least one line" });

    const built = lines.map((l) => ({
      description: String(l.description || "").trim(),
      item: l.item || undefined,
      quantity: Number(l.quantity),
      price: Number(l.price),
    }));
    for (const l of built) {
      if (!l.description) return res.status(400).json({ message: "Each line needs a description" });
      if (!Number.isInteger(l.quantity) || l.quantity < 1) return res.status(400).json({ message: "Quantity must be a whole number, at least 1" });
      if (!(l.price >= 0)) return res.status(400).json({ message: "Price cannot be negative" });
      l.total = round2(l.quantity * l.price);
    }

    // Stock check for lines that draw from an item
    const wanted = new Map();
    for (const l of built.filter((x) => x.item)) wanted.set(String(l.item), (wanted.get(String(l.item)) || 0) + l.quantity);
    if (wanted.size) {
      const totals = await totalsByItem();
      const items = await Item.find({ _id: { $in: [...wanted.keys()] } });
      for (const [id, qty] of wanted) {
        const item = items.find((i) => String(i._id) === id);
        if (!item) return res.status(400).json({ message: "One of the selected items no longer exists" });
        const t = totals.get(id) || { totalQty: 0, totalSold: 0 };
        if (qty > t.totalQty - t.totalSold) return res.status(400).json({ message: `Only ${t.totalQty - t.totalSold} of "${item.name}" in stock` });
      }
    }

    const subTotal = round2(built.reduce((s, l) => s + l.total, 0));
    const gst = Number(gstPercent);
    const disc = Number(discount);
    if (!(gst >= 0 && gst <= 100)) return res.status(400).json({ message: "GST must be between 0 and 100" });
    if (!(disc >= 0)) return res.status(400).json({ message: "Discount cannot be negative" });
    const gstAmount = round2((subTotal * gst) / 100);
    const grandTotal = round2(subTotal + gstAmount - disc);
    if (grandTotal < 0) return res.status(400).json({ message: "Discount cannot be more than the invoice total" });

    const invoiceNo = await nextNumber(Invoice, "invoiceNo");
    res.status(201).json(await Invoice.create({ invoiceNo, center, lines: built, subTotal, gstPercent: gst, gstAmount, discount: disc, grandTotal }));
  }, "Another invoice was created at the same time. Please save again.");
});

router.post("/:id/payments", requireRole("admin"), (req, res) =>
  guarded(res, async () => {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    const amount = round2(Number(req.body?.amount));
    if (!(amount > 0)) return res.status(400).json({ message: "Enter the amount received" });
    if (amount > inv.outstanding) return res.status(400).json({ message: `Only ${inv.outstanding.toFixed(2)} is outstanding on this invoice` });
    inv.payments.push({ amount, mode: req.body?.mode, paidAt: req.body?.paidAt || undefined, reference: req.body?.reference });
    await inv.save();
    res.status(201).json(inv);
  })
);

// An invoice with payments recorded cannot be deleted; deleting one without payments returns its stock automatically
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const inv = await Invoice.findById(req.params.id);
  if (!inv) return res.status(404).json({ message: "Invoice not found" });
  if (inv.payments.length) return res.status(409).json({ message: "Payments have been recorded against this invoice, so it cannot be deleted" });
  await inv.deleteOne();
  res.json({ message: "Invoice deleted" });
});

module.exports = router;
