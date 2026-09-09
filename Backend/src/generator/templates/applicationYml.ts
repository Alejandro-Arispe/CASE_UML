import { GenerationModel } from '../GenerationModel';

// Configuracion de PostgreSQL (seccion 36): usa placeholders con valores
// por defecto de desarrollo local (${VAR:default}), no credenciales de
// produccion hardcodeadas. Hibernate administra el esquema en runtime
// (ddl-auto=update); schema.sql es solo de referencia (seccion 37).
export function renderApplicationYml(model: GenerationModel, port: number, dbPort: number): string {
  return `server:
  port: \${SERVER_PORT:${port}}

spring:
  application:
    name: ${model.packageName}
  datasource:
    url: jdbc:postgresql://\${DB_HOST:localhost}:\${DB_PORT:${dbPort}}/\${DB_NAME:${model.databaseName}}
    username: \${DB_USERNAME:case_uml}
    password: \${DB_PASSWORD:case_uml}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true

springdoc:
  swagger-ui:
    path: /swagger-ui.html
`;
}
