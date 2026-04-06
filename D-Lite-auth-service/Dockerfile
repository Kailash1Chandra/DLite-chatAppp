# Auth Service Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Port configuration via environment variable
ENV PORT=3001
EXPOSE ${PORT}

CMD ["node", "src/server.js"]
