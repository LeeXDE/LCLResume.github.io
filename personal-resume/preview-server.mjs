import { createServer } from "http";
import { readFile, readFileSync, existsSync } from "fs";
import { readFile as readFileAsync } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL(".", import.meta.url));

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));

const readFile = readFileAsync;
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

  if (
    (req.method === "OPTIONS" && (urlPath === "/api/feedback" || urlPath === "/api/agent")) ||
    (req.method === "POST" && urlPath === "/api/agent")
  ) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    const { default: agentHandler } = await import("./api/agent.js");
    const mockReq = {
      method: "POST",
      body: raw ? JSON.parse(raw) : {},
      on() {},
      [Symbol.asyncIterator]: async function* () {},
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(body) {
        res.writeHead(this.statusCode, this.headers);
        res.end(body);
      },
    };
    await agentHandler(mockReq, mockRes);
    return;
  }

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
