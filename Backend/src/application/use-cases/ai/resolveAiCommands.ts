import { randomUUID } from 'crypto';
import { UmlModel } from '../../../domain/entities';
import { applyOperationToModel, UmlOperationInput } from '../uml/umlOperations';
import { AiCommand } from './aiCommand';

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

// Resultado de buscar un elemento por nombre: puede no existir, existir una
// sola vez (el caso normal), o existir mas de una vez. Antes, un nombre
// duplicado se resolvia en silencio a "el primero que aparece" -la IA podia
// terminar editando la clase equivocada sin ningun aviso-; ahora ese caso se
// distingue explicitamente para que el comando se omita con un motivo claro
// en vez de adivinar.
type Resolved = { id: string } | 'AMBIGUOUS' | 'NOT_FOUND';

function resolveClass(model: UmlModel, className: string): Resolved {
  const target = normalize(className);
  const matches = model.classes.filter((c) => normalize(c.name) === target);
  if (matches.length === 0) return 'NOT_FOUND';
  if (matches.length > 1) return 'AMBIGUOUS';
  return { id: matches[0].id };
}

function resolveAttribute(model: UmlModel, classId: string, attributeName: string): Resolved {
  const klass = model.classes.find((c) => c.id === classId);
  if (!klass) return 'NOT_FOUND';
  const target = normalize(attributeName);
  const matches = klass.attributes.filter((a) => normalize(a.name) === target);
  if (matches.length === 0) return 'NOT_FOUND';
  if (matches.length > 1) return 'AMBIGUOUS';
  return { id: matches[0].id };
}

// Busca la relacion entre dos clases (en cualquier direccion, seccion 22:
// la IA no siempre acierta el sentido origen/destino). Si hay mas de una
// relacion entre el mismo par -por ejemplo una 1:N y una N:M creadas por
// separado- no hay forma de saber cual quiso decir el comando (que solo
// trae los nombres de clase, no un id de relacion), asi que se marca
// ambigua en vez de tomar la primera.
function resolveRelationship(model: UmlModel, sourceClassName: string, targetClassName: string): Resolved {
  const source = resolveClass(model, sourceClassName);
  const target = resolveClass(model, targetClassName);
  if (source === 'NOT_FOUND' || target === 'NOT_FOUND') return 'NOT_FOUND';
  if (source === 'AMBIGUOUS' || target === 'AMBIGUOUS') return 'AMBIGUOUS';

  const matches = model.relationships.filter(
    (r) =>
      (r.sourceClassId === source.id && r.targetClassId === target.id) ||
      (r.sourceClassId === target.id && r.targetClassId === source.id),
  );
  if (matches.length === 0) return 'NOT_FOUND';
  if (matches.length > 1) return 'AMBIGUOUS';
  return { id: matches[0].id };
}

function ambiguousClassReason(className: string): string {
  return `Hay mas de una clase llamada "${className}": no se puede saber a cual te referis`;
}

function ambiguousRelationshipReason(sourceClassName: string, targetClassName: string): string {
  return `Hay mas de una relacion entre "${sourceClassName}" y "${targetClassName}": no se puede saber a cual te referis`;
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
// respuesta acaba de crear. Un comando que no puede resolverse -no existe o
// es ambiguo- se omite (no aborta el resto del lote) y se informa en
// `skipped`.
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
        const existing = resolveClass(simulated, cmd.className);
        if (existing !== 'NOT_FOUND') {
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
        const resolved = resolveClass(simulated, cmd.className);
        if (resolved === 'NOT_FOUND') reason = `Clase inexistente: ${cmd.className}`;
        else if (resolved === 'AMBIGUOUS') reason = ambiguousClassReason(cmd.className);
        else operation = { operation: 'RENAME_CLASS', classId: resolved.id, name: cmd.newName };
        break;
      }

      case 'DELETE_CLASS': {
        const resolved = resolveClass(simulated, cmd.className);
        if (resolved === 'NOT_FOUND') reason = `Clase inexistente: ${cmd.className}`;
        else if (resolved === 'AMBIGUOUS') reason = ambiguousClassReason(cmd.className);
        else operation = { operation: 'DELETE_CLASS', classId: resolved.id };
        break;
      }

      case 'ADD_ATTRIBUTE': {
        const resolved = resolveClass(simulated, cmd.className);
        if (resolved === 'NOT_FOUND') {
          reason = `Clase inexistente: ${cmd.className}`;
          break;
        }
        if (resolved === 'AMBIGUOUS') {
          reason = ambiguousClassReason(cmd.className);
          break;
        }
        operation = {
          operation: 'ADD_ATTRIBUTE',
          classId: resolved.id,
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
        const resolvedClass = resolveClass(simulated, cmd.className);
        if (resolvedClass === 'NOT_FOUND') {
          reason = `Clase inexistente: ${cmd.className}`;
          break;
        }
        if (resolvedClass === 'AMBIGUOUS') {
          reason = ambiguousClassReason(cmd.className);
          break;
        }
        const resolvedAttribute = resolveAttribute(simulated, resolvedClass.id, cmd.attributeName);
        if (resolvedAttribute === 'NOT_FOUND') {
          reason = `Atributo inexistente: ${cmd.className}.${cmd.attributeName}`;
          break;
        }
        if (resolvedAttribute === 'AMBIGUOUS') {
          reason = `Hay mas de un atributo "${cmd.attributeName}" en "${cmd.className}": no se puede saber a cual te referis`;
          break;
        }
        operation = {
          operation: 'UPDATE_ATTRIBUTE',
          classId: resolvedClass.id,
          attributeId: resolvedAttribute.id,
          name: cmd.newAttributeName,
          type: cmd.dataType,
          isPrimaryKey: cmd.isPrimaryKey,
          nullable: cmd.nullable,
        };
        break;
      }

      case 'REMOVE_ATTRIBUTE': {
        const resolvedClass = resolveClass(simulated, cmd.className);
        if (resolvedClass === 'NOT_FOUND') {
          reason = `Clase inexistente: ${cmd.className}`;
          break;
        }
        if (resolvedClass === 'AMBIGUOUS') {
          reason = ambiguousClassReason(cmd.className);
          break;
        }
        const resolvedAttribute = resolveAttribute(simulated, resolvedClass.id, cmd.attributeName);
        if (resolvedAttribute === 'NOT_FOUND') {
          reason = `Atributo inexistente: ${cmd.className}.${cmd.attributeName}`;
          break;
        }
        if (resolvedAttribute === 'AMBIGUOUS') {
          reason = `Hay mas de un atributo "${cmd.attributeName}" en "${cmd.className}": no se puede saber a cual te referis`;
          break;
        }
        operation = { operation: 'REMOVE_ATTRIBUTE', classId: resolvedClass.id, attributeId: resolvedAttribute.id };
        break;
      }

      case 'CREATE_RELATIONSHIP': {
        const resolvedSource = resolveClass(simulated, cmd.sourceClassName);
        const resolvedTarget = resolveClass(simulated, cmd.targetClassName);
        if (resolvedSource === 'NOT_FOUND' || resolvedTarget === 'NOT_FOUND') {
          reason = `Relacion con clase inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
          break;
        }
        if (resolvedSource === 'AMBIGUOUS' || resolvedTarget === 'AMBIGUOUS') {
          reason = ambiguousClassReason(resolvedSource === 'AMBIGUOUS' ? cmd.sourceClassName : cmd.targetClassName);
          break;
        }
        operation = {
          operation: 'CREATE_RELATIONSHIP',
          relationshipId: randomUUID(),
          sourceClassId: resolvedSource.id,
          targetClassId: resolvedTarget.id,
          type: cmd.relationshipType,
          sourceMultiplicity: cmd.sourceMultiplicity,
          targetMultiplicity: cmd.targetMultiplicity,
        };
        break;
      }

      case 'UPDATE_RELATIONSHIP': {
        const resolved = resolveRelationship(simulated, cmd.sourceClassName, cmd.targetClassName);
        if (resolved === 'NOT_FOUND') reason = `Relacion inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
        else if (resolved === 'AMBIGUOUS') reason = ambiguousRelationshipReason(cmd.sourceClassName, cmd.targetClassName);
        else operation = { operation: 'UPDATE_RELATIONSHIP', relationshipId: resolved.id, type: cmd.relationshipType };
        break;
      }

      case 'SET_MULTIPLICITY': {
        const resolved = resolveRelationship(simulated, cmd.sourceClassName, cmd.targetClassName);
        if (resolved === 'NOT_FOUND') reason = `Relacion inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
        else if (resolved === 'AMBIGUOUS') reason = ambiguousRelationshipReason(cmd.sourceClassName, cmd.targetClassName);
        else
          operation = {
            operation: 'SET_MULTIPLICITY',
            relationshipId: resolved.id,
            sourceMultiplicity: cmd.sourceMultiplicity,
            targetMultiplicity: cmd.targetMultiplicity,
          };
        break;
      }

      case 'DELETE_RELATIONSHIP': {
        const resolved = resolveRelationship(simulated, cmd.sourceClassName, cmd.targetClassName);
        if (resolved === 'NOT_FOUND') reason = `Relacion inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
        else if (resolved === 'AMBIGUOUS') reason = ambiguousRelationshipReason(cmd.sourceClassName, cmd.targetClassName);
        else operation = { operation: 'DELETE_RELATIONSHIP', relationshipId: resolved.id };
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
