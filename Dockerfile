FROM node:22-alpine

# Git and bash are used by Expo CLI and ngrok tunneling
RUN apk add --no-cache git bash

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm install

# Pre-install @expo/ngrok so --tunnel works without interactive prompts
RUN npm install -g @expo/ngrok

# Copy application source
COPY . .

# Metro bundler, Expo DevTools, and Web ports
EXPOSE 8081 19000 19001 19002

CMD ["npx", "expo", "start", "--clear"]
