from typing import Dict
import httpx


async def publish(post: Dict, creds: Dict) -> Dict:
    token = creds.get("accessToken") or creds.get("access_token", "")
    org_id = creds.get("organizationId") or creds.get("organization_id", "")
    author = f"urn:li:organization:{org_id}" if org_id else "urn:li:person:me"

    body = {
        "author": author,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": post["body"]},
                "shareMediaCategory": "NONE",
                "media": [],
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            json=body,
        )

    d = r.json()
    if not r.is_success:
        raise ValueError(d.get("message") or "LinkedIn publish failed")
    return {"success": True, "postId": d.get("id"), "publishedAt": _now()}


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
