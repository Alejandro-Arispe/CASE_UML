import { randomUUID } from 'crypto';
import { UmlModel } from '../../../domain/entities';
import { applyOperationToModel, UmlOperationInput } from '../uml/umlOperations';
import { AiCommand } from './aiCommand';

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function findClassId(model: UmlModel, className: string): string | null {
  return model.classes.find((c) => normalize(c.name) === normalize(className))?.id ?? null;
}

function findAttributeId(model: UmlModel, classId: string, attributeName: string): string | null {
  const klass = model.classes.find((c) => c.id === classId);
  return klass?.attributes.find((a) => normalize(a.name) === normalize(attributeName))?.id ?? null;
}

function findRelationshipId(model: UmlModel, sourceClassName: string, targetClassName: string): string | null {
  const sourceId = findClassId(model, sourceClassName);
  const targetId = findClassId(model, targetClassName);
  if (!sourceId || !targetId) return null;
  const rel = model.relationships.find(
    (r) =>
      (r.sourceClassId === sourceId && r.targetClassId === targetId) ||
      (r.sourceClassId === targetId && r.targetClassId === sourceId),
  );
  return rel?.id ?? null;
}

function nextPosition(index: number): { x: number; y: number } {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 80 + col * 220, y: 80 + row * 180 };
}

export interface ResolvedAiCommands {
  operations: UmlOperationInput[];
  skipped: { command: AiCommand; reason: string }[];
}

// Traduce comandos de IA (basados en nombres) a operaciones reales (basadas
// en UUID) simulando cada paso sobre una copia del modelo con la misma
// funcion pura del motor de edicion (seccion 22), para que un comando pueda
// referirse a una clase/atributo que un comando anterior de la MISMA
// respuesta acaba de crear. Un comando que no puede resolverse se omite
// (no aborta el resto del lote) y se informa en `skipped`.
export function resolveAiCommands(commands: AiCommand[], initialModel: UmlModel): ResolvedAiCommands {
  let simulated = initialModel;
  const operations: UmlOperationInput[] = [];
  const skipped: { command: AiCommand; reason: string }[] = [];
  let createdClasses = 0;

  for (const cmd of commands) {
    let operation: UmlOperationInput | null = null;
    let reason: string | null = null;

    switch (cmd.action) {
      case 'CREATE_CLASS': {
        if (findClassId(simulated, cmd.className)) {
          reason = `La clase "${cmd.className}" ya existe`;
          break;
        }
        operation = {
          operation: 'CREATE_CLASS',
          classId: randomUUID(),
          name: cmd.className,
          position: nextPosition(createdClasses++),
        };
        break;
      }

      case 'RENAME_CLASS': {
        const classId = findClassId(simulated, cmd.className);
        if (!classId) reason = `Clase inexistente: ${cmd.className}`;
        else operation = { operation: 'RENAME_CLASS', classId, name: cmd.newName };
        break;
      }

      case 'DELETE_CLASS': {
        const classId = findClassId(simulated, cmd.className);
        if (!classId) reason = `Clase inexistente: ${cmd.className}`;
        else operation = { operation: 'DELETE_CLASS', classId };
        break;
      }

      case 'ADD_ATTRIBUTE': {
        const classId = findClassId(simulated, cmd.className);
        if (!classId) {
          reason = `Clase inexistente: ${cmd.className}`;
          break;
        }
        operation = {
          operation: 'ADD_ATTRIBUTE',
          classId,
          attributeId: randomUUID(),
          name: cmd.attributeName,
          type: cmd.dataType,
          isPrimaryKey: cmd.isPrimaryKey,
          nullable: cmd.nullable,
          defaultValue: cmd.defaultValue,
        };
        break;
      }

      case 'UPDATE_ATTRIBUTE': {
        const classId = findClassId(simulated, cmd.className);
        const attributeId = classId ? findAttributeId(simulated, classId, cmd.attributeName) : null;
        if (!classId || !attributeId) {
          reason = `Atributo inexistente: ${cmd.className}.${cmd.attributeName}`;
          break;
        }
        operation = {
          operation: 'UPDATE_ATTRIBUTE',
          classId,
          attributeId,
          name: cmd.newAttributeName,
          type: cmd.dataType,
          isPrimaryKey: cmd.isPrimaryKey,
          nullable: cmd.nullable,
        };
        break;
      }

      case 'REMOVE_ATTRIBUTE': {
        const classId = findClassId(simulated, cmd.className);
        const attributeId = classId ? findAttributeId(simulated, classId, cmd.attributeName) : null;
        if (!classId || !attributeId) {
          reason = `Atributo inexistente: ${cmd.className}.${cmd.attributeName}`;
          break;
        }
        operation = { operation: 'REMOVE_ATTRIBUTE', classId, attributeId };
        break;
      }

      case 'CREATE_RELATIONSHIP': {
        const sourceClassId = findClassId(simulated, cmd.sourceClassName);
        const targetClassId = findClassId(simulated, cmd.targetClassName);
        if (!sourceClassId || !targetClassId) {
          reason = `Relacion con clase inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
          break;
        }
        operation = {
          operation: 'CREATE_RELATIONSHIP',
          relationshipId: randomUUID(),
          sourceClassId,
          targetClassId,
          type: cmd.relationshipType,
          sourceMultiplicity: cmd.sourceMultiplicity,
          targetMultiplicity: cmd.targetMultiplicity,
        };
        break;
      }

      case 'UPDATE_RELATIONSHIP': {
        const relationshipId = findRelationshipId(simulated, cmd.sourceClassName, cmd.targetClassName);
        if (!relationshipId) reason = `Relacion inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
        else operation = { operation: 'UPDATE_RELATIONSHIP', relationshipId, type: cmd.relationshipType };
        break;
      }

      case 'SET_MULTIPLICITY': {
        const relationshipId = findRelationshipId(simulated, cmd.sourceClassName, cmd.targetClassName);
        if (!relationshipId) reason = `Relacion inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
        else
          operation = {
            operation: 'SET_MULTIPLICITY',
            relationshipId,
            sourceMultiplicity: cmd.sourceMultiplicity,
            targetMultiplicity: cmd.targetMultiplicity,
          };
        break;
      }

      case 'DELETE_RELATIONSHIP': {
        const relationshipId = findRelationshipId(simulated, cmd.sourceClassName, cmd.targetClassName);
        if (!relationshipId) reason = `Relacion inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
        else operation = { operation: 'DELETE_RELATIONSHIP', relationshipId };
        break;
      }
    }

    if (operation) {
      operations.push(operation);
      simulated = applyOperationToModel(simulated, operation);
    } else {
      skipped.push({ command: cmd, reason: reason ?? 'Comando invalido' });
    }
  }

  return { operations, skipped };
}
