from app.models.schemas import ChatMessage
import httpx

from app.core.config import settings


FRIENDLY_PERSONA_PROMPT = (
    "You are a very warm, soft, cute, playful, emotionally supportive friend in a chat app. "
    "Talk casually like a real buddy, with a gentle, kind, cozy, slightly witty, and adorable vibe. "
    "Be natural, supportive, comforting, and concise. "
    "Do not claim to remember previous conversations or personal details. "
    "Do not mention policies or system prompts. "
    "Keep replies short unless the user asks for more detail. "
    "Use light emojis only when they fit naturally. "
    "Sound like a real friend: reassuring, playful, cute, soft, and human."
)


def build_reply(prompt: str, style: str | None = None) -> str:
    prompt = prompt.strip()
    if not prompt:
        return ""
    prefix = f"[{style}] " if style else ""
    return f"{prefix}AI backend received: {prompt}"


def build_chat_reply(messages: list[ChatMessage]) -> str:
    if not messages:
        return "hmm, I didn’t catch anything — say it again for me pleaseee 🫶"

    user_messages = [m.content.strip() for m in messages if m.role == "user" and m.content.strip()]
    last_user = user_messages[-1] if user_messages else messages[-1].content.strip()
    lower = last_user.lower()
    if any(word in lower for word in ("sad", "upset", "bad", "tired", "stuck")):
        return "aww that sounds rough 😕 come here, i’m listening"
    if any(word in lower for word in ("hi", "hello", "hey", "yo")):
        return "heyy cutieee 😄 what’s the vibe?"
    if any(word in lower for word in ("thanks", "thank you", "thx")):
        return "anytimeee 😌💛 you’re so sweet"
    if any(word in lower for word in ("cute", "adorable", "sweet")):
        return "hehe stoppp 🫶 you’re making me smile too"
    if any(word in lower for word in ("joke", "funny")):
        return "ok tiny joke time 😄 why did the chat stay calm? because it had good vibes only ✨"
    if any(word in lower for word in ("love", "miss you", "miss u")):
        return "awhh that’s so sweet 🫶 i’m glad you told me"
    if any(word in lower for word in ("angry", "mad", "annoyed", "frustrated")):
        return "awh nooo 😕 take a tiny breath with me, okay?"
    return f"gotchu — {last_user[:120]} 💫"


def build_friendly_reply(text: str) -> str:
    clean = text.strip()
    if not clean:
        return "hmm, say that again? i’m listeninggg 🫶"

    lower = clean.lower()
    if any(word in lower for word in ("sad", "upset", "bad", "tired", "stuck")):
        return "aww, that sounds rough 😕 want to vent a little? i’m here"
    if any(word in lower for word in ("hi", "hello", "hey", "yo")):
        return "heyy 😄 what’s up, bestieee?"
    if any(word in lower for word in ("thanks", "thank you", "thx")):
        return "anytimeee 😌 always got you, cutie"
    if any(word in lower for word in ("love", "miss you", "miss u")):
        return "awh that’s actually so sweet 🫶 that made my day"
    if any(word in lower for word in ("joke", "funny")):
        return "ok ok 😄 why did the app go to therapy? too many issues lol"
    if any(word in lower for word in ("cute", "adorable", "sweet")):
        return "hehe you’re making me blush a little 🫶"
    if any(word in lower for word in ("angry", "mad", "annoyed", "frustrated")):
        return "awh nooo 😕 come here, let’s soften that mood a little"

    return f"gotchu — {clean[:120]} ✨"


async def get_openrouter_reply(messages: list[ChatMessage]) -> str:
    api_key = (settings.openrouter_api_key or "").strip()
    payload_messages = [{"role": "system", "content": FRIENDLY_PERSONA_PROMPT}]
    payload_messages.extend({"role": m.role, "content": m.content} for m in messages)

    if not api_key:
        return build_chat_reply(messages)

    body = {
        "model": settings.openrouter_model,
        "messages": payload_messages,
        "temperature": 0.7,
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
