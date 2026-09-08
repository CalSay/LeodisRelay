FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm ci && npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/apps/web
EXPOSE 4310
CMD ["npm", "start"]
