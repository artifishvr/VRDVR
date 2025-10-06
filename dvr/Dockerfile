FROM oven/bun:1

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN bun install

CMD ["bun", "run", "src/index.ts"]

EXPOSE 3000