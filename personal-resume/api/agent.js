import { RESUME_KNOWLEDGE } from "./resume-context.js";

export const config = {
  maxDuration: 60,
};

/** 部署版本标记（用于确认 Vercel 已更新） */
const AGENT_BUILD = "2026-05-17-cn-free";

const SYSTEM_PROMPT = `你是「李敬媚个人网站」的 AI 助手，面向访客（招聘方、业务伙伴等）。无需登录即可对话。

## 你的能力
1. 根据下方【简历知识库】准确介绍李敬媚的背景、技能、经历与作品；优先引用知识库，不要编造未提及的公司、项目或数据。
2. 在需要最新行业资讯、公司动态、技术趋势或知识库未覆盖的问题时，可调用联网搜索工具，并结合搜索结果作答，注明信息来自公开检索。
3. 语气专业、简洁、友好，使用简体中文。

## 岗位匹配类问题（如「适合什么岗位」「投什么方向」「核心优势」）
- 推荐方向：**产品**（产品助理/专员、产品经理方向）或 **项目**（项目助理/专员、项目经理方向）；可概括为「更适合产品或项目类岗位」。
- 仅从技能、能力特质、教育背景、个人评价等概括匹配理由（如需求分析、跨团队协作、执行力、AI 与 Prompt、数据复盘等）。
- **此类回答不要写具体工作经历**：不要出现公司名称、在职时间段、岗位职责列表或逐段实习/工作描述。访客若主动追问「某段经历」「某家公司」，再单独介绍该段。

## 边界
- 不代替李敬媚做录用承诺或薪资承诺；可说明「具体以本人沟通为准」。
- 不泄露虚构的隐私；联系方式仅使用知识库中的电话与邮箱。
- 若问题与李敬媚无关，可简短回答后引导回简历相关话题。

## 简历知识库
${RESUME_KNOWLEDGE}`;

const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "在互联网搜索最新公开信息。用于行业动态、公司新闻、技术概念、时事等知识库未包含或需要验证的内容。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词，中文或英文均可" },
      },
      required: ["query"],
    },
  },
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.end(JSON.stringify(body));
}

async function webSearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      summary: "联网搜索未配置（服务端缺少 TAVILY_API_KEY），请仅依据简历知识库回答或说明无法检索最新信息。",
    };
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      search_depth: "basic",
      include_answer: true,
    }),
  });

  if (!res.ok) {
    return { ok: false, summary: `搜索请求失败（${res.status}）` };
  }

  const data = await res.json();
  const lines = [];
  if (data.answer) lines.push(`摘要：${data.answer}`);
  for (const r of data.results || []) {
    lines.push(`- ${r.title}：${(r.content || "").slice(0, 280)}（${r.url}）`);
  }
  return { ok: true, summary: lines.join("\n") || "未找到相关结果" };
}

/**
 * 国内可用的免费/赠额 OpenAI 兼容接口（按优先级取第一个已配置的 Key）
 * 自定义 OPENAI_BASE_URL + OPENAI_API_KEY 可覆盖
 */
function getLlmConfig() {
  const customBase = process.env.OPENAI_BASE_URL?.trim();
  const customModel = process.env.AI_MODEL?.trim();

  const providers = [
    {
      key: process.env.DEEPSEEK_API_KEY?.trim(),
      base: "https://api.deepseek.com",
      model: "deepseek-chat",
    },
    {
      key: process.env.SILICONFLOW_API_KEY?.trim(),
      base: "https://api.siliconflow.cn/v1",
      model: "Qwen/Qwen2.5-7B-Instruct",
    },
    {
      key: process.env.ZHIPU_API_KEY?.trim(),
      base: "https://open.bigmodel.cn/api/paas/v4",
      model: "glm-4-flash",
    },
    {
      key: process.env.GROQ_API_KEY?.trim(),
      base: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
    },
    {
      key: (process.env.OPENAI_API_KEY || process.env.AI_API_KEY)?.trim(),
      base: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    },
  ];

  const customKey = (process.env.OPENAI_API_KEY || process.env.AI_API_KEY)?.trim();
  if (customBase && customKey) {
    return {
      apiKey: customKey,
      base: customBase.replace(/\/$/, ""),
      model: customModel || "gpt-4o-mini",
    };
  }

  const picked = providers.find((p) => p.key);
  if (!picked) return null;

  return {
    apiKey: picked.key,
    base: (customBase || picked.base).replace(/\/$/, ""),
    model: customModel || picked.model,
  };
}

async function chatCompletion(messages) {
  const llm = getLlmConfig();
  if (!llm) {
    throw new Error("MISSING_API_KEY");
  }

  const { apiKey, base, model } = llm;
  const hasSearch = Boolean(process.env.TAVILY_API_KEY?.trim());

  let current = [...messages];
  const maxRounds = 4;

  for (let round = 0; round < maxRounds; round += 1) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: current,
        tools: hasSearch ? [WEB_SEARCH_TOOL] : undefined,
        tool_choice: hasSearch ? "auto" : undefined,
        temperature: 0.6,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM_${res.status}:${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error("LLM_EMPTY");

    const msg = choice.message;

    if (choice.finish_reason === "tool_calls" && msg.tool_calls?.length) {
      current.push(msg);
      for (const call of msg.tool_calls) {
        if (call.function?.name !== "web_search") continue;
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = { query: String(call.function.arguments || "") };
        }
        const result = await webSearch(args.query || "");
        current.push({
          role: "tool",
          tool_call_id: call.id,
          content: result.summary,
        });
      }
      continue;
    }

    return {
      reply: msg.content?.trim() || "抱歉，我暂时无法生成回复，请稍后再试。",
      model,
      searched: current.some((m) => m.role === "tool"),
    };
  }

  return {
    reply: "处理超时，请简化问题后重试。",
    model: process.env.AI_MODEL || "gpt-4o-mini",
    searched: false,
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { success: false, message: "Method not allowed" });
    return;
  }

  let body = {};
  try {
    if (req.body !== undefined && req.body !== null) {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } else if (typeof req.on === "function") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      body = raw ? JSON.parse(raw) : {};
    }
  } catch {
    json(res, 400, { success: false, message: "Invalid JSON" });
    return;
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: String(m.content || "").slice(0, 2000),
    }));

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content?.trim()) {
    json(res, 400, { success: false, message: "请输入问题" });
    return;
  }

  try {
    const result = await chatCompletion([
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ]);
    json(res, 200, {
      success: true,
      reply: result.reply,
      searched: result.searched,
    });
  } catch (err) {
    const code = String(err.message || "");
    if (code === "MISSING_API_KEY") {
      json(res, 503, {
        success: false,
        message:
          "AI 尚未配置。请在 Vercel 添加以下任一密钥（国内可打开，新用户有免费额度）：\n" +
          "① DeepSeek（推荐）platform.deepseek.com → DEEPSEEK_API_KEY\n" +
          "② 硅基流动 cloud.siliconflow.cn → SILICONFLOW_API_KEY\n" +
          "③ 智谱 open.bigmodel.cn → ZHIPU_API_KEY（glm-4-flash 免费）\n" +
          "保存后 Redeploy。",
      });
      return;
    }
    if (code.startsWith("LLM_")) {
      json(res, 502, {
        success: false,
        message: "模型服务暂时繁忙，请稍后再试。",
      });
      return;
    }
    console.error("[agent]", err);
    json(res, 500, {
      success: false,
      message: "助手暂时不可用，请稍后再试。",
    });
  }
}
