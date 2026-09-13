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

Fase 10 completada: generador Spring Boot (secciones 5, 15, 18, 31-42). Es
deterministico y no usa IA (seccion 47): `Backend/src/generator/` traduce
el UML validado (rechaza generar si `validateUmlModel` encuentra problemas,
devolviendo los mismos issues que "Validar modelo") a un "Generation Model"
con nombres normalizados a convenciones Java/PostgreSQL (seccion 18) y las
relaciones resueltas al lado que posee la FK (seccion 12: en 1:N el lado N
tiene `@ManyToOne`; en N:M, `@ManyToMany` unidireccional con `@JoinTable`).
Por cada clase genera `model/`, `repository/`, `service/`, `controller/` y
`dto/` (Request/Response, seccion 34), mas `Application.java`, `pom.xml`,
`application.yml` y `schema.sql` (seccion 37, solo de referencia: Hibernate
administra el esquema real con `ddl-auto=update`). Cada proyecto generado
usa su propia base de datos (`gen_<id>`, creada automaticamente en el mismo
Postgres de la plataforma) para no mezclar datos de negocio con los de
CASE_UML. Expuesto en `POST /api/projects/:id/generate-backend` y en el
boton "Generar backend" del editor (con confirmacion, seccion 40).

Se genero y **corrio de verdad** el ejemplo completo de la seccion 41
(Cliente 1--N Pedido): `mvn compile` compilo sin errores, `mvn spring-boot:run`
levanto la app, Hibernate creo las tablas con la FK correcta
(`pedido.cliente_id -> cliente.id`), Swagger expuso `/api/clientes` y
`/api/pedidos`, y se probo el CRUD completo por HTTP (crear, listar, obtener,
actualizar y borrar, incluida la validacion `@NotNull` rechazando un campo
requerido faltante) — el flujo de principio a fin de la seccion 54.

> **Nota de entorno:** para que Maven pudiera descargar dependencias hizo
> falta resolver un problema de certificados TLS causado por el escaneo
> SSL de Norton Antivirus (su certificado raiz no estaba en el truststore
> de Java). Se soluciono con una copia local de `cacerts` con ese
> certificado importado (`C:\Users\<usuario>\.m2-truststore\cacerts`), sin
> tocar el `cacerts` del JDK (que requeria permisos de administrador). Para
> compilar/ejecutar un backend generado hay que exportar:
> `MAVEN_OPTS="-Djavax.net.ssl.trustStore=<esa-ruta> -Djavax.net.ssl.trustStorePassword=changeit"`

## Fase 12: integracion final

Prueba de punta a punta combinando todas las fases en una sola corrida
(seccion 52, Fase 12), no cada pieza por separado sino todo el sistema
funcionando junto:

1. Dos usuarios (Angel, Maria) se registran; Angel crea un proyecto y Maria
   se une por codigo de invitacion.
2. Ambos conectados por Socket.IO al mismo proyecto (presencia confirmada).
3. Angel le pide a la IA: *"Crea un sistema de tienda con Producto (nombre,
   precio) y Categoria (nombre), donde una Categoria tiene muchos
   Productos"* → la IA genera las 2 clases, sus atributos y la relacion
   (8 operaciones) en un solo pedido.
4. Angel pide *"Agrega stock a Producto"* → Maria, conectada de forma
   independiente, recibe `attribute_created` e `history_entry` **en vivo**,
   confirmando que colaboracion + IA + historial funcionan juntos, no solo
   por separado.
5. "Validar modelo" confirma que el modelo generado por la IA es valido
   (la IA agrega PK por defecto, seccion 30).
6. "Generar backend" produce el proyecto Spring Boot.
7. `mvn compile` sin errores, `mvn spring-boot:run` levanta la app: Hibernate
   crea `categoria`/`producto` con la FK y el `NOT NULL` en `stock`
   correctos.
8. CRUD real por HTTP: crear Categoria, crear Producto referenciandola,
   listar — swagger expone `/api/categorias` y `/api/productos`.
9. "Ver historial" en el editor lista las 9 operaciones en orden correcto,
   todas atribuidas a Angel (quien escribio los pedidos a la IA).

Con esto las 12 fases del documento estan implementadas y verificadas
funcionando en conjunto, no solo de forma aislada.

## Diagrama de clases completo y compatibilidad con Enterprise Architect

> Requiere aplicar la migracion `20260912120000_relationship_kinds`
> (`npm run prisma:migrate` en `Backend/`).

- **Relaciones**: asociacion, agregacion, composicion y herencia, con
  multiplicidades `1`, `0..1`, `0..*`, `1..*`, nombre/rol y **clase
  asociacion**. Convencion: en agregacion/composicion `target` es el TODO y
  `source` la PARTE; en herencia `source` es la subclase y `target` el padre.
- **Editor**: notacion de EA (rombos, triangulo, linea punteada de clase
  asociacion, lazo en autorrelaciones), conexion al borde mas cercano, barra
  "Conectar como" para elegir el tipo al arrastrar, panel de relacion que
  explica que se generara en la base, invertir direccion, edicion de nombres
  que confirma al salir del campo (no en cada tecla).
- **XMI**: importa XMI 2.1 exportado por Enterprise Architect (ids `EAID_`,
  tipos `EAJava_*`, codificacion windows-1252, conectores, ProxyConnector de
  clases asociacion y posiciones del diagrama) o XMI UML estandar; exporta
  con la misma estructura de EA, incluido el diagrama. Probado con ida y
  vuelta sin perdidas sobre un modelo real de EA (herencia, composicion,
  agregacion, clase asociacion y autorrelacion N:M).
- **Generador**: herencia JOINED, FK segun multiplicidades, 1:1 con UNIQUE,
  N:M con tabla intermedia (tambien reflexiva), composicion con cascade,
  clase asociacion como entidad con dos FK, CORS, manejo global de errores
  (400/404/409), inyeccion por constructor y README en el zip. El validador
  detecta antes de generar choques de columnas (ej. un atributo `clienteId`
  que duplica la FK), dos relaciones sin rol entre las mismas clases,
  palabras reservadas y PK faltantes o compuestas.
- **IA**: prompt orientado a diseno de base de datos, pedido por **voz**
  (Web Speech API, Chrome/Edge), archivos de imagen (incluido HEIC) o PDF, y
  aplicacion de todos los cambios en una sola transaccion.
- **Rendimiento**: el guardado escribe solo las diferencias (mover una clase
  es un UPDATE, no reescribir el diagrama); organizar, alinear y duplicar
  viajan como un lote.
