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
npm run dev        # http://localhost:4000

# 3. Frontend
cd Frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

## Estado actual

Fase 1 completada: proyecto base de React, Node/TypeScript (arquitectura
hexagonal) y PostgreSQL (docker-compose) preparados y verificados
(compilacion, arranque de servidor, health check y routing del frontend).

Las siguientes fases (dominio, persistencia, autenticacion, editor UML,
colaboracion en tiempo real, historial, IA, validador y generador Spring
Boot) se implementan de forma incremental.
