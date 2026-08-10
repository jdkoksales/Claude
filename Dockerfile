# Werkt op Fly.io, Render, Railway, een Raspberry Pi — overal waar Docker draait.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY scripts ./scripts

# De gegevens horen op een schijf die herstarts overleeft; koppel daar een
# volume aan (zie README). Zonder volume ben je bij elke herstart alles kwijt.
ENV DB_FILE=/data/samen.json
VOLUME /data

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/server.js"]
