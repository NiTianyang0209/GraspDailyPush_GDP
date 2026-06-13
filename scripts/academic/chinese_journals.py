"""Chinese Academic Journal Scraper - Phase 3: HTML scraping."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage()
CONFIG_PATH = "../../config/journals_chinese.yaml"

def main():
    print("Chinese journal scraper - placeholder")
    print("Phase 3: implement chinajournal.net.cn HTML parsing")

if __name__ == "__main__":
    main()
