"""English Academic Journal Scraper - Phase 2+: RSS + CrossRef enrichment + title backfill."""
import re, sys, time, html as html_mod
from datetime import datetime
from pathlib import Path

import yaml
import feedparser
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage(base_dir=str(Path(__file__).parent.parent.parent / "docs" / "data"))
CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "journals_english.yaml"
CROSSREF_MAILTO = "graspdailypush@example.com"
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
        if m: doi = m.group(0); break
    if not doi:
        m = re.search(doi_re, entry.get("summary", ""))
        if m: doi = m.group(0)
    if not doi:
        m = re.search(doi_re, entry.get("id", ""))
        if m: doi = m.group(0)
    if not doi:
        m = re.search(doi_re, entry.get("link", ""))
        if m: doi = m.group(0)
    return doi.split("<")[0].strip()


def extract_authors(entry):
    authors = []
    if hasattr(entry, "authors") and entry.authors:
        authors = [a.get("name", "") for a in entry.authors if a.get("name")]
    if not authors and hasattr(entry, "dc_creator"):
        creators = entry.get("dc_creator", "")
        authors = creators if isinstance(creators, list) else [creators] if creators else []
    # Try ScienceDirect pattern from raw summary
    if not authors:
        m = re.search(r"Author\(s\)[:\s]+(.*?)(?:</p>|<br)", entry.get("summary", ""), re.DOTALL)
        if m:
            raw = html_mod.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
            authors = [a.strip() for a in re.split(r",(?:\s*and\s*|\s*)", raw) if a.strip()]
    return authors


def extract_volume_issue_pages(entry):
    summary = entry.get("summary", "")
    vol = ""; issue = ""; pages = ""
    m = re.search(r"Volume\s+(\d+)", summary)
    if m: vol = m.group(1)
    m = re.search(r"Issue\s+(\d+)", summary)
    if m: issue = m.group(1)
    m = re.search(r"Pages\s+(\d+[-–]\d+)", summary)
    if m: pages = m.group(1).replace("–", "-")
    if not vol: vol = entry.get("prism_volume", "") or ""
    if not issue: issue = entry.get("prism_number", "") or ""
    if not pages:
        sp = entry.get("prism_startingpage", "") or ""
        ep = entry.get("prism_endingpage", "") or ""
        pages = f"{sp}-{ep}" if sp and ep else sp
    return vol, issue, pages


def parse_sd_summary(summary):
    """Parse ScienceDirect RSS summary HTML into metadata + abstract."""
    soup = BeautifulSoup(summary, "lxml")
    abstract_parts = []
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if not text:
            continue
        # Skip metadata lines
        if text.startswith("Publication date:") or text.startswith("Source:") or text.startswith("Author(s)"):
            continue
        abstract_parts.append(text)
    return "\n".join(abstract_parts)


def fetch_via_rss(journal):
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

        raw_summary = entry.get("summary", "") or ""
        # For ScienceDirect, parse summary properly
        is_sciencedirect = "sciencedirect" in (entry.get("link", "") or "")
        if is_sciencedirect:
            abstract = parse_sd_summary(raw_summary)
        else:
            abstract = re.sub(r"<[^>]+>", "", raw_summary).strip()

        doi = doi_from_entry(entry)
        authors = extract_authors(entry)
        vol, issue, pages = extract_volume_issue_pages(entry)

        paper_id = re.sub(r"[^a-zA-Z0-9]", "-", title[:40])
        paper_id = f"{journal['name'][:4].upper()}-{pub_date or '0000'}-{paper_id}"

        theme = "green" if "green" in journal.get("topics", ["green"]) else "digital"
        link = entry.get("link", "") or ""

        papers.append({
            "id": paper_id,
            "title": title,
            "journal": journal["name"],
            "publisher": journal.get("publisher", ""),
            "authors": authors,
            "doi": doi,
            "link": link,
            "volume": vol,
            "issue": issue,
            "pages": pages,
            "abstract": abstract[:1200] if abstract else "",
            "keywords": [],
            "theme": theme,
            "publication_date": pub_date or "",
            "is_new": True,
        })
    return papers


def fetch_via_crossref(journal):
    issn = journal.get("issn", "")
    if not issn:
        print("    No ISSN configured")
        return []
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
            "link": f"https://doi.org/{doi}" if doi else "",
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


def enrich_by_doi(papers):
    """Enrich papers with volume/issue/pages via CrossRef DOI lookup."""
    dois = list(set(p["doi"] for p in papers if p["doi"] and not all([p.get("volume", ""), p.get("issue", ""), p.get("pages", "")])))
    if not dois:
        return papers
    doi_map = {}
    for i in range(0, len(dois), 20):
        batch = dois[i:i + 20]
        filter_str = ",".join(f"doi:{d}" for d in batch)
        try:
            r = requests.get(
                f"https://api.crossref.org/works?filter={filter_str}&rows=20",
                headers={"User-Agent": f"GraspDailyPush/1.0 (mailto:{CROSSREF_MAILTO})"},
                timeout=20,
            )
            for item in r.json().get("message", {}).get("items", []):
                d = item.get("DOI", "")
                if d:
                    doi_map[d] = item
        except Exception:
            pass
        time.sleep(0.2)
    for p in papers:
        d = p.get("doi", "")
        if d in doi_map:
            item = doi_map[d]
            if not p.get("volume"): p["volume"] = item.get("volume", "") or ""
            if not p.get("issue"): p["issue"] = item.get("issue", "") or ""
            if not p.get("pages"): p["pages"] = item.get("page", "") or ""
    return papers


def enrich_by_title(papers):
    """For papers without DOI or missing key fields, search CrossRef by title."""
    to_search = [
        p for p in papers
        if not p.get("doi") or not all([p.get("authors"), p.get("abstract")])
    ]
    # Limit to avoid excessive API calls
    to_search = to_search[:15]
    if not to_search:
        return papers

    found = 0
    for idx, p in enumerate(to_search):
        title = p["title"]
        query = title.strip()
        if len(query) < 15:
            continue
        print(f"      Title-search [{idx+1}/{len(to_search)}]: {query[:40]}...")
        try:
            url = f"https://api.crossref.org/works?query.title={requests.utils.quote(query)}&rows=1"
            r = requests.get(url, headers={
                "User-Agent": f"GraspDailyPush/1.0 (mailto:{CROSSREF_MAILTO})"
            }, timeout=10)
            items = r.json().get("message", {}).get("items", [])
            if not items:
                continue
            item = items[0]
            item_title = (item.get("title") or [""])[0].lower()[:50]
            query_lower = query.lower()[:50]
            if item_title != query_lower and len(set(item_title.split()) & set(query_lower.split())) < 3:
                continue
        except Exception:
            time.sleep(0.3)
            continue

        if not p.get("doi"):
            p["doi"] = item.get("DOI", "")
        if not p.get("volume"):
            p["volume"] = item.get("volume", "") or ""
        if not p.get("issue"):
            p["issue"] = item.get("issue", "") or ""
        if not p.get("pages"):
            p["pages"] = item.get("page", "") or ""
        if not p.get("authors"):
            authors = []
            for a in item.get("author", []):
                given = a.get("given", "")
                family = a.get("family", "")
                if family:
                    authors.append(f"{given} {family}".strip() if given else family)
            p["authors"] = authors
        if not p.get("abstract"):
            abstract_raw = item.get("abstract", "") or ""
            p["abstract"] = re.sub(r"<[^>]+>", "", abstract_raw).strip()[:1200]
        if not p.get("link"):
            doi = item.get("DOI", "")
            if doi:
                p["link"] = f"https://doi.org/{doi}"
        found += 1
        time.sleep(0.3)

    if found:
        print(f"    Title-search enriched {found} papers")
    return papers


def is_future_date(date_str):
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
                papers = enrich_by_doi(papers)
                papers = enrich_by_title(papers)
            else:
                print(f"    RSS returned no data, trying CrossRef fallback...")
                papers = fetch_via_crossref(journal)

        if not papers:
            print(f"    0 papers")
            continue

        before = len(papers)
        papers = [p for p in papers if not is_future_date(p.get("publication_date", ""))]
        filtered = before - len(papers)
        if filtered:
            print(f"    Filtered {filtered} future-dated papers")

        count = 0
        for paper in papers:
            if paper["id"] not in existing_ids:
                all_papers.append(paper)
                count += 1

        print(f"  Got {len(papers)} entries, {count} new")

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
