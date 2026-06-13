(function () {
  "use strict";

  const DATA_BASE = "data";

  // ---- Utility ----
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatDateTime(dateStr) {
    return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ---- Page Navigation ----
  function initNav() {
    var navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var page = btn.dataset.page;
        navBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
        var target = document.getElementById("page-" + page);
        if (target) target.classList.add("active");
      });
    });
  }

  // ---- Fetch helper ----
  async function loadJSON(path) {
    const ts = Date.now();
    const separator = path.includes('?') ? '&' : '?';
    const res = await fetch(path + separator + '_t=' + ts);
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + path);
    return res.json();
  }

  // ---- Render News Headlines (source-tabbed) ----
  var currentNewsSource = 0;

  function renderHeadlines(data) {
    var tabs = document.getElementById("headlines-tabs");
    var list = document.getElementById("headlines-list");
    if (!data || !data.sources || data.sources.length === 0) {
      list.innerHTML = "<div class=\"loading\">暂无新闻</div>";
      return;
    }
    var sources = data.sources;
    tabs.innerHTML = sources.map(function (s, i) {
      return "<button class=\"tab-btn" + (i === currentNewsSource ? " active" : "") + "\" data-idx=\"" + i + "\">" + escapeHtml(s.name) + "</button>";
    }.bind(this)).join("\n");
    tabs.onclick = function (e) {
      var btn = e.target.closest(".tab-btn");
      if (!btn) return;
      currentNewsSource = parseInt(btn.dataset.idx, 10);
      renderNewsItems(sources[currentNewsSource]);
      tabs.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    };
    renderNewsItems(sources[0]);
  }

  function renderNewsItems(source) {
    var list = document.getElementById("headlines-list");
    if (!source || !source.items) {
      list.innerHTML = "<div class=\"loading\">暂无数据</div>";
      return;
    }
    var sourceUrl = source.url || "#";
    list.innerHTML = [
      "<div class=\"source-header\">",
      "  <a class=\"source-home-link\" href=\"" + escapeHtml(sourceUrl) + "\" target=\"_blank\" rel=\"noopener\">浏览更多 →</a>",
      "</div>"
    ].join("\n") + source.items.map(function (item) {
      var articleUrl = item.url || sourceUrl;
      return [
        "<div class=\"news-card\">",
        "  <div class=\"news-card-header\">",
        "    <span class=\"source-label\">" + escapeHtml(source.name) + "</span>",
        "    <span class=\"time\">" + escapeHtml(item.time) + "</span>",
        "  </div>",
        "  <a class=\"news-title\" href=\"" + escapeHtml(articleUrl) + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(item.title) + "</a>",
        (item.summary ? "  <div class=\"summary\">" + escapeHtml(item.summary) + "</div>" : ""),
        "</div>"
      ].join("\n");
    }.bind(this)).join("\n");
  }

  // ---- Render Hotlists ----
  var currentHotPlatform = 0;

  function renderHotlists(data) {
    var tabs = document.getElementById("hotlists-tabs");
    var content = document.getElementById("hotlists-content");
    if (!data || !data.platforms || data.platforms.length === 0) {
      content.innerHTML = "<div class=\"loading\">暂无热搜</div>";
      return;
    }
    var platforms = data.platforms;
    tabs.innerHTML = platforms.map(function (p, i) {
      return "<button class=\"tab-btn" + (i === currentHotPlatform ? " active" : "") + "\" data-idx=\"" + i + "\">" + escapeHtml(p.name) + "</button>";
    }.bind(this)).join("\n");
    tabs.addEventListener("click", function (e) {
      var btn = e.target.closest(".tab-btn");
      if (!btn) return;
      currentHotPlatform = parseInt(btn.dataset.idx, 10);
      renderHotlistItems(platforms[currentHotPlatform]);
      tabs.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    });
    renderHotlistItems(platforms[0]);
  }

  function renderHotlistItems(platform) {
    var content = document.getElementById("hotlists-content");
    if (!platform || !platform.items) {
      content.innerHTML = "<div class=\"loading\">暂无数据</div>";
      return;
    }
    var html = platform.items.map(function (item) {
      var rankClass = "rank";
      if (item.rank <= 1) rankClass += " top-1";
      else if (item.rank <= 2) rankClass += " top-2";
      else if (item.rank <= 3) rankClass += " top-3";
      var hotUrl = item.url || "";
      var titleHtml = hotUrl
        ? "<a class=\"hot-title-link\" href=\"" + escapeHtml(hotUrl) + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(item.title) + "</a>"
        : "<span class=\"title\">" + escapeHtml(item.title) + "</span>";
      return [
        "<div class=\"hot-item\">",
        "  <span class=\"" + rankClass + "\">" + escapeHtml(String(item.rank)) + "</span>",
        "  " + titleHtml,
        (item.heat ? "  <span class=\"heat\">" + escapeHtml(item.heat) + "</span>" : ""),
        "</div>"
      ].join("\n");
    }.bind(this)).join("\n");
    var platformUrl = platform.url || "#";
    html += "<div class=\"hot-more\"><a href=\"" + escapeHtml(platformUrl) + "\" target=\"_blank\" rel=\"noopener\">查看全部 →</a></div>";
    content.innerHTML = html;
  }

  // ---- Render Academic (journal-tabbed) ----
  var currentJournalIdx = 0;

  function renderAcademic(data) {
    var container = document.getElementById("academic-content");
    if (!data || data.length === 0) {
      container.innerHTML = "<div class=\"loading\">暂无论文收录</div>";
      return;
    }

    var journalMap = {};
    data.forEach(function (p) {
      var j = p.journal || "Other";
      if (!journalMap[j]) journalMap[j] = [];
      journalMap[j].push(p);
    });

    var journals = Object.keys(journalMap).sort();
    var html = "";
    html += "<div id=\"journal-tabs\" class=\"tab-bar\">";
    html += journals.map(function (j, i) {
      return "<button class=\"tab-btn" + (i === currentJournalIdx ? " active" : "") + "\" data-idx=\"" + i + "\">" + escapeHtml(j) + " (" + journalMap[j].length + ")</button>";
    }.bind(this)).join("\n");
    html += "</div>";
    html += "<div id=\"journal-content\"></div>";
    container.innerHTML = html;

    var tabs = document.getElementById("journal-tabs");
    tabs.onclick = function (e) {
      var btn = e.target.closest(".tab-btn");
      if (!btn) return;
      currentJournalIdx = parseInt(btn.dataset.idx, 10);
      renderJournalPapers(journals[currentJournalIdx], journalMap[journals[currentJournalIdx]]);
      tabs.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    };

    renderJournalPapers(journals[0], journalMap[journals[0]]);
  }

  function renderJournalPapers(journalName, papers) {
    var container = document.getElementById("journal-content");
    if (!papers || papers.length === 0) {
      container.innerHTML = "<div class=\"loading\">暂无论文</div>";
      return;
    }

    var green = papers.filter(function (p) { return p.theme === "green"; });
    var digital = papers.filter(function (p) { return p.theme === "digital"; });
    var html = "";

    function renderGroup(emoji, label, themeClass, group) {
      var items = group.map(function (p) {
        var badge = p.is_new ? "<span class=\"badge-new\">新</span>" : "";

        var metaParts = [];
        var journalLabel = "<span class=\"meta-journal\">" + escapeHtml(p.journal) + "</span>";
        metaParts.push(journalLabel);

        var vip = [];
        if (p.volume) vip.push("Vol. " + escapeHtml(p.volume));
        if (p.issue) vip.push("No. " + escapeHtml(p.issue));
        if (p.pages) vip.push("pp. " + escapeHtml(p.pages));
        if (vip.length > 0) metaParts.push("<span class=\"meta-vip\">" + vip.join(", ") + "</span>");

        if (p.doi) {
          var cleanDoi = p.doi.split("<")[0].trim();
          metaParts.push("<span><a class=\"doi-link\" href=\"https://doi.org/" + encodeURIComponent(cleanDoi) + "\" target=\"_blank\" rel=\"noopener\">DOI</a></span>");
        }

        var authorsHtml = (p.authors && p.authors.length > 0)
          ? "<div class=\"paper-authors\">" + escapeHtml(p.authors.join(", ")) + "</div>"
          : "";

        var abstractHtml = p.abstract
          ? "<div class=\"paper-abstract\"><span class=\"label\">摘要：</span>" + escapeHtml(p.abstract) + "</div>"
          : "";

        var keywordsHtml = (p.keywords && p.keywords.length > 0)
          ? "<div class=\"keywords\">" + p.keywords.map(function (kw) { return "<span class=\"keyword\">" + escapeHtml(kw) + "</span>"; }).join("") + "</div>"
          : "";

        return [
          "<div class=\"paper-card\">",
          "  <div class=\"paper-title\">" + escapeHtml(p.title) + badge + "</div>",
          "  <div class=\"paper-meta\">" + metaParts.join(" · ") + "</div>",
          authorsHtml,
          "  <div class=\"paper-abstract\">" + escapeHtml(p.abstract || "") + "</div>",
          keywordsHtml,
          "</div>"
        ].join("\n");
      }).join("\n");

      return [
        "<div class=\"theme-group\">",
        "  <div class=\"theme-header " + themeClass + "\">" + emoji + " " + escapeHtml(label) + " <span style=\"font-weight:400;font-size:12px;opacity:0.7\">(" + group.length + " 篇)</span></div>",
        items,
        "</div>"
      ].join("\n");
    }

    if (green.length > 0) html += renderGroup("💚", "绿色主题", "green", green);
    if (digital.length > 0) html += renderGroup("💙", "数字主题", "digital", digital);
    container.innerHTML = html;
  }

  // ---- Render Commentary (admin + user dual-layer) ----
  function renderCommentary(newsData, academicData, newsUpdatedAt, academicUpdatedAt) {
    function renderPane(type, adminData, dataUpdatedAt) {
      var adminBody = document.getElementById("admin" + type + "Body");
      var userBody = document.getElementById("user" + type + "Body");
      var staleEl = document.getElementById("stale" + type);

      // Admin section
      if (adminData && adminData.commentary) {
        var meta = "";
        if (adminData.generated_at) meta += "<div class=\"meta\"><span>🕐 " + formatDateTime(adminData.generated_at) + "</span></div>";
        if (adminData.total_papers) meta += "<div class=\"meta\"><span>本期收录 " + (adminData.total_papers || 0) + " 篇</span></div>";
        adminBody.innerHTML = "<div class=\"text\">" + escapeHtml(adminData.commentary) + "</div>" + meta;
      } else {
        adminBody.innerHTML = "<div class=\"loading\">暂无点评</div>";
      }

      // Stale detection
      if (adminData && adminData.generated_at && dataUpdatedAt) {
        if (new Date(dataUpdatedAt) > new Date(adminData.generated_at)) {
          staleEl.style.display = "block";
          staleEl.textContent = "⚠️ 数据已更新，管理员点评可能不匹配最新内容";
        } else {
          staleEl.style.display = "none";
        }
      } else {
        staleEl.style.display = "none";
      }

      // User section (localStorage)
      var userKey = "gdp_commentary_" + type.toLowerCase();
      var userDataStr = localStorage.getItem(userKey);
      var publishBtnId = "publish" + type + "Btn";
      if (userDataStr) {
        try {
          var userData = JSON.parse(userDataStr);
          if (userData && userData.commentary) {
            userBody.innerHTML = "<div class=\"text\">" + escapeHtml(userData.commentary) + "</div>" +
              "<div class=\"meta\"><span>🕐 " + formatDateTime(userData.generated_at) + " (我的生成)</span></div>";
            document.getElementById(publishBtnId).style.display = "inline-block";
            return;
          }
        } catch (e) {}
      }
      userBody.innerHTML = "<div class=\"loading\">暂无</div>";
      document.getElementById(publishBtnId).style.display = "none";
    }

    renderPane("News", newsData, newsUpdatedAt);
    renderPane("Academic", academicData, academicUpdatedAt);

    // Commentary timestamp
    var ts = null;
    [newsData, academicData].forEach(function(d) {
      if (d && d.generated_at) { if (!ts || d.generated_at > ts) ts = d.generated_at; }
    });
    ["news", "academic"].forEach(function(t) {
      try {
        var u = JSON.parse(localStorage.getItem("gdp_commentary_" + t));
        if (u && u.generated_at) { if (!ts || u.generated_at > ts) ts = u.generated_at; }
      } catch (e) {}
    });
    if (ts) document.getElementById("commentaryTime").textContent = "🤖 " + formatDateTime(ts);
  }

  // ---- Update Time Note ----
  function updateTimeNotes(newsData, academicData, academicUpdate) {
    if (newsData && newsData.updated_at) {
      document.getElementById("newsUpdateTime").textContent = "⏱ " + formatDateTime(newsData.updated_at);
    }
    if (academicUpdate && academicUpdate.updated_at) {
      document.getElementById("academicUpdateTime").textContent = "🕐 最后检索 " + formatDateTime(academicUpdate.updated_at);
    }
  }

  // ---- Daily Knowledge ----
  function loadKnowledge() {
    var el = document.getElementById("knowledgeWidget");
    fetch(DATA_BASE + "/knowledge.json?_t=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.length === 0) { el.textContent = "📖 知识暂无"; return; }
        var today = new Date();
        var dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
        var idx = dayOfYear % data.length;
        var tip = data[idx];
        el.innerHTML = "<strong>📖 " + escapeHtml(tip.title) + "</strong> " + escapeHtml(tip.content);
      })
      .catch(function () { el.textContent = "📖 知识暂无"; });
  }

  // ---- Visit Counter ----
  function initVisitCounter() {
    var today = formatDate(new Date());
    var storedDate = localStorage.getItem("gdp_visit_date");
    var storedToday = parseInt(localStorage.getItem("gdp_visit_today") || "0", 10);
    if (storedDate === today) {
      storedToday++;
    } else {
      storedToday = 1;
      localStorage.setItem("gdp_visit_date", today);
    }
    localStorage.setItem("gdp_visit_today", String(storedToday));
    document.getElementById("visitToday").textContent = "今日访问：" + storedToday;

    fetch("https://api.visitorbadge.io/api/visitors?path=https%3A%2F%2Fni-tianyang0209.github.io%2FGraspDailyPush_GDP%2F")
      .then(function (r) { return r.text(); })
      .then(function (svg) {
        var m = svg.match(/: (\d+)<\/title/);
        if (m) document.getElementById("visitTotal").textContent = "总访问：" + m[1];
      })
      .catch(function () {
        document.getElementById("visitTotal").textContent = "总访问：--";
      });
  }

  // ---- GitHub Token Config ----
  function getGitHubToken() {
    return localStorage.getItem("gdp_github_token") || "";
  }

  function initTokenUI() {
    var el = document.getElementById("tokenStatus");
    if (!el) return;
    var token = getGitHubToken();
    el.textContent = token ? "✅" : "点击设置 Token";
    el.title = token ? "GitHub Token 已设置" : "点击设置 GitHub Token 以启用刷新自动抓取";
  }

  // ---- DeepSeek API Key Config ----
  function getDeepSeekKey() {
    return localStorage.getItem("gdp_deepseek_key") || "";
  }

  function initDeepSeekUI() {
    var el = document.getElementById("deepseekStatus");
    if (!el) return;
    var key = getDeepSeekKey();
    el.textContent = key ? "✅" : "点击设置 Key";
    el.title = key ? "DeepSeek API Key 已设置" : "点击设置 DeepSeek API Key";
  }

  // ---- On-demand AI Commentary ----
  async function generateCommentary(type) {
    var key = getDeepSeekKey();
    var statusId = "commentary" + (type === "news" ? "News" : "Academic") + "Status";
    var statusEl = document.getElementById(statusId);
    if (!key) {
      var input = prompt("请输入 DeepSeek API Key：");
      if (input === null) return;
      localStorage.setItem("gdp_deepseek_key", input);
      key = input;
      initDeepSeekUI();
      if (!key) return;
    }

    statusEl.textContent = "⏳ 生成中...";
    try {
      var systemPrompt, userData;
      if (type === "news") {
        var [headlines, hotlists] = await Promise.all([
          loadJSON(DATA_BASE + "/news/headlines.json").catch(function () { return null; }),
          loadJSON(DATA_BASE + "/news/hotlists.json").catch(function () { return null; })
        ]);
        systemPrompt = "你是一个时事评论员，请根据以下新闻热搜数据撰写一段300-500字的点评，分析当前热点趋势。用中文回复。";
        userData = JSON.stringify({ headlines: headlines, hotlists: hotlists }, null, 2);
      } else {
        var papers = await loadJSON(DATA_BASE + "/academic/papers_index.json").catch(function () { return null; });
        systemPrompt = "你是一个学术评论员，请根据以下学术论文数据撰写一段300-500字的点评，总结研究热点和趋势。用中文回复。";
        userData = JSON.stringify({ papers: papers }, null, 2);
      }

      var res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userData }
          ],
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      if (!res.ok) {
        var errText = await res.text().catch(function () { return ""; });
        statusEl.textContent = "❌ API 错误: " + res.status;
        return;
      }

      var result = await res.json();
      var text = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
      if (!text) { statusEl.textContent = "❌ API 返回格式异常"; return; }

      // Save to localStorage
      var userKey = "gdp_commentary_" + type;
      var generatedAt = new Date().toISOString();
      localStorage.setItem(userKey, JSON.stringify({ commentary: text, generated_at: generatedAt }));

      // Update user section display
      var userBodyId = "user" + (type === "news" ? "News" : "Academic") + "Body";
      document.getElementById(userBodyId).innerHTML = "<div class=\"text\">" + escapeHtml(text) + "</div>" +
        "<div class=\"meta\"><span>🕐 " + formatDateTime(generatedAt) + " (我的生成)</span></div>";

      // Show publish button
      var publishBtnId = "publish" + (type === "news" ? "News" : "Academic") + "Btn";
      document.getElementById(publishBtnId).style.display = "inline-block";

      // Update commentary timestamp
      var curTs = document.getElementById("commentaryTime").textContent;
      document.getElementById("commentaryTime").textContent = "🤖 " + formatDateTime(generatedAt);

      statusEl.textContent = "✅ 生成完成";
    } catch (e) {
      statusEl.textContent = "❌ 请求失败: " + e.message;
    }
  }

  // ---- Publish as Admin Commentary ----
  async function publishCommentary(type) {
    var userKey = "gdp_commentary_" + type;
    var userDataStr = localStorage.getItem(userKey);
    if (!userDataStr) return;

    var token = prompt("请输入 GitHub Token 以发布为管理员点评：");
    if (!token) return;

    var statusId = "commentary" + (type === "news" ? "News" : "Academic") + "Status";
    var statusEl = document.getElementById(statusId);
    statusEl.textContent = "📤 发布中...";

    var owner = "NiTianyang0209";
    var repo = "GraspDailyPush_GDP";
    var filePath = type === "news" ? "docs/data/academic/commentary_news.json" : "docs/data/academic/commentary.json";
    var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + filePath;

    try {
      var userData = JSON.parse(userDataStr);
      var newContent = { commentary: userData.commentary, generated_at: userData.generated_at };
      var contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(newContent, null, 2))));

      // Get current file sha
      var getRes = await fetch(apiUrl, {
        headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json" }
      });

      var sha = "";
      if (getRes.ok) {
        var getData = await getRes.json();
        sha = getData.sha;
      }

      var putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Authorization": "Bearer " + token,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Update " + type + " commentary",
          content: contentBase64,
          sha: sha
        })
      });

      if (!putRes.ok) {
        statusEl.textContent = "❌ 发布失败: " + putRes.status;
        return;
      }

      // Update admin section with published content
      var adminBodyId = "admin" + (type === "news" ? "News" : "Academic") + "Body";
      document.getElementById(adminBodyId).innerHTML = "<div class=\"text\">" + escapeHtml(userData.commentary) + "</div>" +
        "<div class=\"meta\"><span>🕐 " + formatDateTime(userData.generated_at) + " (已发布)</span></div>";

      // Hide stale warning
      var staleId = "stale" + (type === "news" ? "News" : "Academic");
      document.getElementById(staleId).style.display = "none";

      // Hide publish button
      var publishBtnId = "publish" + (type === "news" ? "News" : "Academic") + "Btn";
      document.getElementById(publishBtnId).style.display = "none";

      statusEl.textContent = "✅ 已发布为管理员点评";
    } catch (e) {
      statusEl.textContent = "❌ 发布失败: " + e.message;
    }
  }

  // ---- Trigger GitHub Actions ----
  async function triggerWorkflows(token) {
    var owner = "NiTianyang0209";
    var repo = "GraspDailyPush_GDP";
    var workflows = ["scrape-daily.yml"];
    var results = await Promise.all(workflows.map(async function (wf) {
      try {
        var res = await fetch("https://api.github.com/repos/" + owner + "/" + repo + "/actions/workflows/" + wf + "/dispatches", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: "main" })
        });
        return { workflow: wf, status: res.status };
      } catch (e) {
        return { workflow: wf, error: e.message };
      }
    }));
    var ok = results.every(function (r) { return r.status === 204; });
    return { status: ok ? "triggered" : "partial", results: results };
  }

  // ---- Refresh ----
  const REFRESH_COOLDOWN = 10 * 60 * 1000;
  const POLL_INTERVAL = 15000;
  const POLL_TIMEOUT = 3 * 60 * 1000;

  var refreshInProgress = false;
  var lastRefreshTime = null;
  var lastTriggerTime = null;

  function showRefreshTime() {
    var el = document.getElementById("refreshInfo");
    if (lastRefreshTime) {
      el.textContent = "最后刷新 " + formatDateTime(lastRefreshTime);
    }
  }

  function canRefresh() {
    if (!lastTriggerTime) return true;
    var elapsed = Date.now() - lastTriggerTime;
    if (elapsed < REFRESH_COOLDOWN) {
      var remain = Math.ceil((REFRESH_COOLDOWN - elapsed) / 1000 / 60);
      return { allowed: false, remain: remain + " 分钟" };
    }
    return true;
  }

  async function getUpdatedAt(path) {
    try {
      var data = await loadJSON(path);
      return data && data.updated_at ? data.updated_at : null;
    } catch (e) { return null; }
  }

  async function reFetchAndRender() {
    currentNewsSource = 0;
    currentHotPlatform = 0;
    currentJournalIdx = 0;

    // Clear user-generated commentary on refresh (data is fresh now)
    localStorage.removeItem("gdp_commentary_news");
    localStorage.removeItem("gdp_commentary_academic");
    document.getElementById("publishNewsBtn").style.display = "none";
    document.getElementById("publishAcademicBtn").style.display = "none";

    var hasError = false;
    var [headlines, hotlists, papers, commentaryNews, commentaryAcademic, academicUpdate] = await Promise.all([
      loadJSON(DATA_BASE + "/news/headlines.json").catch(function () { return null; }),
      loadJSON(DATA_BASE + "/news/hotlists.json").catch(function () { return null; }),
      loadJSON(DATA_BASE + "/academic/papers_index.json").catch(function () { return null; }),
      loadJSON(DATA_BASE + "/academic/commentary_news.json").catch(function () { return null; }),
      loadJSON(DATA_BASE + "/academic/commentary.json").catch(function () { return null; }),
      loadJSON(DATA_BASE + "/academic/last_update.json").catch(function () { return null; })
    ]);

    if (headlines) renderHeadlines(headlines); else hasError = true;
    if (hotlists) renderHotlists(hotlists); else hasError = true;
    if (papers) renderAcademic(papers); else hasError = true;

    var newsUpdatedAt = (headlines && headlines.updated_at) ? headlines.updated_at : null;
    var acaUpdatedAt = (academicUpdate && academicUpdate.updated_at) ? academicUpdate.updated_at : null;
    renderCommentary(commentaryNews, commentaryAcademic, newsUpdatedAt, acaUpdatedAt);

    updateTimeNotes(headlines, papers, academicUpdate);
    loadKnowledge();
    return hasError;
  }

  async function refreshAllData() {
    if (refreshInProgress) return;

    var rateCheck = canRefresh();
    if (rateCheck !== true) {
      var se = document.getElementById("updateStatus");
      se.textContent = "⏳ " + rateCheck.remain + " 后再刷新";
      se.style.color = "#fbbf24";
      return;
    }

    refreshInProgress = true;
    var btn = document.getElementById("refreshBtn");
    var statusEl = document.getElementById("updateStatus");
    btn.style.animation = "spin 0.8s linear infinite";

    var token = getGitHubToken();

    // 没有 token → 静默重载（仅重新拉取静态数据）
    if (!token) {
      statusEl.textContent = "🔄 重新加载...";
      var h = await reFetchAndRender();
      lastRefreshTime = new Date();
      showRefreshTime();
      statusEl.textContent = h ? "⚠️ 部分数据加载失败" : "✅ 数据已更新";
      statusEl.style.color = h ? "#fbbf24" : "#6ee7b7";
      btn.style.animation = "";
      refreshInProgress = false;
      return;
    }

    // 记录旧数据指纹
    var oldNews = await getUpdatedAt(DATA_BASE + "/news/headlines.json");
    var oldHot = await getUpdatedAt(DATA_BASE + "/news/hotlists.json");
    var oldPapersLen = null;
    try {
      var p = await loadJSON(DATA_BASE + "/academic/papers_index.json");
      if (p) oldPapersLen = p.length;
    } catch (e) {}

    statusEl.textContent = "📡 正在触发抓取...";
    lastTriggerTime = Date.now();
    localStorage.setItem("gdp_last_trigger", String(lastTriggerTime));

    try {
      var result = await triggerWorkflows(token);
      var triggered = result && result.status === "triggered";
      statusEl.textContent = triggered ? "⏳ 等待数据更新..." : "⚠️ 部分抓取触发失败，继续等待...";
      statusEl.style.color = triggered ? "#6ee7b7" : "#fbbf24";

      // 轮询检测数据是否已更新
      var deadline = Date.now() + POLL_TIMEOUT;
      var updated = false;
      while (Date.now() < deadline) {
        await new Promise(function (r) { setTimeout(r, POLL_INTERVAL); });
        var newNews = await getUpdatedAt(DATA_BASE + "/news/headlines.json");
        var newHot = await getUpdatedAt(DATA_BASE + "/news/hotlists.json");
        var newPapersLen = null;
        try {
          var p2 = await loadJSON(DATA_BASE + "/academic/papers_index.json");
          if (p2) newPapersLen = p2.length;
        } catch (e) {}
        if ((newNews && newNews !== oldNews) || (newHot && newHot !== oldHot) || (newPapersLen !== null && newPapersLen !== oldPapersLen)) {
          statusEl.textContent = "📥 检测到新数据，正在加载...";
          updated = true;
          break;
        }
      }

      // 轮询结束后无论是否检测到新数据都重新加载一次
      var hasError = await reFetchAndRender();
      lastRefreshTime = new Date();
      showRefreshTime();
      var msg;
      if (triggered && !updated) {
        msg = "⏳ 抓取已完成，部署中请稍后刷新...";
      } else {
        msg = updated ? "✅ 数据已更新" : "🔄 已重新加载";
      }
      if (hasError) msg = "⚠️ 部分数据加载失败";
      statusEl.textContent = msg;
      statusEl.style.color = hasError ? "#fbbf24" : "#6ee7b7";

    } catch (err) {
      console.error("Refresh trigger error:", err);
      statusEl.textContent = "❌ 刷新请求失败";
      statusEl.style.color = "#fca5a5";
      await reFetchAndRender();
      lastRefreshTime = new Date();
      showRefreshTime();
    }

    btn.style.animation = "";
    refreshInProgress = false;
  }

  // ---- Main ----
  async function init() {
    document.getElementById("currentDate").textContent = "📅 " + formatDate(new Date());
    initNav();

    var statusEl = document.getElementById("updateStatus");
    var hasError = false;

    try {
      var [headlines, hotlists, papers, commentaryNews, commentaryAcademic, academicUpdate] = await Promise.all([
        loadJSON(DATA_BASE + "/news/headlines.json").catch(function () { return null; }),
        loadJSON(DATA_BASE + "/news/hotlists.json").catch(function () { return null; }),
        loadJSON(DATA_BASE + "/academic/papers_index.json").catch(function () { return null; }),
        loadJSON(DATA_BASE + "/academic/commentary_news.json").catch(function () { return null; }),
        loadJSON(DATA_BASE + "/academic/commentary.json").catch(function () { return null; }),
        loadJSON(DATA_BASE + "/academic/last_update.json").catch(function () { return null; })
      ]);

      if (headlines) {
        renderHeadlines(headlines);
      } else {
        document.getElementById("headlines-list").innerHTML = "<div class=\"error-msg\">新闻数据加载失败</div>";
        hasError = true;
      }

      if (hotlists) {
        renderHotlists(hotlists);
      } else {
        document.getElementById("hotlists-content").innerHTML = "<div class=\"error-msg\">热搜数据加载失败</div>";
        hasError = true;
      }

      if (papers) {
        renderAcademic(papers);
      } else {
        document.getElementById("academic-content").innerHTML = "<div class=\"error-msg\">学术数据加载失败</div>";
        hasError = true;
      }

      var newsUpdatedAt = (headlines && headlines.updated_at) ? headlines.updated_at : null;
      var acaUpdatedAt = (academicUpdate && academicUpdate.updated_at) ? academicUpdate.updated_at : null;
      renderCommentary(commentaryNews, commentaryAcademic, newsUpdatedAt, acaUpdatedAt);

      updateTimeNotes(headlines, papers, academicUpdate);
      loadKnowledge();
      initVisitCounter();

      lastRefreshTime = new Date();
      lastTriggerTime = parseInt(localStorage.getItem("gdp_last_trigger") || "0", 10);
      showRefreshTime();
      initTokenUI();
      initDeepSeekUI();
      statusEl.textContent = hasError ? "⚠️ 部分数据加载失败" : "✅ 数据已更新";
      statusEl.style.color = hasError ? "#fbbf24" : "#6ee7b7";

    } catch (err) {
      console.error("App init error:", err);
      statusEl.textContent = "❌ 数据加载失败";
      statusEl.style.color = "#fca5a5";
    }

    // Manual refresh button
    document.getElementById("refreshBtn").addEventListener("click", refreshAllData);

    // Token setup click
    var tokenStatus = document.getElementById("tokenStatus");
    if (tokenStatus) {
      tokenStatus.addEventListener("click", function () {
        var current = getGitHubToken();
        var input = prompt("请输入 GitHub Personal Access Token：", current);
        if (input !== null) {
          localStorage.setItem("gdp_github_token", input);
          initTokenUI();
          document.getElementById("updateStatus").textContent = input ? "✅ Token 已设置" : "⚠️ Token 已清除";
          document.getElementById("updateStatus").style.color = input ? "#6ee7b7" : "#fbbf24";
        }
      });
    }

    // DeepSeek key setup
    var dsStatus = document.getElementById("deepseekStatus");
    if (dsStatus) {
      dsStatus.addEventListener("click", function () {
        var current = getDeepSeekKey();
        var input = prompt("请输入 DeepSeek API Key：", current);
        if (input !== null) {
          localStorage.setItem("gdp_deepseek_key", input);
          initDeepSeekUI();
          document.getElementById("updateStatus").textContent = input ? "✅ DeepSeek Key 已设置" : "⚠️ DeepSeek Key 已清除";
          document.getElementById("updateStatus").style.color = input ? "#6ee7b7" : "#fbbf24";
        }
      });
    }

    // Commentary tab switching
    var commentaryTabs = document.getElementById("commentaryTabs");
    if (commentaryTabs) {
      commentaryTabs.addEventListener("click", function (e) {
        var btn = e.target.closest(".tab-btn");
        if (!btn) return;
        document.querySelectorAll("#commentaryTabs .tab-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var target = btn.dataset.commentary;
        document.querySelectorAll(".commentary-pane").forEach(function (p) { p.classList.remove("active"); });
        var pane = document.querySelector(".commentary-pane[data-pane=\"" + target + "\"]");
        if (pane) pane.classList.add("active");
      });
    }

    // Generate buttons
    document.querySelectorAll(".generate-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        generateCommentary(btn.dataset.type);
      });
    });

    // Publish buttons
    document.getElementById("publishNewsBtn").addEventListener("click", function () {
      publishCommentary("news");
    });
    document.getElementById("publishAcademicBtn").addEventListener("click", function () {
      publishCommentary("academic");
    });

    // Auto-refresh every 6 hours
    setInterval(refreshAllData, 6 * 60 * 60 * 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
