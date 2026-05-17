const agentRoot = document.getElementById("site-agent");

if (agentRoot) {
  const endpoint =
    document.querySelector('meta[name="agent-endpoint"]')?.content?.trim() || "/api/agent";

  const panel = agentRoot.querySelector(".site-agent-panel");
  const toggle = agentRoot.querySelector(".site-agent-toggle");
  const closeBtn = agentRoot.querySelector(".site-agent-close");
  const form = agentRoot.querySelector(".site-agent-form");
  const input = agentRoot.querySelector(".site-agent-input");
  const messagesEl = agentRoot.querySelector(".site-agent-messages");
  const statusEl = agentRoot.querySelector(".site-agent-status");
  const STORAGE_KEY = "resume-agent-messages-v1";
  let messages = [];
  let busy = false;

  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) messages = JSON.parse(saved);
  } catch {
    messages = [];
  }

  function saveMessages() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      /* ignore */
    }
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
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
      bubble.textContent = msg.content;
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

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || busy) return;

    busy = true;
    form?.querySelector("button[type=submit]")?.setAttribute("disabled", "true");
    input?.setAttribute("disabled", "true");

    messages.push({ role: "user", content });
    saveMessages();
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

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json().catch(() => ({}));
      typingRow.remove();

      if (!res.ok || !data.success) {
        let errMsg = data.message || "请求失败，请稍后再试。";
        if (res.status === 404) {
          errMsg =
            "未找到 AI 接口。请使用 Vercel 地址访问（非 GitHub Pages），并确认已部署 api/agent。";
        }
        messages.push({
          role: "assistant",
          content: errMsg,
        });
      } else {
        let reply = data.reply || "";
        if (data.searched) reply += "\n\n— 本次回答参考了联网检索。";
        messages.push({ role: "assistant", content: reply });
      }
    } catch {
      typingRow.remove();
      messages.push({
        role: "assistant",
        content: "网络异常，请检查连接。本地开发请运行：node preview-server.mjs",
      });
    }

    saveMessages();
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
}
