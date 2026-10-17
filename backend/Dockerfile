
FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg python3 curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Install PO-token provider
RUN git clone --depth 1 --branch 2.0.2 \
    https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
    /app/bgutil-ytdlp-pot-provider \
    && cd /app/bgutil-ytdlp-pot-provider/server \
    && npm ci \
    && npx tsc

# Install yt-dlp plugin
COPY yt_dlp_plugins/ /usr/local/bin/yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/

COPY server.js ./

ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV BGUTIL_SERVER_HOME=/app/bgutil-ytdlp-pot-provider/server

EXPOSE 5000

CMD ["npm", "start"]
