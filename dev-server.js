const http = require("http");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");

const ROOT = __dirname;
const PORT = 3456;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const rel = decoded === "/" ? "/index.html" : decoded;
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const filePath = safePath(req.url);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    const range = req.headers.range;

    if (range && /^bytes=/.test(range)) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      let start = parseInt(startStr, 10);
      let end = endStr ? parseInt(endStr, 10) : Math.min(start + 1024 * 1024 - 1, stat.size - 1);
      if (Number.isNaN(start) || start < 0) start = 0;
      if (Number.isNaN(end) || end >= stat.size) end = stat.size - 1;
      if (start > end) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
      });

      const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 64 * 1024 });
      pipeline(stream, res, () => {});
      return;
    }

    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": ext === ".mp4" ? "public, max-age=3600" : "no-cache",
    });
    const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    pipeline(stream, res, () => {});
  });
});

server.listen(PORT, () => {
  console.log(`Serving http://localhost:${PORT}`);
});
