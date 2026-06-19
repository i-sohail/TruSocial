from typing import Dict, Optional
import httpx

_GRAPH = "https://graph.facebook.com/v19.0"


async def publish(post: Dict, creds: Dict) -> Dict:
    token = creds.get("accessToken") or creds.get("access_token", "")
    page_id = creds.get("pageId") or creds.get("page_id", "")
    image_url: Optional[str] = post.get("imageUrl") or post.get("image_url")

    async with httpx.AsyncClient(timeout=30) as c:
        if image_url and post.get("format") == "photo":
            r = await c.post(
                f"{_GRAPH}/{page_id}/photos",
                json={"url": image_url, "caption": post["body"],
                      "access_token": token, "published": True},
            )
        else:
            r = await c.post(
                f"{_GRAPH}/{page_id}/feed",
                json={"message": post["body"], "access_token": token},
            )

    d = r.json()
    if not r.is_success or d.get("error"):
        msg = (d.get("error") or {}).get("message") or "Facebook publish failed"
        raise ValueError(msg)
    return {"success": True, "postId": d.get("id"), "publishedAt": _now()}


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
