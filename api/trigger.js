// Vercel Serverless Function — 触发 GitHub Actions 工作流
// 部署后需设置环境变量 GITHUB_TOKEN（在 Vercel Dashboard 中配置）

export default async function handler(req, res) {
  // CORS for browser requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: "GITHUB_TOKEN not configured" });

  const owner = "NiTianyang0209";
  const repo = "GraspDailyPush_GDP";
  const workflows = ["scrape-news.yml", "scrape-hotlists.yml", "scrape-english-academic.yml"];

  const results = await Promise.all(workflows.map(async (wf) => {
    try {
      const r = await fetch(
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
      return { workflow: wf, status: r.status };
    } catch (e) {
      return { workflow: wf, error: e.message };
    }
  }));

  const ok = results.every((r) => r.status === 204);
  res.status(200).json({ status: ok ? "triggered" : "partial", results });
}
