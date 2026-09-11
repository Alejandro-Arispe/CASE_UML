import { AiCommand } from '../../application/use-cases/ai/aiCommand';

// Abstrae el proveedor de IA (Gemini): la aplicacion no conoce el SDK ni el
// modelo concreto, solo pide comandos estructurados a partir de un prompt
// (o una foto de un diagrama) y el estado actual del modelo UML (seccion 28).
export interface AiModelClient {
  generateCommands(input: { prompt: string; modelSummary: string }): Promise<AiCommand[]>;
  // Mismo contrato de salida (AiCommand[]) que generateCommands: una foto de
  // un diagrama dibujado a mano/pizarra se traduce a los mismos comandos
  // estructurados, asi reutiliza integramente resolveAiCommands y
  // ApplyUmlOperation sin que el resto del pipeline sepa que el origen fue
  // una imagen en vez de texto.
  generateCommandsFromImage(input: {
    imageBase64: string;
    mimeType: string;
    modelSummary: string;
  }): Promise<AiCommand[]>;
}
