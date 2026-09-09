import fs from 'fs';
import { ZipArchive } from 'archiver';
import { NextFunction, Request, Response } from 'express';
import { GenerateBackend } from '../../../application/use-cases/generator/GenerateBackend';

// El backend generado nunca queda pisando la carpeta del proyecto (seccion
// 40 reinterpretada a pedido del usuario): se genera en una carpeta
// temporal del SO, se comprime en memoria/stream directo a la respuesta, y
// la carpeta temporal se borra apenas termina de enviarse el .zip.
export function createGeneratorController(deps: { generateBackend: GenerateBackend }) {
  return {
    async generate(req: Request, res: Response, next: NextFunction) {
      let outputDir: string | undefined;
      try {
        const result = await deps.generateBackend.execute({
          projectId: String(req.params.id),
          userId: req.userId!,
        });
        outputDir = result.outputDir;

        res.status(200);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${result.artifactId}.zip"`);
        res.setHeader('X-Generated-Package', result.packageName);
        res.setHeader('X-Generated-Database', result.databaseName);
        res.setHeader('X-Generated-Port', String(result.port));
        res.setHeader('X-Generated-Db-Host', result.dbHost);
        res.setHeader('X-Generated-Db-Port', String(result.dbPort));

        const archive = new ZipArchive({ zlib: { level: 9 } });
        const dirToClean = outputDir;

        archive.on('error', (err: Error) => next(err));
        res.on('close', () => {
          fs.rm(dirToClean, { recursive: true, force: true }, () => {});
        });

        archive.pipe(res);
        // El nombre de la carpeta raiz dentro del zip es el artifactId, no
        // el path temporal del servidor.
        archive.directory(outputDir, result.artifactId);
        await archive.finalize();
      } catch (err) {
        if (outputDir) {
          fs.rm(outputDir, { recursive: true, force: true }, () => {});
        }
        next(err);
      }
    },
  };
}
