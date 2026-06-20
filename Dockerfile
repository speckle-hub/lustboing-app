FROM node:18-bullseye-slim

# Install Python, FFmpeg, and wget (required for yt-dlp)
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

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
