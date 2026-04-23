from pydantic import BaseModel
import os


class Settings(BaseModel):
    app_name: str = "AI Backend"
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["*"]
    device: int = int(os.getenv("AI_BACKEND_DEVICE", "-1"))
    stt_model: str = os.getenv("AI_BACKEND_STT_MODEL", "openai/whisper-small")
    tts_model: str = os.getenv("AI_BACKEND_TTS_MODEL", "facebook/mms-tts-eng")
    tts_sample_rate: int = int(os.getenv("AI_BACKEND_TTS_SAMPLE_RATE", "16000"))
    hf_token: str = os.getenv("AI_BACKEND_HF_TOKEN", "")
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_model: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")


settings = Settings()
