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

  // ---- Render Commentary ----
  function renderCommentary(data) {
    var container = document.getElementById("commentary-content");
    if (!data || !data.commentary) {
      container.innerHTML = "<div class=\"loading\">暂无点评</div>";
      return;
    }
    container.innerHTML = [
      "<div class=\"text\">" + escapeHtml(data.commentary) + "</div>",
      "<div class=\"meta\">",
      "  <span>本期收录: " + (data.total_papers || 0) + " 篇" +
        " (绿色 " + (data.green_papers || 0) + " · 数字 " + (data.digital_papers || 0) + ")</span>",
      "  <span>生成于 " + formatDateTime(data.generated_at) + "</span>",
      "</div>"
    ].join("\n");
  }

  // ---- Update Time Note ----
  function updateTimeNotes(newsData, academicData, commentaryData) {
    if (newsData && newsData.updated_at) {
      document.getElementById("newsUpdateTime").textContent = "⏱ " + formatDateTime(newsData.updated_at);
    }
    if (academicData && academicData.length > 0) {
      var dates = academicData.map(function (p) { return new Date(p.publication_date); }).filter(Boolean);
      if (dates.length > 0) {
        var maxDate = new Date(Math.max.apply(null, dates));
        document.getElementById("academicUpdateTime").textContent = "📅 " + formatDate(maxDate);
      }
    }
    if (commentaryData && commentaryData.generated_at) {
      document.getElementById("commentaryTime").textContent = "🤖 " + formatDateTime(commentaryData.generated_at);
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

  // ---- Trigger GitHub Actions ----
  async function triggerWorkflows(token) {
    var owner = "NiTianyang0209";
    var repo = "GraspDailyPush_GDP";
    var workflows = ["scrape-all.yml"];
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

    var hasError = false;
    var [headlines, hotlists, papers, commentary] = await Promise.all([
      loadJSON(DATA_BASE + "/news/headlines.json").catch(function () { return null; }),
      loadJSON(DATA_BASE + "/news/hotlists.json").catch(function () { return null; }),
      loadJSON(DATA_BASE + "/academic/papers_index.json").catch(function () { return null; }),
      loadJSON(DATA_BASE + "/academic/commentary.json").catch(function () { return null; })
    ]);

    if (headlines) renderHeadlines(headlines); else hasError = true;
    if (hotlists) renderHotlists(hotlists); else hasError = true;
    if (papers) renderAcademic(papers); else hasError = true;
    if (commentary) renderCommentary(commentary); else hasError = true;

    updateTimeNotes(headlines, papers, commentary);
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

      var hasError = await reFetchAndRender();
      lastRefreshTime = new Date();
      showRefreshTime();
      var msg = updated ? "✅ 数据已更新" : "⏰ 当前数据已加载";
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
      var [headlines, hotlists, papers, commentary] = await Promise.all([
        loadJSON(DATA_BASE + "/news/headlines.json").catch(function () { return null; }),
        loadJSON(DATA_BASE + "/news/hotlists.json").catch(function () { return null; }),
        loadJSON(DATA_BASE + "/academic/papers_index.json").catch(function () { return null; }),
        loadJSON(DATA_BASE + "/academic/commentary.json").catch(function () { return null; })
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

      if (commentary) {
        renderCommentary(commentary);
      } else {
        document.getElementById("commentary-content").innerHTML = "<div class=\"error-msg\">点评数据加载失败</div>";
        hasError = true;
      }

      updateTimeNotes(headlines, papers, commentary);
      loadKnowledge();
      initVisitCounter();

      lastRefreshTime = new Date();
      lastTriggerTime = parseInt(localStorage.getItem("gdp_last_trigger") || "0", 10);
      showRefreshTime();
      initTokenUI();
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

    // Auto-refresh every 6 hours
    setInterval(refreshAllData, 6 * 60 * 60 * 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
