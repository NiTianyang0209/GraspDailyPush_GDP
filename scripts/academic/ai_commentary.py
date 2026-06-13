"""Generate AI commentary for academic papers via DeepSeek API."""
import json, os, sys, urllib.request, urllib.error, datetime
from pathlib import Path
BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))
from utils.storage import JSONStorage

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
storage = JSONStorage(base_dir=str(BASE / "docs" / "data"))

def call_deepseek(api_key, system_prompt, user_content):
    data = json.dumps({
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "max_tokens": 1024,
        "temperature": 0.7
    }).encode("utf-8")
    req = urllib.request.Request(DEEPSEEK_URL, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    })
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    return result["choices"][0]["message"]["content"]

def main():
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        print("SKIP: DEEPSEEK_API_KEY not set")
        return

    papers = storage.read("academic/papers_index.json")
    if not papers or len(papers) == 0:
        print("SKIP: no papers data available")
        return

    green = [p for p in papers if p.get("theme") == "green"]
    digital = [p for p in papers if p.get("theme") == "digital"]

    summary = {
        "total": len(papers),
        "green": len(green),
        "digital": len(digital),
        "journals": list({p.get("journal", "Unknown") for p in papers}),
        "sample_titles": [p.get("title", "")[:80] for p in papers[:20]]
    }

    user_content = json.dumps(summary, ensure_ascii=False, indent=2)

    system_prompt = (
        "你是一个学术评论员。根据以下学术论文数据（期刊分布、主题分类、代表性标题），"
        "写一段300-500字的点评，总结本周研究热点和学术趋势。用中文、平实的语气。"
    )

    try:
        text = call_deepseek(api_key, system_prompt, user_content[:8000])
    except Exception as e:
        print(f"ERROR: DeepSeek API call failed: {e}")
        sys.exit(1)

    output = {
        "commentary": text,
        "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "period": "每周更新",
        "total_papers": len(papers),
        "green_papers": len(green),
        "digital_papers": len(digital)
    }

    storage.write("academic/commentary.json", output)
    print("OK: academic commentary generated")

if __name__ == "__main__":
    main()
