// 로컬 미리보기 서버: node scripts/serve.mjs [포트]
// Cloudflare처럼 확장자 없는 주소(/products/acid-waste-bag)를 .html 파일로 연결합니다.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8765;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain" };

async function resolve(urlPath) {
  const base = join(ROOT, decodeURIComponent(urlPath));
  if (!base.startsWith(ROOT)) return null;
  for (const candidate of [base, base + ".html", join(base, "index.html")]) {
    try { if ((await stat(candidate)).isFile()) return candidate; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(new URL(req.url, "http://x").pathname);
  if (!file) { res.writeHead(404, { "content-type": TYPES[".html"] }); res.end(await readFile(join(ROOT, "404.html"))); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(await readFile(file));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
