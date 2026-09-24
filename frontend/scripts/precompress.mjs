// Komprimiert die Textdateien in dist/ einmalig beim Docker-Build zu .br und
// .gz (siehe Dockerfile). app/main.py liefert diese Varianten je nach
// Accept-Encoding aus - der Container muss so pro Request nichts mehr
// komprimieren (1 vCPU, das ~1,4 MB große JS-Bundle wäre sonst der Engpass).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const DIST = new URL("../dist", import.meta.url).pathname;
const EXTENSIONS = new Set([".js", ".css", ".html", ".svg", ".json", ".webmanifest", ".txt", ".xml"]);
const MIN_BYTES = 1024;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

let files = 0;
let before = 0;
let after = 0;
for (const path of walk(DIST)) {
  if (!EXTENSIONS.has(extname(path)) || statSync(path).size < MIN_BYTES) continue;
  const data = readFileSync(path);
  const br = brotliCompressSync(data, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length },
  });
  const gz = gzipSync(data, { level: 9 });
  if (br.length < data.length) writeFileSync(`${path}.br`, br);
  if (gz.length < data.length) writeFileSync(`${path}.gz`, gz);
  files += 1;
  before += data.length;
  after += Math.min(br.length, gz.length);
}
console.log(`precompress: ${files} Dateien, ${(before / 1024).toFixed(0)} KiB -> ${(after / 1024).toFixed(0)} KiB`);
