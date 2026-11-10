# The server over Streamable HTTP: http://<host>:3000/mcp, GET /health for probes.
#   docker build -t profile-mcp-server:local .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY data ./data
# numeric, so Kubernetes can check runAsNonRoot (this is the image's "node" user)
USER 1000
EXPOSE 3000
CMD ["node", "dist/index.js", "--http"]
