import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL(".", import.meta.url));
let portNum = Number(process.env.PORT) || 5173;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  if (req.method === "OPTIONS" && urlPath === "/api/feedback") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && urlPath === "/api/feedback") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      res.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ success: false, message: "Invalid JSON" }));
      return;
    }
    const interview = String(body.interview_chance ?? "").trim();
    const company = String(body.visitor_company ?? "").trim();
    if (!interview || !company) {
      res.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ success: false, message: "两项均需填写" }));
      return;
    }
    console.log("[preview /api/feedback]", { interview_chance: interview, visitor_company: company });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  let filePath = urlPath === "/" ? "/index.html" : urlPath;
  if (filePath.startsWith("/public/")) {
    filePath = filePath.replace("/public/", "/public/");
  } else if (filePath.startsWith("/avatar.jpg")) {
    filePath = "/public/avatar.jpg";
  } else if (filePath.startsWith("/cat.jpg")) {
    filePath = "/public/cat.jpg";
  } else if (filePath.startsWith("/photo.jpg")) {
    filePath = "/public/photo.jpg";
  } else if (filePath.startsWith("/resume.pdf")) {
    filePath = "/public/resume.pdf";
  }

  const abs = join(root, filePath.replace(/^\//, "").replace(/\.\./g, ""));

  try {
    const data = await readFile(abs);
    const ext = extname(abs);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && portNum < 5200) {
    portNum += 1;
    console.log(`端口被占用，尝试 ${portNum} …`);
    server.listen(portNum, "127.0.0.1");
    return;
  }
  console.error(err);
  process.exit(1);
});

server.listen(portNum, "127.0.0.1", () => {
  const p = server.address()?.port ?? portNum;
  console.log(`Preview: http://127.0.0.1:${p}`);
});
