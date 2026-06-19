import asyncio
from typing import Dict
import httpx

_GRAPH = "https://graph.facebook.com/v19.0"


async def publish(post: Dict, creds: Dict) -> Dict:
    token = creds.get("accessToken") or creds.get("access_token", "")
    account_id = creds.get("accountId") or creds.get("account_id", "")
    image_url = post.get("imageUrl") or post.get("image_url")

    if not image_url:
        raise ValueError("Instagram requires an image URL.")

    async with httpx.AsyncClient(timeout=30) as c:
        r1 = await c.post(
            f"{_GRAPH}/{account_id}/media",
            json={"image_url": image_url, "caption": post["body"], "access_token": token},
        )
        c1 = r1.json()
        if not r1.is_success or c1.get("error"):
            raise ValueError((c1.get("error") or {}).get("message") or "IG container failed")

        await asyncio.sleep(3)

        r2 = await c.post(
            f"{_GRAPH}/{account_id}/media_publish",
            json={"creation_id": c1["id"], "access_token": token},
        )
        pub = r2.json()
        if not r2.is_success or pub.get("error"):
            raise ValueError((pub.get("error") or {}).get("message") or "IG publish failed")

    return {"success": True, "postId": pub.get("id"), "publishedAt": _now()}


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
