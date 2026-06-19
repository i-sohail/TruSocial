from openai import AsyncAzureOpenAI, APIError


async def generate_image(api_key: str, endpoint: str, deployment: str, api_version: str, prompt: str) -> str:
    client = AsyncAzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=api_version,
    )
    try:
        response = await client.images.generate(
            model=deployment,
            prompt=prompt,
            size="1024x1024",
            n=1,
        )
    except APIError as e:
        raise ValueError(f"Azure OpenAI image: {e.message}")
    item = response.data[0]
    if item.b64_json:
        return f"data:image/png;base64,{item.b64_json}"
    if item.url:
        return item.url
    raise ValueError("Azure OpenAI returned no image data.")


async def test_connection(api_key: str, endpoint: str, deployment: str, api_version: str) -> None:
    client = AsyncAzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=api_version,
    )
    try:
        response = await client.images.generate(
            model=deployment,
            prompt="a simple blue circle on a white background",
            size="1024x1024",
            n=1,
        )
    except APIError as e:
        raise ValueError(f"Azure OpenAI image: {e.message}")
    item = response.data[0]
    if not item.b64_json and not item.url:
        raise ValueError("No image returned from Azure OpenAI.")
