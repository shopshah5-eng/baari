FROM node:22-alpine
RUN addgroup -S baari && adduser -S baari -G baari
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY supabase ./supabase
RUN mkdir -p data && chown -R baari:baari /app
USER baari
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/server.js"]
