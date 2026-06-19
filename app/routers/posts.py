from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import Post
from app.schemas import PostOut, PostUpdate, ScheduleRequest

router = APIRouter()


def _to_out(p: Post) -> PostOut:
    return PostOut(
        id=p.id, body=p.body, format=p.format,
        content_type=p.content_type, topic=p.topic,
        image_url=p.image_url or None, image_prompt=p.image_prompt or None,
        image_error=p.image_error or None, image_style=p.image_style or None,
        image_provider=p.image_provider or None,
        status=p.status, platforms=p.platforms or {},
        scheduled_for=p.scheduled_for, created_at=p.created_at,
        publish_results=p.publish_results,
        published_at=p.published_at,
        qa_score=p.qa_score, brand_score=p.brand_score, fact_score=p.fact_score,
        tg_notified=p.tg_notified, tg_msg_id=p.tg_msg_id,
        rejected_with=p.rejected_with or None,
        regenerated_from=p.regenerated_from or None,
        replaced_by=p.replaced_by or None,
    )


@router.get("", response_model=List[PostOut])
def list_posts(db: Session = Depends(get_db)):
    posts = db.query(Post).order_by(Post.created_at.desc()).all()
    return [_to_out(p) for p in posts]


@router.put("/{post_id}", response_model=PostOut)
def update_post(post_id: str, body: PostUpdate, db: Session = Depends(get_db)):
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Post not found")
    if body.body is not None:
        p.body = body.body
    if body.status is not None:
        p.status = body.status
    db.commit()
    return _to_out(p)


@router.delete("/{post_id}", status_code=204)
def delete_post(post_id: str, db: Session = Depends(get_db)):
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Post not found")
    db.delete(p)
    db.commit()


@router.post("/{post_id}/approve", response_model=PostOut)
def approve_post(post_id: str, db: Session = Depends(get_db)):
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Post not found")
    p.status = "approved"
    db.commit()
    return _to_out(p)


@router.post("/{post_id}/reject", response_model=PostOut)
def reject_post(post_id: str, db: Session = Depends(get_db)):
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Post not found")
    p.status = "rejected"
    db.commit()
    return _to_out(p)


@router.post("/{post_id}/schedule", response_model=PostOut)
def schedule_post(post_id: str, body: ScheduleRequest, db: Session = Depends(get_db)):
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Post not found")
    p.scheduled_for = body.scheduled_for
    p.status = "scheduled"
    p.tg_notified = False
    db.commit()
    return _to_out(p)


@router.post("/{post_id}/publish", response_model=PostOut)
async def publish_post(post_id: str, db: Session = Depends(get_db)):
    from app.models import AppSettings, TelegramSettings
    from app.routers.social import get_decrypted_creds
    from app.services.publishers import facebook, instagram, twitter, linkedin

    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Post not found")

    platforms = [k for k, v in (p.platforms or {}).items() if v]
    results = {}

    for plat in platforms:
        creds = get_decrypted_creds(plat, db)
        if not creds.get("connected"):
            results[plat] = {"success": False, "error": "Not connected"}
            continue
        try:
            post_dict = {
                "body": p.body, "format": p.format,
                "imageUrl": p.image_url, "image_url": p.image_url,
            }
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

    ok = any(r.get("success") for r in results.values())
    p.status = "published" if ok else "publish_error"
    p.publish_results = results
    p.published_at = datetime.now(timezone.utc)
    db.commit()
    return _to_out(p)


@router.post("/{post_id}/send-telegram", response_model=PostOut)
async def send_to_telegram(post_id: str, db: Session = Depends(get_db)):
    from app.models import TelegramSettings, Company
    from app.services.telegram_svc import send, send_photo, build_approval_message, approval_buttons
    from app.encryption import decrypt

    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Post not found")

    tg = db.get(TelegramSettings, 1)
    token = decrypt(tg.bot_token_enc)
    if not token or not tg.chat_id:
        raise HTTPException(400, "Telegram not configured")

    co = db.get(Company, 1)
    post_dict = {
        "body": p.body, "format": p.format,
        "contentType": p.content_type, "content_type": p.content_type,
        "platforms": p.platforms,
        "imageUrl": p.image_url,
    }
    co_dict = {"name": co.name, "hours_before": tg.hours_before}
    msg = build_approval_message(post_dict, co_dict, p.scheduled_for.isoformat() if p.scheduled_for else None)
    btns = approval_buttons(p.id)

    try:
        if p.image_url and p.format == "photo":
            sent = await send_photo(token, tg.chat_id, p.image_url, msg, btns)
        else:
            sent = await send(token, tg.chat_id, msg, btns)
        p.tg_notified = True
        p.tg_msg_id = sent.get("message_id")
        db.commit()
    except Exception as e:
        raise HTTPException(502, str(e))

    return _to_out(p)
