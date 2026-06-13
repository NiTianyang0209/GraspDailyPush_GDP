// Cloudflare Worker — 触发 GitHub Actions 工作流
// 部署后设置环境变量：
//   GITHUB_TOKEN: 个人访问令牌（repo 权限）
//   RATE_LIMIT_SECONDS: 频率限制秒数（默认 600）
//   REFRESH_KV: KV 命名空间绑定（可选，增强服务端限流）

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const token = env.GITHUB_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
        status: 500, headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // 服务端限流（依赖 KV 绑定）
    const limit = parseInt(env.RATE_LIMIT_SECONDS || "600", 10);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (env.REFRESH_KV) {
      const last = await env.REFRESH_KV.get(ip);
      if (last) {
        const elapsed = (Date.now() - parseInt(last, 10)) / 1000;
        if (elapsed < limit) {
          const remain = Math.ceil(limit - elapsed);
          return new Response(JSON.stringify({ error: "rate_limited", remain }), {
            status: 429, headers: { "Content-Type": "application/json", ...cors },
          });
        }
      }
      await env.REFRESH_KV.put(ip, String(Date.now()), { expirationTtl: limit });
    }

    const owner = "NiTianyang0209";
    const repo = "GraspDailyPush_GDP";
    const workflows = ["scrape-news.yml", "scrape-hotlists.yml", "scrape-english-academic.yml"];

    const results = await Promise.all(workflows.map(async (wf) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${wf}/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ref: "main" }),
          }
        );
        return { workflow: wf, status: res.status };
      } catch (e) {
        return { workflow: wf, error: e.message };
      }
    }));

    const ok = results.every((r) => r.status === 204);
    return new Response(JSON.stringify({ status: ok ? "triggered" : "partial", results }), {
      status: 200, headers: { "Content-Type": "application/json", ...cors },
    });
  },
};
