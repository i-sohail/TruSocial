import asyncio
import json
import os
import random

import boto3
from botocore.exceptions import ClientError

_MODELS = [
    "amazon.nova-canvas-v1:0",
    "amazon.titan-image-generator-v2:0",
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


def _invoke(region: str, model_id: str, token: str, payload: dict) -> dict:
    os.environ["AWS_BEARER_TOKEN_BEDROCK"] = token
    client = boto3.client("bedrock-runtime", region_name=region)
    try:
        resp = client.invoke_model(modelId=model_id, body=json.dumps(payload))
        return json.loads(resp["body"].read())
    except ClientError as e:
        raise ValueError(e.response["Error"]["Message"])


async def generate_image(bearer_token: str, region: str, model_id: str, prompt: str) -> str:
    payload = _IMAGE_PAYLOAD(prompt, random.randint(0, 2_147_483_647))
    result = await asyncio.to_thread(_invoke, region, model_id, bearer_token, payload)
    b64 = result.get("images", [None])[0]
    if not b64:
        raise ValueError("Bedrock returned no image data.")
    return f"data:image/png;base64,{b64}"


async def detect_and_test(bearer_token: str, region: str, model_id: str | None = None) -> str:
    """Test connection and return the working model ID.
    If model_id is given, test only that model.
    Otherwise try Nova Canvas then Titan until one works.
    """
    models = [model_id] if model_id else _MODELS
    payload = _IMAGE_PAYLOAD("a simple blue circle on white background", 42)
    last_err: Exception = ValueError("No Bedrock image model accessible.")

    for m in models:
        try:
            result = await asyncio.to_thread(_invoke, region, m, bearer_token, payload)
            if result.get("images"):
                return m
        except ValueError as e:
            last_err = e

    raise last_err
