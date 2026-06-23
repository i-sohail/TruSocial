from fastapi import APIRouter, Depends, HTTPException, Request
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
            access_key=mask(row.bedrock_access_key_enc),
            secret_key=mask(row.bedrock_secret_key_enc),
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
        if b.access_key is not None and not is_sentinel(b.access_key):
            row.bedrock_access_key_enc = encrypt(b.access_key) if b.access_key else ""
        if b.secret_key is not None and not is_sentinel(b.secret_key):
            row.bedrock_secret_key_enc = encrypt(b.secret_key) if b.secret_key else ""
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


@router.post("/test-bedrock")
async def test_bedrock(request: Request, db: Session = Depends(get_db)):
    from app.services.bedrock import detect_region_and_model

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    row = db.get(AppSettings, 1)

    access_key = payload.get("accessKey") or payload.get("access_key") or ""
    secret_key = payload.get("secretKey") or payload.get("secret_key") or ""

    if not access_key or is_sentinel(access_key):
        access_key = decrypt(row.bedrock_access_key_enc)
    if not secret_key or is_sentinel(secret_key):
        secret_key = decrypt(row.bedrock_secret_key_enc)

    if not access_key:
        raise HTTPException(400, "AWS Access Key ID not configured.")
    if not secret_key:
        raise HTTPException(400, "AWS Secret Access Key not configured.")

    try:
        region, model_id = await detect_region_and_model(access_key, secret_key)
    except Exception as e:
        raise HTTPException(400, str(e))

    row.bedrock_access_key_enc = encrypt(access_key)
    row.bedrock_secret_key_enc = encrypt(secret_key)
    row.bedrock_region = region
    row.bedrock_model_id = model_id
    row.bedrock_enabled = True
    db.commit()

    return {"ok": True, "region": region, "modelId": model_id}
