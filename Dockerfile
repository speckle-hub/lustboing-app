FROM node:20-bookworm-slim

# Install Python, FFmpeg, wget, and pip (required for yt-dlp + impersonation)
RUN apt-get update && apt-get install -y \
    python3 \
    python-is-python3 \
    python3-pip \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install curl-cffi for yt-dlp browser impersonation (bypasses bot detection)
RUN pip3 install --break-system-packages curl-cffi --quiet 2>/dev/null || pip3 install curl-cffi --quiet

# Install yt-dlp globally
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set up working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY server.js .

# Expose port (Render sets PORT env variable)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
