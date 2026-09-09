import fs from 'fs';
import os from 'os';
import path from 'path';
import { GenerationModel } from './GenerationModel';
import { renderApplicationClass } from './templates/application';
import { renderApplicationYml } from './templates/applicationYml';
import { renderRequestDto, renderResponseDto } from './templates/dto';
import { renderEntity } from './templates/entity';
import { renderController } from './templates/controller';
import { renderPom } from './templates/pom';
import { renderRepository } from './templates/repository';
import { renderSchemaSql } from './templates/schemaSql';
import { renderService } from './templates/service';

export interface WriteGeneratedProjectResult {
  outputDir: string;
  artifactId: string;
  packageName: string;
  databaseName: string;
  port: number;
  files: string[];
}

// El backend generado ya no se deja pisando la carpeta del proyecto: se
// escribe en una carpeta temporal del sistema operativo, se comprime y se
// entrega como descarga (ver generator.controller.ts); la carpeta temporal
// se borra apenas se termina de enviar el .zip. Cada generacion usa un
// nombre unico (timestamp) para poder convivir con generaciones anteriores
// que todavia no terminaron de limpiarse.
function outputDirFor(projectId: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `case-uml-gen-${projectId}-`));
}

function writeFile(baseDir: string, relativePath: string, content: string, files: string[]) {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  files.push(relativePath);
}

export function writeGeneratedProject(
  model: GenerationModel,
  projectId: string,
  options: { artifactId: string; port: number; dbPort: number },
): WriteGeneratedProjectResult {
  const outputDir = outputDirFor(projectId);
  const files: string[] = [];
  const javaBase = path.join('src', 'main', 'java', ...model.packageName.split('.'));

  for (const klass of model.classes) {
    writeFile(outputDir, path.join(javaBase, 'model', `${klass.className}.java`), renderEntity(model, klass), files);
    writeFile(
      outputDir,
      path.join(javaBase, 'repository', `${klass.className}Repository.java`),
      renderRepository(model, klass),
      files,
    );
    writeFile(
      outputDir,
      path.join(javaBase, 'service', `${klass.className}Service.java`),
      renderService(model, klass),
      files,
    );
    writeFile(
      outputDir,
      path.join(javaBase, 'controller', `${klass.className}Controller.java`),
      renderController(model, klass),
      files,
    );
    writeFile(
      outputDir,
      path.join(javaBase, 'dto', `${klass.className}RequestDTO.java`),
      renderRequestDto(model, klass),
      files,
    );
    writeFile(
      outputDir,
      path.join(javaBase, 'dto', `${klass.className}ResponseDTO.java`),
      renderResponseDto(model, klass),
      files,
    );
  }

  writeFile(outputDir, path.join(javaBase, 'Application.java'), renderApplicationClass(model), files);
  writeFile(outputDir, 'pom.xml', renderPom(options.artifactId), files);
  writeFile(
    outputDir,
    path.join('src', 'main', 'resources', 'application.yml'),
    renderApplicationYml(model, options.port, options.dbPort),
    files,
  );
  writeFile(outputDir, 'schema.sql', renderSchemaSql(model), files);

  return {
    outputDir,
    artifactId: options.artifactId,
    packageName: model.packageName,
    databaseName: model.databaseName,
    port: options.port,
    files,
  };
}
