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
    content.innerHTML = platform.items.map(function (item) {
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
        var doiHtml = "";
        if (p.doi) {
          var cleanDoi = p.doi.split("<")[0].trim();
          doiHtml = "    <span>🔗 <a class=\"doi-link\" href=\"https://doi.org/" + encodeURIComponent(cleanDoi) + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(cleanDoi) + "</a></span>";
        }
        return [
          "<div class=\"paper-card\" onclick=\"this.classList.toggle('expanded')\">",
          "  <div class=\"paper-title\">" + escapeHtml(p.title) + badge + "</div>",
          "  <div class=\"paper-meta\">",
          "    <span>📄 " + escapeHtml(p.journal) + "</span>",
          "    <span>✍️ " + escapeHtml((p.authors || []).join(", ")) + "</span>",
          doiHtml,
          "  </div>",
          "  <div class=\"paper-detail\">",
          "    <div><span class=\"label\">摘要：</span>" + escapeHtml(p.abstract || "") + "</div>",
          (p.keywords ? "    <div class=\"keywords\">" + p.keywords.map(function (kw) { return "<span class=\"keyword\">" + escapeHtml(kw) + "</span>"; }).join("") + "</div>" : ""),
          "  </div>",
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
      statusEl.textContent = hasError ? "⚠️ 部分数据加载失败" : "✅ 数据已更新";
      statusEl.style.color = hasError ? "#fbbf24" : "#6ee7b7";

    } catch (err) {
      console.error("App init error:", err);
      statusEl.textContent = "❌ 数据加载失败";
      statusEl.style.color = "#fca5a5";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
