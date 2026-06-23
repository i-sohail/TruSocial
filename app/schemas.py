from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class _Base(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)


# ── Settings ──────────────────────────────────────────────────────────────────

class BedrockOut(_Base):
    access_key: str = ""
    secret_key: str = ""
    region: str = "us-east-1"
    model_id: str = "amazon.nova-canvas-v1:0"
    enabled: bool = False


class SettingsOut(_Base):
    api_key: str = ""
    bedrock: BedrockOut = BedrockOut()
    setup_complete: bool = False
    current_view: str = "dashboard"


class BedrockIn(_Base):
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    region: Optional[str] = None
    model_id: Optional[str] = None
    enabled: Optional[bool] = None


class SettingsIn(_Base):
    api_key: Optional[str] = None
    bedrock: Optional[BedrockIn] = None
    setup_complete: Optional[bool] = None
    current_view: Optional[str] = None


# ── Company ───────────────────────────────────────────────────────────────────

class CompanySchema(_Base):
    name: str = ""
    industry: str = ""
    description: str = ""
    website: str = ""
    products: str = ""
    services: str = ""
    target_audience: str = ""
    brand_voice: str = "professional"
    brand_colors: List[str] = ["#6C63FF", "#00D1B2"]
    company_size: str = ""
    competitors: str = ""
    keywords: str = ""
    tone: str = "authoritative"
    approval_mode: str = "selective"
    brand_guidelines: str = ""
    platforms: Dict[str, bool] = {"linkedin": True, "instagram": True, "facebook": False, "x": False}
    schedule: Dict[str, bool] = {
        "monday": True, "tuesday": True, "wednesday": True,
        "thursday": True, "friday": True, "saturday": False, "sunday": False,
    }


# ── Social Accounts ───────────────────────────────────────────────────────────

class FacebookAccount(_Base):
    connected: bool = False
    access_token: str = ""
    page_id: str = ""
    page_name: str = ""
    app_id: str = ""
    app_secret: str = ""


class InstagramAccount(_Base):
    connected: bool = False
    access_token: str = ""
    account_id: str = ""
    username: str = ""
    app_id: str = ""
    app_secret: str = ""


class XAccount(_Base):
    connected: bool = False
    api_key: str = ""
    api_secret: str = ""
    access_token: str = ""
    access_secret: str = ""
    bearer_token: str = ""


class LinkedInAccount(_Base):
    connected: bool = False
    access_token: str = ""
    organization_id: str = ""
    profile_name: str = ""
    client_id: str = ""
    client_secret: str = ""


class SocialAccountsOut(_Base):
    facebook: FacebookAccount = FacebookAccount()
    instagram: InstagramAccount = InstagramAccount()
    x: XAccount = XAccount()
    linkedin: LinkedInAccount = LinkedInAccount()


# ── Posts ─────────────────────────────────────────────────────────────────────

class PostOut(_Base):
    id: str
    body: str = ""
    format: str = "text"
    content_type: str = ""
    topic: str = ""
    image_url: Optional[str] = None
    image_prompt: Optional[str] = None
    image_error: Optional[str] = None
    image_style: Optional[str] = None
    image_provider: Optional[str] = None
    status: str = "pending"
    platforms: Dict[str, bool] = {}
    scheduled_for: Optional[datetime] = None
    created_at: Optional[datetime] = None
    publish_results: Optional[Dict[str, Any]] = None
    published_at: Optional[datetime] = None
    qa_score: int = 0
    brand_score: int = 0
    fact_score: int = 0
    tg_notified: bool = False
    tg_msg_id: Optional[int] = None
    rejected_with: Optional[str] = None
    regenerated_from: Optional[str] = None
    replaced_by: Optional[str] = None


class PostUpdate(_Base):
    body: Optional[str] = None
    status: Optional[str] = None


class ScheduleRequest(_Base):
    scheduled_for: datetime


class PublishResult(_Base):
    success: bool
    post_id: Optional[str] = None
    published_at: Optional[str] = None
    error: Optional[str] = None


# ── Generate ──────────────────────────────────────────────────────────────────

class GenerateRequest(_Base):
    format: str = "text"
    content_type: str = "Educational"
    topic: str = ""
    image_style: str = "professional poster"


# ── Telegram ──────────────────────────────────────────────────────────────────

class TelegramOut(_Base):
    bot_token: str = ""
    chat_id: str = ""
    enabled: bool = False
    hours_before: int = 5
    last_polled: Optional[datetime] = None


class TelegramIn(_Base):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    enabled: Optional[bool] = None
    hours_before: Optional[int] = None


class BotTokenRequest(_Base):
    bot_token: Optional[str] = None


class TestMessageRequest(_Base):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    hours_before: int = 5


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsOut(_Base):
    total: int = 0
    by_format: Dict[str, int] = {}
    by_status: Dict[str, int] = {}
    tg_notified: int = 0
    published_via_tg: int = 0
    regenerated: int = 0


class InsightOut(_Base):
    insight: str = ""
