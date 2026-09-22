# IA local para las aplicaciones generadas

Los pesos se guardan por maquina en `local-ai/models/` y estan excluidos de
Git. **El CASE no los carga ni los usa**: el CASE solo recibe el diagrama y
genera el backend Spring Boot. Estos recursos estan reservados para una futura
aplicacion movil y/o para el despliegue local del backend ya generado.

## Modelos instalados

- `models/qwen/qwen2.5-1.5b-instruct-q4_k_m.gguf`: modelo textual para
  interpretar ordenes del usuario en la aplicacion generada.
- `models/whisper/ggml-small-q5_1.bin`: modelo multilingue de Whisper.cpp
  para transcribir voz en una futura integracion offline.
- `models/gemma/gemma-4-E2B-it.litertlm`: modelo LiteRT para una aplicacion
  Android/AI Edge. No es un archivo GGUF y por eso no se carga desde
  `llama-server` ni directamente desde Node.

## Funcionamiento objetivo

1. El CASE genera un backend Spring Boot normal, sin modelos ni dependencia de
   IA.
2. La aplicacion movil usa Whisper para voz a texto, Qwen para interpretar la
   orden y Gemma LiteRT cuando necesite capacidades multimodales en Android.
3. La app movil llama a endpoints funcionales del backend generado, como
   `POST /api/appointments`, despues de validar la orden localmente.

Los modelos no se incluyen dentro del ZIP del backend: pesan varios GB y se
instalan con la aplicacion movil o con un runtime local junto al despliegue.
La proxima implementacion debe ser un perfil generable de agenda (citas,
disponibilidad y cancelacion) y su contrato REST; despues se conecta el cliente
movil de voz a esos endpoints.

## Dictado local opcional en el CASE

El CASE conserva Gemini y el boton de dictado del navegador sin cambios. Como
mejora, se agrego un segundo boton de microfono para Whisper local. Antes de
abrir el CASE, inicia el servidor desde la raiz:

```powershell
.\local-ai\start-whisper.ps1
```

Despues, el boton `Dictar localmente (Whisper)` transcribe en esta computadora
y agrega el texto al pedido que Gemini procesa normalmente. Si Whisper no esta
iniciado, el boton local queda deshabilitado: el resto del CASE sigue igual.
