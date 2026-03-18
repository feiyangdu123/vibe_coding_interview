import os
import json
import requests

API_KEY = "sk-Ee9BWT9tgaSnSGv5VUwmXtHrelwCs1Pj"
BASE_URL = "https://api-gateway.glm.ai/v1"
MODEL = "claude-opus-4-6"

url = f"{BASE_URL}/messages"

payload = {
    "model": MODEL,
    "max_tokens": 1024,
    "messages": [
        {
            "role": "user",
            "content": "你好"
        }
    ]
}

headers = {
    "content-type": "application/json",
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
}

resp = requests.post(url, headers=headers, json=payload, timeout=120)

print("status_code:", resp.status_code)
print("raw_text:", resp.text)

resp.raise_for_status()

data = resp.json()

# Anthropic Messages API 常见返回格式：
# {
#   "content": [
#     {"type": "text", "text": "..."}
#   ],
#   ...
# }

text_parts = []
for item in data.get("content", []):
    if item.get("type") == "text":
        text_parts.append(item.get("text", ""))

print("\n=== assistant ===")
print("".join(text_parts))