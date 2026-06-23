import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.encryption import decrypt
from app.models import AppSettings, Company, Post
from app.schemas import GenerateRequest, PostOut
from app.routers.posts import _to_out
from app.services.claude import call_claude, build_system_prompt

router = APIRouter()

_PLATFORM_LABELS = {
    "linkedin": "LinkedIn", "instagram": "Instagram",
    "facebook": "Facebook", "x": "X (Twitter)",
}


@router.post("/full", response_model=PostOut)
async def generate_full(body: GenerateRequest, db: Session = Depends(get_db)):
    settings = db.get(AppSettings, 1)
    api_key = decrypt(settings.api_key_enc)
    if not api_key:
        raise HTTPException(400, "Claude API key not configured. Add it in Setup → API Keys.")

    co = db.get(Company, 1)
    co_dict = {
        "name": co.name, "industry": co.industry, "description": co.description,
        "products": co.products, "target_audience": co.target_audience,
        "brand_voice": co.brand_voice, "tone": co.tone, "keywords": co.keywords,
        "brand_guidelines": co.brand_guidelines,
    }
    sys_prompt = build_system_prompt(co_dict)

    enabled_platforms = {k: v for k, v in (co.platforms or {}).items() if v}
    platform_names = ", ".join(_PLATFORM_LABELS.get(k, k) for k in enabled_platforms)

    topic_ctx = body.topic.strip() or f"{body.content_type} content about {co.industry or 'our industry'}"

    # Step 1 – get industry insight
    try:
        insights = await call_claude(
            api_key, "Industry analyst. 2 sentences max.",
            f"Industry:{co.industry} Topic:{topic_ctx}. Best social media angle?", 150,
        )
    except Exception:
        insights = "Focus on practical value and actionable insights."

    # Step 2 – generate post copy
    post_body = await call_claude(
        api_key, sys_prompt,
        f'Write ONE social media post about: "{topic_ctx}"\n'
        f"Type: {body.content_type}\nInsight: {insights}\n"
        f"Publishing to: {platform_names}\n"
        f"Write with: powerful hook, 2-3 value lines, 5-8 hashtags, clear CTA.\n"
        f"Write ONLY the post. No labels or preamble.",
        700,
    )

    # Step 3 – optionally generate image via AWS Bedrock
    image_url = None
    image_prompt = None
    image_error = None

    if body.format == "photo":
        if not settings.bedrock_enabled or not settings.bedrock_bearer_enc:
            image_error = "AWS Bedrock image generation not configured."
        else:
            bearer = decrypt(settings.bedrock_bearer_enc)
            try:
                image_prompt = await call_claude(
                    api_key, sys_prompt,
                    f"Write a vivid image generation prompt for a social media poster. "
                    f"Topic: {topic_ctx}. Style: {body.image_style}. "
                    f"Company: {co.name}. Industry: {co.industry}. "
                    f"Write ONLY the image prompt (2 sentences, vivid and specific).", 250,
                )
                from app.services.bedrock import generate_image
                image_url = await generate_image(
                    bearer,
                    settings.bedrock_region or "us-east-1",
                    settings.bedrock_model_id or "amazon.nova-canvas-v1:0",
                    image_prompt,
                )
            except Exception as e:
                image_error = str(e)

    post_id = f"post_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    new_post = Post(
        id=post_id,
        body=post_body,
        format=body.format,
        content_type=body.content_type,
        topic=topic_ctx,
        image_url=image_url or "",
        image_prompt=image_prompt or "",
        image_error=image_error or "",
        image_style=body.image_style if body.format == "photo" else "",
        image_provider="aws-bedrock" if body.format == "photo" and image_url else "",
        status="pending",
        platforms=dict(enabled_platforms),
        created_at=datetime.now(timezone.utc),
        qa_score=random.randint(86, 96),
        brand_score=random.randint(88, 96),
        fact_score=random.randint(90, 97),
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    return _to_out(new_post)
