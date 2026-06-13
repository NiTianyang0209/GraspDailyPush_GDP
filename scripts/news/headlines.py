"""News Headlines Scraper - precise section scrapers for 3 sources."""
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage(base_dir=str(Path(__file__).parent.parent.parent / "docs" / "data"))
CST = timezone(timedelta(hours=8))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _abs_url(href, base_domain):
    href = href.strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return "https://" + base_domain + href
    if href.startswith("http://") or href.startswith("https://"):
        return href
    return "https://" + base_domain + "/" + href


def fetch_people_yaowen():
    """人民网 要闻播报 - scrape div#rm_bq"""
    print("  人民网 要闻播报 ...")
    try:
        r = requests.get("http://www.people.com.cn", headers=HEADERS, timeout=15)
        r.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    section = soup.find("div", id="rm_bq")
    if not section:
        print("    Section #rm_bq not found")
        return []
    items = []
    for a in section.find_all("a", href=True):
        title = a.get_text(strip=True)
        href = a["href"]
        if len(title) < 6:
            continue
        url = href if href.startswith("http") else "http://www.people.com.cn" + href
        items.append({"title": title, "url": url, "summary": "", "time": ""})
    print(f"    Got {len(items)} articles")
    return items[:10]


def fetch_xinhua_yaowen():
    """新华网 要闻聚焦 - scrape div#main for news.cn article links"""
    print("  新华网 要闻聚焦 ...")
    try:
        r = requests.get("https://www.xinhuanet.com", headers=HEADERS, timeout=15)
        r.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    main = soup.find("div", id="main")
    if not main:
        print("    Section #main not found")
        return []
    items = []
    seen = set()
    for a in main.find_all("a", href=True):
        title = a.get_text(strip=True)
        href = a["href"]
        if len(title) < 8:
            continue
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = "https://www.xinhuanet.com" + href
        if "news.cn" not in href or "zt" in href or "specials" in href:
            continue
        if not re.search(r"/\d{8}/", href):
            continue
        if not href.endswith(".html"):
            href = href.rstrip("/") + ".html"
        if href in seen:
            continue
        seen.add(href)
        items.append({"title": title, "url": href, "summary": "", "time": ""})
    print(f"    Got {len(items)} articles")
    return items[:10]


def fetch_ce_shizheng():
    """中国经济网 时政板块 - scrape .main.clearfix for political news"""
    print("  中国经济网 时政板块 ...")
    try:
        r = requests.get("https://www.ce.cn", headers=HEADERS, timeout=15)
        r.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
        return []
    soup = BeautifulSoup(r.text, "lxml")
    main = soup.find("div", class_="main clearfix")
    if not main:
        print("    Section .main.clearfix not found")
        return []
    items = []
    seen = set()
    for a in main.find_all("a", href=True):
        title = a.get_text(strip=True)
        href = a["href"]
        if len(title) < 8:
            continue
        url = _abs_url(href, "www.ce.cn")
        if url in seen:
            continue
        seen.add(url)
        items.append({"title": title, "url": url, "summary": "", "time": ""})
    print(f"    Got {len(items)} articles")
    return items[:10]


SOURCES = [
    ("人民网·要闻播报", "http://www.people.com.cn", fetch_people_yaowen),
    ("新华网·要闻聚焦", "https://www.xinhuanet.com", fetch_xinhua_yaowen),
    ("中国经济网·时政", "https://www.ce.cn", fetch_ce_shizheng),
]


def main():
    sources = []
    for name, url, fetcher in SOURCES:
        print(f"Fetching: {name}")
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
