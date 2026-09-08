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

Fase 6 completada: colaboracion en tiempo real con Socket.IO. El editor UML
(Fase 5) ahora sincroniza cada cambio como una operacion granular (seccion
22) sobre la room `project:{projectId}` (seccion 20), con el servidor como
autoridad de revision (seccion 23) y presencia de integrantes conectados
(seccion 25). El autoguardado por REST de la Fase 5 se mantiene disponible
(`PUT /api/projects/:id/uml-model`) para reemplazos de grafo completo (por
ejemplo, generacion desde IA en una fase futura), pero el editor interactivo
ya no lo usa como via principal.

Probado con dos clientes Socket.IO autenticados de forma independiente
(simulando dos usuarios reales): uno crea una clase y el otro la ve
aparecer sin recargar; el otro alterna un checkbox de un atributo y el
primero recibe el cambio de inmediato. La presencia (integrantes en linea)
tambien se actualizo correctamente al conectar/desconectar.

El estado del diagrama UML vive en un store propio (`Frontend/src/store/
umlStore.ts`), independiente de React Flow y de Socket.IO (seccion 6/45):
el canvas es una vista derivada de ese store, y toda la logica de red vive
aislada en `Frontend/src/features/uml-editor/collaboration.ts`.

Fase 7 completada: historial de edicion (seccion 27). Cada operacion
aceptada por `ApplyUmlOperation` genera una entrada de `EditHistory` con
una descripcion legible (ej. "Agrego telefono a Cliente", "Creo relacion
Cliente - Pedido"), difundida en vivo a todos los conectados via el evento
`history_entry`. El editor muestra el "Ultimo movimiento" en el header y un
boton "Ver historial de edicion" que lista el historial completo
(`GET /api/projects/:id/history`). Probado en navegador: crear clase,
renombrarla, agregar y renombrar un atributo, verificando tanto la
actualizacion en vivo como el listado completo.

Fase 8 completada: IA con Gemini (secciones 28-30). El flujo es
`IA -> comandos estructurados -> Action Engine -> UML interno -> Validacion
-> Persistencia -> Socket.IO`, tal como pide el documento: la IA nunca
escribe en la base ni decide como se persiste, solo produce una lista de
comandos (`{"action": "ADD_ATTRIBUTE", ...}`) que referencian clases y
atributos **por nombre** (no por UUID, para no depender de que el modelo
invente IDs). `resolveAiCommands` los traduce a operaciones reales
simulando el modelo paso a paso (asi un comando puede referirse a algo que
otro comando de la misma respuesta acaba de crear), y cada operacion
resuelta se aplica con el mismo `ApplyUmlOperation` de las fases 6/7: queda
persistida, versionada y en el historial exactamente igual que un cambio
manual, y se difunde en vivo a todos los conectados (incluido quien pidio
el cambio, ya que ahi nadie aplico nada de forma optimista).

El editor tiene un panel "Asistente IA" para escribir el pedido en lenguaje
natural. Probado en navegador con el escenario de la seccion 56: "Crea un
sistema basico de biblioteca con libros, autores, usuarios y prestamos"
genero las 4 clases con su PK y las relaciones esperadas (Autor-Libro,
Usuario-Prestamo, Prestamo-Libro); despues "Agrega correo a Usuario"
identifico la clase existente y le agrego el atributo, sin duplicarla.

> **Nota:** el modelo usado es `gemini-3.6-flash` (Google retiro
> `gemini-2.5-flash` para cuentas nuevas). Requiere `GEMINI_API_KEY` en
> `Backend/.env` (no se versiona).

Fase 9 completada: validador del modelo UML (seccion 17), corre antes del
generador. `Backend/src/domain/validation/validateUmlModel.ts` es una
funcion pura de dominio que revisa el grafo completo (algo que ninguna
entidad puede validar por si sola): clase sin nombre, clase duplicada,
atributo sin nombre/tipo, entidad sin clave primaria (seccion 16), relacion
hacia una clase inexistente, multiplicidad invalida e IDs duplicados.
Expuesto en `GET /api/projects/:id/validate` y en un boton "Validar modelo"
en el editor que lista los problemas encontrados (o confirma que el modelo
es valido). Probado con casos unitarios de la funcion pura (modelo invalido
con multiples problemas a la vez, y modelo valido) y en navegador: una
clase sin PK marca el modelo como invalido, y al agregarle una clave
primaria la validacion pasa a valida.

La siguiente fase (generador Spring Boot) se implementa de forma
incremental; el generador debera exigir un modelo valido antes de producir
el backend (seccion 17: "No generar silenciosamente un backend invalido").
