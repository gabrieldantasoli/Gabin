# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# instala só deps de runtime (mais leve)
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

# >>> ajuste para o seu entrypoint real <<<
CMD ["node", "dist/index.js"]

