from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.encryption import decrypt, encrypt, is_sentinel, mask
from app.models import SocialAccount
from app.schemas import SocialAccountsOut, FacebookAccount, InstagramAccount, XAccount, LinkedInAccount

router = APIRouter()

_DEFAULTS: dict = {
    "facebook": FacebookAccount(),
    "instagram": InstagramAccount(),
    "x": XAccount(),
    "linkedin": LinkedInAccount(),
}


def _fb_out(row: SocialAccount) -> FacebookAccount:
    return FacebookAccount(
        connected=row.connected, access_token=mask(row.access_token_enc),
        page_id=row.page_id, page_name=row.page_name,
        app_id=row.app_id, app_secret=mask(row.app_secret_enc),
    )


def _ig_out(row: SocialAccount) -> InstagramAccount:
    return InstagramAccount(
        connected=row.connected, access_token=mask(row.access_token_enc),
        account_id=row.account_id, username=row.username,
        app_id=row.app_id, app_secret=mask(row.app_secret_enc),
    )


def _x_out(row: SocialAccount) -> XAccount:
    return XAccount(
        connected=row.connected, api_key=mask(row.api_key_enc),
        api_secret=mask(row.api_secret_enc), access_token=mask(row.access_token_enc),
        access_secret=mask(row.access_secret_enc), bearer_token=mask(row.bearer_token_enc),
    )


def _li_out(row: SocialAccount) -> LinkedInAccount:
    return LinkedInAccount(
        connected=row.connected, access_token=mask(row.access_token_enc),
        organization_id=row.organization_id, profile_name=row.profile_name,
        client_id=row.client_id, client_secret=mask(row.client_secret_enc),
    )


def _row_to_typed(row: SocialAccount):
    if row.platform == "facebook": return _fb_out(row)
    if row.platform == "instagram": return _ig_out(row)
    if row.platform == "x": return _x_out(row)
    if row.platform == "linkedin": return _li_out(row)
    return None


@router.get("", response_model=SocialAccountsOut)
def get_all(db: Session = Depends(get_db)):
    rows = {r.platform: r for r in db.query(SocialAccount).all()}
    return SocialAccountsOut(
        facebook=_fb_out(rows["facebook"]) if "facebook" in rows else FacebookAccount(),
        instagram=_ig_out(rows["instagram"]) if "instagram" in rows else InstagramAccount(),
        x=_x_out(rows["x"]) if "x" in rows else XAccount(),
        linkedin=_li_out(rows["linkedin"]) if "linkedin" in rows else LinkedInAccount(),
    )


@router.put("/{platform}")
def update_account(platform: str, body: dict, db: Session = Depends(get_db)):
    if platform not in ("facebook", "instagram", "x", "linkedin"):
        raise HTTPException(404, "Unknown platform")

    row = db.query(SocialAccount).filter_by(platform=platform).first()

    def _set_enc(field: str, key: str):
        val = body.get(key, "")
        if val and not is_sentinel(val):
            setattr(row, field, encrypt(val))
        elif not val:
            setattr(row, field, "")

    _set_enc("access_token_enc", "accessToken")
    _set_enc("app_secret_enc", "appSecret")
    _set_enc("api_key_enc", "apiKey")
    _set_enc("api_secret_enc", "apiSecret")
    _set_enc("access_secret_enc", "accessSecret")
    _set_enc("client_secret_enc", "clientSecret")
    _set_enc("bearer_token_enc", "bearerToken")

    # Plain fields
    for attr, key in [
        ("page_id","pageId"),("page_name","pageName"),("app_id","appId"),
        ("account_id","accountId"),("username","username"),
        ("organization_id","organizationId"),("profile_name","profileName"),
        ("client_id","clientId"),
    ]:
        if key in body:
            setattr(row, attr, body[key])

    has_token = any([
        row.access_token_enc, row.api_key_enc, row.bearer_token_enc,
    ])
    row.connected = bool(has_token)

    db.commit()
    return {"ok": True, "connected": row.connected}


@router.delete("/{platform}")
def disconnect(platform: str, db: Session = Depends(get_db)):
    row = db.query(SocialAccount).filter_by(platform=platform).first()
    if not row:
        raise HTTPException(404, "Platform not found")
    for field in (
        "access_token_enc","app_secret_enc","api_key_enc","api_secret_enc",
        "access_secret_enc","client_secret_enc","bearer_token_enc",
        "page_id","page_name","app_id","account_id","username",
        "organization_id","profile_name","client_id",
    ):
        setattr(row, field, "")
    row.connected = False
    db.commit()
    return {"ok": True}


def get_decrypted_creds(platform: str, db: Session) -> dict:
    """Return fully decrypted credentials for publishing."""
    row = db.query(SocialAccount).filter_by(platform=platform).first()
    if not row:
        return {}
    return {
        "connected": row.connected,
        "accessToken": decrypt(row.access_token_enc),
        "appSecret": decrypt(row.app_secret_enc),
        "apiKey": decrypt(row.api_key_enc),
        "apiSecret": decrypt(row.api_secret_enc),
        "accessSecret": decrypt(row.access_secret_enc),
        "clientSecret": decrypt(row.client_secret_enc),
        "bearerToken": decrypt(row.bearer_token_enc),
        "pageId": row.page_id, "pageName": row.page_name, "appId": row.app_id,
        "accountId": row.account_id, "username": row.username,
        "organizationId": row.organization_id, "profileName": row.profile_name,
        "clientId": row.client_id,
    }
