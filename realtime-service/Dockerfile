FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY src ./src

RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 --ingroup app app
USER app

ENV PORT=4003
ENV UVICORN_WORKERS=1
ENV UVICORN_LOG_LEVEL=info
EXPOSE 10000

CMD ["sh", "-lc", "uvicorn app.main:asgi_app --host 0.0.0.0 --port ${PORT:-10000} --workers ${UVICORN_WORKERS} --proxy-headers --forwarded-allow-ips='*' --log-level ${UVICORN_LOG_LEVEL}"]
