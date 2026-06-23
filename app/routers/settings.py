from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.encryption import decrypt, encrypt, is_sentinel, mask
from app.models import AppSettings
from app.schemas import SettingsIn, SettingsOut, BedrockOut

router = APIRouter()


def _row_to_out(row: AppSettings) -> SettingsOut:
    return SettingsOut(
        api_key=mask(row.api_key_enc),
        bedrock=BedrockOut(
            bearer_token=mask(row.bedrock_bearer_enc),
            region=row.bedrock_region or "us-east-1",
            model_id=row.bedrock_model_id or "amazon.nova-canvas-v1:0",
            enabled=row.bedrock_enabled,
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

    if body.bedrock is not None:
        b = body.bedrock
        if b.bearer_token is not None and not is_sentinel(b.bearer_token):
            row.bedrock_bearer_enc = encrypt(b.bearer_token) if b.bearer_token else ""
        if b.region is not None:
            row.bedrock_region = b.region
        if b.model_id is not None:
            row.bedrock_model_id = b.model_id
        if b.enabled is not None:
            row.bedrock_enabled = b.enabled

    if body.setup_complete is not None:
        row.setup_complete = body.setup_complete
    if body.current_view is not None:
        row.current_view = body.current_view

    db.commit()
    db.refresh(row)
    return _row_to_out(row)


class _TestBedrockBody(BaseModel):
    bearer_token: Optional[str] = None
    region: Optional[str] = None
    model_id: Optional[str] = None


@router.post("/test-bedrock")
async def test_bedrock(body: _TestBedrockBody = _TestBedrockBody(), db: Session = Depends(get_db)):
    from app.services.bedrock import detect_and_test
    row = db.get(AppSettings, 1)

    token = body.bearer_token or ""
    if not token or is_sentinel(token):
        token = decrypt(row.bedrock_bearer_enc)

    region = body.region or row.bedrock_region or "us-east-1"
    model_id = body.model_id or None  # None → auto-detect

    if not token:
        raise HTTPException(400, "AWS Bedrock bearer token not configured.")

    try:
        detected = await detect_and_test(token, region, model_id or None)
    except Exception as e:
        raise HTTPException(400, str(e))

    # Auto-save detected model back to DB
    row.bedrock_model_id = detected
    row.bedrock_enabled = True
    db.commit()

    return {"ok": True, "modelId": detected}
