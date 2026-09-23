import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { env } from '../../config/env';
import { MULTIPLICITIES, RELATIONSHIP_KINDS, UML_DATA_TYPES } from '../../domain/entities';
import { DomainError } from '../../domain/errors/DomainError';
import { AiCommand, aiCommandSchema } from '../../application/use-cases/ai/aiCommand';
import { AiModelClient } from '../../ports/out/AiModelClient';

const MODEL = 'gemini-3.6-flash';

// Errores transitorios de Gemini (saturacion 503, limite 429, fallas 5xx o
// de red): se reintenta con espera creciente. Solo se reintenta mientras
// quede margen, porque el frontend da el pedido por perdido a los 180s y un
// intento fallido puede tardar mas de un minuto en volver.
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [3_000, 6_000];
const RETRY_TIME_BUDGET_MS = 100_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function errorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}

function isRetryable(err: unknown): boolean {
  const status = errorStatus(err);
  if (status !== undefined) return RETRYABLE_STATUS.has(status);
  // Sin status HTTP: corte de red / timeout del fetch.
  return err instanceof TypeError || /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(String(err));
}

function unavailableMessage(err: unknown): string {
  return errorStatus(err) === 429
    ? 'Se alcanzo el limite de uso de la IA (Gemini). Espera un minuto e intenta de nuevo.'
    : 'El servicio de IA (Gemini) esta saturado en este momento. Intenta de nuevo en unos segundos.';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ACTIONS = [
  'CREATE_CLASS',
  'RENAME_CLASS',
  'DELETE_CLASS',
  'ADD_ATTRIBUTE',
  'UPDATE_ATTRIBUTE',
  'REMOVE_ATTRIBUTE',
  'CREATE_RELATIONSHIP',
  'UPDATE_RELATIONSHIP',
  'SET_MULTIPLICITY',
  'DELETE_RELATIONSHIP',
];

// Schema de salida controlada: un objeto "plano" con todos los campos
// posibles como opcionales (Gemini no soporta bien uniones discriminadas
// reales), validado y acotado despues con `aiCommandSchema` (zod).
const commandItemSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ACTIONS },
    className: { type: Type.STRING },
    newName: { type: Type.STRING },
    x: { type: Type.NUMBER },
    y: { type: Type.NUMBER },
    attributeName: { type: Type.STRING },
    newAttributeName: { type: Type.STRING },
    dataType: { type: Type.STRING, enum: [...UML_DATA_TYPES] },
    isPrimaryKey: { type: Type.BOOLEAN },
    nullable: { type: Type.BOOLEAN },
    defaultValue: { type: Type.STRING },
    sourceClassName: { type: Type.STRING },
    targetClassName: { type: Type.STRING },
    relationshipKind: { type: Type.STRING, enum: [...RELATIONSHIP_KINDS] },
    relationshipName: { type: Type.STRING },
    associationClassName: { type: Type.STRING },
    sourceMultiplicity: { type: Type.STRING, enum: [...MULTIPLICITIES] },
    targetMultiplicity: { type: Type.STRING, enum: [...MULTIPLICITIES] },
  },
  required: ['action'],
};

// Reglas de modelado compartidas por el pedido de texto y el de imagen: el
// objetivo es un diagrama de clases que se convierte en una base de datos
// PostgreSQL + backend Spring Boot, asi que las reglas son de diseno de BD.
const MODELING_RULES = `Reglas de modelado (el diagrama se convierte en tablas PostgreSQL y un backend Spring Boot):
- Nombres de clase en singular y PascalCase (Cliente, DetallePedido). Atributos en camelCase, sin tildes.
- Clave primaria: cada clase raiz lleva exactamente un atributo "id" de tipo Long con isPrimaryKey=true y nullable=false. Las subclases de una herencia NO llevan id propio (heredan el del padre).
- Tipos: dinero -> BigDecimal; fecha -> LocalDate; fecha y hora -> LocalDateTime; cantidades y numeros enteros -> Integer; si/no -> Boolean; textos, codigos, telefonos, correos -> String. Tipos validos: ${UML_DATA_TYPES.join(', ')}.
- nullable=false para los datos obligatorios (nombres, fechas clave, montos, estados); nullable=true para los opcionales (telefono, observaciones).
- NUNCA crees atributos de clave foranea (clienteId, idCategoria, categoria_id): la relacion ya genera la FK.
- Multiplicidades validas: "1", "0..1", "0..*", "1..*". La multiplicidad de cada extremo indica cuantas instancias de ESA clase participan. Ej: source Cliente "1" -- target Pedido "0..*" = un cliente tiene 0 o mas pedidos y cada pedido es de 1 cliente.
- Tipos de relacion (relationshipKind):
  - ASSOCIATION: vinculo entre entidades independientes.
  - COMPOSITION: la parte no existe sin el todo y se borra con el. sourceClassName = PARTE, targetClassName = TODO. Ej: source DetallePedido "1..*" -- target Pedido "1".
  - AGGREGATION: todo-parte donde la parte existe por si misma. sourceClassName = PARTE, targetClassName = TODO. Ej: source Docente "0..*" -- target Departamento "1".
  - GENERALIZATION: herencia "es un". sourceClassName = SUBCLASE, targetClassName = PADRE, multiplicidades "1" y "1".
- Muchos a muchos: si la relacion no tiene datos propios, ASSOCIATION "0..*" -- "0..*". Si tiene datos propios (fecha, cantidad, precio, nota), crea una clase intermedia con sus atributos y su id y relacionala con cada extremo con "1" -- "0..*" (ej. Estudiante "1" -- "0..*" Inscripcion, Curso "1" -- "0..*" Inscripcion).
- Si hay mas de una relacion entre las mismas dos clases, dale a cada una un relationshipName (rol) distinto, ej. "emisor" y "receptor".
- Referencia clases y atributos SIEMPRE por nombre exacto, nunca por ID.
- Orden de los comandos: primero todos los CREATE_CLASS, luego todos los ADD_ATTRIBUTE, y al final las relaciones.`;

const TEXT_SYSTEM_INSTRUCTION = `Sos el motor de modelado de una herramienta CASE para disenar BASES DE DATOS con diagramas de clases UML.
Tu unica salida es una lista de comandos estructurados que modifican el diagrama; nunca generes codigo, SQL ni texto libre.

Si el pedido pide crear o ampliar un sistema, disena un modelo COMPLETO y bien estructurado:
- Incluye todas las entidades que el dominio necesita para funcionar como base de datos real, no solo las que el usuario nombra: catalogos (Categoria, TipoX), tablas de detalle (DetallePedido, LineaFactura) y entidades de transaccion o registro (Pago, Movimiento, Reserva) cuando el caso lo requiera. Para un sistema pequeno apunta a 6-12 clases; no inventes modulos ajenos al pedido.
- Cada clase con sus atributos basicos y necesarios (normalmente 3-8), con tipos y obligatoriedad adecuados.
- Todas las relaciones necesarias con multiplicidades correctas; usa herencia, composicion o agregacion solo cuando corresponda semanticamente.
- En cada CREATE_CLASS indica x e y (0 a 1000) para un diagrama legible: clases relacionadas cerca, padres arriba de sus subclases, el todo junto a sus partes, sin superponer (separacion minima de 220 en x o de 180 en y).

Si el pedido modifica el modelo existente, aplica SOLO los cambios pedidos sobre las clases existentes (no recrees lo que ya existe).
Si el pedido no requiere cambios en el modelo, responde con una lista vacia.

${MODELING_RULES}`;

// Foto, captura o PDF de un diagrama (pizarra, papel u otra herramienta):
// aca el pedido ES el archivo. Mismo formato de comandos y mismo esquema de
// salida para no duplicar el pipeline de resolucion.
const IMAGE_SYSTEM_INSTRUCTION = `Sos el motor de vision de una herramienta CASE para disenar BASES DE DATOS con diagramas de clases UML.
Recibis una foto, captura o PDF de un diagrama de clases (dibujado a mano, en pizarra o en otra herramienta como Enterprise Architect, StarUML o draw.io) y lo traducis a la lista de comandos estructurados que lo reconstruye. Nunca generes texto libre.

Como leer el diagrama:
- Cada rectangulo con nombre es una clase (CREATE_CLASS). Indica x e y (0 a 1000) segun la posicion del CENTRO de la clase en la imagen, respetando la distribucion original.
- Los atributos visibles del compartimento de atributos (ADD_ATTRIBUTE), con el tipo de la lista permitida mas parecido al escrito (int -> Integer, float/double -> Double, decimal/money -> BigDecimal, date -> LocalDate, datetime/timestamp -> LocalDateTime, bool -> Boolean, varchar/char/text -> String). Si no hay tipo escrito, deducilo del nombre.
- Marca isPrimaryKey=true en el atributo subrayado, con PK/<<PK>>/llave, o llamado "id"/"idClase"/"codigo" si es claramente el identificador. Si una clase raiz no muestra clave primaria, agregale "id" Long PK. No agregues atributos que no esten dibujados (salvo esa PK).
- No copies atributos que sean claramente la clave foranea de una relacion dibujada (ej. "idCliente" en Pedido si hay una linea entre Pedido y Cliente).
- Ignora el compartimento de operaciones/metodos.
- Lineas entre clases:
  - Linea simple: ASSOCIATION, con las multiplicidades escritas en cada extremo (1, 0..1, *, 0..*, 1..*, N). Si falta alguna, usa "1" -- "0..*" segun el sentido mas logico.
  - Rombo vacio: AGGREGATION. Rombo relleno: COMPOSITION. El extremo con el rombo es el TODO (targetClassName); el otro extremo es la PARTE (sourceClassName).
  - Triangulo vacio: GENERALIZATION. La clase a la que apunta el triangulo es el PADRE (targetClassName).
  - Una clase unida con linea punteada al medio de otra linea es una clase asociacion: crea la relacion entre los dos extremos con associationClassName = esa clase.
  - Un nombre escrito sobre la linea es el relationshipName.
- Si la imagen no contiene ningun diagrama de clases reconocible, responde con una lista vacia.

${MODELING_RULES}`;

// Con un esquema "plano", el modelo suele completar los campos que no
// aplican con null o "" (ej. defaultValue: null en ADD_ATTRIBUTE): zod los
// rechazaria y el comando entero se perderia. Se quitan antes de validar.
// Tambien repara un error frecuente del modelo: poner el nombre del
// atributo en otro campo de texto (relationshipName/newName).
function withoutEmptyFields(item: unknown): unknown {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const cleaned = Object.fromEntries(
    Object.entries(item as Record<string, unknown>).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  );
  if (typeof cleaned.action === 'string' && cleaned.action.endsWith('_ATTRIBUTE') && !cleaned.attributeName) {
    cleaned.attributeName = cleaned.relationshipName ?? cleaned.newName;
  }
  return cleaned;
}

export class GeminiAiModelClient implements AiModelClient {
  private readonly client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }

  private async runCommandGeneration(
    systemInstruction: string,
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'],
    thinkingLevel: ThinkingLevel,
  ): Promise<AiCommand[]> {
    if (!env.geminiApiKey) {
      throw new DomainError('GEMINI_API_KEY no esta configurada en el backend');
    }

    const request = () =>
      this.client.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: { type: Type.ARRAY, items: commandItemSchema },
          // Disenar un modelo de datos completo si se beneficia de razonar
          // (entidades de apoyo, cardinalidades); el limite de salida es amplio
          // para que un sistema con muchas clases/atributos no se corte.
          thinkingConfig: { thinkingLevel },
          maxOutputTokens: 32768,
        },
      });

    const startedAt = Date.now();
    let response: Awaited<ReturnType<typeof request>> | undefined;
    for (let attempt = 1; !response; attempt++) {
      try {
        response = await request();
      } catch (err) {
        if (!isRetryable(err)) throw err;
        const delay = RETRY_DELAYS_MS[attempt - 1];
        const outOfBudget = Date.now() - startedAt + (delay ?? 0) > RETRY_TIME_BUDGET_MS;
        if (attempt >= MAX_ATTEMPTS || delay === undefined || outOfBudget) {
          console.warn(`[IA] Gemini no disponible tras ${attempt} intento(s):`, errorStatus(err) ?? String(err));
          throw new DomainError(unavailableMessage(err));
        }
        console.warn(`[IA] Gemini respondio ${errorStatus(err) ?? 'error de red'}; reintento ${attempt + 1}/${MAX_ATTEMPTS} en ${delay / 1000}s`);
        await sleep(delay);
      }
    }

    const text = response.text;
    if (!text) return [];

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new DomainError('La IA no devolvio un JSON valido (posiblemente la respuesta se corto); intenta con un pedido mas acotado');
    }

    if (!Array.isArray(raw)) return [];

    const commands: AiCommand[] = [];
    let discarded = 0;
    for (const item of raw) {
      const parsed = aiCommandSchema.safeParse(withoutEmptyFields(item));
      if (parsed.success) {
        commands.push(parsed.data);
      } else {
        discarded++;
        if (discarded <= 3) {
          console.warn('[IA] comando descartado:', JSON.stringify(item), parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
        }
      }
    }
    if (discarded > 0) console.warn(`[IA] ${discarded} de ${raw.length} comandos descartados por formato invalido`);
    if (env.nodeEnv !== 'production') {
      const byAction = commands.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.action]: (acc[c.action] ?? 0) + 1 }), {});
      console.info('[IA] comandos validos:', JSON.stringify(byAction));
    }
    return commands;
  }

  async generateCommands(input: { prompt: string; modelSummary: string }): Promise<AiCommand[]> {
    return this.runCommandGeneration(
      TEXT_SYSTEM_INSTRUCTION,
      `Modelo actual del proyecto:\n${input.modelSummary}\n\nPedido del usuario:\n${input.prompt}`,
      ThinkingLevel.MEDIUM,
    );
  }

  async generateCommandsFromImage(input: {
    imageBase64: string;
    mimeType: string;
    modelSummary: string;
    prompt?: string;
  }): Promise<AiCommand[]> {
    return this.runCommandGeneration(
      IMAGE_SYSTEM_INSTRUCTION,
      [
        {
          text:
            `Modelo actual del proyecto (puede estar vacio; no dupliques clases que ya existen):\n${input.modelSummary}` +
            (input.prompt ? `\n\nIndicaciones del usuario:\n${input.prompt}` : ''),
        },
        { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
      ],
      ThinkingLevel.LOW,
    );
  }
}
