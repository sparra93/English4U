# English Tutor

Aplicacion web ligera para practicar ingles hablado con un flujo local:

`microfono del navegador -> Whisper -> Ollama -> Kokoro -> audio de respuesta`

El proyecto esta pensado para un estudiante hispanohablante. Transcribe audio en ingles, genera una respuesta corta de tutor, marca correcciones importantes y devuelve una version hablada de la respuesta.

## Que hace

- Graba audio desde el navegador.
- Transcribe con `faster-whisper` usando `distil-large-v3`.
- Envia la transcripcion a Ollama con el modelo `qwen3.5:9b-32k`.
- Devuelve:
  - respuesta conversacional
  - correcciones importantes
  - una version mas natural de la frase del estudiante
  - una expresion o frase de vocabulario
- Sintetiza la respuesta con Kokoro usando la voz `af_heart`.

## Stack actual

- Backend: FastAPI
- STT: `faster-whisper`
- LLM: Ollama
- TTS: `kokoro`
- Frontend: HTML, CSS y JavaScript vanilla

## Requisitos

Antes de arrancar, este proyecto asume lo siguiente:

- Python disponible dentro de `venv/`
- Ollama corriendo en `http://127.0.0.1:11434`
- Modelo de Ollama descargado: `qwen3.5:9b-32k`
- GPU CUDA recomendada para Whisper

Punto importante: Whisper intenta cargar primero en GPU y, si falla, puede usar un fallback configurable a CPU.

## Configuracion

La configuracion principal ahora sale de variables de entorno. Tienes una base en:

[`/home/soulblue/english-tutor/.env.example`](/home/soulblue/english-tutor/.env.example)

Variables mas utiles:

- `REMOTE_BACKEND_BASE_URL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `WHISPER_DEVICE`
- `WHISPER_COMPUTE_TYPE`
- `WHISPER_FALLBACK_DEVICE`
- `WHISPER_FALLBACK_COMPUTE_TYPE`
- `TTS_VOICE`
- `GENERATED_RETENTION_SECONDS`

El prompt del tutor tambien se puede editar sin tocar la logica Python en:

- [`app/prompts/tutor_system_prompt.txt`](/home/soulblue/english-tutor/app/prompts/tutor_system_prompt.txt)

## Instalacion

Crear o activar el entorno virtual e instalar dependencias:

```bash
/home/soulblue/english-tutor/venv/bin/python -m pip install -r requirements.txt
```

Si todavia no descargaste el modelo de Ollama:

```bash
ollama pull qwen3.5:9b-32k
```

## Ejecutar la app web

```bash
/home/soulblue/english-tutor/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Abrir en el navegador:

- Local: `http://127.0.0.1:8090`
- Red local o Tailscale: `http://<IP>:8090`

Para detenerla:

```bash
Ctrl+C
```

## Development

Para desarrollo local con recarga automatica y HTTPS:

```bash
cd /home/soulblue/english-tutor
./dev.sh
```

Atajo opcional:

```bash
make dev
```

`dev.sh` hace lo siguiente:

- verifica que exista `venv/bin/python`
- genera un certificado local autofirmado en `.certs/` si todavia no existe
- arranca Uvicorn con `--reload`
- habilita HTTPS para que el navegador permita usar el microfono

URLs en desarrollo:

- local: `https://127.0.0.1:8090`
- alternativa: `https://localhost:8090`

Comportamiento de recarga:

- el backend arranca con auto reload habilitado
- la vigilancia de cambios se limita a `app/`
- los cambios en archivos Python del backend provocan recarga
- los archivos `.wav` generados no deberian provocar recargas innecesarias

Salida:

- `Ctrl+C` detiene el proceso de Uvicorn de forma limpia
- la primera vez el navegador mostrara una advertencia porque el certificado es autofirmado
- debes aceptar o confiar en ese certificado local para que `getUserMedia()` funcione

## Desarrollo distribuido en red local

Si quieres que otros desarrolladores trabajen desde sus propios equipos pero que el procesamiento pesado ocurra en un computador central, usa `REMOTE_BACKEND_BASE_URL`.

Idea:

- computador central: corre la app completa con Whisper, Ollama y TTS
- equipos de desarrollo: corren esta misma app en modo proxy
- navegador del desarrollador: usa el microfono local
- backend local del desarrollador: reenvia `/api/health`, `/api/tutor` y `/generated/*` al servidor central

Ventajas de este enfoque:

- no hace falta cargar modelos en cada equipo
- el microfono sigue funcionando porque el frontend corre en `localhost`
- no hace falta cambiar la API del frontend
- el audio de respuesta tambien se reproduce a traves del proxy local

### Servidor central

En el computador que estara encendido 24/7:

```bash
/home/soulblue/english-tutor/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8090
```

### Equipo de desarrollo

En cada equipo que clone el repo, define:

```bash
export REMOTE_BACKEND_BASE_URL="http://IP-DEL-SERVIDOR-CENTRAL:8090"
```

Luego arranca normalmente:

```bash
./dev.sh
```

o:

```bash
/home/soulblue/english-tutor/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8090
```

En este modo:

- no se inicializan Whisper, Ollama ni Kokoro localmente
- `/api/tutor` se reenvia al servidor central
- `/api/health` consulta el estado del servidor central
- `/generated/*` se sirve por proxy desde el servidor central

### Requisito de red

Los equipos cliente deben poder alcanzar por red al computador central en el puerto `8090`, por ejemplo usando:

- IP local de la red
- Tailscale, si todos estan en la misma Tailnet

## Flujo de uso

1. Abre la interfaz web.
2. Permite acceso al microfono.
3. Graba una frase en ingles.
4. La app transcribe, consulta el tutor y reproduce la respuesta.

## Endpoints

### `GET /api/health`

Comprueba si los servicios principales estan cargados y si Ollama responde.

Ejemplo:

```json
{
  "status": "ok",
  "whisper": true,
  "ollama": true,
  "tts": true
}
```

Si Ollama no esta disponible, `status` pasa a `degraded`.

### `POST /api/tutor`

Recibe audio como `multipart/form-data` en el campo `audio`.

Respuesta JSON:

```json
{
  "transcription": "How are you today?",
  "response": "I'm good, thank you. What did you do today?",
  "corrections": "No important corrections.",
  "natural_version": "How are you today?",
  "vocabulary": "What did you do today?",
  "timings": {
    "whisper": 1.234,
    "ollama": 2.345,
    "tts": 0.678,
    "total": 4.257
  },
  "audio_url": "/generated/example.wav"
}
```

## Estructura del proyecto

```text
app/
  config.py                Configuracion por entorno
  main.py                  FastAPI app y endpoints
  prompts/
    tutor_system_prompt.txt Prompt del tutor
  services/
    whisper_service.py     Transcripcion
    tutor_service.py       Prompt y llamada a Ollama
    tts_service.py         Sintesis de voz
  static/
    index.html             Interfaz web
    styles.css             Estilos
    app.js                 Grabacion y consumo del backend
  generated/               Audios temporales y respuestas generadas

tutor.py                   Script local de prueba end-to-end
test_whisper.py            Prueba aislada de Whisper
test_tts.py                Prueba aislada de Kokoro
tests/
  test_tutor_service.py    Tests del parseo de respuesta
requirements.txt           Dependencias Python
```

## Scripts utiles

### Probar el flujo completo sin navegador

```bash
/home/soulblue/english-tutor/venv/bin/python tutor.py
```

Usa `test.wav` como entrada y escribe `tutor_response.wav`.

### Probar solo Whisper

```bash
/home/soulblue/english-tutor/venv/bin/python test_whisper.py
```

### Probar solo TTS

```bash
/home/soulblue/english-tutor/venv/bin/python test_tts.py
```

### Ejecutar tests unitarios

```bash
/home/soulblue/english-tutor/venv/bin/python -m unittest discover -s tests
```

## Limitaciones actuales

- Whisper esta configurado solo para ingles: `language="en"`.
- El historial de conversacion en frontend se conserva solo por sesion del navegador.
- Los archivos de audio generados se sirven desde `app/generated/` y se limpian por antiguedad, no por cuota de espacio.
- No hay autenticacion ni persistencia real de usuarios o conversaciones.
- El modo proxy asume que el servidor central expone esta misma API en `/api/*` y los audios en `/generated/*`.

## Archivos clave

- Entrada web: [`app/main.py`](/home/soulblue/english-tutor/app/main.py)
- Configuracion: [`app/config.py`](/home/soulblue/english-tutor/app/config.py)
- Logica del tutor: [`app/services/tutor_service.py`](/home/soulblue/english-tutor/app/services/tutor_service.py)
- Transcripcion: [`app/services/whisper_service.py`](/home/soulblue/english-tutor/app/services/whisper_service.py)
- Sintesis de voz: [`app/services/tts_service.py`](/home/soulblue/english-tutor/app/services/tts_service.py)
- Prompt del tutor: [`app/prompts/tutor_system_prompt.txt`](/home/soulblue/english-tutor/app/prompts/tutor_system_prompt.txt)
- Script standalone: [`tutor.py`](/home/soulblue/english-tutor/tutor.py)

## Siguiente mejora razonable

Despues de los cambios ya implementados, estas serian las siguientes mejoras con mejor retorno:

1. Tests del endpoint `/api/tutor`
   Ya existe cobertura del parseo del tutor. El siguiente paso natural es cubrir el endpoint principal con mocks de Whisper, Ollama y TTS.

2. Conversacion con contexto real en backend
   Ahora el historial visual existe en frontend, pero no se envia como contexto al tutor. Mantener una ventana corta de conversacion mejoraria continuidad.

3. Politica de limpieza mas robusta
   La limpieza actual es por antiguedad. Una politica adicional por cantidad o tamaño total evitaria crecimiento descontrolado si el uso aumenta.

4. Variables de entorno para frontend
   Si el producto sigue creciendo, puede ser util exponer branding, nombre del tutor o textos de onboarding sin editar JS/HTML.

5. Observabilidad simple
   Logging estructurado y errores mas visibles ayudarian a diagnosticar fallos de audio, carga de modelos y tiempos de respuesta.
