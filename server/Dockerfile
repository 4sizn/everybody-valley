# Build from repository root: docker build -f server/Dockerfile -t everybody-valley .
FROM node:24.20.0-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.25.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/install-hooks.mjs scripts/install-hooks.mjs
COPY apps/valley-map/package.json apps/valley-map/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/adapter-web/package.json packages/adapter-web/package.json
COPY packages/adapter-native/package.json packages/adapter-native/package.json
COPY packages/map-style/package.json packages/map-style/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile
COPY . .
ENV EXPO_NO_DOTENV=1
RUN pnpm build
RUN node -e "const fs=require('node:fs'); fs.writeFileSync('/runtime-package.json', JSON.stringify({private:true,type:'module',dependencies:Object.fromEntries(['better-sqlite3','sharp'].map(name=>[name,require(name+'/package.json').version]))}))"

FROM node:24.20.0-bookworm-slim
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0 DB_PATH=/data/valley.db UPLOADS_DIR=/data/uploads VALLEYS_DIR=/app/data/valleys MIGRATIONS_DIR=/app/migrations WEB_DIR=/app/web LOG_FORMAT=json TRUST_PROXY=false
WORKDIR /app
COPY --from=build /runtime-package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /repo/server/dist ./dist
COPY --from=build /repo/server/migrations ./migrations
COPY --from=build /repo/data/valleys ./data/valleys
COPY --from=build /repo/apps/valley-map/dist ./web
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.mjs"]
