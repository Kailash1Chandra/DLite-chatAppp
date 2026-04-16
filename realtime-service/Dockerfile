FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app
COPY src /app/src

ENV PORT=4003
EXPOSE 4003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4003"]

