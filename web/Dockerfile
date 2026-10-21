# ---- Compilación de la web ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Caddy con la web incluida ----
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
