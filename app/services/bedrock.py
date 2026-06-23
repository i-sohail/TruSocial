import asyncio
import json
import random

import boto3
from botocore.exceptions import ClientError

_MODELS = [
    "amazon.nova-canvas-v1:0",
    "amazon.titan-image-generator-v2:0",
]

_REGIONS = [
    "us-east-1",
    "us-west-2",
    "eu-west-1",
    "eu-central-1",
    "ap-southeast-1",
    "ap-northeast-1",
]

_IMAGE_PAYLOAD = lambda prompt, seed: {
    "taskType": "TEXT_IMAGE",
    "textToImageParams": {"text": prompt},
    "imageGenerationConfig": {
        "numberOfImages": 1,
        "quality": "standard",
        "cfgScale": 8.0,
        "height": 1024,
        "width": 1024,
        "seed": seed,
    },
}


def _client(region: str, access_key: str, secret_key: str):
    return boto3.client(
        "bedrock-runtime",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def _invoke(region: str, model_id: str, access_key: str, secret_key: str, payload: dict) -> dict:
    client = _client(region, access_key, secret_key)
    try:
        resp = client.invoke_model(modelId=model_id, body=json.dumps(payload))
        return json.loads(resp["body"].read())
    except ClientError as e:
        raise ValueError(e.response["Error"]["Message"])


async def generate_image(access_key: str, secret_key: str, region: str, model_id: str, prompt: str) -> str:
    payload = _IMAGE_PAYLOAD(prompt, random.randint(0, 2_147_483_647))
    result = await asyncio.to_thread(_invoke, region, model_id, access_key, secret_key, payload)
    b64 = result.get("images", [None])[0]
    if not b64:
        raise ValueError("Bedrock returned no image data.")
    return f"data:image/png;base64,{b64}"


async def detect_region_and_model(access_key: str, secret_key: str, region: str | None = None) -> tuple[str, str]:
    """Try each region × each model. Returns (region, model_id) of the first that works."""
    test_payload = _IMAGE_PAYLOAD("a simple blue circle on white background", 42)
    regions = [region] if region else _REGIONS
    legacy_hit = False

    for r in regions:
        for m in _MODELS:
            try:
                result = await asyncio.to_thread(_invoke, r, m, access_key, secret_key, test_payload)
                if result.get("images"):
                    return r, m
            except ValueError as e:
                if "Legacy" in str(e) or "legacy" in str(e):
                    legacy_hit = True
                continue

    if legacy_hit:
        raise ValueError(
            "Token valid but Nova Canvas and Titan are Legacy (inactive 30+ days). "
            "Fix: AWS Console → Bedrock → Model access → Modify → enable 'Amazon Nova Canvas' → Save."
        )
    raise ValueError(
        "No accessible Bedrock image model found. "
        "Make sure Nova Canvas or Titan Image Generator is enabled in your AWS account under Model access."
    )
