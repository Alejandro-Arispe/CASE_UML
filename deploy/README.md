# Despliegue de CASE_UML en AWS

Guia para dejar la plataforma funcionando en una instancia EC2 con Docker.
Todo lo necesario esta en esta carpeta (`deploy/`) y en los `Dockerfile` de
`Backend/` y `Frontend/`.

## Arquitectura

```
Internet ──80/443──▶ web (Caddy)
                      ├── /            → SPA de React (archivos estaticos)
                      ├── /api/*       ─┐
                      └── /socket.io/* ─┴─▶ backend (Node, puerto 4000 interno)
                                              │
                                              ▼
                              db (PostgreSQL 16, en el mismo servidor)
                              o Amazon RDS (PostgreSQL gestionado)
```

- Un solo dominio/IP sirve frontend, API y WebSocket, asi que no hace falta
  CORS ni configurar URLs del backend en el frontend.
- Caddy saca y renueva solo el certificado HTTPS cuando se le da un dominio.
- Al arrancar, el backend aplica las migraciones de Prisma (`prisma migrate
  deploy`); la base se crea vacia y queda lista sin pasos manuales.
- Solo los puertos 80 y 443 quedan expuestos; PostgreSQL y el backend no se
  publican hacia afuera.

## 1. Crear la instancia EC2

En la consola de AWS → EC2 → *Launch instance*:

| Campo | Valor |
|---|---|
| AMI | Ubuntu Server 24.04 LTS |
| Tipo | `t3.small` (2 GB RAM). Con `t2.micro`/`t3.micro` de la capa gratuita tambien funciona, pero agregar swap (paso 2) |
| Almacenamiento | 20 GB gp3 |
| Key pair | Crear/usar una para entrar por SSH |
| Security group | Entrada: **22** (SSH, solo tu IP), **80** (HTTP, 0.0.0.0/0), **443** (HTTPS, 0.0.0.0/0) |

Despues: EC2 → *Elastic IPs* → *Allocate* → *Associate* a la instancia, para
que la IP publica no cambie al reiniciar.

## 2. Preparar el servidor

```bash
ssh -i mi-clave.pem ubuntu@IP_PUBLICA

# Docker + Docker Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # volver a entrar para que tome el grupo docker
```

Solo si la instancia tiene 1 GB de RAM (micro), agregar 2 GB de swap para que
la compilacion de las imagenes no se quede sin memoria:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Descargar el proyecto y configurar

```bash
git clone https://github.com/USUARIO/REPO.git case_uml
cd case_uml/deploy
cp .env.example .env
nano .env
```

Valores a completar en `.env`:

| Variable | Que poner |
|---|---|
| `POSTGRES_PASSWORD` | Una clave larga (solo letras y numeros) |
| `DATABASE_URL` | Reemplazar `cambiar_por_una_clave_larga` por la **misma** clave |
| `JWT_SECRET` | La salida de `openssl rand -hex 32` |
| `GEMINI_API_KEY` | La API key de Gemini (sin ella todo funciona excepto la IA) |
| `SITE_ADDRESS` | `:80` si se entra por IP, o el dominio (ver paso 5) |
| `PUBLIC_URL` | `http://IP_PUBLICA` o `https://midominio.com` |

`deploy/.env` esta en `.gitignore`: las claves nunca se suben al repositorio.

## 4. Levantar

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos (compila backend y frontend). Verificar:

```bash
docker compose ps                  # db, backend y web en "Up"
docker compose logs backend        # "All migrations have been successfully applied"
                                   # "CASE_UML backend escuchando en ..."
curl http://localhost/api/health   # {"status":"ok"}
```

Abrir `http://IP_PUBLICA` en el navegador, registrarse y crear un proyecto.

## 5. HTTPS con dominio (recomendado)

El dictado por voz del navegador (microfono) **solo funciona con HTTPS**. Para
activarlo hace falta un nombre de dominio apuntando a la Elastic IP:

- Dominio propio: crear un registro `A` → IP publica (Route 53 u otro proveedor).
- Gratis: [DuckDNS](https://www.duckdns.org) → crear `miproyecto.duckdns.org`
  con la IP publica.

Luego en `.env`:

```
SITE_ADDRESS=miproyecto.duckdns.org
PUBLIC_URL=https://miproyecto.duckdns.org
```

y aplicar con `docker compose up -d`. Caddy obtiene el certificado de
Let's Encrypt en unos segundos (los puertos 80 y 443 deben estar abiertos en
el security group).

## Opcion: base de datos en Amazon RDS

Por defecto PostgreSQL corre en el mismo servidor (volumen `db-data`). Para
usar una base gestionada con backups automaticos:

1. RDS → *Create database* → PostgreSQL 16, plantilla *Free tier*,
   `db.t3.micro`, nombre de base inicial `case_uml`, usuario y clave maestros.
2. *Connectivity*: misma VPC que la EC2, **sin** acceso publico. En el
   security group de RDS agregar una regla de entrada **5432** cuyo origen
   sea el **security group de la EC2**.
3. En `deploy/.env`:
   - borrar la linea `COMPOSE_PROFILES=local-db` (asi no se levanta el
     PostgreSQL local);
   - `DATABASE_URL=postgresql://USUARIO:CLAVE@ENDPOINT_RDS:5432/case_uml?schema=public&sslmode=require`
     (RDS exige SSL; `sslmode=require` es obligatorio).
4. `docker compose up -d --build`. Las tablas se crean solas al arrancar el
   backend.

## Alternativa: Microsoft Azure

La configuracion es la misma (solo Docker); cambia donde se crea el servidor.
Con *Azure for Students* se obtiene credito gratis sin tarjeta.

1. Portal de Azure → *Virtual machines* → *Create*:
   - Imagen: **Ubuntu Server 24.04 LTS**; tamaño **B2s** (4 GB). Con **B1s**
     (1 GB) funciona agregando swap (paso 2).
   - Autenticacion: clave SSH (descargar el `.pem`), usuario `azureuser`.
   - *Inbound ports*: SSH (22), HTTP (80), HTTPS (443).
2. Una vez creada: *Overview* → *DNS name* → *Configure* → poner una etiqueta
   (ej. `caseuml`). Queda un dominio gratis
   `caseuml.<region>.cloudapp.azure.com` que sirve para HTTPS, y en la misma
   pantalla poner la IP publica como **Static**.
3. Seguir los pasos 2, 3 y 4 de esta guia (cambiando `ubuntu` por
   `azureuser`), con:
   ```
   SITE_ADDRESS=caseuml.<region>.cloudapp.azure.com
   PUBLIC_URL=https://caseuml.<region>.cloudapp.azure.com
   ```

Base gestionada opcional (**Azure Database for PostgreSQL – Flexible
Server**, version 16): en *Networking* permitir el acceso desde la IP de la VM
(o misma VNet), crear la base `case_uml`, y en `.env` borrar
`COMPOSE_PROFILES=local-db` y usar
`DATABASE_URL=postgresql://USUARIO:CLAVE@SERVIDOR.postgres.database.azure.com:5432/case_uml?schema=public&sslmode=require`.

## Operacion

```bash
# Actualizar a la ultima version del repositorio
git pull && docker compose up -d --build

# Logs en vivo
docker compose logs -f backend

# Reiniciar / detener (los datos se conservan)
docker compose restart
docker compose down

# Respaldo de la base local
docker compose exec -T db pg_dump -U case_uml case_uml > respaldo_$(date +%F).sql

# Restaurar un respaldo en la base local
docker compose exec -T db psql -U case_uml case_uml < respaldo.sql
```

Los contenedores tienen `restart: unless-stopped`, asi que vuelven a levantar
solos si la instancia se reinicia.

> **Cuidado:** `docker compose down -v` borra los volumenes, es decir, **toda
> la base de datos local**. Usar solo `down` (sin `-v`).

## Notas

- **Backend generado:** en el servidor no se crean bases `gen_...` sobre la
  base de la plataforma (`GENERATOR_CREATE_DATABASES=false`). El zip que se
  descarga trae su propio `docker-compose.yml` con PostgreSQL y una coleccion
  de Postman: se ejecuta en la maquina de quien lo descarga con
  `docker compose up --build` y se prueba en `http://localhost:8081/api`.
- **Whisper local:** el dictado con Whisper local es una herramienta de
  desarrollo y no se despliega; en el servidor el boton aparece deshabilitado.
  El dictado del navegador (Chrome/Edge) sigue disponible con HTTPS.
- **Costos (aprox.):** una `t3.small` 24/7 ronda los USD 15/mes y toda IP
  publica IPv4 (incluida la Elastic IP) unos USD 3,6/mes. Revisar la capa
  gratuita vigente de la cuenta para EC2 y RDS. Detener la instancia cuando no
  se use reduce el costo; al terminar el proyecto, eliminar instancia,
  Elastic IP y RDS.
