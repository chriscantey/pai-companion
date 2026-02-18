FROM oven/bun:1

WORKDIR /app

COPY package.json ./
RUN bun install

COPY server.ts ./

EXPOSE 8888

CMD ["bun", "run", "server.ts"]
