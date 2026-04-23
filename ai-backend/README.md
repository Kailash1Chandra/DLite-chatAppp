# AI Backend

Standalone backend service for AI-related experiments.

## Run locally

```bash
cd ai-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

Base prefix: `/api/v1`

- `GET /`
- `GET /api/v1/health`
- `GET /api/v1/ready`
- `POST /api/v1/generate`
- `POST /api/v1/chat`
- `GET /api/v1/models`
- `POST /api/v1/speech-to-text`
- `POST /api/v1/text-to-speech`

## Notes

This backend is fully isolated from the existing chat app backend.

Speech endpoints use Hugging Face models by default:

- STT: `openai/whisper-small`
- TTS: `facebook/mms-tts-eng`

## API keys and models

Set your keys in `.env`:

```bash
AI_BACKEND_HF_TOKEN=hf_xxx_your_token
OPENROUTER_API_KEY=sk-or-v1-xxx
```

Default models:

```bash
AI_BACKEND_STT_MODEL=openai/whisper-small
AI_BACKEND_TTS_MODEL=facebook/mms-tts-eng
OPENROUTER_MODEL=openai/gpt-4o-mini
```
