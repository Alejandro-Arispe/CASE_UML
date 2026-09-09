# Generador Spring Boot

El codigo fuente del generador vive en [`Backend/src/generator/`](../Backend/src/generator)
en vez de en esta carpeta: se importa directamente desde los casos de uso del
backend de la plataforma (`GenerateBackend`), y mantenerlo dentro del mismo
proyecto Node/TypeScript evita un segundo paquete con su propio build solo
para unas pocas decenas de archivos (seccion 51 permite adaptar la
estructura mientras se mantengan las responsabilidades separadas, y aca se
mantienen: el generador no importa Express, Prisma ni Socket.IO, es
deterministico y no depende de la IA).

Esta carpeta (`generator/`, en la raiz del repo) queda como el destino de
los proyectos Spring Boot generados: `generated-backend/<projectId>/`
(gitignored). Cada proyecto generado usa su propia base de datos PostgreSQL
(`gen_<id>`) en el mismo servidor de la plataforma.

Ver la seccion "Fase 10" del [README principal](../README.md) para el
detalle de que genera y como se probo.
