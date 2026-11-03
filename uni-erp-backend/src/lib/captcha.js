// A small picture captcha for the public result page. Stateless apart from remembering which pictures were already used:
// the token holds an expiry, a random nonce and an HMAC of the answer, so the server never stores the answer itself.
const crypto = require("crypto");

const TTL_MS = 5 * 60 * 1000;
const used = new Map(); // nonce -> expiry, so one picture can only be answered once

const secret = () => process.env.JWT_SECRET || "";
const sign = (answer, exp, nonce) => crypto.createHmac("sha256", secret()).update(`captcha.${answer}.${exp}.${nonce}`).digest("base64url");

function render(code) {
  const r = (a, b) => a + Math.random() * (b - a);
  const chars = [...code].map((ch, i) => `<text x="${14 + i * 26}" y="${r(34, 42).toFixed(0)}" font-size="${r(26, 32).toFixed(0)}" font-family="monospace" font-weight="bold" fill="hsl(${(r(200, 260)).toFixed(0)},45%,28%)" transform="rotate(${r(-18, 18).toFixed(0)} ${14 + i * 26} 30)">${ch}</text>`).join("");
  const lines = Array.from({ length: 6 }, () => `<line x1="${r(0, 180).toFixed(0)}" y1="${r(0, 56).toFixed(0)}" x2="${r(0, 180).toFixed(0)}" y2="${r(0, 56).toFixed(0)}" stroke="hsl(${r(0, 360).toFixed(0)},30%,60%)" stroke-width="1.2"/>`).join("");
  const dots = Array.from({ length: 40 }, () => `<circle cx="${r(0, 180).toFixed(0)}" cy="${r(0, 56).toFixed(0)}" r="${r(0.6, 1.4).toFixed(1)}" fill="#8a94a6"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="56" viewBox="0 0 180 56" role="img" aria-label="Number to type"><rect width="180" height="56" fill="#eef1f6"/>${dots}${lines}${chars}</svg>`;
}

function create() {
  const code = String(crypto.randomInt(100000, 1000000));
  const exp = Date.now() + TTL_MS;
  const nonce = crypto.randomBytes(8).toString("hex");
  return { token: `${exp}.${nonce}.${sign(code, exp, nonce)}`, svg: render(code) };
}

function verify(token, answer) {
  const [exp, nonce, sig] = String(token || "").split(".");
  const clean = String(answer || "").replace(/\s+/g, "");
  if (!exp || !nonce || !sig || !/^\d{6}$/.test(clean) || Number(exp) < Date.now() || used.has(nonce)) return false;
  const expected = Buffer.from(sign(clean, exp, nonce));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  used.set(nonce, Number(exp));
  for (const [n, e] of used) if (e < Date.now()) used.delete(n); // forget expired pictures
  return true;
}

module.exports = { create, verify };
