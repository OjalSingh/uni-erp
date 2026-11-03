const { Subject } = require("../models/Course");

// The full subject list for each (course, part) in a batch of marks, keyed "courseId|part"
async function expectedMap(items) {
  const keys = [...new Set(items.map((m) => `${String(m.course?._id || m.course)}|${m.part}`))];
  const map = new Map();
  await Promise.all(keys.map(async (k) => { const [course, part] = k.split("|"); map.set(k, await Subject.find({ course, part: Number(part) }).lean()); }));
  return map;
}
const expectedFor = (map, m) => map.get(`${String(m.course?._id || m.course)}|${m.part}`) || [];

module.exports = { expectedMap, expectedFor };
