"""News Headlines Scraper - Phase 3: RSS + HTML scraping for real article URLs."""
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import yaml
import feedparser
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage(base_dir=str(Path(__file__).parent.parent.parent / "docs" / "data"))
CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "news_sources.yaml"
CST = timezone(timedelta(hours=8))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def fetch_rss(url, max_items=10):
    """Fetch articles from RSS feed."""
    try:
        feed = feedparser.parse(url)
    except Exception as e:
        print(f"    RSS error: {e}")
        return []
    if feed.bozo and not feed.entries:
        return []
    results = []
    for entry in feed.entries[:max_items]:
        title = entry.get("title", "").strip()
        link = entry.get("link", "").strip()
        if not title or not link:
            continue
        summary = re.sub(r"<[^>]+>", "", entry.get("summary", "") or "").strip()[:200]
        published = entry.get("published_parsed") or entry.get("updated_parsed")
        pub_date = ""
        if published:
            pub_date = datetime(*published[:6]).strftime("%Y-%m-%d")
        results.append({
            "title": title,
            "url": link,
            "summary": summary,
            "time": pub_date,
        })
    return results


def fetch_xinhuanet():
    """Scrape XinhuaNet (www.news.cn) homepage for article links."""
    print("  Scraping www.news.cn ...")
    try:
        r = requests.get("https://www.news.cn", headers=HEADERS, timeout=15)
        r.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    items = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        title = a.get_text(strip=True)
        if len(title) < 8:
            continue
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = "https://www.news.cn" + href
        if "news.cn" not in href:
            continue
        if not re.search(r"/\d{8}/", href):
            continue
        if href in seen:
            continue
        if not href.endswith(".html"):
            href = href.rstrip("/") + ".html"
        seen.add(href)
        items.append({
            "title": title,
            "url": href,
            "summary": "",
            "time": "",
        })
    items = items[:10]
    print(f"    Got {len(items)} articles")
    return items


def _abs_url(href, base_domain):
    """Convert relative URL to absolute."""
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return "https://" + base_domain + href
    if href.startswith("http://") or href.startswith("https://"):
        return href
    return "https://" + base_domain + "/" + href


def fetch_cctv():
    """Scrape CCTV (www.cctv.com) homepage."""
    print("  Scraping www.cctv.com ...")
    try:
        r = requests.get("https://www.cctv.com", headers=HEADERS, timeout=15)
        r.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    items = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        title = a.get_text(strip=True)
        if len(title) < 8:
            continue
        url = _abs_url(href, "www.cctv.com")
        if url in seen:
            continue
        seen.add(url)
        items.append({"title": title, "url": url, "summary": "", "time": ""})
    items = items[:10]
    print(f"    Got {len(items)} articles")
    return items


def fetch_cecn():
    """Scrape China Economic Net (www.ce.cn) homepage."""
    print("  Scraping www.ce.cn ...")
    try:
        r = requests.get("https://www.ce.cn", headers=HEADERS, timeout=15)
        r.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    items = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        title = a.get_text(strip=True)
        if len(title) < 8:
            continue
        url = _abs_url(href, "www.ce.cn")
        if url in seen:
            continue
        seen.add(url)
        items.append({"title": title, "url": url, "summary": "", "time": ""})
    items = items[:10]
    print(f"    Got {len(items)} articles")
    return items


def fetch_zaobao():
    """Scrape Zaobao (www.zaobao.com.sg) homepage."""
    print("  Scraping www.zaobao.com.sg ...")
    try:
        r = requests.get("https://www.zaobao.com.sg", headers=HEADERS, timeout=15)
        r.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    items = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        title = a.get_text(strip=True)
        if len(title) < 15:
            continue
        url = _abs_url(href, "www.zaobao.com.sg")
        if url in seen:
            continue
        seen.add(url)
        items.append({"title": title, "url": url, "summary": "", "time": ""})
    items = items[:10]
    print(f"    Got {len(items)} articles")
    return items


def fetch_chinadaily():
    """Scrape China Daily (www.chinadaily.com.cn) homepage."""
    print("  Scraping www.chinadaily.com.cn ...")
    try:
        r = requests.get("https://www.chinadaily.com.cn", headers=HEADERS, timeout=15)
        r.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    items = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        title = a.get_text(strip=True)
        if len(title) < 15:
            continue
        url = _abs_url(href, "www.chinadaily.com.cn")
        if url in seen:
            continue
        if "chinadaily" not in url:
            continue
        seen.add(url)
        items.append({"title": title, "url": url, "summary": "", "time": ""})
    items = items[:10]
    print(f"    Got {len(items)} articles")
    return items


# Source configurations with their fetch methods
SOURCES = [
    ("人民网", "http://www.people.com.cn", lambda: fetch_rss("http://www.people.com.cn/rss/politics.xml", 10)),
    ("新华网", "https://www.xinhuanet.com", fetch_xinhuanet),
    ("中国日报", "https://www.chinadaily.com.cn", fetch_chinadaily),
    ("央视网", "https://www.cctv.com", fetch_cctv),
    ("中国经济网", "https://www.ce.cn", fetch_cecn),
    ("联合早报", "https://www.zaobao.com.sg", fetch_zaobao),
]


def main():
    sources = []
    for name, url, fetcher in SOURCES:
        print(f"Fetching: {name} ({url})")
        try:
            items = fetcher()
        except Exception as e:
            print(f"  ERROR: {e}")
            items = []
        if items:
            sources.append({"name": name, "url": url, "items": items})
        else:
            print(f"  No items fetched")

    data = {
        "updated_at": datetime.now(CST).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "sources": sources,
    }

    storage.write("news/headlines.json", data)
    print(f"\nSaved {len(sources)} sources to headlines.json")


if __name__ == "__main__":
    main()
