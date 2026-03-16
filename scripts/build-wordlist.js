/**
 *  build-wordlist.js
 *  Reads downloaded KBBI raw word lists from _raw/
 *  Outputs static JSON API files into dist/
 *
 *  Runs inside GitHub Actions — no user interaction needed.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT     = path.join(__dirname, "..");
const RAW_DIR  = path.join(ROOT, "_raw");
const DIST_DIR = path.join(ROOT, "dist");
const API_DIR  = path.join(DIST_DIR, "api");

function isGameWord(w) {
  return w.length >= 2 && w.length <= 30 && /^[a-z]+$/.test(w);
}

function main() {
  console.log("\n=============================");
  console.log("  NEKO KBBI — Build Static API");
  console.log("=============================\n");

  // ─── Read raw files ───
  const bag = new Set();
  const rawFiles = ["list1.txt", "list2.txt"];

  for (const file of rawFiles) {
    const fp = path.join(RAW_DIR, file);
    if (!fs.existsSync(fp)) { console.log(`  [SKIP] ${file} not found`); continue; }
    const lines = fs.readFileSync(fp, "utf8").split(/\r?\n/);
    let added = 0;
    for (const raw of lines) {
      const w = raw.trim().toLowerCase();
      if (w && isGameWord(w) && !bag.has(w)) { bag.add(w); added++; }
    }
    console.log(`  [READ] ${file}  →  ${lines.length} raw, ${added} new valid`);
  }

  const sorted = [...bag].sort();
  console.log(`\n  Total: ${sorted.length} valid words\n`);

  if (sorted.length === 0) {
    console.error("  ❌ No words found! Check _raw/ files.");
    process.exit(1);
  }

  // ─── Create dist structure ───
  //   dist/
  //     index.html
  //     api/
  //       check/{word}.json          ← not practical for 110K, use words/{letter}.json instead
  //       words/all.json             ← full word array
  //       words/{a..z}.json          ← words by letter
  //       stats.json                 ← counts
  //       random.json                ← 100 random words (refreshed on build)

  fs.mkdirSync(path.join(API_DIR, "words"), { recursive: true });

  // ─── Group by letter ───
  const byLetter = {};
  for (const w of sorted) {
    const ch = w[0];
    (byLetter[ch] ??= []).push(w);
  }

  // ─── words/{letter}.json ───
  const stats = { total: sorted.length, byLetter: {}, lastUpdated: new Date().toISOString() };

  for (const [ch, words] of Object.entries(byLetter).sort()) {
    fs.writeFileSync(
      path.join(API_DIR, "words", `${ch}.json`),
      JSON.stringify({ letter: ch, total: words.length, words })
    );
    stats.byLetter[ch] = words.length;
    console.log(`  [SAVE] api/words/${ch}.json  (${words.length})`);
  }

  // ─── words/all.json ───
  fs.writeFileSync(
    path.join(API_DIR, "words", "all.json"),
    JSON.stringify({ total: sorted.length, words: sorted })
  );
  console.log(`  [SAVE] api/words/all.json  (${sorted.length})`);

  // ─── stats.json ───
  fs.writeFileSync(
    path.join(API_DIR, "stats.json"),
    JSON.stringify(stats, null, 2)
  );
  console.log(`  [SAVE] api/stats.json`);

  // ─── random.json (100 random words) ───
  const shuffled = [...sorted].sort(() => Math.random() - 0.5);
  const randomWords = shuffled.slice(0, 100);
  fs.writeFileSync(
    path.join(API_DIR, "random.json"),
    JSON.stringify({ count: randomWords.length, words: randomWords })
  );
  console.log(`  [SAVE] api/random.json`);

  // ─── index.html (landing page) ───
  const indexHtml = buildIndexHtml(stats);
  fs.writeFileSync(path.join(DIST_DIR, "index.html"), indexHtml);
  console.log(`  [SAVE] index.html`);

  // ─── 404.html (for SPA-like routing) ───
  fs.writeFileSync(path.join(DIST_DIR, "404.html"), indexHtml);
  console.log(`  [SAVE] 404.html`);

  console.log(`\n  ✅ Build complete! ${sorted.length} words`);
  console.log(`  📂 ${DIST_DIR}\n`);
}

function buildIndexHtml(stats) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neko KBBI API</title>
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
  .try input {
    background: #161616; border: 1px solid #333; color: #fff; padding: 0.7rem 1rem;
    border-radius: 8px; font-size: 1rem; width: 100%;
  }
  .try-result { margin-top: 0.8rem; background: #161616; border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 0.85rem; min-height: 2.5rem; border: 1px solid #222; white-space: pre-wrap; }
  footer { margin-top: 2rem; text-align: center; color: #444; font-size: 0.8rem; }
</style>
</head>
<body>
<div class="container">
  <h1>🐱 <span>Neko</span> KBBI API</h1>
  <p class="subtitle">KBBI word checker for Sambung Kata game — by Neko_Omen</p>

  <div class="stats">
    <div class="stats-grid">
      <div><div class="stat-num">${stats.total.toLocaleString()}</div><div class="stat-label">Total Words</div></div>
      <div><div class="stat-num">${Object.keys(stats.byLetter).length}</div><div class="stat-label">Letters</div></div>
      <div><div class="stat-num">FREE</div><div class="stat-label">Forever</div></div>
    </div>
  </div>

  <h3 style="margin-bottom: 0.8rem; color: #aaa;">Endpoints</h3>
  <ul class="endpoints">
    <li><span class="method">GET</span><span class="path">/api/words/all.json</span><span class="desc">All words</span></li>
    <li><span class="method">GET</span><span class="path">/api/words/{a-z}.json</span><span class="desc">By letter</span></li>
    <li><span class="method">GET</span><span class="path">/api/stats.json</span><span class="desc">Statistics</span></li>
    <li><span class="method">GET</span><span class="path">/api/random.json</span><span class="desc">Random words</span></li>
  </ul>

  <div class="try">
    <input id="wordInput" type="text" placeholder="Type a word to check..." oninput="checkWord(this.value)">
    <div id="result" class="try-result">Type a word above to check if it's in KBBI...</div>
  </div>

  <footer>
    Data source: <a href="https://github.com/damzaky/kumpulan-kata-bahasa-indonesia-KBBI">KBBI Word List</a>
    &nbsp;•&nbsp; Updated: ${stats.lastUpdated.split("T")[0]}
  </footer>
</div>

<script>
let wordCache = {};
async function loadLetter(ch) {
  if (wordCache[ch]) return wordCache[ch];
  try {
    const r = await fetch('./api/words/' + ch + '.json');
    const d = await r.json();
    wordCache[ch] = new Set(d.words);
    return wordCache[ch];
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
    const words = await loadLetter(w[0]);
    const exists = words.has(w);
    el.innerHTML = exists
      ? '<span style="color:#4ade80">✅ "' + w + '" — ada di KBBI!</span>'
      : '<span style="color:#f87171">❌ "' + w + '" — tidak ditemukan</span>';
  }, 200);
}
</script>
</body>
</html>`;
}

main();
