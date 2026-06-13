"""Hotlists Scraper - Phase 2: Weibo/Baidu/Zhihu/Toutiao/Tieba."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage()
CONFIG_PATH = "../../config/news_sources.yaml"

def main():
    print("Hotlists scraper - placeholder")
    print("Phase 2: implement hotlist scraping")

if __name__ == "__main__":
    main()
