"""Hotlists Scraper - Phase 2: Baidu/Zhihu/Weibo/Toutiao/Tieba."""
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import yaml
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
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def fetch_baidu():
    """Scrape Baidu Hot Search (works as of 2025)."""
    url = "https://top.baidu.com/board?tab=realtime"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
    except Exception as e:
        print(f"  Baidu request failed: {e}")
        return []

    items = []
    try:
        soup = BeautifulSoup(resp.text, "lxml")
        for i, div in enumerate(soup.select(".category-wrap_iQLoo")):
            title_el = div.select_one(".c-single-text-ellipsis")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            heat_el = div.select_one(".hot-index_1Bl1a")
            heat = heat_el.get_text(strip=True) if heat_el else ""
            items.append({"rank": i + 1, "title": title, "heat": heat})
    except Exception as e:
        print(f"  Baidu parse failed: {e}")

    if not items:
        try:
            data_match = re.search(r"<!--s-data:(.*?)-->", resp.text, re.DOTALL)
            if data_match:
                data = json.loads(data_match.group(1))
                cards = data.get("data", {}).get("cards", [])
                for card in cards:
                    for content in card.get("content", []):
                        word = content.get("word", "")
                        if word:
                            idx = len(items) + 1
                            items.append({
                                "rank": idx,
                                "title": word,
                                "heat": content.get("hotScore", ""),
                            })
        except Exception as e:
            print(f"  Baidu JSON fallback failed: {e}")

    return items


def fetch_weibo():
    """Scrape Weibo Hot Search (likely blocked)."""
    url = "https://s.weibo.com/top/summary/"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
    except Exception as e:
        print(f"  Weibo request failed: {e}")
        return []

    items = []
    try:
        soup = BeautifulSoup(resp.text, "lxml")
        for tr in soup.select("tbody tr"):
            tds = tr.select("td")
            if len(tds) < 2:
                continue
            rank_el = tds[0].select_one(".rank")
            if not rank_el:
                continue
            rank_text = rank_el.get_text(strip=True)
            if not rank_text.isdigit():
                continue
            title_el = tds[1].select_one("a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            heat_el = tds[1].select_one("span")
            heat = heat_el.get_text(strip=True) if heat_el else ""
            items.append({"rank": int(rank_text), "title": title, "heat": heat})
    except Exception as e:
        print(f"  Weibo parse failed: {e}")

    return items


def fetch_zhihu():
    """Scrape Zhihu Hot List (likely 403)."""
    url = "https://www.zhihu.com/hot"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
    except Exception as e:
        print(f"  Zhihu request failed: {e}")
        return []

    items = []
    try:
        soup = BeautifulSoup(resp.text, "lxml")
        for a in soup.select('a[href*="question/"]'):
            title_el = a.select_one(".HotList-itemTitle")
            if title_el:
                title = title_el.get_text(strip=True)
                if title:
                    items.append({"rank": len(items) + 1, "title": title, "heat": ""})
    except Exception as e:
        print(f"  Zhihu parse failed: {e}")

    return items


def fetch_toutiao():
    """Scrape Toutiao Hot Events (likely blocked)."""
    url = "https://www.toutiao.com/hot-event/"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
    except Exception as e:
        print(f"  Toutiao request failed: {e}")
        return []

    items = []
    try:
        soup = BeautifulSoup(resp.text, "lxml")
        for div in soup.select(".hot-list-item"):
            title_el = div.select_one(".title")
            if title_el:
                title = title_el.get_text(strip=True)
                items.append({"rank": len(items) + 1, "title": title, "heat": ""})
    except Exception as e:
        print(f"  Toutiao parse failed: {e}")

    return items


def fetch_tieba():
    """Scrape Baidu Tieba Hot Topics."""
    url = "https://tieba.baidu.com/hottopic/browse/topicList"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
    except Exception as e:
        print(f"  Tieba request failed: {e}")
        return []

    items = []
    try:
        data = resp.json()
        topics = data.get("data", {}).get("topicList", [])
        for i, topic in enumerate(topics):
            items.append({
                "rank": i + 1,
                "title": topic.get("topicName", ""),
                "heat": str(topic.get("discussNum", "")),
            })
    except Exception as e:
        print(f"  Tieba parse failed: {e}")

    return items


FETCHERS = {
    "baidu": ("百度热搜", fetch_baidu),
    "weibo": ("微博热搜", fetch_weibo),
    "zhihu": ("知乎热榜", fetch_zhihu),
    "toutiao": ("今日头条", fetch_toutiao),
    "tieba": ("百度贴吧", fetch_tieba),
}


def main():
    config = load_config()
    hotlists_cfg = {}
    for h in config.get("news", {}).get("hotlists", []):
        platform = h.get("platform")
        if platform:
            hotlists_cfg[platform] = h

    existing_data = storage.read("news/hotlists.json") or {}
    existing_platforms = {p["name"]: p for p in existing_data.get("platforms", [])}

    platforms = []
    for key, (name, fetcher) in FETCHERS.items():
        print(f"Fetching: {name}...")
        try:
            items = fetcher()
        except Exception as e:
            print(f"  ERROR: {e}")
            items = []

        if items:
            print(f"  Got {len(items)} items")
            platforms.append({"name": name, "items": items})
        elif name in existing_platforms:
            print(f"  Using cached data ({len(existing_platforms[name]['items'])} items)")
            platforms.append(existing_platforms[name])
        else:
            print(f"  No data available (blocked)")

    data = {
        "updated_at": datetime.now(CST).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "platforms": platforms,
    }

    storage.write("news/hotlists.json", data)
    print(f"\nSaved {len(platforms)} platforms to hotlists.json")


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


if __name__ == "__main__":
    main()
