FROM oven/bun:1-slim

WORKDIR /app

COPY server.ts .

# Create mount point directories
RUN mkdir -p /portal /exchange

EXPOSE 8080

CMD ["bun", "run", "server.ts"]
