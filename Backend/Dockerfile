# Backend de la plataforma CASE_UML para produccion.
# Etapa 1: instala dependencias, genera el cliente de Prisma para Linux y
# compila TypeScript a dist/.
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Etapa 2: imagen de ejecucion. Se copia node_modules completo porque el
# CLI de Prisma (devDependency) hace falta para aplicar las migraciones.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PRISMA_HIDE_UPDATE_MESSAGE=1
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
EXPOSE 4000

# Al arrancar aplica las migraciones pendientes (idempotente) y levanta el
# servidor. Si la base todavia no acepta conexiones (recien creada), reintenta.
CMD ["sh", "-c", "for i in $(seq 1 30); do npx prisma migrate deploy && exec node dist/server.js; echo 'Base de datos no disponible, reintentando en 3s...'; sleep 3; done; exit 1"]
