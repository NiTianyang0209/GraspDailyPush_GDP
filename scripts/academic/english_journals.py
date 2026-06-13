"""English Academic Journal Scraper - Phase 2: RSS scraping with feedparser."""
import re
import sys
from datetime import datetime
from pathlib import Path

import yaml
import feedparser

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage(base_dir=str(Path(__file__).parent.parent.parent / "docs" / "data"))
CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "journals_english.yaml"


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def parse_rss_entry(entry, journal_name, topics):
    title = entry.get("title", "").strip()
    link = entry.get("link", "").strip()
    published = entry.get("published_parsed") or entry.get("updated_parsed")
    pub_date = None
    if published:
        pub_date = datetime(*published[:6]).strftime("%Y-%m-%d")

    authors = []
    if hasattr(entry, "authors") and entry.authors:
        authors = [a.get("name", "") for a in entry.authors if a.get("name")]
    if not authors and hasattr(entry, "dc_creator"):
        creators = entry.get("dc_creator", "")
        if isinstance(creators, list):
            authors = creators
        elif creators:
            authors = [creators]

    summary = entry.get("summary", "") or ""
    summary_clean = re.sub(r"<[^>]+>", "", summary).strip()

    doi = ""
    doi_re = r"10\.\d{4,}/[a-zA-Z0-9._()/-]+"
    for link_ in entry.get("links", []):
        href = link_.get("href", "")
        m = re.search(doi_re, href)
        if m:
            doi = m.group(0)
            break
    if not doi:
        m = re.search(doi_re, summary)
        if m:
            doi = m.group(0)
    doi = doi.split("<")[0].strip()

    paper_id = re.sub(r"[^a-zA-Z0-9]", "-", title[:40])
    paper_id = f"{journal_name[:4].upper()}-{pub_date or '0000'}-{paper_id}"

    theme = "green" if "green" in topics else "digital"

    return {
        "id": paper_id,
        "title": title,
        "journal": journal_name,
        "authors": authors,
        "doi": doi,
        "abstract": summary_clean[:800] if summary_clean else "",
        "theme": theme,
        "publication_date": pub_date or "",
        "is_new": True,
    }


def main():
    config = load_config()
    journals = config.get("journals", [])
    if not journals:
        print("No journals configured.")
        return

    all_papers = []
    existing = storage.read("academic/papers_index.json") or []
    existing_ids = {p["id"] for p in existing if "id" in p}

    for journal in journals:
        name = journal["name"]
        url = journal["url"]
        topics = journal.get("topics", ["green"])
        print(f"Fetching: {name} ({url})")

        try:
            feed = feedparser.parse(url)
        except Exception as e:
            print(f"  FAILED to fetch: {e}")
            continue

        if feed.bozo and not feed.entries:
            print(f"  FAILED: feed is malformed, no entries")
            continue

        count = 0
        for entry in feed.entries:
            paper = parse_rss_entry(entry, name, topics)
            if paper["id"] not in existing_ids:
                all_papers.append(paper)
                count += 1

        print(f"  Found {len(feed.entries)} entries, {count} new")

    # Mark existing papers as not new
    for p in existing:
        p["is_new"] = False

    if all_papers:
        merged = all_papers + existing
        merged.sort(key=lambda p: p.get("publication_date", ""), reverse=True)
        storage.write("academic/papers_index.json", merged)
        print(f"Saved {len(all_papers)} new + {len(existing)} existing = {len(merged)} total")
    else:
        # Even if no new papers, update existing with is_new=False
        storage.write("academic/papers_index.json", existing)
        print("No new papers found. Existing papers marked as not new.")


if __name__ == "__main__":
    main()
