"""English Academic Journal Scraper - Phase 2+: RSS + CrossRef enrichment."""
import re, sys, time
from datetime import datetime
from pathlib import Path

import yaml
import feedparser
import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage(base_dir=str(Path(__file__).parent.parent.parent / "docs" / "data"))
CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "journals_english.yaml"
CROSSREF_MAILTO = "graspdailypush@example.com"  # polite identifier for CrossRef API
MAX_PAPERS_PER_JOURNAL = 30


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def doi_from_entry(entry):
    doi = ""
    doi_re = r"10\.\d{4,}/[a-zA-Z0-9._()/-]+"
    for link_ in entry.get("links", []):
        href = link_.get("href", "")
        m = re.search(doi_re, href)
        if m:
            doi = m.group(0)
            break
    if not doi:
        m = re.search(doi_re, entry.get("summary", ""))
        if m:
            doi = m.group(0)
    if not doi:
        m = re.search(doi_re, entry.get("id", ""))
        if m:
            doi = m.group(0)
    # Also try direct "link" top-level key
    if not doi:
        m = re.search(doi_re, entry.get("link", ""))
        if m:
            doi = m.group(0)
    return doi.split("<")[0].strip()


def extract_authors(entry):
    authors = []
    if hasattr(entry, "authors") and entry.authors:
        authors = [a.get("name", "") for a in entry.authors if a.get("name")]
    if not authors and hasattr(entry, "dc_creator"):
        creators = entry.get("dc_creator", "")
        if isinstance(creators, list):
            authors = creators
        elif creators:
            authors = [creators]
    # Try to parse from summary for ScienceDirect
    if not authors:
        summary = entry.get("summary", "")
        m = re.search(r"Author\(s\)[:\s]+(.+)", summary)
        if m:
            raw = m.group(1).strip()
            authors = [a.strip() for a in re.split(r",|;", raw) if a.strip()]
    return authors


def extract_volume_issue_pages(entry):
    """Extract volume/issue/pages from summary HTML (ScienceDirect pattern)."""
    summary = entry.get("summary", "")
    vol = ""
    issue = ""
    pages = ""
    m = re.search(r"Volume\s+(\d+)", summary)
    if m:
        vol = m.group(1)
    m = re.search(r"Issue\s+(\d+)", summary)
    if m:
        issue = m.group(1)
    m = re.search(r"Pages\s+(\d+[-–]\d+)", summary)
    if m:
        pages = m.group(1).replace("–", "-")
    # Also check prism fields for Nature
    if not vol:
        vol = entry.get("prism_volume", "") or ""
    if not issue:
        issue = entry.get("prism_number", "") or ""
    if not pages:
        sp = entry.get("prism_startingpage", "") or ""
        ep = entry.get("prism_endingpage", "") or ""
        if sp and ep:
            pages = f"{sp}-{ep}"
        elif sp:
            pages = sp
    return vol, issue, pages


def fetch_via_rss(journal):
    """Parse RSS feed, return list of partial paper dicts."""
    url = journal.get("url", "")
    if not url:
        return []
    try:
        feed = feedparser.parse(url)
    except Exception as e:
        print(f"    RSS parse error: {e}")
        return []

    if feed.bozo and not feed.entries:
        print(f"    RSS failed: {feed.bozo_exception if hasattr(feed, 'bozo_exception') else 'unknown'}")
        return []

    papers = []
    for entry in feed.entries:
        title = entry.get("title", "").strip()
        if not title:
            continue
        published = entry.get("published_parsed") or entry.get("updated_parsed")
        pub_date = None
        if published:
            pub_date = datetime(*published[:6]).strftime("%Y-%m-%d")

        summary = entry.get("summary", "") or ""
        summary_clean = re.sub(r"<[^>]+>", "", summary).strip()

        doi = doi_from_entry(entry)
        authors = extract_authors(entry)
        vol, issue, pages = extract_volume_issue_pages(entry)

        paper_id = re.sub(r"[^a-zA-Z0-9]", "-", title[:40])
        paper_id = f"{journal['name'][:4].upper()}-{pub_date or '0000'}-{paper_id}"

        theme = "green" if "green" in journal.get("topics", ["green"]) else "digital"

        papers.append({
            "id": paper_id,
            "title": title,
            "journal": journal["name"],
            "publisher": journal.get("publisher", ""),
            "authors": authors,
            "doi": doi,
            "volume": vol,
            "issue": issue,
            "pages": pages,
            "abstract": summary_clean[:1200] if summary_clean else "",
            "keywords": [],
            "theme": theme,
            "publication_date": pub_date or "",
            "is_new": True,
        })
    return papers


def fetch_via_crossref(journal):
    """Use CrossRef REST API to fetch papers with full metadata."""
    issn = journal.get("issn", "")
    if not issn:
        print("    No ISSN configured for CrossRef fallback")
        return []

    # Get papers from last 2 years
    from_date = datetime.now().strftime("%Y") + "-01-01"
    url = (
        f"https://api.crossref.org/works"
        f"?filter=issn:{issn},from-pub-date:{from_date}"
        f"&rows={MAX_PAPERS_PER_JOURNAL}&order=desc&sort=published"
    )
    try:
        r = requests.get(url, headers={
            "User-Agent": f"GraspDailyPush/1.0 (mailto:{CROSSREF_MAILTO})"
        }, timeout=20)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"    CrossRef request failed: {e}")
        return []

    items = data.get("message", {}).get("items", [])
    if not items:
        print("    No items from CrossRef")
        return []

    papers = []
    for item in items:
        title = (item.get("title") or [""])[0]
        if not title:
            continue
        doi = item.get("DOI", "")
        vol = item.get("volume", "") or ""
        issue = item.get("issue", "") or ""
        pages = item.get("page", "") or ""

        authors = []
        for a in item.get("author", []):
            given = a.get("given", "")
            family = a.get("family", "")
            if family:
                authors.append(f"{given} {family}".strip() if given else family)

        pub_parts = item.get("published-print", {}).get("date-parts", [[None]])[0]
        if not any(pub_parts):
            pub_parts = item.get("published-online", {}).get("date-parts", [[None]])[0]
        pub_date = "-".join(str(p) for p in pub_parts) if any(pub_parts) else ""

        abstract_raw = item.get("abstract", "") or ""
        abstract = re.sub(r"<[^>]+>", "", abstract_raw).strip()[:1200]

        # Try to get keywords from CrossRef (rarely populated)
        keywords = item.get("subject", []) or []

        paper_id = re.sub(r"[^a-zA-Z0-9]", "-", title[:40])
        paper_id = f"{journal['name'][:4].upper()}-{pub_date or '0000'}-{paper_id}"

        theme = "green" if "green" in journal.get("topics", ["green"]) else "digital"

        papers.append({
            "id": paper_id,
            "title": title,
            "journal": journal["name"],
            "publisher": journal.get("publisher", ""),
            "authors": authors,
            "doi": doi,
            "volume": vol,
            "issue": issue,
            "pages": pages,
            "abstract": abstract,
            "keywords": keywords,
            "theme": theme,
            "publication_date": pub_date,
            "is_new": True,
        })

    return papers


def enrich_from_crossref(papers):
    """Batch enrich papers with volume/issue/pages via CrossRef by DOI."""
    dois = [p["doi"] for p in papers if p["doi"] and not all([p.get("volume", ""), p.get("issue", ""), p.get("pages", "")])]
    dois = list(set(dois))
    if not dois:
        return papers

    # Query in batches of 20 (CrossRef allows multiple DOI filter)
    doi_map = {}
    for i in range(0, len(dois), 20):
        batch = dois[i:i + 20]
        filter_str = ",".join(f"doi:{d}" for d in batch)
        url = f"https://api.crossref.org/works?filter={filter_str}&rows=20"
        try:
            r = requests.get(url, headers={
                "User-Agent": f"GraspDailyPush/1.0 (mailto:{CROSSREF_MAILTO})"
            }, timeout=20)
            data = r.json()
            for item in data.get("message", {}).get("items", []):
                d = item.get("DOI", "")
                if d:
                    doi_map[d] = item
        except Exception:
            pass
        time.sleep(0.2)  # polite delay

    for p in papers:
        d = p.get("doi", "")
        if d in doi_map:
            item = doi_map[d]
            if not p.get("volume"):
                p["volume"] = item.get("volume", "") or ""
            if not p.get("issue"):
                p["issue"] = item.get("issue", "") or ""
            if not p.get("pages"):
                p["pages"] = item.get("page", "") or ""

    return papers


def is_future_date(date_str):
    """Check if publication_date is in the future (pre-pub / ahead of print)."""
    if not date_str:
        return False
    try:
        pub = datetime.strptime(date_str, "%Y-%m-%d")
        return pub > datetime.now()
    except ValueError:
        pass
    try:
        pub = datetime.strptime(date_str, "%Y-%m")
        return pub > datetime.now().replace(day=1)
    except ValueError:
        pass
    return False


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
        jtype = journal.get("type", "rss")
        print(f"Fetching: {name} (type={jtype})")

        papers = []
        if jtype == "crossref":
            papers = fetch_via_crossref(journal)
        else:
            papers = fetch_via_rss(journal)
            if papers:
                papers = enrich_from_crossref(papers)
            else:
                # RSS failed, try CrossRef as fallback
                print(f"    RSS returned no data, trying CrossRef fallback...")
                papers = fetch_via_crossref(journal)

        if not papers:
            print(f"    0 papers")
            continue

        # Filter future-dated papers (pre-pub / ahead of print)
        before = len(papers)
        papers = [p for p in papers if not is_future_date(p.get("publication_date", ""))]
        filtered = before - len(papers)
        if filtered:
            print(f"    Filtered {filtered} future-dated papers")

        count = 0
        for paper in papers:
            pid = paper["id"]
            if pid not in existing_ids:
                all_papers.append(paper)
                count += 1

        print(f"  Got {len(papers)} entries, {count} new")

    # Mark existing papers as not new
    for p in existing:
        p["is_new"] = False

    if all_papers:
        merged = all_papers + existing
        merged.sort(key=lambda p: p.get("publication_date", ""), reverse=True)
        storage.write("academic/papers_index.json", merged)
        print(f"Saved {len(all_papers)} new + {len(existing)} existing = {len(merged)} total")
    else:
        storage.write("academic/papers_index.json", existing)
        print("No new papers found.")


if __name__ == "__main__":
    main()
