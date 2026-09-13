import { randomUUID } from 'crypto';
import { Multiplicity, UmlModel, UmlRelationship } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { applyOperationToModel, UmlOperationInput } from '../uml/umlOperations';
import { AiCommand } from './aiCommand';

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

// Resultado de buscar un elemento por nombre: puede no existir, existir una
// sola vez (el caso normal), o existir mas de una vez. Un nombre duplicado
// no se resuelve "al primero que aparece" (la IA podria editar la clase
// equivocada): el comando se omite con un motivo claro.
type Resolved<T = { id: string }> = T | 'AMBIGUOUS' | 'NOT_FOUND';

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

// Busca la relacion entre dos clases en cualquier direccion (la IA no
// siempre acierta el sentido origen/destino). Si hay varias entre el mismo
// par, el nombre (rol) desambigua; si aun asi hay mas de una, es ambigua.
// `reversed` indica que la relacion guardada tiene source/target al reves
// de como los nombro el comando.
function resolveRelationship(
  model: UmlModel,
  sourceClassName: string,
  targetClassName: string,
  relationshipName?: string,
): Resolved<{ id: string; reversed: boolean }> {
  const source = resolveClass(model, sourceClassName);
  const target = resolveClass(model, targetClassName);
  if (source === 'NOT_FOUND' || target === 'NOT_FOUND') return 'NOT_FOUND';
  if (source === 'AMBIGUOUS' || target === 'AMBIGUOUS') return 'AMBIGUOUS';

  let matches: UmlRelationship[] = model.relationships.filter(
    (r) =>
      (r.sourceClassId === source.id && r.targetClassId === target.id) ||
      (r.sourceClassId === target.id && r.targetClassId === source.id),
  );
  if (relationshipName && matches.length > 1) {
    matches = matches.filter((r) => normalize(r.name ?? '') === normalize(relationshipName));
  }
  if (matches.length === 0) return 'NOT_FOUND';
  if (matches.length > 1) return 'AMBIGUOUS';
  const reversed = source.id !== target.id && matches[0].sourceClassId === target.id;
  return { id: matches[0].id, reversed };
}

function ambiguousClassReason(className: string): string {
  return `Hay mas de una clase llamada "${className}": no se puede saber a cual te referis`;
}

function ambiguousRelationshipReason(sourceClassName: string, targetClassName: string): string {
  return `Hay mas de una relacion entre "${sourceClassName}" y "${targetClassName}": indica su nombre (rol)`;
}

export interface ResolvedAiCommands {
  operations: UmlOperationInput[];
  skipped: { command: AiCommand; reason: string }[];
}

// Traduce comandos de IA (basados en nombres) a operaciones reales (basadas
// en UUID) simulando cada paso sobre una copia del modelo con la misma
// funcion pura del motor de edicion (seccion 22), para que un comando pueda
// referirse a una clase/atributo que un comando anterior de la MISMA
// respuesta acaba de crear. Un comando que no puede resolverse -no existe,
// es ambiguo o el motor lo rechaza- se omite (no aborta el resto del lote) y
// se informa en `skipped`.
export function resolveAiCommands(commands: AiCommand[], initialModel: UmlModel): ResolvedAiCommands {
  let simulated = initialModel;
  const operations: UmlOperationInput[] = [];
  const skipped: { command: AiCommand; reason: string }[] = [];

  // Las clases nuevas sin posicion sugerida se acomodan en grilla debajo de
  // lo que ya existe, para no taparlo.
  const existingBottom = initialModel.classes.length
    ? Math.max(...initialModel.classes.map((c) => c.position.y)) + 320
    : 80;
  let gridIndex = 0;
  const nextGridPosition = () => {
    const index = gridIndex++;
    return { x: 80 + (index % 4) * 280, y: existingBottom + Math.floor(index / 4) * 260 };
  };
  const offsetY = initialModel.classes.length ? existingBottom : 40;

  const resolveClassOrReason = (className: string): { id: string } | string => {
    const resolved = resolveClass(simulated, className);
    if (resolved === 'NOT_FOUND') return `Clase inexistente: ${className}`;
    if (resolved === 'AMBIGUOUS') return ambiguousClassReason(className);
    return resolved;
  };

  const resolveRelationshipOrReason = (
    cmd: { sourceClassName: string; targetClassName: string; relationshipName?: string },
  ): { id: string; reversed: boolean } | string => {
    const resolved = resolveRelationship(simulated, cmd.sourceClassName, cmd.targetClassName, cmd.relationshipName);
    if (resolved === 'NOT_FOUND') return `Relacion inexistente: ${cmd.sourceClassName} - ${cmd.targetClassName}`;
    if (resolved === 'AMBIGUOUS') return ambiguousRelationshipReason(cmd.sourceClassName, cmd.targetClassName);
    return resolved;
  };

  const orient = (
    reversed: boolean,
    sourceMultiplicity?: Multiplicity,
    targetMultiplicity?: Multiplicity,
  ): { sourceMultiplicity?: Multiplicity; targetMultiplicity?: Multiplicity } =>
    reversed
      ? { sourceMultiplicity: targetMultiplicity, targetMultiplicity: sourceMultiplicity }
      : { sourceMultiplicity, targetMultiplicity };

  for (const cmd of commands) {
    let operation: UmlOperationInput | null = null;
    let reason: string | null = null;

    switch (cmd.action) {
      case 'CREATE_CLASS': {
        if (resolveClass(simulated, cmd.className) !== 'NOT_FOUND') {
          reason = `La clase "${cmd.className}" ya existe`;
          break;
        }
        const position =
          cmd.x !== undefined && cmd.y !== undefined
            ? { x: Math.round(40 + cmd.x * 1.8), y: Math.round(offsetY + cmd.y * 1.4) }
            : nextGridPosition();
        operation = { operation: 'CREATE_CLASS', classId: randomUUID(), name: cmd.className, position };
        break;
      }

      case 'RENAME_CLASS': {
        const klass = resolveClassOrReason(cmd.className);
        if (typeof klass === 'string') reason = klass;
        else operation = { operation: 'RENAME_CLASS', classId: klass.id, name: cmd.newName };
        break;
      }

      case 'DELETE_CLASS': {
        const klass = resolveClassOrReason(cmd.className);
        if (typeof klass === 'string') reason = klass;
        else operation = { operation: 'DELETE_CLASS', classId: klass.id };
        break;
      }

      case 'ADD_ATTRIBUTE': {
        const klass = resolveClassOrReason(cmd.className);
        if (typeof klass === 'string') {
          reason = klass;
          break;
        }
        if (resolveAttribute(simulated, klass.id, cmd.attributeName) !== 'NOT_FOUND') {
          reason = `El atributo "${cmd.className}.${cmd.attributeName}" ya existe`;
          break;
        }
        operation = {
          operation: 'ADD_ATTRIBUTE',
          classId: klass.id,
          attributeId: randomUUID(),
          name: cmd.attributeName,
          type: cmd.dataType,
          isPrimaryKey: cmd.isPrimaryKey,
          nullable: cmd.isPrimaryKey ? false : cmd.nullable,
          defaultValue: cmd.defaultValue,
        };
        break;
      }

      case 'UPDATE_ATTRIBUTE':
      case 'REMOVE_ATTRIBUTE': {
        const klass = resolveClassOrReason(cmd.className);
        if (typeof klass === 'string') {
          reason = klass;
          break;
        }
        const attribute = resolveAttribute(simulated, klass.id, cmd.attributeName);
        if (attribute === 'NOT_FOUND') {
          reason = `Atributo inexistente: ${cmd.className}.${cmd.attributeName}`;
          break;
        }
        if (attribute === 'AMBIGUOUS') {
          reason = `Hay mas de un atributo "${cmd.attributeName}" en "${cmd.className}"`;
          break;
        }
        operation =
          cmd.action === 'REMOVE_ATTRIBUTE'
            ? { operation: 'REMOVE_ATTRIBUTE', classId: klass.id, attributeId: attribute.id }
            : {
                operation: 'UPDATE_ATTRIBUTE',
                classId: klass.id,
                attributeId: attribute.id,
                name: cmd.newAttributeName,
                type: cmd.dataType,
                isPrimaryKey: cmd.isPrimaryKey,
                nullable: cmd.nullable,
              };
        break;
      }

      case 'CREATE_RELATIONSHIP': {
        const source = resolveClassOrReason(cmd.sourceClassName);
        const target = resolveClassOrReason(cmd.targetClassName);
        if (typeof source === 'string' || typeof target === 'string') {
          reason = typeof source === 'string' ? source : (target as string);
          break;
        }
        let associationClassId: string | undefined;
        if (cmd.associationClassName) {
          const associationClass = resolveClassOrReason(cmd.associationClassName);
          if (typeof associationClass === 'string') {
            reason = associationClass;
            break;
          }
          associationClassId = associationClass.id;
        }
        const isGeneralization = cmd.relationshipKind === 'GENERALIZATION';
        operation = {
          operation: 'CREATE_RELATIONSHIP',
          relationshipId: randomUUID(),
          sourceClassId: source.id,
          targetClassId: target.id,
          kind: cmd.relationshipKind,
          sourceMultiplicity: isGeneralization ? '1' : cmd.sourceMultiplicity,
          targetMultiplicity: isGeneralization ? '1' : cmd.targetMultiplicity,
          name: cmd.relationshipName,
          associationClassId,
        };
        break;
      }

      case 'UPDATE_RELATIONSHIP':
      case 'SET_MULTIPLICITY': {
        const relationship = resolveRelationshipOrReason(cmd);
        if (typeof relationship === 'string') {
          reason = relationship;
          break;
        }
        let associationClassId: string | undefined;
        if (cmd.action === 'UPDATE_RELATIONSHIP' && cmd.associationClassName) {
          const associationClass = resolveClassOrReason(cmd.associationClassName);
          if (typeof associationClass === 'string') {
            reason = associationClass;
            break;
          }
          associationClassId = associationClass.id;
        }
        operation = {
          operation: 'UPDATE_RELATIONSHIP',
          relationshipId: relationship.id,
          ...(cmd.action === 'UPDATE_RELATIONSHIP' && cmd.relationshipKind ? { kind: cmd.relationshipKind } : {}),
          ...(associationClassId ? { associationClassId } : {}),
          ...orient(relationship.reversed, cmd.sourceMultiplicity, cmd.targetMultiplicity),
        };
        break;
      }

      case 'DELETE_RELATIONSHIP': {
        const relationship = resolveRelationshipOrReason(cmd);
        if (typeof relationship === 'string') reason = relationship;
        else operation = { operation: 'DELETE_RELATIONSHIP', relationshipId: relationship.id };
        break;
      }
    }

    if (operation) {
      // El motor de edicion puede rechazarla (ej. herencia circular): se
      // omite con su motivo en vez de abortar todo el pedido.
      try {
        simulated = applyOperationToModel(simulated, operation);
        operations.push(operation);
      } catch (err) {
        skipped.push({ command: cmd, reason: err instanceof DomainError ? err.message : 'Comando invalido' });
      }
    } else {
      skipped.push({ command: cmd, reason: reason ?? 'Comando invalido' });
    }
  }

  return { operations: withPrimaryKeys(operations, simulated), skipped };
}

// Red de seguridad: toda clase raiz que la IA creo en este pedido y quedo sin
// clave primaria recibe "id" Long PK (el prompt lo exige, pero si el modelo
// omite o malforma ese comando, el diagrama no se podria generar). Se inserta
// justo despues de crear la clase para que quede como primer atributo.
function withPrimaryKeys(operations: UmlOperationInput[], finalModel: UmlModel): UmlOperationInput[] {
  const result = [...operations];
  for (let index = result.length - 1; index >= 0; index--) {
    const op = result[index];
    if (op.operation !== 'CREATE_CLASS') continue;
    const klass = finalModel.classes.find((c) => c.id === op.classId);
    if (!klass || klass.attributes.some((a) => a.isPrimaryKey)) continue;
    const isSubclass = finalModel.relationships.some((r) => r.kind === 'GENERALIZATION' && r.sourceClassId === klass.id);
    if (isSubclass) continue;

    const existingId = klass.attributes.find((a) => normalize(a.name) === 'id');
    if (existingId) {
      result.push({ operation: 'UPDATE_ATTRIBUTE', classId: klass.id, attributeId: existingId.id, isPrimaryKey: true, nullable: false });
    } else {
      result.splice(index + 1, 0, {
        operation: 'ADD_ATTRIBUTE',
        classId: klass.id,
        attributeId: randomUUID(),
        name: 'id',
        type: 'Long',
        isPrimaryKey: true,
        nullable: false,
      });
    }
  }
  return result;
}
