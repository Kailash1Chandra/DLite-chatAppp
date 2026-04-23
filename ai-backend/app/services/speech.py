from functools import lru_cache
from io import BytesIO
import wave

import numpy as np
from fastapi import HTTPException
from transformers import pipeline

from app.core.config import settings


@lru_cache(maxsize=1)
def get_stt_pipeline():
    token = (settings.hf_token or "").strip() or None
    return pipeline(
        task="automatic-speech-recognition",
        model=settings.stt_model,
        device=settings.device,
        token=token,
    )


@lru_cache(maxsize=1)
def get_tts_pipeline():
    token = (settings.hf_token or "").strip() or None
    return pipeline(
        task="text-to-speech",
        model=settings.tts_model,
        device=settings.device,
        token=token,
    )


def transcribe_audio_file(audio_path: str) -> dict:
    stt = get_stt_pipeline()
    try:
        result = stt(audio_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not transcribe audio: {exc}") from exc

    text = ""
    language = None
    if isinstance(result, dict):
      text = str(result.get("text", "")).strip()
      language = result.get("language") or result.get("lang")
    else:
      text = str(result or "").strip()

    return {"text": text, "language": language}


def synthesize_text_to_wav_bytes(text: str) -> tuple[bytes, int]:
    tts = get_tts_pipeline()
    try:
        result = tts(text)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not synthesize speech: {exc}") from exc

    audio = result.get("audio")
    sample_rate = int(result.get("sampling_rate") or settings.tts_sample_rate)
    if audio is None:
        raise HTTPException(status_code=500, detail="TTS model returned no audio")

    audio_np = np.asarray(audio)
    if audio_np.dtype.kind == "f":
        audio_np = np.clip(audio_np, -1.0, 1.0)
        audio_np = (audio_np * 32767).astype(np.int16)
    else:
        audio_np = audio_np.astype(np.int16)

    buffer = BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1 if audio_np.ndim == 1 else audio_np.shape[1])
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_np.tobytes())

    return buffer.getvalue(), sample_rate