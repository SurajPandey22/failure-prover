import os
import time
import json
import requests
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class ILLMProvider(ABC):
    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str) -> str:
        pass

class FakeLLM(ILLMProvider):
    def __init__(self):
        self.responses: List[str] = []
        self.requests: List[Dict[str, str]] = []

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        self.requests.append({"system_prompt": system_prompt, "user_prompt": user_prompt})
        if self.responses:
            return self.responses.pop(0)
        return "Default fake response"

class GeminiLLM(ILLMProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        if not self.api_key:
            raise ValueError("API Key is missing")

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        if not self.api_key:
            raise ValueError("API Key is missing")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [{
                "role": "user",
                "parts": [{"text": user_prompt}]
            }]
        }

        max_retries = 4
        last_err = None

        for attempt in range(1, max_retries + 1):
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=30)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"]
                    return ""
                
                # Check for rate limits / quota limits
                if res.status_code in [429, 503]:
                    wait_time = 15 if res.status_code == 429 else (2 ** (attempt - 1) * 2)
                    time.sleep(wait_time)
                    continue

                res.raise_for_status()
            except Exception as e:
                last_err = e
                time.sleep(2)

        raise last_err or RuntimeError("LLM API call failed")
