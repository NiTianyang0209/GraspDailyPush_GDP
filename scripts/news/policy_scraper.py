"""Policy & Document Scraper — collect green/low-carbon/eco policies from Chinese government sources."""
import re, sys
from datetime import datetime, timedelta
from pathlib import Path

import yaml
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

storage = JSONStorage(base_dir=str(Path(__file__).parent.parent.parent / "docs" / "data"))
CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "policy_sources.yaml"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
}
CUTOFF_DATE = datetime.now() - timedelta(days=365 * 5)  # 5 years


# ========== Curated baseline: key policies from the last 5 years ==========
CURATED_POLICIES = [
    {
        "title": "中共中央 国务院关于全面推进美丽中国建设的意见",
        "source": "中办国办",
        "date": "2024-01-11",
        "url": "https://www.gov.cn/zhengce/202401/content_6924525.htm",
        "summary": "全面推进美丽中国建设的纲领性文件，提出到2027年、2035年和本世纪中叶的美丽中国建设目标，涵盖绿色低碳转型、污染防治、生态保护修复等重点任务。",
        "topics": ["生态文明", "绿色"],
    },
    {
        "title": "中共中央 国务院关于加快经济社会发展全面绿色转型的意见",
        "source": "中办国办",
        "date": "2024-08-11",
        "url": "https://www.gov.cn/zhengce/202408/content_6969358.htm",
        "summary": "首次从中央层面对加快经济社会发展全面绿色转型作出系统部署，涵盖产业结构、能源转型、交通运输、城乡建设、消费模式等五大领域绿色转型。",
        "topics": ["绿色", "低碳"],
    },
    {
        "title": "国务院关于印发《2030年前碳达峰行动方案》的通知",
        "source": "国务院",
        "date": "2021-10-26",
        "url": "https://www.gov.cn/zhengce/content/2021-10/26/content_5644984.htm",
        "summary": "碳达峰阶段的顶层设计文件，明确重点实施能源绿色低碳转型、节能降碳增效、工业领域碳达峰等十大行动。",
        "topics": ["碳达峰", "低碳"],
    },
    {
        "title": "中共中央 国务院关于完整准确全面贯彻新发展理念做好碳达峰碳中和工作的意见",
        "source": "中办国办",
        "date": "2021-09-22",
        "url": "https://www.gov.cn/zhengce/2021-10/24/content_5644613.htm",
        "summary": "碳达峰碳中和工作的顶层设计，构建碳达峰碳中和'1+N'政策体系中的'1'，明确主要目标和重大举措。",
        "topics": ["碳达峰", "碳中和", "低碳"],
    },
    {
        "title": "中共中央关于制定国民经济和社会发展第十四个五年规划和二〇三五年远景目标的建议",
        "source": "中办国办",
        "date": "2020-11-03",
        "url": "https://www.gov.cn/zhengce/2020-11/03/content_5556991.htm",
        "summary": "十四五规划建议，专章部署'推动绿色发展，促进人与自然和谐共生'，提出加快推动绿色低碳发展、改善生态环境质量等目标。",
        "topics": ["十四五", "绿色", "生态文明"],
    },
    {
        "title": "中华人民共和国国民经济和社会发展第十四个五年规划和2035年远景目标纲要",
        "source": "国务院",
        "date": "2021-03-13",
        "url": "https://www.gov.cn/xinwen/2021-03/13/content_5592681.htm",
        "summary": "十四五规划纲要，明确绿色发展相关约束性指标，包括单位GDP能源消耗降低13.5%、单位GDP二氧化碳排放降低18%等。",
        "topics": ["十四五", "绿色", "低碳"],
    },
    {
        "title": "中共中央 国务院关于加快建立健全国土空间规划体系的意见",
        "source": "中办国办",
        "date": "2024-09-11",
        "url": "https://www.gov.cn/zhengce/202409/content_6973720.htm",
        "summary": "建立全国统一、责权清晰、科学高效的国土空间规划体系，强化生态保护红线、永久基本农田、城镇开发边界等空间管控。",
        "topics": ["生态文明", "生态"],
    },
    {
        "title": "国务院办公厅关于加快构建废弃物循环利用体系的意见",
        "source": "国务院",
        "date": "2024-02-09",
        "url": "https://www.gov.cn/zhengce/content/202402/content_6930014.htm",
        "summary": "到2025年初步建成覆盖各领域、各环节的废弃物循环利用体系，到2030年建成全面高效的废弃物循环利用体系。",
        "topics": ["绿色", "循环经济"],
    },
    {
        "title": "国家发展改革委 国家能源局关于印发《'十四五'现代能源体系规划》的通知",
        "source": "发改委",
        "date": "2022-03-22",
        "url": "https://www.ndrc.gov.cn/xxgk/zcfb/ghwb/202203/t20220322_1320016.html",
        "summary": "十四五能源体系规划，到2025年非化石能源消费比重提高到20%左右，非化石能源发电量比重达到39%左右。",
        "topics": ["十四五", "能源", "绿色"],
    },
    {
        "title": "国家发展改革委 国家能源局关于印发《'十五五'新型能源体系建设规划》的通知",
        "source": "发改委",
        "date": "2026-04-15",
        "url": "https://www.ndrc.gov.cn/xxgk/zcfb/ghwb/202604/t20260415_1403563.html",
        "summary": "十五五新型能源体系规划，加快构建新型能源体系，推动能源绿色低碳转型和安全高效。重点发展非化石能源，推进能源数字化智能化。",
        "topics": ["十五五", "能源", "绿色", "低碳"],
    },
    {
        "title": "中共中央 国务院关于全面推进美丽内蒙古建设的意见",
        "source": "中办国办",
        "date": "2024-12-25",
        "url": "https://www.gov.cn/zhengce/202412/content_6998772.htm",
        "summary": "推进美丽中国建设的先行区实践，聚焦生态保护修复、绿色低碳发展等领域，为全国生态文明建设探索经验。",
        "topics": ["生态文明", "绿色"],
    },
    {
        "title": "关于进一步强化金融支持绿色低碳发展的指导意见",
        "source": "人民银行",
        "date": "2024-04-10",
        "url": "https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/5392341/index.html",
        "summary": "人民银行等七部门联合发文，提出推动绿色金融标准体系建设、丰富绿色金融市场、强化碳金融等举措。",
        "topics": ["绿色金融", "低碳"],
    },
    {
        "title": "国家发展改革委等部门关于促进绿色消费的指导意见",
        "source": "发改委",
        "date": "2022-01-21",
        "url": "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202201/t20220121_1312562.html",
        "summary": "全面促进绿色消费，加快形成简约适度、绿色低碳、文明健康的生活方式和消费模式。",
        "topics": ["绿色", "低碳", "消费"],
    },
    {
        "title": "碳排放权交易管理办法（试行）",
        "source": "生态环境部",
        "date": "2021-01-05",
        "url": "https://www.mee.gov.cn/xxgk2018/xxgk/xxgk02/202101/t20210105_816131.html",
        "summary": "规范全国碳排放权交易及相关活动，推动温室气体减排，实现碳达峰碳中和目标。",
        "topics": ["碳达峰", "碳中和", "碳市场"],
    },
    {
        "title": "中共中央 国务院关于深入打好污染防治攻坚战的意见",
        "source": "中办国办",
        "date": "2021-11-07",
        "url": "https://www.gov.cn/zhengce/2021-11/07/content_5649818.htm",
        "summary": "到2025年生态环境持续改善，到2035年广泛形成绿色生产生活方式，碳排放达峰后稳中有降。",
        "topics": ["生态文明", "环境", "绿色"],
    },
    {
        "title": "国家发展改革委 国家能源局关于加强新形势下电力系统稳定工作的指导意见",
        "source": "发改委",
        "date": "2024-07-15",
        "url": "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202407/t20240715_1394990.html",
        "summary": "新形势下加强电力系统稳定工作，保障新能源高质量发展和电力系统安全稳定运行。",
        "topics": ["能源", "绿色"],
    },
    {
        "title": "财政部 住房城乡建设部 工业和信息化部关于印发《绿色数据中心政府采购需求标准（试行）》的通知",
        "source": "财政部",
        "date": "2023-04-10",
        "url": "https://www.mof.gov.cn/zhengwuxinxi/zhengcefabu/202304/t20230410_3878220.htm",
        "summary": "推动绿色数据中心建设，通过政府采购引导数据中心向绿色低碳方向发展。",
        "topics": ["绿色", "数字"],
    },
    {
        "title": "中共中央 国务院关于促进民营经济发展壮大的意见（绿色转型相关部分）",
        "source": "中办国办",
        "date": "2023-07-19",
        "url": "https://www.gov.cn/zhengce/202307/content_6893023.htm",
        "summary": "支持民营企业参与推进碳达峰碳中和，参与绿色低碳产业和绿色金融发展。",
        "topics": ["绿色", "低碳"],
    },
    {
        "title": "国家发展改革委 国家统计局 生态环境部关于加快建立统一规范的碳排放统计核算体系实施方案",
        "source": "发改委",
        "date": "2024-10-23",
        "url": "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202410/t20241023_1398765.html",
        "summary": "建立统一规范的碳排放统计核算体系，为碳达峰碳中和工作提供数据支撑。",
        "topics": ["碳达峰", "碳中和", "低碳"],
    },
    {
        "title": "中国人民银行 国家发展改革委 证监会关于印发《绿色债券支持项目目录（2021年版）》的通知",
        "source": "人民银行",
        "date": "2021-04-21",
        "url": "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/4298111/index.html",
        "summary": "统一绿色债券标准，明确绿色债券支持项目范围，推动绿色债券市场高质量发展。",
        "topics": ["绿色金融", "绿色"],
    },
]


# ========== Per-source scraping strategies ==========

def scrape_source(source):
    """Attempt to scrape one source. Returns list of policy dicts or [] on failure."""
    name = source["name"]
    url = source["url"]
    topics = source.get("topics", [])

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
        if resp.status_code != 200:
            print(f"    HTTP {resp.status_code}")
            return []
    except Exception as e:
        print(f"    Request failed: {e}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    policies = []

    # Generic extraction: find all links with title-like text
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        href = a["href"]
        if len(text) < 10:
            continue
        # Resolve relative URLs
        if href.startswith("/"):
            from urllib.parse import urlparse
            parsed = urlparse(url)
            href = f"{parsed.scheme}://{parsed.netloc}{href}"
        elif href.startswith("./"):
            href = url.rstrip("/") + href[1:]
        elif href.startswith("."):
            continue
        elif not href.startswith("http"):
            href = url.rstrip("/") + "/" + href
        # Filter by topic keywords
        matched_topics = [t for t in topics if t in text]
        if not matched_topics:
            continue
        # Check if within 5 years from date if available
        date = ""
        # Try to find a nearby date element
        parent = a.find_parent("li") or a.find_parent("div")
        if parent:
            date_text = parent.get_text()
            m = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})", date_text)
            if m:
                date = m.group(1).replace("/", "-")

        policies.append({
            "title": text.strip(),
            "source": name,
            "date": date,
            "url": href,
            "summary": "",
            "topics": matched_topics,
        })

    print(f"    Found {len(policies)} matched policies")
    return policies


def is_relevant(policy):
    """Check if policy is within 5 years and topically relevant."""
    if policy.get("date"):
        try:
            d = datetime.strptime(policy["date"], "%Y-%m-%d")
            if d < CUTOFF_DATE:
                return False
        except ValueError:
            pass
    return True


def main():
    # Load curated baseline
    all_policies = list(CURATED_POLICIES)

    # Try scraping each source
    config = yaml.safe_load(open(CONFIG_PATH, "r", encoding="utf-8"))
    for source in config.get("sources", []):
        name = source["name"]
        print(f"Scraping: {name} ({source.get('url', '')[:50]})...")
        scraped = scrape_source(source)
        scraped = [p for p in scraped if is_relevant(p)]
        all_policies.extend(scraped)

    # Deduplicate by title
    seen_titles = set()
    deduped = []
    for p in all_policies:
        t = p["title"].strip()
        if t not in seen_titles:
            seen_titles.add(t)
            deduped.append(p)

    # Sort by date descending (newest first)
    def sort_key(p):
        d = p.get("date", "")
        return d if d else "0000-00-00"
    deduped.sort(key=sort_key, reverse=True)

    data = {
        "updated_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "count": len(deduped),
        "policies": deduped,
    }

    storage.write("news/policies.json", data)
    print(f"\nSaved {len(deduped)} policies to policies.json")


if __name__ == "__main__":
    main()
