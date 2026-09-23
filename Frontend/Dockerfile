# Frontend de la plataforma CASE_UML para produccion.
# Etapa 1: compila la SPA. Las URLs son relativas al mismo dominio: el
# proxy (Caddy) reenvia /api y /socket.io al backend, asi la misma imagen
# sirve para cualquier IP o dominio sin recompilar.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=/
ENV VITE_API_URL=$VITE_API_URL VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

# Etapa 2: Caddy sirve los archivos estaticos y hace de proxy/HTTPS. Su
# configuracion (Caddyfile) se monta desde la carpeta deploy/.
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
