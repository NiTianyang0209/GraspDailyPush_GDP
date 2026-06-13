"""English Academic Journal Scraper - Phase 2: RSS scraping."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage()
CONFIG_PATH = "../../config/journals_english.yaml"

def main():
    print("English journal scraper - placeholder")
    print("Phase 2: implement RSS fetching with feedparser")

if __name__ == "__main__":
    main()
