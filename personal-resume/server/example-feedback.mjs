/**
 * 最小示例：接收简历页 JSON 反馈，返回 { success: true }。
 * 部署时在反代后挂到 /api/feedback，并把 index.html 里
 * <meta name="feedback-endpoint" content="/api/feedback" /> 填好。
 *
 * 运行：node server/example-feedback.mjs
 * 默认监听 8788（勿暴露到公网，应放在 Nginx/Caddy 后面）。
 *
 * 发邮件到 QQ 邮箱需自行接入 nodemailer / 腾讯云邮件 / SendGrid 等，此处仅 console.log。
 */

import { createServer } from "http";

const PORT = Number(process.env.FEEDBACK_PORT) || 8788;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const path = (req.url || "").split("?")[0];

  if (req.method === "OPTIONS" && path === "/api/feedback") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && path === "/api/feedback") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    try {
      const body = await readBody(req);
      const interview = String(body.interview_chance ?? "").trim();
      const company = String(body.visitor_company ?? "").trim();

      if (!interview || !company) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: "请填写两项内容" }));
        return;
      }

      console.log("[feedback]", new Date().toISOString(), { interview, company });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, message: "JSON 解析失败" }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Example feedback API: http://127.0.0.1:${PORT}/api/feedback`);
});
