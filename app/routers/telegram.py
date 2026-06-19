from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import SENTINEL
from app.dependencies import get_db
from app.encryption import decrypt, encrypt, is_sentinel, mask
from app.models import TelegramSettings, Company
from app.schemas import TelegramOut, TelegramIn, BotTokenRequest, TestMessageRequest
from app.services import telegram_svc


def _resolve_token(provided, db: Session) -> str:
    if provided and provided != SENTINEL:
        return provided
    row = db.get(TelegramSettings, 1)
    stored = decrypt(row.bot_token_enc) if row.bot_token_enc else ""
    if not stored:
        raise HTTPException(400, "Bot token not configured. Enter your bot token or save settings first.")
    return stored


def _resolve_chat_id(provided, db: Session) -> str:
    if provided:
        return provided
    row = db.get(TelegramSettings, 1)
    if not row.chat_id:
        raise HTTPException(400, "Chat ID not configured. Enter your chat ID or save settings first.")
    return row.chat_id

router = APIRouter()


def _row_to_out(row: TelegramSettings) -> TelegramOut:
    return TelegramOut(
        bot_token=mask(row.bot_token_enc),
        chat_id=row.chat_id,
        enabled=row.enabled,
        hours_before=row.hours_before,
        last_polled=row.last_polled,
    )


@router.get("", response_model=TelegramOut)
def get_telegram(db: Session = Depends(get_db)):
    return _row_to_out(db.get(TelegramSettings, 1))


@router.put("", response_model=TelegramOut)
def update_telegram(body: TelegramIn, db: Session = Depends(get_db)):
    row = db.get(TelegramSettings, 1)
    if body.bot_token is not None and not is_sentinel(body.bot_token):
        row.bot_token_enc = encrypt(body.bot_token) if body.bot_token else ""
    if body.chat_id is not None:
        row.chat_id = body.chat_id
    if body.enabled is not None:
        row.enabled = body.enabled
    if body.hours_before is not None:
        row.hours_before = body.hours_before
    db.commit()
    return _row_to_out(row)


@router.post("/test-bot")
async def test_bot(body: BotTokenRequest, db: Session = Depends(get_db)):
    token = _resolve_token(body.bot_token, db)
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"https://api.telegram.org/bot{token}/getMe")
        d = r.json()
        if not d.get("ok"):
            raise HTTPException(400, d.get("description", "Bot test failed"))
        return {"ok": True, "username": d["result"]["username"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, str(e))


@router.post("/fetch-chat-id")
async def fetch_chat_id(body: BotTokenRequest, db: Session = Depends(get_db)):
    token = _resolve_token(body.bot_token, db)
    try:
        updates = await telegram_svc.get_updates(token, 0)
        if not updates:
            raise HTTPException(404, "No messages yet — send any message to your bot first, then try again.")
        latest = updates[-1]
        chat_id = str(
            (latest.get("message") or {}).get("chat", {}).get("id") or
            (latest.get("callback_query") or {}).get("message", {}).get("chat", {}).get("id") or ""
        )
        if not chat_id:
            raise HTTPException(404, "Could not extract chat ID from latest update.")
        return {"chatId": chat_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, str(e))


@router.post("/test-message")
async def send_test_message(body: TestMessageRequest, db: Session = Depends(get_db)):
    token = _resolve_token(body.bot_token, db)
    chat_id = _resolve_chat_id(body.chat_id, db)
    co = db.get(Company, 1)
    text = (
        f"✅ <b>AI Social Autopilot connected!</b>\n\n"
        f"<b>Company:</b> {co.name or 'Your Company'}\n"
        f"<b>Status:</b> Ready to receive approval requests 🚀\n\n"
        f"You'll receive posts {body.hours_before}h before their scheduled publish time."
    )
    try:
        await telegram_svc.send(token, chat_id, text)
    except Exception as e:
        raise HTTPException(502, str(e))
    return {"ok": True}


@router.post("/mock-card")
async def send_mock_card(body: TestMessageRequest, db: Session = Depends(get_db)):
    token = _resolve_token(body.bot_token, db)
    chat_id = _resolve_chat_id(body.chat_id, db)
    co = db.get(Company, 1)
    mock_post = {
        "id": "demo_123", "format": "text", "contentType": "Educational",
        "content_type": "Educational",
        "body": (
            "🚀 Most companies waste 80% of their social media budget.\n\n"
            "Here's what the top 1% do differently:\n\n"
            "→ They post consistently, not just when inspired\n"
            "→ They lead with value, not promotions\n"
            "→ They engage before publishing\n"
            "→ They analyze what works and double down\n\n"
            "Social media isn't luck — it's a system.\n\n"
            "What's the #1 change that improved your social presence? 👇\n\n"
            "#Marketing #SocialMedia #GrowthStrategy #ContentMarketing"
        ),
        "platforms": {"linkedin": True, "instagram": True},
    }
    from datetime import datetime, timezone
    sched = datetime.now(timezone.utc).isoformat()
    co_dict = {"name": co.name or "Acme Corp", "hours_before": body.hours_before}
    msg = telegram_svc.build_approval_message(mock_post, co_dict, sched)
    btns = telegram_svc.approval_buttons("demo_123")
    try:
        await telegram_svc.send(token, chat_id, msg, btns)
    except Exception as e:
        raise HTTPException(502, str(e))
    return {"ok": True}
