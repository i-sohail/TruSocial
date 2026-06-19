from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.encryption import decrypt
from app.models import AppSettings, Post, TelegramSettings, SocialAccount
from app.schemas import AnalyticsOut, InsightOut

router = APIRouter()


@router.get("", response_model=AnalyticsOut)
def get_analytics(db: Session = Depends(get_db)):
    posts = db.query(Post).all()
    by_fmt = {"text": 0, "photo": 0}
    by_status: dict = {}
    for p in posts:
        by_fmt[p.format] = by_fmt.get(p.format, 0) + 1
        by_status[p.status] = by_status.get(p.status, 0) + 1

    tg_notified = sum(1 for p in posts if p.tg_notified)
    published_via_tg = sum(1 for p in posts if p.status == "published" and p.tg_notified)
    regenerated = sum(1 for p in posts if p.rejected_with)

    return AnalyticsOut(
        total=len(posts),
        by_format=by_fmt,
        by_status=by_status,
        tg_notified=tg_notified,
        published_via_tg=published_via_tg,
        regenerated=regenerated,
    )


@router.post("/insights", response_model=InsightOut)
async def get_insights(db: Session = Depends(get_db)):
    from app.services.claude import call_claude
    settings = db.get(AppSettings, 1)
    api_key = decrypt(settings.api_key_enc)
    if not api_key:
        raise HTTPException(400, "Claude API key not configured.")

    posts = db.query(Post).all()
    by_fmt = {"text": 0, "photo": 0}
    by_status: dict = {}
    for p in posts:
        by_fmt[p.format] = by_fmt.get(p.format, 0) + 1
        by_status[p.status] = by_status.get(p.status, 0) + 1

    tg_notified = sum(1 for p in posts if p.tg_notified)
    published_via_tg = sum(1 for p in posts if p.status == "published" and p.tg_notified)
    regenerated = sum(1 for p in posts if p.rejected_with)

    from app.models import Company
    co = db.get(Company, 1)

    try:
        text = await call_claude(
            api_key,
            "You are a social media analyst. Be specific and actionable.",
            (
                f"Posts:{len(posts)}, Text:{by_fmt['text']}, Photo:{by_fmt['photo']}, "
                f"Published:{by_status.get('published',0)}, TgApproved:{published_via_tg}, "
                f"Regenerated:{regenerated}, Industry:{co.industry}\n"
                f"Give 3 specific content recommendations."
            ),
            500,
        )
    except Exception as e:
        raise HTTPException(502, str(e))

    return InsightOut(insight=text)
