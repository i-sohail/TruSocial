from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.encryption import decrypt, encrypt, is_sentinel, mask
from app.models import AppSettings
from app.schemas import SettingsIn, SettingsOut, OpenAIImageOut

router = APIRouter()


def _row_to_out(row: AppSettings) -> SettingsOut:
    return SettingsOut(
        api_key=mask(row.api_key_enc),
        openai=OpenAIImageOut(
            api_key=mask(row.openai_key_enc),
            endpoint=row.openai_endpoint or "",
            deployment=row.openai_deployment or "gpt-4o",
            api_version=row.openai_api_version or "2024-12-01-preview",
            enabled=row.openai_image_enabled,
        ),
        setup_complete=row.setup_complete,
        current_view=row.current_view,
    )


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    row = db.get(AppSettings, 1)
    return _row_to_out(row)


@router.put("", response_model=SettingsOut)
def update_settings(body: SettingsIn, db: Session = Depends(get_db)):
    row = db.get(AppSettings, 1)

    if body.api_key is not None and not is_sentinel(body.api_key):
        row.api_key_enc = encrypt(body.api_key) if body.api_key else ""

    if body.openai is not None:
        o = body.openai
        if o.api_key is not None and not is_sentinel(o.api_key):
            row.openai_key_enc = encrypt(o.api_key) if o.api_key else ""
        if o.endpoint is not None:
            row.openai_endpoint = o.endpoint
        if o.deployment is not None:
            row.openai_deployment = o.deployment
        if o.api_version is not None:
            row.openai_api_version = o.api_version
        if o.enabled is not None:
            row.openai_image_enabled = o.enabled

    if body.setup_complete is not None:
        row.setup_complete = body.setup_complete
    if body.current_view is not None:
        row.current_view = body.current_view

    db.commit()
    db.refresh(row)
    return _row_to_out(row)


class _TestOpenAIBody(BaseModel):
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    deployment: Optional[str] = None
    api_version: Optional[str] = None


@router.post("/test-openai")
async def test_openai(body: _TestOpenAIBody = _TestOpenAIBody(), db: Session = Depends(get_db)):
    from app.services.openai_image import test_connection
    row = db.get(AppSettings, 1)

    key = body.api_key or ""
    if not key or is_sentinel(key):
        key = decrypt(row.openai_key_enc)

    endpoint = body.endpoint or row.openai_endpoint or ""
    deployment = body.deployment or row.openai_deployment or "gpt-4o"
    api_version = body.api_version or row.openai_api_version or "2024-12-01-preview"

    if not key:
        raise HTTPException(400, "Azure OpenAI API key not configured.")
    if not endpoint:
        raise HTTPException(400, "Azure OpenAI endpoint URL not configured.")
    try:
        await test_connection(key, endpoint, deployment, api_version)
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"ok": True}
