from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, JSON
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    api_key_enc = Column(Text, default="")
    bedrock_bearer_enc = Column(Text, default="")
    bedrock_region = Column(String(50), default="us-east-1")
    bedrock_model_id = Column(String(120), default="amazon.nova-canvas-v1:0")
    bedrock_enabled = Column(Boolean, default=False)
    setup_complete = Column(Boolean, default=False)
    current_view = Column(String(50), default="dashboard")


class Company(Base):
    __tablename__ = "company"

    id = Column(Integer, primary_key=True, default=1)
    name = Column(String(255), default="")
    industry = Column(String(100), default="")
    description = Column(Text, default="")
    website = Column(String(255), default="")
    products = Column(Text, default="")
    services = Column(Text, default="")
    target_audience = Column(Text, default="")
    brand_voice = Column(String(50), default="professional")
    brand_colors = Column(JSON, default=lambda: ["#6C63FF", "#00D1B2"])
    company_size = Column(String(50), default="")
    competitors = Column(Text, default="")
    keywords = Column(Text, default="")
    tone = Column(String(50), default="authoritative")
    approval_mode = Column(String(50), default="selective")
    brand_guidelines = Column(Text, default="")
    platforms = Column(JSON, default=lambda: {"linkedin": True, "instagram": True, "facebook": False, "x": False})
    schedule = Column(JSON, default=lambda: {
        "monday": True, "tuesday": True, "wednesday": True,
        "thursday": True, "friday": True, "saturday": False, "sunday": False,
    })


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True)
    platform = Column(String(50), unique=True, nullable=False)
    connected = Column(Boolean, default=False)
    # Encrypted secret fields
    access_token_enc = Column(Text, default="")
    app_secret_enc = Column(Text, default="")
    api_key_enc = Column(Text, default="")
    api_secret_enc = Column(Text, default="")
    access_secret_enc = Column(Text, default="")
    client_secret_enc = Column(Text, default="")
    bearer_token_enc = Column(Text, default="")  # X bearer token
    # Plain (non-secret) fields
    page_id = Column(String(100), default="")
    page_name = Column(String(255), default="")
    app_id = Column(String(100), default="")
    account_id = Column(String(100), default="")
    username = Column(String(100), default="")
    organization_id = Column(String(100), default="")
    profile_name = Column(String(255), default="")
    client_id = Column(String(100), default="")


class Post(Base):
    __tablename__ = "posts"

    id = Column(String(100), primary_key=True)
    body = Column(Text, default="")
    format = Column(String(20), default="text")
    content_type = Column(String(50), default="")
    topic = Column(Text, default="")
    image_url = Column(Text, default="")
    image_prompt = Column(Text, default="")
    image_error = Column(Text, default="")
    image_style = Column(String(100), default="")
    image_provider = Column(String(50), default="")
    status = Column(String(50), default="pending")
    platforms = Column(JSON, default=lambda: {})
    scheduled_for = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    publish_results = Column(JSON, nullable=True)
    published_at = Column(DateTime, nullable=True)
    qa_score = Column(Integer, default=0)
    brand_score = Column(Integer, default=0)
    fact_score = Column(Integer, default=0)
    tg_notified = Column(Boolean, default=False)
    tg_msg_id = Column(Integer, nullable=True)
    rejected_with = Column(Text, default="")
    regenerated_from = Column(String(100), default="")
    replaced_by = Column(String(100), default="")


class TelegramSettings(Base):
    __tablename__ = "telegram_settings"

    id = Column(Integer, primary_key=True, default=1)
    bot_token_enc = Column(Text, default="")
    chat_id = Column(String(100), default="")
    enabled = Column(Boolean, default=False)
    hours_before = Column(Integer, default=5)
    last_polled = Column(DateTime, nullable=True)
