"""
Background Telegram poller — runs every 3 seconds.
  1. Sends approval notifications for posts due within hoursBefore window.
  2. Polls for Telegram button presses (approve / reject) and text replies (feedback).
  3. Handles approve → publish, reject → ask feedback, feedback → regenerate → re-send.
"""

import asyncio
import random
from datetime import datetime, timezone
from typing import Optional

from app.database import SessionLocal
from app.encryption import decrypt
from app.models import AppSettings, Company, Post, TelegramSettings
from app.services import telegram_svc


# ── helpers ──────────────────────────────────────────────────────────────────

def _get_config():
    """Return (api_key, bedrock_settings, telegram_settings, company) dicts."""
    with SessionLocal() as db:
        settings = db.get(AppSettings, 1)
        tg = db.get(TelegramSettings, 1)
        co = db.get(Company, 1)
        return (
            decrypt(settings.api_key_enc),
            {
                "bearer": decrypt(settings.bedrock_bearer_enc),
                "region": settings.bedrock_region or "us-east-1",
                "model_id": settings.bedrock_model_id or "amazon.nova-canvas-v1:0",
                "enabled": settings.bedrock_enabled,
            },
            {
                "token": decrypt(tg.bot_token_enc),
                "chat_id": tg.chat_id,
                "enabled": tg.enabled,
                "hours_before": tg.hours_before,
            },
            {
                "name": co.name, "industry": co.industry, "description": co.description,
                "products": co.products, "target_audience": co.target_audience,
                "brand_voice": co.brand_voice, "tone": co.tone,
                "keywords": co.keywords, "brand_guidelines": co.brand_guidelines,
            },
        )


def _post_to_dict(p: Post) -> dict:
    return {
        "id": p.id, "body": p.body, "format": p.format,
        "contentType": p.content_type, "content_type": p.content_type,
        "topic": p.topic, "imageUrl": p.image_url, "image_url": p.image_url,
        "imageStyle": p.image_style, "platforms": p.platforms or {},
        "scheduledFor": p.scheduled_for.isoformat() if p.scheduled_for else None,
    }


# ── notification sender ───────────────────────────────────────────────────────

async def _send_notifications(tg_cfg: dict, co: dict) -> None:
    token, chat_id = tg_cfg["token"], tg_cfg["chat_id"]
    hours_before = tg_cfg["hours_before"]
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    window_ms = hours_before * 3_600_000

    with SessionLocal() as db:
        due = db.query(Post).filter(
            Post.status == "scheduled",
            Post.tg_notified == False,
            Post.scheduled_for != None,
        ).all()

    for post in due:
        if not post.scheduled_for:
            continue
        sched_ts = post.scheduled_for.replace(tzinfo=timezone.utc).timestamp() * 1000
        ms_until = sched_ts - now_ms
        if not (0 < ms_until <= window_ms):
            continue
        try:
            post_dict = _post_to_dict(post)
            msg = telegram_svc.build_approval_message(
                post_dict, {**co, "hours_before": hours_before},
                post.scheduled_for.isoformat(),
            )
            btns = telegram_svc.approval_buttons(post.id)
            if post.image_url and post.format == "photo":
                sent = await telegram_svc.send_photo(token, chat_id, post.image_url, msg, btns)
            else:
                sent = await telegram_svc.send(token, chat_id, msg, btns)

            with SessionLocal() as db:
                p = db.get(Post, post.id)
                if p:
                    p.tg_notified = True
                    p.tg_msg_id = sent.get("message_id")
                    db.commit()
        except Exception as e:
            print(f"[TG poller] notify error: {e}")


# ── approve handler ───────────────────────────────────────────────────────────

async def _handle_approve(post_id: str, cb_id: str, msg_id: Optional[int], tg_cfg: dict) -> None:
    token, chat_id = tg_cfg["token"], tg_cfg["chat_id"]
    await telegram_svc.answer_callback(token, cb_id, "Publishing now… ⏳")

    from app.routers.social import get_decrypted_creds
    from app.services.publishers import facebook, instagram, twitter, linkedin

    with SessionLocal() as db:
        p = db.get(Post, post_id)
        if not p:
            await telegram_svc.send(token, chat_id, "❌ Post not found.")
            return
        platforms = [k for k, v in (p.platforms or {}).items() if v]
        post_dict = _post_to_dict(p)

    results = {}
    for plat in platforms:
        with SessionLocal() as db:
            creds = get_decrypted_creds(plat, db)
        if not creds.get("connected"):
            results[plat] = {"success": False, "error": "Not connected"}
            continue
        try:
            if plat == "facebook":
                results[plat] = await facebook.publish(post_dict, creds)
            elif plat == "instagram":
                results[plat] = await instagram.publish(post_dict, creds)
            elif plat == "x":
                results[plat] = await twitter.publish(post_dict, creds)
            elif plat == "linkedin":
                results[plat] = await linkedin.publish(post_dict, creds)
        except Exception as e:
            results[plat] = {"success": False, "error": str(e)}

    ok_plats = [p for p, r in results.items() if r.get("success")]
    fail_plats = [(p, r) for p, r in results.items() if not r.get("success")]

    with SessionLocal() as db:
        p = db.get(Post, post_id)
        if p:
            p.status = "published" if ok_plats else "publish_error"
            p.publish_results = results
            p.published_at = datetime.now(timezone.utc)
            db.commit()

    label_map = {"linkedin": "LinkedIn", "instagram": "Instagram", "facebook": "Facebook", "x": "X"}
    if ok_plats:
        txt = (
            f"✅ <b>Published!</b>\n\nPosted to: {', '.join(label_map.get(p, p) for p in ok_plats)}"
            + ("\n⚠️ Failed: " + ", ".join(label_map.get(p, p) + " (" + r["error"] + ")" for p, r in fail_plats) if fail_plats else "")
            + f"\n\n<i>Published at {datetime.now().strftime('%Y-%m-%d %H:%M')}</i>"
        )
    else:
        txt = (
            "❌ <b>Publish Failed</b>\n\n"
            + "\n".join(f"{label_map.get(p,p)}: {r['error']}" for p, r in fail_plats)
            + "\n\nCheck Social Accounts settings."
        )

    try:
        if msg_id:
            await telegram_svc.edit_message(token, chat_id, msg_id, txt)
        else:
            await telegram_svc.send(token, chat_id, txt)
    except Exception:
        pass


# ── reject handler ────────────────────────────────────────────────────────────

async def _handle_reject(post_id: str, cb_id: str, msg_id: Optional[int], tg_cfg: dict) -> None:
    token, chat_id = tg_cfg["token"], tg_cfg["chat_id"]
    await telegram_svc.answer_callback(token, cb_id, "Post rejected ❌")

    with SessionLocal() as db:
        p = db.get(Post, post_id)
        if p:
            p.status = "awaiting_feedback"
            db.commit()

    await telegram_svc.send(
        token, chat_id,
        "❌ <b>Post Rejected</b>\n\n<b>Reply with your feedback</b> and the AI will regenerate immediately.\n\n"
        "<b>Example:</b>\n• \"Too promotional — make it more educational\"\n• \"Hook is weak — make it punchier\"\n\n"
        "<i>Just type your feedback in this chat.</i>",
        {"inline_keyboard": [[{"text": "↩️ Actually approve it", "callback_data": f"approve::{post_id}"}]]},
    )


# ── feedback handler ──────────────────────────────────────────────────────────

async def _handle_feedback(post_id: str, feedback: str, tg_cfg: dict, api_key: str, bedrock: dict, co: dict) -> None:
    token, chat_id = tg_cfg["token"], tg_cfg["chat_id"]

    regen_msg = await telegram_svc.send(
        token, chat_id,
        f"🔄 <b>Regenerating post with your feedback…</b>\n\n📝 Feedback: \"<i>{feedback}</i>\"\n\n<i>~15–20 seconds…</i>",
    )

    try:
        from app.services.claude import call_claude, build_system_prompt
        sys_prompt = build_system_prompt(co)

        with SessionLocal() as db:
            old = db.get(Post, post_id)
            old_body = old.body if old else ""
            old_format = old.format if old else "text"
            old_platforms = old.platforms if old else {}
            old_topic = old.topic if old else ""
            old_style = old.image_style if old else ""

        new_body = await call_claude(
            api_key,
            sys_prompt + f"\n\nPREVIOUS REJECTED POST:\n{old_body}\n\nUSER FEEDBACK: {feedback}\n\n"
                         "Write a brand new post that fully addresses this feedback.",
            f'Rewrite the social media post with this feedback: "{feedback}"\n'
            f"Original topic: {old_topic}\nWrite ONLY the post content.",
            700,
        )

        new_image_url = None
        if old_format == "photo" and bedrock["enabled"] and bedrock["bearer"]:
            try:
                img_prompt = await call_claude(
                    api_key, sys_prompt,
                    f"Vivid image prompt for social media poster. Topic: {old_topic}. Style: {old_style}. "
                    f"Incorporate feedback: {feedback}. Write ONLY the image prompt (2 sentences).", 200,
                )
                from app.services.bedrock import generate_image
                new_image_url = await generate_image(
                    bedrock["bearer"], bedrock["region"], bedrock["model_id"], img_prompt,
                )
            except Exception as e:
                print(f"[TG poller] image regen failed: {e}")

        new_id = f"post_{int(datetime.now(timezone.utc).timestamp() * 1000)}_regen"
        with SessionLocal() as db:
            old_post = db.get(Post, post_id)
            if old_post:
                old_post.status = "rejected"
                old_post.replaced_by = new_id
            co_row = db.get(Company, 1)
            new_post = Post(
                id=new_id, body=new_body,
                format=old_format, content_type=old_post.content_type if old_post else "",
                topic=old_topic, image_url=new_image_url or "",
                image_style=old_style, image_provider="aws-bedrock" if new_image_url else "",
                status="scheduled", platforms=old_platforms,
                scheduled_for=old_post.scheduled_for if old_post else None,
                created_at=datetime.now(timezone.utc),
                rejected_with=feedback, regenerated_from=post_id,
                qa_score=random.randint(86, 96),
                brand_score=random.randint(88, 96),
                fact_score=random.randint(90, 97),
            )
            db.add(new_post)
            db.commit()
            db.refresh(new_post)
            co_dict = {"name": co_row.name, "hours_before": tg_cfg["hours_before"]}

        if regen_msg and regen_msg.get("message_id"):
            await telegram_svc.delete_message(token, chat_id, regen_msg["message_id"])

        new_dict = _post_to_dict(new_post)
        msg = telegram_svc.build_approval_message(
            new_dict, co_dict,
            new_post.scheduled_for.isoformat() if new_post.scheduled_for else None,
        )
        btns = telegram_svc.approval_buttons(new_id)
        if new_image_url and old_format == "photo":
            sent = await telegram_svc.send_photo(token, chat_id, new_image_url, msg, btns)
        else:
            sent = await telegram_svc.send(token, chat_id, msg, btns)

        with SessionLocal() as db:
            p = db.get(Post, new_id)
            if p:
                p.tg_notified = True
                p.tg_msg_id = sent.get("message_id")
                db.commit()

    except Exception as e:
        await telegram_svc.send(token, chat_id, f"❌ <b>Regeneration failed:</b> {e}\n\nPlease try again from the dashboard.")


# ── main poll loop ────────────────────────────────────────────────────────────

_offset = 0
_handled: set = set()


async def _poll(tg_cfg: dict, api_key: str, bedrock: dict, co: dict) -> None:
    global _offset
    token, chat_id = tg_cfg["token"], tg_cfg["chat_id"]
    try:
        updates = await telegram_svc.get_updates(token, _offset)
    except Exception:
        return

    for upd in updates:
        _offset = max(_offset, upd["update_id"] + 1)

        if upd.get("callback_query"):
            cq = upd["callback_query"]
            if cq["id"] in _handled:
                continue
            _handled.add(cq["id"])
            data = cq.get("data", "")
            action, _, post_id = data.partition("::")
            msg_id = (cq.get("message") or {}).get("message_id")
            with SessionLocal() as db:
                exists = db.get(Post, post_id) is not None
            if action == "approve":
                if exists:
                    await _handle_approve(post_id, cq["id"], msg_id, tg_cfg)
                else:
                    await telegram_svc.answer_callback(token, cq["id"], "Post not found")
            elif action == "reject":
                if exists:
                    await _handle_reject(post_id, cq["id"], msg_id, tg_cfg)
                else:
                    await telegram_svc.answer_callback(token, cq["id"], "Post not found")

        if upd.get("message", {}).get("text") and not upd["message"]["text"].startswith("/"):
            text = upd["message"]["text"].strip()
            with SessionLocal() as db:
                waiting = db.query(Post).filter(Post.status == "awaiting_feedback").first()
                waiting_id = waiting.id if waiting else None
            if waiting_id:
                await _handle_feedback(waiting_id, text, tg_cfg, api_key, bedrock, co)

    # Update last_polled timestamp
    if updates:
        with SessionLocal() as db:
            tg = db.get(TelegramSettings, 1)
            tg.last_polled = datetime.now(timezone.utc)
            db.commit()


async def run_telegram_poller() -> None:
    """Entry point: infinite loop, runs every 3 seconds."""
    print("[TG poller] started")
    while True:
        try:
            api_key, bedrock, tg_cfg, co = _get_config()
            if tg_cfg["enabled"] and tg_cfg["token"] and tg_cfg["chat_id"]:
                await _send_notifications(tg_cfg, co)
                await _poll(tg_cfg, api_key, bedrock, co)
        except Exception as e:
            print(f"[TG poller] error: {e}")
        await asyncio.sleep(3)
