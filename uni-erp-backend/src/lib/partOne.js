const Mark = require("../models/Mark");
const PartOneMark = require("../models/PartOneMark");
const { summarise } = require("./result");
const { expectedMap, expectedFor } = require("./subjects");

// Part 1 totals for students on multi-part courses: the old system's summary rows first, otherwise their Part 1 subject marks
async function loadPartOne(studentIds) {
  const map = new Map();
  if (!studentIds.length) return map;
  for (const p of await PartOneMark.find({ student: { $in: studentIds } }).sort({ createdAt: 1 })) {
    map.set(String(p.student), { total: p.totalMarks, obtained: p.obtainedMarks, source: "summary" });
  }
  const firsts = await Mark.find({ student: { $in: studentIds }, part: 1 });
  const exp = await expectedMap(firsts);
  for (const m of firsts) {
    const r = summarise(m.subjectMarks, expectedFor(exp, m));
    if (r.total.max > 0 && !map.has(String(m.student))) map.set(String(m.student), { total: r.total.max, obtained: r.total.obtained, source: "marks" });
  }
  return map;
}

module.exports = { loadPartOne };
