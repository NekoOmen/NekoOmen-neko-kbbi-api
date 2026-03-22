import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT     = path.join(__dirname, "..");
const RAW_DIR  = path.join(ROOT, "_raw");
const DIST_DIR = path.join(ROOT, "dist");

function isGameWord(w) {
  return w.length >= 2 && w.length <= 30 && /^[a-z]+$/.test(w);
}

function buildLanguage(langCode, langName, rawFiles, apiDir) {
  console.log(`\n--- ${langName} (${langCode}) ---\n`);

  const bag = new Set();

  for (const file of rawFiles) {
    const fp = path.join(RAW_DIR, file);
    if (!fs.existsSync(fp)) { console.log(`  [SKIP] ${file} not found`); continue; }
    const lines = fs.readFileSync(fp, "utf8").split(/\r?\n/);
    let added = 0;
    for (const raw of lines) {
      const w = raw.trim().toLowerCase();
      if (w && isGameWord(w) && !bag.has(w)) { bag.add(w); added++; }
    }
    console.log(`  [READ] ${file}  ->  ${lines.length} raw, ${added} new valid`);
  }

  const sorted = [...bag].sort();
  console.log(`  Total: ${sorted.length} valid words`);

  if (sorted.length === 0) {
    console.log(`  No words found for ${langName}, skipping.`);
    return null;
  }

  fs.mkdirSync(path.join(apiDir, "words"), { recursive: true });

  const byLetter = {};
  for (const w of sorted) {
    const ch = w[0];
    (byLetter[ch] ??= []).push(w);
  }

  const stats = { lang: langCode, total: sorted.length, byLetter: {}, lastUpdated: new Date().toISOString() };

  for (const [ch, words] of Object.entries(byLetter).sort()) {
    fs.writeFileSync(
      path.join(apiDir, "words", `${ch}.json`),
      JSON.stringify({ letter: ch, total: words.length, words })
    );
    stats.byLetter[ch] = words.length;
    console.log(`  [SAVE] ${langCode}/words/${ch}.json  (${words.length})`);
  }

  fs.writeFileSync(
    path.join(apiDir, "words", "all.json"),
    JSON.stringify({ total: sorted.length, words: sorted })
  );
  console.log(`  [SAVE] ${langCode}/words/all.json  (${sorted.length})`);

  fs.writeFileSync(
    path.join(apiDir, "stats.json"),
    JSON.stringify(stats, null, 2)
  );
  console.log(`  [SAVE] ${langCode}/stats.json`);

  const shuffled = [...sorted].sort(() => Math.random() - 0.5);
  const randomWords = shuffled.slice(0, 100);
  fs.writeFileSync(
    path.join(apiDir, "random.json"),
    JSON.stringify({ count: randomWords.length, words: randomWords })
  );
  console.log(`  [SAVE] ${langCode}/random.json`);

  return stats;
}

function main() {
  console.log("\n=============================");
  console.log("  NEKO WORD API — Build");
  console.log("=============================");

  const idStats = buildLanguage(
    "id", "Indonesian",
    ["list1.txt", "list2.txt"],
    path.join(DIST_DIR, "api", "id")
  );

  const enStats = buildLanguage(
    "en", "English",
    ["words_alpha.txt"],
    path.join(DIST_DIR, "api", "en")
  );

  const indexHtml = buildIndexHtml(idStats, enStats);
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, "index.html"), indexHtml);
  fs.writeFileSync(path.join(DIST_DIR, "404.html"), indexHtml);
  console.log(`\n  [SAVE] index.html / 404.html`);

  const total = (idStats ? idStats.total : 0) + (enStats ? enStats.total : 0);
  console.log(`\n  Build complete! ${total} total words`);
  console.log(`  ${DIST_DIR}\n`);
}

function buildIndexHtml(idStats, enStats) {
  const idTotal = idStats ? idStats.total.toLocaleString() : "0";
  const enTotal = enStats ? enStats.total.toLocaleString() : "0";
  const updated = new Date().toISOString().split("T")[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neko Word API</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: #0a0a0a; color: #e0e0e0;
    min-height: 100vh; padding: 2rem;
  }
  .container { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 2rem; margin-bottom: 0.3rem; }
  h1 span { color: #ff6b9d; }
  .subtitle { color: #888; margin-bottom: 2rem; font-size: 0.95rem; }
  .stats { background: #161616; border-radius: 12px; padding: 1.2rem; margin-bottom: 1.5rem; border: 1px solid #222; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center; }
  .stat-num { font-size: 1.8rem; font-weight: 700; color: #ff6b9d; }
  .stat-label { font-size: 0.8rem; color: #666; margin-top: 0.2rem; }
  .endpoints { list-style: none; }
  .endpoints li {
    background: #161616; border: 1px solid #222; border-radius: 8px;
    padding: 0.8rem 1rem; margin-bottom: 0.5rem;
    display: flex; align-items: center; gap: 0.8rem;
  }
  .method { background: #1a3a2a; color: #4ade80; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
  .path { color: #ccc; font-family: monospace; font-size: 0.9rem; }
  .desc { color: #666; font-size: 0.8rem; margin-left: auto; }
  a { color: #ff6b9d; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .try { margin-top: 1.5rem; }
  .try input, .try select {
    background: #161616; border: 1px solid #333; color: #fff; padding: 0.7rem 1rem;
    border-radius: 8px; font-size: 1rem;
  }
  .try input { width: 100%; }
  .try select { margin-bottom: 0.5rem; }
  .try-result { margin-top: 0.8rem; background: #161616; border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 0.85rem; min-height: 2.5rem; border: 1px solid #222; white-space: pre-wrap; }
  footer { margin-top: 2rem; text-align: center; color: #444; font-size: 0.8rem; }
</style>
</head>
<body>
<div class="container">
  <h1><span>Neko</span> Word API</h1>
  <p class="subtitle">Word checker for Sambung Kata / Word Chain — by Neko_Omen</p>

  <div class="stats">
    <div class="stats-grid">
      <div><div class="stat-num">${idTotal}</div><div class="stat-label">Indonesian</div></div>
      <div><div class="stat-num">${enTotal}</div><div class="stat-label">English</div></div>
      <div><div class="stat-num">FREE</div><div class="stat-label">Forever</div></div>
    </div>
  </div>

  <h3 style="margin-bottom: 0.8rem; color: #aaa;">Endpoints</h3>
  <ul class="endpoints">
    <li><span class="method">GET</span><span class="path">/api/{id|en}/words/all.json</span><span class="desc">All words</span></li>
    <li><span class="method">GET</span><span class="path">/api/{id|en}/words/{a-z}.json</span><span class="desc">By letter</span></li>
    <li><span class="method">GET</span><span class="path">/api/{id|en}/stats.json</span><span class="desc">Statistics</span></li>
    <li><span class="method">GET</span><span class="path">/api/{id|en}/random.json</span><span class="desc">Random words</span></li>
  </ul>

  <div class="try">
    <select id="langSelect" onchange="resetCheck()">
      <option value="id">Indonesian (KBBI)</option>
      <option value="en">English</option>
    </select>
    <input id="wordInput" type="text" placeholder="Type a word to check..." oninput="checkWord(this.value)">
    <div id="result" class="try-result">Type a word above to check...</div>
  </div>

  <footer>
    Updated: ${updated}
  </footer>
</div>

<script>
let wordCache = {};
function getLang() { return document.getElementById('langSelect').value; }
function resetCheck() { wordCache = {}; document.getElementById('result').textContent = 'Type a word above to check...'; document.getElementById('wordInput').value = ''; }
async function loadLetter(lang, ch) {
  const key = lang + '_' + ch;
  if (wordCache[key]) return wordCache[key];
  try {
    const r = await fetch('./api/' + lang + '/words/' + ch + '.json');
    const d = await r.json();
    wordCache[key] = new Set(d.words);
    return wordCache[key];
  } catch { return new Set(); }
}
let debounce;
async function checkWord(val) {
  clearTimeout(debounce);
  const el = document.getElementById('result');
  const w = val.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (!w || w.length < 2) { el.textContent = 'Type a word above to check...'; return; }
  debounce = setTimeout(async () => {
    el.textContent = 'Checking...';
    const lang = getLang();
    const words = await loadLetter(lang, w[0]);
    const exists = words.has(w);
    const label = lang === 'id' ? 'KBBI' : 'English';
    el.innerHTML = exists
      ? '<span style="color:#4ade80">"' + w + '" valid! (' + label + ')</span>'
      : '<span style="color:#f87171">"' + w + '" not found (' + label + ')</span>';
  }, 200);
}
</script>
</body>
</html>`;
}

main();
