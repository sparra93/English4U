# English Tutor

Nota para agentes:

- si necesitas una guia corta y operativa para levantar el proyecto, lee `AGENT_RUNBOOK.md`

Aplicacion web ligera para practicar ingles hablado con un flujo local:

`microfono del navegador -> Whisper -> Ollama -> Kokoro -> audio de respuesta`

El proyecto esta pensado para un estudiante hispanohablante. Transcribe audio en ingles, genera una respuesta corta de tutor, marca correcciones importantes y devuelve una version hablada de la respuesta.

## Que hace

- Graba audio desde el navegador.
- Transcribe con `faster-whisper` usando `distil-large-v3`.
- Envia la transcripcion a Ollama con el modelo `qwen3.5:9b-32k`, junto con
  configuracion de ensenanza, contexto del alumno y los ultimos turnos de la
  sesion (memoria de conversacion real, no solo del lado del navegador).
- Pide al modelo una respuesta en JSON validada contra un esquema (Pydantic)
  en vez de parsear texto libre por marcadores. Devuelve:
  - respuesta conversacional
  - correcciones importantes
  - una version mas natural de la frase del estudiante
  - una expresion o frase de vocabulario
- Guarda cada turno (transcripcion, salida estructurada, tiempos) en SQLite,
  asociado a una sesion de navegador y a un alumno por defecto.
- Sintetiza la respuesta con Kokoro usando la voz `af_heart`.

## Stack actual

- Backend: FastAPI
- STT: `faster-whisper`
- LLM: Ollama
- TTS: `kokoro`
- Frontend: HTML, CSS y JavaScript vanilla

## Modos de despliegue

Este proyecto ahora soporta dos formas de uso:

- servidor central: corre Whisper, Ollama y Kokoro en una sola maquina
- cliente proxy: corre solo la web y reenvia el procesamiento al servidor central

La idea es que otro usuario pueda levantar el proyecto en su PC y solo tenga que indicar la IP de esta maquina.

## Requisitos

Antes de arrancar, este proyecto asume lo siguiente:

- servidor central:
  - Python disponible dentro de `venv/`
  - Ollama corriendo en `http://127.0.0.1:11434`
  - modelo de Ollama descargado: `qwen3.5:9b-32k`
  - GPU CUDA recomendada para Whisper
- cliente proxy:
  - Python disponible dentro de `venv/`
  - conectividad hacia el servidor central en el puerto `8090`

Punto importante: Whisper intenta cargar primero en GPU y, si falla, puede usar un fallback configurable a CPU.

## Configuracion

La configuracion principal sale de variables de entorno. Tienes una base en:

- `.env.example`

Tambien puedes crear un archivo `.env` en la raiz del proyecto. La app lo carga automaticamente al arrancar.

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
- `DB_PATH` (solo servidor central; base de datos SQLite con alumno/sesiones/turnos)
- `RECENT_TURNS_LIMIT` (solo servidor central; cuantos turnos recientes se envian como memoria de conversacion)

El prompt del tutor se ensambla en capas (rol, politica pedagogica
compartida, configuracion de ensenanza en runtime, contexto del alumno,
historial reciente y tarea actual) en `app/services/prompt_builder.py`. El
texto estatico de las dos primeras capas se puede editar sin tocar logica
Python en:

- `app/prompts/role.txt`
- `app/prompts/teaching_policy.txt`

## Instalacion

### Servidor central

Crear o activar el entorno virtual e instalar dependencias completas:

```bash
venv/bin/python -m pip install -r requirements.server.txt
```

Si todavia no descargaste el modelo de Ollama:

```bash
ollama pull qwen3.5:9b-32k
```

Script recomendado para este equipo:

```bash
./server.sh
```

### Cliente proxy

En un equipo que solo usara la UI y enviara todo al servidor central, instala solo las dependencias minimas:

```bash
venv/bin/python -m pip install -r requirements.proxy.txt
```

Crea `.env` con algo como esto:

```bash
REMOTE_BACKEND_BASE_URL=http://IP-DEL-SERVIDOR-CENTRAL:8090
APP_HOST=0.0.0.0
APP_PORT=8090
```

Con eso no hace falta instalar Ollama, descargar modelos ni levantar Whisper/Kokoro en el equipo cliente.

## Ejecutar la app web

```bash
venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Si esta maquina sera el servidor central para otros clientes, usa preferentemente:

```bash
./server.sh
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
./server.sh
```

### Equipo cliente o de desarrollo

En cada equipo que clone el repo, crea `.env` o define:

```bash
export REMOTE_BACKEND_BASE_URL="http://IP-DEL-SERVIDOR-CENTRAL:8090"
```

Luego arranca normalmente:

```bash
./dev.sh
```

o:

```bash
venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8090
```

En este modo:

- no se inicializan Whisper, Ollama ni Kokoro localmente
- no hace falta tener instalados `faster-whisper`, `kokoro` ni Ollama en la maquina cliente si usas `requirements.proxy.txt`
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
  "tts": true,
  "database": true
}
```

Si Ollama, Whisper, TTS o la base de datos no estan disponibles, `status`
pasa a `degraded`. `database` solo aparece en modo servidor.

### `POST /api/tutor`

Recibe `multipart/form-data` con:

- `audio` (obligatorio): la grabacion.
- `session_id` (opcional): id de sesion generado por el navegador
  (`crypto.randomUUID()`). Si no se envia, el servidor genera uno nuevo y lo
  devuelve en la respuesta; el frontend lo guarda para las siguientes
  peticiones de la misma pestaña, lo que le da memoria de conversacion real
  dentro de la sesion.
- `teaching_config_override` (opcional): JSON con cualquier subconjunto de
  los campos de `config/TEACHING_CONFIG_SPEC.md` (por ejemplo
  `{"correction_mode": "immediate"}`), con la precedencia mas alta sobre la
  preferencia guardada del alumno.

Respuesta JSON:

```json
{
  "transcription": "How are you today?",
  "response": "I'm good, thank you. What did you do today?",
  "corrections": "No important corrections.",
  "natural_version": "How are you today?",
  "vocabulary": "What did you do today?",
  "session_id": "5c7e5b0e6f5545e1b8b6a9f0b6e9b111",
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
  schemas/
    teacher_output.py      Esquema Pydantic de la respuesta del tutor
    teaching_config.py     Esquema y precedencia de configuracion de ensenanza
  storage/
    db.py                  Conexion SQLite y esquema (DDL)
    learner_repository.py  Alumno por defecto y sus preferencias
    session_repository.py  Sesiones de navegador
    turn_repository.py     Turnos (transcripcion + salida estructurada)
  prompts/
    role.txt               Rol inmutable del tutor
    teaching_policy.txt    Politica pedagogica compartida
  services/
    whisper_service.py     Transcripcion
    tutor_service.py       Llamada a Ollama con salida estructurada y reintento
    prompt_builder.py      Ensamblado del prompt en capas
    tts_service.py         Sintesis de voz
  static/
    index.html             Interfaz web
    styles.css             Estilos
    app.js                 Grabacion, session_id y consumo del backend
  generated/               Audios temporales y respuestas generadas
  data/                    Base de datos SQLite (ignorada por git)

tutor.py                   Script local de prueba end-to-end (legado, rutas fijas)
test_whisper.py            Prueba aislada de Whisper (legado, rutas fijas)
test_tts.py                Prueba aislada de Kokoro (legado, rutas fijas)
tests/
  test_tutor_service.py         Tests del servicio del tutor (mock de Ollama)
  test_teacher_output_schema.py Tests del esquema de salida estructurada
  test_teaching_config.py       Tests de precedencia de configuracion
  test_prompt_builder.py        Tests del ensamblado de prompt
  test_storage.py               Tests de los repositorios SQLite
  test_api_tutor_endpoint.py    Test end-to-end del endpoint (servicios mockeados)
requirements.txt           Dependencias Python (servidor)
requirements.server.txt    Alias de requirements.txt
requirements.proxy.txt     Dependencias minimas del cliente proxy
requirements-dev.txt       Dependencias adicionales solo para tests
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
venv/bin/python -m unittest discover -s tests
```

La mayoria de los tests no requieren Ollama, Whisper ni Kokoro reales (usan
mocks y una base de datos SQLite temporal). El test de endpoint
(`tests/test_api_tutor_endpoint.py`) usa `fastapi.testclient.TestClient`, que
requiere `httpx2`:

```bash
venv/bin/python -m pip install -r requirements-dev.txt
```

## Limitaciones actuales

- Whisper esta configurado solo para ingles: `language="en"`.
- La memoria de conversacion dentro de una sesion ahora es real (se reenvian
  los ultimos turnos al tutor y se guardan en SQLite), pero sigue existiendo
  un unico alumno por defecto: no hay autenticacion ni multiples usuarios.
- No hay UI para configurar preferencias de ensenanza todavia — el override
  de sesion (`teaching_config_override`) solo se puede ejercitar via API o
  tests, no desde la interfaz web.
- Los agentes Planner, Evaluator, Grammar, Vocabulary y Pronunciation
  descritos en `agents/` todavia no existen como logica separada; el turno
  sigue siendo una unica llamada al modelo.
- Los archivos de audio generados se sirven desde `app/generated/` y se limpian por antiguedad, no por cuota de espacio.
- El modo proxy asume que el servidor central expone esta misma API en `/api/*` y los audios en `/generated/*`.

## Archivos clave

- Entrada web: `app/main.py`
- Configuracion: `app/config.py`
- Logica del tutor (salida estructurada, reintento): `app/services/tutor_service.py`
- Ensamblado del prompt en capas: `app/services/prompt_builder.py`
- Esquemas Pydantic: `app/schemas/teacher_output.py`, `app/schemas/teaching_config.py`
- Persistencia SQLite: `app/storage/db.py` y los repositorios en `app/storage/`
- Transcripcion: `app/services/whisper_service.py`
- Sintesis de voz: `app/services/tts_service.py`
- Prompts estaticos: `app/prompts/role.txt`, `app/prompts/teaching_policy.txt`
- Script standalone (legado, rutas fijas): `tutor.py`

## Siguiente mejora razonable

Ya implementado: salida estructurada y validada del tutor (sin parseo de
texto libre), configuracion de ensenanza en runtime con precedencia,
conversacion con contexto real en backend (~~item 2~~), y persistencia
minima de alumno/sesiones/turnos en SQLite. Tests del endpoint `/api/tutor`
(~~item 1~~) tambien existen ahora (`tests/test_api_tutor_endpoint.py`).

Con eso resuelto, las siguientes mejoras con mejor retorno son:

1. UI de configuracion de ensenanza
   `teaching_config_override` y las preferencias del alumno solo se pueden
   fijar via API/tests hoy. Una pantalla simple de ajustes lo haria usable
   de verdad.

2. Evaluator y Planner como llamadas por limite de sesion
   Convertir los turnos guardados en evidencia de progreso real (nivel,
   errores recurrentes) y en una recomendacion de proximo objetivo, en vez
   de dejar esa informacion sin usar en la base de datos.

3. Logica de Vocabulary sobre `vocabulary_items`
   La tabla y sus estados (`new` -> ... -> `mastered`) ya existen; falta la
   logica deterministica que decide las transiciones.

4. Politica de limpieza mas robusta para audio generado
   La limpieza actual es por antiguedad. Una politica adicional por cantidad
   o tamano total evitaria crecimiento descontrolado si el uso aumenta.

5. Observabilidad simple
   Logging estructurado y errores mas visibles ayudarian a diagnosticar
   fallos de audio, carga de modelos, tiempos de respuesta y reintentos de
   validacion del tutor.
