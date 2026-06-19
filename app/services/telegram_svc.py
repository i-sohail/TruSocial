from typing import Any, Dict, Optional
import httpx

_BASE = "https://api.telegram.org/bot{token}/{method}"


def _url(token: str, method: str) -> str:
    return f"https://api.telegram.org/bot{token}/{method}"


async def send(token: str, chat_id: str, text: str, markup: Optional[Dict] = None) -> Dict:
    body: Dict[str, Any] = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if markup:
        body["reply_markup"] = markup
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(_url(token, "sendMessage"), json=body)
    d = r.json()
    if not d.get("ok"):
        raise ValueError(d.get("description") or "Telegram sendMessage failed")
    return d["result"]


async def send_photo(
    token: str, chat_id: str, photo_url: str, caption: str, markup: Optional[Dict] = None
) -> Dict:
    body: Dict[str, Any] = {
        "chat_id": chat_id, "photo": photo_url,
        "caption": caption, "parse_mode": "HTML",
    }
    if markup:
        body["reply_markup"] = markup
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(_url(token, "sendPhoto"), json=body)
    d = r.json()
    if not d.get("ok"):
        # fall back to text
        return await send(token, chat_id, caption, markup)
    return d["result"]


async def get_updates(token: str, offset: int = 0) -> list:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(_url(token, "getUpdates"), params={"offset": offset, "timeout": 1})
    d = r.json()
    if not d.get("ok"):
        raise ValueError(d.get("description") or "getUpdates failed")
    return d.get("result") or []


async def answer_callback(token: str, cb_id: str, text: str = "") -> None:
    async with httpx.AsyncClient(timeout=5) as c:
        await c.post(
            _url(token, "answerCallbackQuery"),
            json={"callback_query_id": cb_id, "text": text},
        )


async def edit_message(token: str, chat_id: str, msg_id: int, text: str) -> None:
    async with httpx.AsyncClient(timeout=5) as c:
        await c.post(
            _url(token, "editMessageText"),
            json={"chat_id": chat_id, "message_id": msg_id, "text": text, "parse_mode": "HTML"},
        )


async def delete_message(token: str, chat_id: str, msg_id: int) -> None:
    async with httpx.AsyncClient(timeout=5) as c:
        await c.post(
            _url(token, "deleteMessage"),
            json={"chat_id": chat_id, "message_id": msg_id},
        )


def build_approval_message(post: Dict, company: Dict, scheduled_for: Optional[str]) -> str:
    emojis = {"linkedin": "💼", "instagram": "📸", "facebook": "👥", "x": "🐦"}
    platform_labels = {
        "linkedin": "LinkedIn", "instagram": "Instagram",
        "facebook": "Facebook", "x": "X (Twitter)",
    }
    plats = "\n".join(
        f"{emojis.get(k,'•')} {platform_labels.get(k, k)}"
        for k, v in (post.get("platforms") or {}).items() if v
    )
    from datetime import datetime
    if scheduled_for:
        try:
            dt = datetime.fromisoformat(scheduled_for.replace("Z", "+00:00"))
            sched_text = dt.strftime("%A, %B %-d at %I:%M %p")
        except Exception:
            sched_text = scheduled_for
    else:
        sched_text = "ASAP"

    icon = "🖼️" if post.get("format") == "photo" else "📝"
    hours = company.get("telegramHoursBefore") or company.get("hours_before") or 5
    return (
        f"🔔 <b>Approval Required</b>\n\n"
        f"{icon} <b>{post.get('contentType') or post.get('content_type') or 'Social'} Post</b>\n"
        f"📅 <b>Scheduled:</b> {sched_text}\n"
        f"🏢 <b>Company:</b> {company.get('name') or 'Your Company'}\n\n"
        f"<b>Publishing to:</b>\n{plats}\n\n"
        f"<b>━━━ POST CONTENT ━━━</b>\n\n"
        f"{post.get('body','')}\n\n"
        f"<b>━━━━━━━━━━━━━━━━━━</b>\n\n"
        f"<i>⏰ Posting {hours} hours from now — approve or reject below</i>"
    )


def approval_buttons(post_id: str) -> Dict:
    return {
        "inline_keyboard": [[
            {"text": "✅  Post it", "callback_data": f"approve::{post_id}"},
            {"text": "❌  Reject",  "callback_data": f"reject::{post_id}"},
        ]]
    }
