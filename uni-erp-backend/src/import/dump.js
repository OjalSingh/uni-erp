// Reads a mysqldump file without needing MySQL: returns { table: [ {column: value, ...}, ... ] }
const fs = require("fs");

const ESCAPES = { n: "\n", r: "\r", t: "\t", "0": "\0", b: "\b", Z: "\x1a" };

function parseSchema(sql) {
  const tables = {};
  const re = /CREATE TABLE `(\w+)` \(\r?\n([\s\S]*?)\r?\n\) ENGINE/g;
  let m;
  while ((m = re.exec(sql))) {
    tables[m[1]] = m[2].split(/\r?\n/).map((l) => /^\s{2}`(\w+)`/.exec(l)?.[1]).filter(Boolean);
  }
  return tables;
}

// Parses one "( v, v, ... )" tuple starting at sql[i] === "(". Returns [values, indexAfterTuple].
function parseTuple(sql, i) {
  const values = [];
  i++; // skip "("
  for (;;) {
    const c = sql[i];
    if (c === "'") {
      let out = "";
      i++;
      for (;;) {
        const ch = sql[i];
        if (ch === "\\") {
          const nx = sql[i + 1];
          out += ESCAPES[nx] ?? nx; // \' \" \\ and unknown escapes keep the character
          i += 2;
        } else if (ch === "'") {
          if (sql[i + 1] === "'") { out += "'"; i += 2; } else { i++; break; }
        } else { out += ch; i++; }
      }
      values.push(out);
    } else {
      let j = i;
      while (sql[j] !== "," && sql[j] !== ")") j++;
      const tok = sql.slice(i, j);
      values.push(tok === "NULL" ? null : /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(tok) ? Number(tok) : tok);
      i = j;
    }
    if (sql[i] === ",") { i++; continue; }
    if (sql[i] === ")") return [values, i + 1];
    throw new Error(`Unexpected character ${JSON.stringify(sql[i])} at ${i}`);
  }
}

function parseDump(file) {
  const sql = fs.readFileSync(file, "utf8");
  const schema = parseSchema(sql);
  const data = Object.fromEntries(Object.keys(schema).map((t) => [t, []]));
  const re = /^INSERT INTO `(\w+)` (?:\(([^)]*)\) )?VALUES /gm;
  let m;
  while ((m = re.exec(sql))) {
    const table = m[1];
    const cols = m[2] ? m[2].split(",").map((c) => c.trim().replace(/`/g, "")) : schema[table];
    if (!cols) continue;
    let i = re.lastIndex;
    for (;;) {
      const [vals, next] = parseTuple(sql, i);
      if (vals.length !== cols.length) throw new Error(`Column count mismatch in ${table}: ${vals.length} values for ${cols.length} columns`);
      const row = {};
      cols.forEach((c, k) => (row[c] = vals[k]));
      (data[table] ||= []).push(row);
      i = next;
      if (sql[i] === ",") { i++; continue; }
      break; // ";"
    }
    re.lastIndex = i;
  }
  return { schema, data };
}

module.exports = { parseDump };
