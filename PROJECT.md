# GraspDailyPush_GDP — 项目简介

## 一句话

每日信息简报网页：自动爬取时事新闻 + 热搜榜单 + 学术论文，GitHub Actions 定时抓取，GitHub Pages 静态托管，前端纯静态。

## 技术栈

| 层 | 技术 |
|---|---|
| 托管 | GitHub Pages（`docs/` 目录） |
| CI/CD | GitHub Actions（双 workflow） |
| 后端 | 零服务器，全静态方案 |
| 爬虫 | Python（requests + lxml + CrossRef API） |
| 前端 | 纯 HTML + CSS + JS，浅色主题 |

## 仓库结构

```
GraspDailyPush_GDP/
├── .github/workflows/
│   ├── scrape-daily.yml       # 新闻+热搜，每6小时 + workflow_dispatch
│   └── scrape-academic.yml    # 学术论文，每周一 + workflow_dispatch
├── docs/                      # GitHub Pages 根目录
│   ├── index.html             # 主页面
│   ├── css/style.css          # 全部样式
│   ├── js/app.js              # 全部前端逻辑
│   └── data/                  # JSON 数据文件（由 workflow 生成/更新）
│       ├── news/
│       │   ├── headlines.json  # 新闻头条
│       │   └── hotlists.json   # 热搜榜单
│       ├── academic/
│       │   ├── papers_index.json        # 学术论文
│       │   ├── commentary_news.json     # 时事管理员点评
│       │   ├── commentary.json          # 学术管理员点评
│       │   └── last_update.json         # 学术最后更新时间
│       └── knowledge.json    # 每日知识库（30条轮换）
├── scripts/
│   ├── news/
│   │   ├── headlines.py       # 人民网/新华网/中国经济网 爬虫
│   │   └── hotlists.py        # 百度热搜 + 微博热搜 爬虫
│   └── academic/
│       └── english_journals.py # 12本英文期刊爬虫（CrossRef API）
├── config/
│   └── journals.json          # 期刊配置（ISSN等）
├── api/                       # 废弃的 Vercel 备选方案
├── PROJECT.md                 # 本文件
└── README.md
```

## 关键设计决策

1. **零服务器** — 全静态，不用时只会产生 Pages 托管流量
2. **双 workflow** — `scrape-daily.yml`（6小时）+ `scrape-academic.yml`（每周一），避免并发 push 冲突
3. **Token 管理** — GitHub PAT 存 localStorage，刷新时调用 GitHub API 触发 `workflow_dispatch`
4. **DeepSeek Key** — 访客自己输入，仅存 localStorage，不存代码
5. **AI 短评分两层**：
   - **管理员版** — 存 repo 文件，所有人可见。通过 📤 发布按钮 + prompt 输入 Token → GitHub Contents API 覆盖仓库文件
   - **访客版** — 存 localStorage，仅自己可见。刷新后清除
   - **Stale 检测** — 比较 `data.updated_at > admin.generated_at` 时显示黄色过期提醒
6. **刷新流程** — 点击 🔄 → 无 Token 则静默重载 → 有 Token 则 API 触发 workflow → 轮询 15s×3min 检测数据变化 → 重新渲染

## 维护指南（退出终端后续操作）

### 日常维护

一切自动化，无需手动操作：
- 新闻+热搜：每 6 小时自动爬取
- 学术论文：每周一自动爬取
- 如需手动刷新：网页上点击 🔄（需设好 GitHub Token）

### 代码修改

```bash
cd C:\Users\11275\Desktop\GraspDailyPush_GDP
# 改代码 → commit → push，Pages 自动部署
git add -A
git commit -m "说明"
git push
```

### 添加新爬虫源

1. 在 `scripts/` 下新建 Python 文件
2. 数据写入 `docs/data/` 下对应 JSON
3. 如果在 `scrape-daily.yml` 中添加步骤，注意保持**单 workflow**，不要另起新的 workflow（避免并发问题）

### 修改前端

- `docs/index.html` — 页面结构
- `docs/css/style.css` — 样式
- `docs/js/app.js` — 所有交互逻辑（刷新、点评生成/发布、stale检测等）

### 部署

push 到 main 后 GitHub Pages 自动部署，等待约 1-2 分钟生效。

## 已知待办

- [ ] **中文期刊爬虫（Phase 3）** — 知网/万方/维普 学术论文收录
- [ ] Cloudflare Workers 方案已放弃（新账号 workers.dev 路由不可用）

## 关键信息

- GitHub 仓库：`NiTianyang0209/GraspDailyPush_GDP`
- Pages 地址：`https://ni-tianyang0209.github.io/GraspDailyPush_GDP/`
- 本地路径：`C:\Users\11275\Desktop\GraspDailyPush_GDP`
