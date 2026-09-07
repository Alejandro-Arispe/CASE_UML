# Backend (plataforma)

Node.js + TypeScript con arquitectura hexagonal (Ports & Adapters).

```
src/
├── domain/          Entidades y reglas de negocio puras (sin dependencias externas)
├── application/     Casos de uso, organizados por feature (auth, projects, uml, ai, history)
├── ports/           Interfaces que el dominio/aplicacion necesitan (repositorios, IA, etc.)
├── adapters/
│   ├── http/        Express: rutas y controllers
│   ├── persistence/ Repositorios Prisma (implementan ports/out) + PostgreSQL
│   ├── socket/      Socket.IO (colaboracion en tiempo real)
│   └── ai/          Cliente de Gemini
├── config/          Lectura de variables de entorno
└── server.ts        Composition root: arma app + socket server y arranca
```

Regla: `domain` y `application` no importan Express, Socket.IO, Prisma ni
Gemini directamente. Toda dependencia externa entra a traves de un puerto
implementado en `adapters`.

## Scripts

```bash
npm run dev              # servidor de desarrollo (ts-node-dev)
npm run build            # compila a dist/
npm start                # ejecuta el build compilado
npm run prisma:generate  # regenera el Prisma Client tras cambiar el schema
npm run prisma:migrate   # crea/aplica una migracion en desarrollo
```
