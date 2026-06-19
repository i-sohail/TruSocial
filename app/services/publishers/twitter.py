from typing import Dict
import httpx


async def publish(post: Dict, creds: Dict) -> Dict:
    token = creds.get("accessToken") or creds.get("access_token", "")
    text = (post.get("body") or "")[:280]

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            "https://api.twitter.com/2/tweets",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"text": text},
        )

    d = r.json()
    if not r.is_success or d.get("errors"):
        msg = (d.get("errors") or [{}])[0].get("message") or "X (Twitter) publish failed"
        raise ValueError(msg)
    return {"success": True, "postId": d.get("data", {}).get("id"), "publishedAt": _now()}


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
