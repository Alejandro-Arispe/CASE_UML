import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { env } from '../../config/env';
import { UML_DATA_TYPES } from '../../domain/entities';
import { DomainError } from '../../domain/errors/DomainError';
import { AiCommand, aiCommandSchema } from '../../application/use-cases/ai/aiCommand';
import { AiModelClient } from '../../ports/out/AiModelClient';

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

const RELATIONSHIP_TYPES = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'];

// Schema de salida controlada: un objeto "plano" con todos los campos
// posibles como opcionales (Gemini no soporta bien uniones discriminadas
// reales), validado y acotado despues con `aiCommandSchema` (zod).
const commandItemSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ACTIONS },
    className: { type: Type.STRING },
    newName: { type: Type.STRING },
    attributeName: { type: Type.STRING },
    newAttributeName: { type: Type.STRING },
    dataType: { type: Type.STRING, enum: [...UML_DATA_TYPES] },
    isPrimaryKey: { type: Type.BOOLEAN },
    nullable: { type: Type.BOOLEAN },
    defaultValue: { type: Type.STRING },
    sourceClassName: { type: Type.STRING },
    targetClassName: { type: Type.STRING },
    relationshipType: { type: Type.STRING, enum: RELATIONSHIP_TYPES },
    sourceMultiplicity: { type: Type.STRING, enum: ['1', 'N'] },
    targetMultiplicity: { type: Type.STRING, enum: ['1', 'N'] },
  },
  required: ['action'],
};

const SYSTEM_INSTRUCTION = `Sos el motor de comandos de una plataforma CASE/UML.
Tu unica tarea es traducir el pedido del usuario en una lista de comandos
estructurados que modifican un diagrama de clases. Nunca generes codigo,
SQL, ni texto libre: solo la lista de comandos del formato indicado.

Reglas:
- Referencia clases y atributos SIEMPRE por nombre, nunca por ID.
- Si el pedido implica crear un sistema nuevo: primero CREATE_CLASS para
  cada clase, luego ADD_ATTRIBUTE para cada atributo (incluyendo una clave
  primaria "id" de tipo Long marcada isPrimaryKey en cada clase que
  represente una entidad persistible), y luego CREATE_RELATIONSHIP para
  las relaciones entre ellas.
- Tipos de dato validos: ${UML_DATA_TYPES.join(', ')}.
- Multiplicidades validas: "1" o "N".
- Si el pedido no requiere cambios en el modelo, responde con una lista vacia.`;

// Foto de un diagrama dibujado a mano o en pizarra (seccion "importar
// diagrama desde imagen"): a diferencia del prompt de texto, aca el pedido
// completo ES la imagen. Se reutiliza el mismo formato de comandos y el
// mismo esquema de salida para no duplicar el pipeline de resolucion.
const IMAGE_SYSTEM_INSTRUCTION = `Sos el motor de vision de una plataforma CASE/UML.
Se te da una foto o captura de un diagrama de clases UML dibujado a mano,
en pizarra, o en otra herramienta. Tu tarea es reconocer todas las clases,
sus atributos (con el tipo de dato mas parecido de la lista permitida) y
las relaciones entre clases, y traducirlo a la MISMA lista de comandos
estructurados que usarias para un pedido de texto.

Reglas:
- Referencia clases y atributos SIEMPRE por nombre (el nombre que este
  escrito o el mas cercano legible), nunca por ID.
- Primero CREATE_CLASS para cada clase que reconozcas, luego ADD_ATTRIBUTE
  para cada atributo visible (si una clase no muestra atributos, no le
  inventes ninguno; si no tiene una clave primaria visible, agregale un
  "id" de tipo Long marcado isPrimaryKey igual que en un pedido de texto).
- Interpreta las multiplicidades escritas junto a cada relacion (1, N, *,
  0..1, 1..*, etc.) y traducilas a "1" o "N" segun corresponda; si no se
  distingue con claridad, usa el sentido mas comun (1 a N).
- Tipos de dato validos: ${UML_DATA_TYPES.join(', ')}.
- Si la imagen no muestra ningun diagrama de clases reconocible, responde
  con una lista vacia en vez de inventar clases.`;

export class GeminiAiModelClient implements AiModelClient {
  private readonly client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }

  private async runCommandGeneration(
    systemInstruction: string,
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'],
  ): Promise<AiCommand[]> {
    if (!env.geminiApiKey) {
      throw new DomainError('GEMINI_API_KEY no esta configurada en el backend');
    }

    const response = await this.client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: commandItemSchema },
        // Sin razonamiento extendido (esto es generacion de JSON estructurado,
        // no un problema que requiera "pensar") y con espacio de sobra para
        // que un modelo con varias clases/atributos/relaciones no se corte.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        maxOutputTokens: 8192,
      },
    });

    const text = response.text;
    if (!text) return [];

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new DomainError('La IA no devolvio un JSON valido');
    }

    if (!Array.isArray(raw)) return [];

    const commands: AiCommand[] = [];
    for (const item of raw) {
      const parsed = aiCommandSchema.safeParse(item);
      if (parsed.success) commands.push(parsed.data);
    }
    return commands;
  }

  async generateCommands(input: { prompt: string; modelSummary: string }): Promise<AiCommand[]> {
    return this.runCommandGeneration(
      SYSTEM_INSTRUCTION,
      `Modelo actual del proyecto:\n${input.modelSummary}\n\nPedido del usuario:\n${input.prompt}`,
    );
  }

  async generateCommandsFromImage(input: {
    imageBase64: string;
    mimeType: string;
    modelSummary: string;
  }): Promise<AiCommand[]> {
    return this.runCommandGeneration(IMAGE_SYSTEM_INSTRUCTION, [
      { text: `Modelo actual del proyecto (puede estar vacio):\n${input.modelSummary}` },
      { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
    ]);
  }
}
