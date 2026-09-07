# CASE_UML

Plataforma web CASE/UML para modelado de datos mediante diagramas de clases y
generacion automatica de un backend Spring Boot + PostgreSQL a partir del
modelo UML.

Flujo central:

```
Usuario -> Proyecto -> Diagrama de clases UML -> Modelo UML interno
        -> Validacion -> Generador propio -> Backend Spring Boot -> PostgreSQL
```

El modelo UML interno es la fuente de verdad; el diagrama visual es una vista
de ese modelo.

## Estructura del proyecto

```
CASE_UML/
├── Frontend/          React + TypeScript + React Flow
├── Backend/           Node + TypeScript, arquitectura hexagonal (Ports & Adapters)
├── generator/         Generador propio de backend Spring Boot (Fase 10)
├── docs/              Documentacion tecnica del proyecto
└── docker-compose.yml PostgreSQL para desarrollo local
```

## Stack

- **Frontend**: React, TypeScript, React Flow, React Router, Zustand, Axios, Socket.IO client.
- **Backend (plataforma)**: Node.js, TypeScript, Express, Socket.IO, Prisma + PostgreSQL, JWT.
- **Backend generado**: Java, Spring Boot, Maven, Spring Data JPA, Springdoc OpenAPI.
- **IA**: Gemini (produce comandos estructurados, nunca escribe codigo directamente).

## Arquitectura

La plataforma Node.js sigue **arquitectura hexagonal (Ports & Adapters)**:
las reglas de negocio (`Backend/src/domain`, `Backend/src/application`) estan
desacopladas de Express, Socket.IO, Prisma/PostgreSQL y Gemini, que son
adaptadores (`Backend/src/adapters`) conectados mediante puertos
(`Backend/src/ports`).

El backend generado (Spring Boot) usa una arquitectura distinta y mas simple:
**Controller -> Service -> Repository -> Model**, con DTOs para entrada/salida.
Esta decision esta cerrada y no debe mezclarse con la arquitectura de la
plataforma.

## Requisitos para desarrollo

- Node.js 20+ y npm
- Docker (para levantar PostgreSQL localmente)
- Java 17+ y Maven (necesarios mas adelante para compilar/ejecutar el backend
  generado; no son necesarios para las fases iniciales de la plataforma)

## Cómo levantar el entorno

```bash
# 1. Base de datos
docker compose up -d

# 2. Backend
cd Backend
cp .env.example .env
npm install
npm run prisma:migrate   # aplica el schema a la base (primera vez / tras cambiarlo)
npm run dev               # http://localhost:4000

# 3. Frontend
cd Frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

> **Nota de entorno (Windows):** el contenedor de PostgreSQL publica el
> puerto **5433** en el host (no 5432), porque en algunas maquinas ya hay un
> PostgreSQL nativo escuchando en 5432 y ambos procesos pueden bindear el
> puerto sin error visible, causando fallos de autenticacion muy confusos al
> conectar por el puerto equivocado. `Backend/.env.example` ya apunta a
> `localhost:5433`. Si tu maquina no tiene ese conflicto, `docker-compose.yml`
> se puede volver a mapear a `5432:5432` sin problema.

## Estado actual

Fase 5 completada: autenticacion (JWT + bcrypt), proyectos (crear, listar,
invitacion por codigo, integrantes) y editor UML con React Flow (crear/
editar/borrar clases, atributos y relaciones, con autoguardado por REST).
Probado de punta a punta en navegador: login, creacion de proyecto, edicion
del diagrama y persistencia verificada tras recargar la pagina.

El estado del diagrama UML vive en un store propio (`Frontend/src/store/
umlStore.ts`), independiente de React Flow: el canvas es una vista derivada
de ese store, nunca la fuente de verdad (seccion 6).

Las siguientes fases (colaboracion en tiempo real con Socket.IO, historial,
IA, validador y generador Spring Boot) se implementan de forma incremental.
