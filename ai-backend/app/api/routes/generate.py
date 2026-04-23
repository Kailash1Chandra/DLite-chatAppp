from fastapi import APIRouter

from app.models.schemas import ChatRequest, ChatResponse, GenerateRequest, GenerateResponse
from app.services.generator import build_reply, get_openrouter_reply

router = APIRouter(tags=["generation"])


@router.post("/generate", response_model=GenerateResponse)
def generate(payload: GenerateRequest):
    reply = build_reply(payload.prompt, payload.style)
    return GenerateResponse(reply=reply, prompt=payload.prompt.strip(), style=payload.style)


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    reply = await get_openrouter_reply(payload.messages)
    return ChatResponse(reply=reply, messages_count=len(payload.messages))
