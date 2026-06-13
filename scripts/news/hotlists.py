"""Hotlists Scraper - Phase 2: real-time data with clickable URLs."""
import json
import re
import sys
import urllib.parse
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


def _search_url(platform, keyword):
    """Generate a search/topic URL for a given platform and keyword."""
    q = urllib.parse.quote(keyword)
    urls = {
        "baidu": "https://www.baidu.com/s?wd=" + q,
        "weibo": "https://s.weibo.com/weibo?q=" + q + "&type=hot",
        "zhihu": "https://www.zhihu.com/search?type=content&q=" + q,
        "toutiao": "https://www.toutiao.com/search/?keyword=" + q,
        "tieba": "https://tieba.baidu.com/f?kw=" + q,
    }
    return urls.get(platform, "")


def fetch_baidu():
    """Baidu Hot Search with real data and URLs."""
    url = "https://top.baidu.com/board?tab=realtime"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
    except Exception as e:
        print(f"    Request failed: {e}")
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
            items.append({
                "rank": i + 1,
                "title": title,
                "heat": heat,
                "url": _search_url("baidu", title),
            })
    except Exception as e:
        print(f"    Parse failed: {e}")

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
                            items.append({
                                "rank": len(items) + 1,
                                "title": word,
                                "heat": str(content.get("hotScore", "")),
                                "url": _search_url("baidu", word),
                            })
        except Exception as e:
            print(f"    JSON fallback failed: {e}")

    return items


def fetch_weibo():
    """Weibo Hot Search via internal API."""
    api_headers = {
        "User-Agent": HEADERS["User-Agent"],
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://weibo.com",
    }
    try:
        resp = requests.get(
            "https://weibo.com/ajax/side/hotSearch",
            headers=api_headers,
            timeout=15,
        )
    except Exception as e:
        print(f"    Request failed: {e}")
        return []

    items = []
    try:
        data = resp.json()
        realtime = data.get("data", {}).get("realtime", [])
        for entry in realtime:
            word = entry.get("word", "")
            if not word:
                continue
            num = entry.get("num", 0)
            label = entry.get("label_name", "")
            heat = str(num) if num else label
            items.append({
                "rank": len(items) + 1,
                "title": word,
                "heat": heat,
                "url": _search_url("weibo", word),
            })
    except Exception as e:
        print(f"    Parse failed: {e}")

    return items


def fetch_zhihu():
    """Zhihu Hot List (likely 401, fallback to cached)."""
    api_headers = {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": "https://www.zhihu.com",
    }
    try:
        resp = requests.get(
            "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50",
            headers=api_headers,
            timeout=15,
        )
    except Exception as e:
        print(f"    Request failed: {e}")
        return []

    items = []
    try:
        data = resp.json()
        for entry in data.get("data", []):
            target = entry.get("target", {})
            title = (
                target.get("title", "")
                or target.get("question", {}).get("title", "")
            )
            if not title:
                continue
            qid = target.get("id", "") or target.get("question", {}).get("id", "")
            url = "https://www.zhihu.com/question/" + str(qid) if qid else _search_url("zhihu", title)
            items.append({
                "rank": len(items) + 1,
                "title": title,
                "heat": str(entry.get("detail_text", "")),
                "url": url,
            })
    except Exception as e:
        print(f"    Parse failed: {e}")

    return items


def fetch_toutiao():
    """Toutiao Hot Events (likely blocked)."""
    return []


def fetch_tieba():
    """Tieba Hot Topics."""
    try:
        resp = requests.get(
            "https://tieba.baidu.com/hottopic/browse/topicList",
            headers=HEADERS,
            timeout=15,
        )
    except Exception as e:
        print(f"    Request failed: {e}")
        return []

    items = []
    try:
        data = resp.json()
        topics = data.get("data", {}).get("topicList", [])
        for i, topic in enumerate(topics):
            name = topic.get("topicName", "")
            if not name:
                continue
            topic_url = topic.get("topicUrl", "") or _search_url("tieba", name)
            items.append({
                "rank": i + 1,
                "title": name,
                "heat": str(topic.get("discussNum", "")),
                "url": topic_url,
            })
    except Exception as e:
        print(f"    Parse failed: {e}")

    return items


FETCHERS = {
    "baidu": ("百度热搜", fetch_baidu),
    "weibo": ("微博热搜", fetch_weibo),
    "zhihu": ("知乎热榜", fetch_zhihu),
    "toutiao": ("今日头条", fetch_toutiao),
    "tieba": ("百度贴吧", fetch_tieba),
}


def main():
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
            old_items = existing_platforms[name]["items"]
            # Add URLs to cached items that lack them
            for x in old_items:
                if "url" not in x:
                    x["url"] = _search_url(key, x["title"])
            print(f"  Using cached data ({len(old_items)} items)")
            platforms.append({"name": name, "items": old_items})
        else:
            print(f"  No data available")

    data = {
        "updated_at": datetime.now(CST).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "platforms": platforms,
    }

    storage.write("news/hotlists.json", data)
    print(f"\nSaved {len(platforms)} platforms to hotlists.json")


if __name__ == "__main__":
    main()
