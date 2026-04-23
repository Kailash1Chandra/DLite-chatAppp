from app.models.schemas import ChatMessage
import httpx

from app.core.config import settings


def build_reply(prompt: str, style: str | None = None) -> str:
    prompt = prompt.strip()
    if not prompt:
        return ""
    prefix = f"[{style}] " if style else ""
    return f"{prefix}AI backend received: {prompt}"


def build_chat_reply(messages: list[ChatMessage]) -> str:
    if not messages:
        return "No messages provided."

    user_messages = [m.content.strip() for m in messages if m.role == "user" and m.content.strip()]
    last_user = user_messages[-1] if user_messages else messages[-1].content.strip()
    return f"AI backend reply: {last_user}"


def build_friendly_reply(text: str) -> str:
    clean = text.strip()
    if not clean:
        return "hmm, say that again?"

    lower = clean.lower()
    if any(word in lower for word in ("sad", "upset", "bad", "tired", "stuck")):
        return f"aww, that sounds rough 😕 wanna talk more about {clean[:80]}?"
    if any(word in lower for word in ("hi", "hello", "hey", "yo")):
        return "heyy 😄 what’s up?"
    if any(word in lower for word in ("thanks", "thank you", "thx")):
        return "anytimee 😌"

    return f"gotcha — {clean[:140]}"


async def get_openrouter_reply(messages: list[ChatMessage]) -> str:
    api_key = (settings.openrouter_api_key or "").strip()
    if not api_key:
        return build_chat_reply(messages)

    payload_messages = [{"role": m.role, "content": m.content} for m in messages]
    body = {
        "model": settings.openrouter_model,
        "messages": payload_messages,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post("https://openrouter.ai/api/v1/chat/completions", json=body, headers=headers)
        response.raise_for_status()
        data = response.json() or {}
        choices = data.get("choices") or []
        first = choices[0] if choices else {}
        message = first.get("message") or {}
        content = str(message.get("content") or "").strip()
        return content or build_chat_reply(messages)
    except Exception:
        return build_chat_reply(messages)
