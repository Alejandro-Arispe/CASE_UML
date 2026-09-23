import { GenerationModel } from '../GenerationModel';

// Archivos para levantar el backend generado en cualquier maquina con solo
// Docker: la base PostgreSQL viaja dentro del docker-compose, asi el
// proyecto no depende de la base que la plataforma CASE crea en su propio
// Postgres (que no existe en la maquina de quien lo descarga).

export function renderDockerfile(options: { port: number }): string {
  return `# Compila con Maven dentro de Docker (no hace falta tener Java ni Maven
# instalados) y corre el .jar resultante sobre un JRE liviano.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE ${options.port}
ENTRYPOINT ["java", "-jar", "app.jar"]
`;
}

export function renderDockerignore(): string {
  return `target/
*.log
`;
}

// La base NO publica su puerto en la maquina: un PostgreSQL ya instalado
// (muy comun en 5432) haria fallar el "docker compose up". La API se
// conecta a la base por la red interna de Docker.
export function renderDockerCompose(model: GenerationModel, options: { port: number }): string {
  return `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${model.databaseName}
      POSTGRES_USER: case_uml
      POSTGRES_PASSWORD: case_uml
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U case_uml -d ${model.databaseName}"]
      interval: 3s
      timeout: 3s
      retries: 20

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: ${model.databaseName}
      DB_USERNAME: case_uml
      DB_PASSWORD: case_uml
      SERVER_PORT: ${options.port}
    ports:
      - "${options.port}:${options.port}"

volumes:
  db-data:
`;
}
