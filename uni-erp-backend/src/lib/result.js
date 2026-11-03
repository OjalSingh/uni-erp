// How marks turn into a result. The thresholds come from the printed stationery:
// I Div. 60% & above, II Div. 45% & above, III Div. 33% & above.
const DIVISIONS = [[60, "I"], [45, "II"], [33, "III"]];
const PASS_MARK = 33;

const divisionFor = (percent) => (DIVISIONS.find(([min]) => percent >= min)?.[1]) || "Fail";
const round2 = (n) => Math.round(n * 100) / 100;
const sum = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

// Papers are identified by kind and paper number (e.g. Theory II), falling back to the name
const paperKey = (s) => `${s.type}|${s.code || s.subject || s.name}`;

// Totals and divisions for the marks entered. When the course's subject list is known (`expected`), the maximum always comes from
// that full list and a paper with no marks counts as zero and makes the result incomplete, so a missing paper can never raise a percentage.
function summarise(subjectMarks = [], expected = null) {
  let rows = subjectMarks;
  let missing = 0;
  if (expected && expected.length) {
    const have = new Map(subjectMarks.map((s) => [paperKey(s), s]));
    rows = expected.map((e) => {
      const hit = have.get(paperKey(e));
      if (!hit) missing++;
      return { type: e.type, maxMarks: e.maxMarks, marks: hit ? hit.marks : 0 };
    });
  }
  const block = (list) => {
    const max = sum(list, "maxMarks");
    const obtained = sum(list, "marks");
    const percent = max > 0 ? (obtained / max) * 100 : null;
    return { max, obtained, percent: percent === null ? null : round2(percent), division: percent === null ? null : divisionFor(percent) };
  };
  const theory = block(rows.filter((s) => s.type === "Theory"));
  const practical = block(rows.filter((s) => s.type === "Practical"));
  const total = block(rows);
  // Qualified when the result is complete and every kind of paper the course has reaches the pass mark
  const kinds = [theory, practical].filter((b) => b.max > 0);
  const incomplete = missing > 0;
  const qualified = !incomplete && kinds.length > 0 && kinds.every((b) => b.percent >= PASS_MARK);
  return { theory, practical, total, qualified, incomplete, missingPapers: missing };
}

// For courses with more than one part: the final result adds the earlier part's total.
// Only the totals of an earlier part may be known, so a theory/practical split is not claimed for the combined figure.
function combine(current, earlier) {
  if (!earlier) return null;
  const max = current.total.max + earlier.total;
  const obtained = current.total.obtained + earlier.obtained;
  const percent = max > 0 ? (obtained / max) * 100 : null;
  return { max, obtained, percent: percent === null ? null : round2(percent), division: percent === null ? null : divisionFor(percent) };
}

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
// Papers are numbered I, II, III...; sort them in that order, not alphabetically
const paperOrder = (a, b) => (ROMAN[a] || 99) - (ROMAN[b] || 99) || String(a).localeCompare(String(b));

module.exports = { DIVISIONS, PASS_MARK, divisionFor, summarise, combine, paperOrder, round2 };
