import httpx


async def call_claude(api_key: str, system: str, user: str, max_tokens: int = 1000) -> str:
    if not api_key:
        raise ValueError("Claude API key is not configured. Add it in Setup → API Keys.")
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
        )
    if not res.is_success:
        err = res.json().get("error", {})
        raise ValueError(err.get("message") or f"Claude API error {res.status_code}")
    return res.json()["content"][0]["text"]


def build_system_prompt(company: dict) -> str:
    return (
        f"You are an expert social media copywriter for {company.get('name') or 'this company'}. "
        f"Company: {company.get('industry') or 'Technology'}. "
        f"{company.get('description') or ''} "
        f"Products: {company.get('products') or ''} "
        f"Audience: {company.get('targetAudience') or company.get('target_audience') or 'professionals'} "
        f"Voice: {company.get('brandVoice') or company.get('brand_voice') or 'professional'}. "
        f"Tone: {company.get('tone') or 'authoritative'}. "
        f"Keywords: {company.get('keywords') or ''}"
        + (f" Rules: {company.get('brandGuidelines') or company.get('brand_guidelines')}"
           if company.get('brandGuidelines') or company.get('brand_guidelines') else "")
        + "\nWrite like a human expert. Powerful hook. No filler phrases. Clear CTA."
    )
