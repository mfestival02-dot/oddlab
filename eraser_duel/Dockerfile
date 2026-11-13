# 지우개 따먹기 온라인 서버 (게임 화면과 WebSocket을 한 서버가 함께 내준다)
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node build.mjs
ENV PORT=8080 HOST=0.0.0.0
EXPOSE 8080
CMD ["node", "server/index.mjs"]
