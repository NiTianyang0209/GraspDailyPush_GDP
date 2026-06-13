"""Generate AI commentary for news & hotlists via DeepSeek API."""
import json, os, sys, urllib.request, urllib.error, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.storage import JSONStorage

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
storage = JSONStorage()

def load_data():
    headlines = storage.read("news/headlines.json")
    hotlists = storage.read("news/hotlists.json")
    return headlines, hotlists

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

    headlines, hotlists = load_data()
    if not headlines and not hotlists:
        print("SKIP: no data available")
        return

    user_content = json.dumps({
        "headlines": headlines or {"sources": []},
        "hotlists": hotlists or {"platforms": []}
    }, ensure_ascii=False, indent=2)

    system_prompt = (
        "你是一个时事评论员。根据以下新闻和热搜数据，写一段300-500字的点评。"
        "分析当前热点趋势，指出值得关注的事件。用中文、平实的语气。"
    )

    try:
        text = call_deepseek(api_key, system_prompt, user_content[:8000])
    except Exception as e:
        print(f"ERROR: DeepSeek API call failed: {e}")
        sys.exit(1)

    output = {
        "commentary": text,
        "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_count": len(headlines.get("sources", [])) if headlines else 0,
        "hotlist_count": sum(len(p.get("items", [])) for p in (hotlists.get("platforms", []) if hotlists else []))
    }

    storage.write("academic/commentary_news.json", output)
    print("OK: news commentary generated")

if __name__ == "__main__":
    main()
