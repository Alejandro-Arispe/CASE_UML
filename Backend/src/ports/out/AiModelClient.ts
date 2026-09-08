import { AiCommand } from '../../application/use-cases/ai/aiCommand';

// Abstrae el proveedor de IA (Gemini): la aplicacion no conoce el SDK ni el
// modelo concreto, solo pide comandos estructurados a partir de un prompt
// y el estado actual del modelo UML (seccion 28).
export interface AiModelClient {
  generateCommands(input: { prompt: string; modelSummary: string }): Promise<AiCommand[]>;
}
