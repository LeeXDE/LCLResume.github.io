const agentRoot = document.getElementById("site-agent");

/** 备用：GitHub Pages 等静态站调用 Vercel 上的接口 */
const VERCEL_AGENT_API = "https://lcl-resume-github-io.vercel.app/api/chat";

if (agentRoot) {
  function resolveAgentEndpoints() {
    const host = window.location.hostname;
    const onGhPages = host.endsWith("github.io");
    const onVercel = host.endsWith("vercel.app");
    const onLocal = host === "localhost" || host === "127.0.0.1";
    const list = [];

    if (onVercel || onLocal) {
      list.push(`${window.location.origin}/api/chat`);
      list.push(`${window.location.origin}/api/agent`);
    }
    if (onGhPages) {
      list.push(VERCEL_AGENT_API);
      list.push("https://lcl-resume-github-io.vercel.app/api/agent");
    }

    const meta = document.querySelector('meta[name="agent-endpoint"]')?.content?.trim();
    if (meta) list.push(meta);

    if (!list.includes(VERCEL_AGENT_API)) list.push(VERCEL_AGENT_API);

    return [...new Set(list)];
  }

  const panel = agentRoot.querySelector(".site-agent-panel");
  const toggle = agentRoot.querySelector(".site-agent-toggle");
  const closeBtn = agentRoot.querySelector(".site-agent-close");
  const form = agentRoot.querySelector(".site-agent-form");
  const input = agentRoot.querySelector(".site-agent-input");
  const messagesEl = agentRoot.querySelector(".site-agent-messages");
  const statusEl = agentRoot.querySelector(".site-agent-status");
  let messages = [];
  let busy = false;

  try {
    sessionStorage.removeItem("resume-agent-messages-v1");
  } catch {
    /* ignore */
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function toPlainText(text) {
    if (!text) return "";
    return String(text)
      .replace(/\r\n/g, "\n")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[\t ]*[-*+]\s+/gm, "· ")
      .replace(/\*{2,}/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = "";

    if (!messages.length) {
      const empty = document.createElement("p");
      empty.className = "site-agent-empty";
      empty.textContent = "你有什么想问的？";
      messagesEl.appendChild(empty);
      return;
    }

    for (const msg of messages) {
      const row = document.createElement("div");
      row.className = `site-agent-row site-agent-row--${msg.role}`;
      const bubble = document.createElement("div");
      bubble.className = `site-agent-bubble site-agent-bubble--${msg.role}`;
      bubble.textContent =
        msg.role === "assistant" ? toPlainText(msg.content) : msg.content;
      row.appendChild(bubble);
      messagesEl.appendChild(row);
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function openPanel() {
    panel?.classList.add("is-open");
    toggle?.setAttribute("aria-expanded", "true");
    input?.focus();
  }

  function closePanel() {
    panel?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  }

  toggle?.addEventListener("click", () => {
    if (panel?.classList.contains("is-open")) closePanel();
    else openPanel();
  });

  closeBtn?.addEventListener("click", closePanel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel?.classList.contains("is-open")) closePanel();
  });

  async function postAgent(url, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function networkErrorMessage(lastErr) {
    const reason = String(lastErr?.message || lastErr || "");
    if (/abort/i.test(reason)) {
      return "请求超时，请稍后再试。";
    }
    return (
      "无法连接 AI 服务（网络被拦截或接口未部署）。\n" +
      "1. 在 Vercel 打开：https://lcl-resume-github-io.vercel.app/api/health 应显示 ok\n" +
      "2. 配置 DEEPSEEK_API_KEY 后 Redeploy\n" +
      "3. 国内访问 GitHub Pages 时，vercel.app 可能被墙，请改用 Vercel 域名或 VPN"
    );
  }

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || busy) return;

    busy = true;
    form?.querySelector("button[type=submit]")?.setAttribute("disabled", "true");
    input?.setAttribute("disabled", "true");

    messages.push({ role: "user", content });
    renderMessages();
    setStatus("思考中…");

    const typingRow = document.createElement("div");
    typingRow.className = "site-agent-row site-agent-row--assistant site-agent-typing-row";
    const typingBubble = document.createElement("div");
    typingBubble.className =
      "site-agent-bubble site-agent-bubble--assistant site-agent-bubble--typing";
    typingBubble.textContent = "正在回复…";
    typingRow.appendChild(typingBubble);
    messagesEl?.appendChild(typingRow);
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;

    let lastErr = null;

    try {
      const payload = { messages };
      const endpoints = resolveAgentEndpoints();
      let res = null;
      let data = {};

      for (const url of endpoints) {
        try {
          res = await postAgent(url, payload);
        } catch (err) {
          lastErr = err;
          continue;
        }
        if (res.status === 404 || res.status === 405) continue;
        data = await res.json().catch(() => ({}));
        break;
      }

      typingRow.remove();

      if (!res || res.status === 404 || res.status === 405) {
        messages.push({
          role: "assistant",
          content:
            "AI 接口未部署。请在 Vercel 确认 Root Directory=personal-resume，并访问 /api/health 检测。",
        });
      } else if (!res.ok || !data.success) {
        messages.push({
          role: "assistant",
          content: data.message || `请求失败（HTTP ${res.status}），请稍后再试。`,
        });
      } else {
        let reply = toPlainText(data.reply || "");
        if (data.searched) reply += "\n\n— 本次回答参考了联网检索。";
        messages.push({ role: "assistant", content: reply });
      }
    } catch (err) {
      typingRow.remove();
      messages.push({
        role: "assistant",
        content: networkErrorMessage(lastErr || err),
      });
    }

    renderMessages();
    setStatus("");
    busy = false;
    form?.querySelector("button[type=submit]")?.removeAttribute("disabled");
    input?.removeAttribute("disabled");
    input?.focus();
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input?.value || "";
    if (input) input.value = "";
    sendMessage(text);
  });

  renderMessages();

  document.getElementById("nav-agent-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    openPanel();
  });

  document.getElementById("agent-open-web")?.addEventListener("click", async () => {
    const q = (input?.value || "").trim();
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const question = q || lastUser?.content || "请根据李敬媚的个人简历网站，介绍她的背景与适合的产品/项目方向。";
    const prompt =
      "你是招聘场景助手。访客正在浏览「李敬媚」个人网站。请用简体中文回答：\n\n" + question;
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("已复制问题，正在打开 DeepSeek 网页…");
    } catch {
      setStatus("请手动复制输入框中的问题");
    }
    window.open("https://chat.deepseek.com/", "_blank", "noopener,noreferrer");
    setTimeout(() => setStatus(""), 3000);
  });
}
