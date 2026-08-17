# English Tutor

Nota para agentes:

- si necesitas una guia corta y operativa para levantar el proyecto, lee `AGENT_RUNBOOK.md`

Aplicacion web para practicar ingles hablado con un flujo local:

`microfono del navegador -> Whisper -> Ollama -> Kokoro -> audio de respuesta`

El proyecto esta pensado para un estudiante hispanohablante. Transcribe audio en ingles, genera una respuesta corta de un tutor con personalidad propia, marca correcciones importantes en el momento, y devuelve una version hablada de la respuesta.

## Que hace

- Graba audio desde el navegador (con auto-stop por silencio: no hace falta tocar el microfono para terminar cada turno, solo dejar de hablar).
- Transcribe con `faster-whisper` usando `distil-large-v3`.
- Envia la transcripcion a Ollama con el modelo configurado (`OLLAMA_MODEL`), junto con:
  - la personalidad del tutor elegido (ver "Tutores y niveles" mas abajo),
  - configuracion de ensenanza en runtime (nivel, modo de correccion, etc.),
  - contexto del alumno,
  - los ultimos turnos de la sesion (memoria de conversacion real, no solo del lado del navegador).
- Pide al modelo una respuesta en JSON validada contra un esquema (Pydantic) en vez de parsear texto libre por marcadores. Devuelve:
  - respuesta conversacional
  - correcciones importantes (mostradas inline en el propio mensaje del chat, no solo en un panel aparte)
  - una version mas natural de la frase del estudiante
  - una expresion o frase de vocabulario que el tutor decide ensenar activamente
  - "key phrases": modismos o phrasal verbs que el propio tutor uso en su respuesta, glosados para que el alumno no se quede sin entenderlos (ej. "turn out") — funciona solo cuando el modelo decide marcarlos; ver "Limitaciones actuales"
- Cada chat nuevo elige un tutor y un nivel CEFR (A1-C2); ambos quedan **bloqueados** para esa conversacion una vez que empieza (no se pueden cambiar a mitad de charla, solo en un chat nuevo).
- Genera un titulo corto y descriptivo para cada sesion (vía IA, una sola vez, en el primer turno) para identificarla despues en el sidebar.
- Guarda cada turno (transcripcion, salida estructurada, tiempos) en SQLite, asociado a una sesion de navegador y a un alumno por defecto.
- Sintetiza la respuesta con Kokoro, con una voz distinta por tutor.

## Tutores y niveles

Cinco tutores con personalidad, acento y voz Kokoro propios (`backend/tutors.py`):

| Tutor | Enfoque | Correccion |
|---|---|---|
| Emma | Practica relajada, generar confianza | Baja |
| James | Precision gramatical, errores recurrentes | Media-alta |
| Sophia | Fluidez, conversacion natural | Baja-media |
| Michael | Ingles profesional / de trabajo | Media |
| Nicole | Reta al alumno, vocabulario mas rico | Media |

Cada uno tiene un `behavior_prompt` propio (no son solo nombres/voces distintas) que se inyecta como una capa extra sobre el prompt base compartido — ver "Configuracion" mas abajo.

El nivel CEFR (A1-C2) elegido para un chat controla directamente que tan simple o compleja debe ser el lenguaje del tutor en esa conversacion (`LEVEL_SPEAKING_GUIDANCE` en `backend/services/prompt_builder.py`), no solo el vocabulario sugerido.

Tutor y nivel se seleccionan en la UI de React (`TeacherPresence` / `LevelPicker`) antes del primer mensaje de un chat nuevo, y quedan bloqueados (con icono de candado) el resto de esa conversacion.

## Stack actual

- Backend: FastAPI
- STT: `faster-whisper`
- LLM: Ollama
- TTS: `kokoro`
- Frontend principal: React + TypeScript + Vite + Mantine (`frontend/`)
- Frontend legado: HTML, CSS y JavaScript vanilla (`backend/static/`), servido directo por FastAPI y conservado como fallback reversible — no tiene selector de tutor/nivel ni las mejoras de UI mas recientes

## Modos de despliegue

Este proyecto soporta dos formas de uso:

- servidor central: corre Whisper, Ollama y Kokoro en una sola maquina (normalmente con GPU)
- cliente proxy: corre solo la web y reenvia el procesamiento al servidor central

La idea es que otro usuario pueda levantar el proyecto en su PC y solo tenga que indicar la IP/host del servidor central.

## Requisitos

Antes de arrancar, este proyecto asume lo siguiente:

- servidor central:
  - Python disponible dentro de `venv/`
  - Ollama corriendo (daemon activo) y el modelo descargado (`OLLAMA_MODEL`, ver `ollama ps` para confirmar que esta cargado)
  - GPU CUDA recomendada para Whisper y Kokoro
  - Node.js si vas a compilar/correr el frontend de React
- cliente proxy:
  - Python disponible dentro de `venv/`
  - conectividad hacia el servidor central en el puerto `8090`

Punto importante: Whisper intenta cargar primero en GPU y, si falla, cae a un fallback configurable a CPU **sin avisar por consola** salvo que revises los logs de arranque (ver seccion de logging mas abajo) — si la app se siente lenta de repente, antes de sospechar del LLM revisa el desglose `timings` (`whisper`/`ollama`/`tts`) que devuelve `/api/tutor`.

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
- `TTS_VOICE` (default de la voz base; cada tutor sobreescribe esto con su propia voz en `backend/tutors.py`)
- `GENERATED_RETENTION_SECONDS`
- `DB_PATH` (solo servidor central; base de datos SQLite con alumno/sesiones/turnos)
- `RECENT_TURNS_LIMIT` (solo servidor central; cuantos turnos recientes se envian como memoria de conversacion — default 10)

El prompt del tutor se ensambla en capas (rol compartido, personalidad del
tutor elegido, politica pedagogica compartida, configuracion de ensenanza en
runtime, contexto del alumno, historial reciente y tarea actual) en
`backend/services/prompt_builder.py`. El texto estatico de las capas
compartidas se puede editar sin tocar logica Python en:

- `backend/prompts/role.txt`
- `backend/prompts/teaching_policy.txt`

La personalidad de cada tutor (`behavior_prompt`) vive en `backend/tutors.py`, no en un archivo `.txt` aparte.

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

Compatibilidad adicional:

```bash
./server
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

## Ejecutar la app

### Frontend React (recomendado)

Un solo comando levanta el backend en background y Vite en foreground:

```bash
./dev-react.sh
```

- Verifica `venv/`, Node/npm y `frontend/package.json`; instala dependencias de npm la primera vez.
- Espera a que `/api/health` responda antes de arrancar Vite.
- `Ctrl+C` detiene backend y frontend juntos de forma limpia.

Abrir en el navegador la URL que imprime Vite (normalmente `http://localhost:5173`); el proxy de Vite reenvia `/api` y `/generated` al backend en `127.0.0.1:8090`.

### Frontend vanilla (legado)

```bash
./dev.sh
```

Backend local con recarga automatica y HTTPS autofirmado (necesario para que el navegador permita `getUserMedia()`), sirviendo `backend/static/` directamente. URLs: `https://127.0.0.1:8090` o `https://localhost:8090`.

### Servidor central (produccion)

```bash
./server.sh
```

Intenta configurar Tailscale Serve por defecto (`ENABLE_TAILSCALE_SERVE=1`), pero si `tailscale` no esta instalado no aborta el servidor local. Para forzar offline de Hugging Face: `HF_HUB_OFFLINE=1 ./server.sh`.

## Desarrollo distribuido en red local

Si quieres que otros desarrolladores trabajen desde sus propios equipos pero que el procesamiento pesado ocurra en un computador central, usa `REMOTE_BACKEND_BASE_URL`.

Idea:

- computador central: corre la app completa con Whisper, Ollama y TTS (`./server.sh`)
- equipos de desarrollo: corren esta misma app en modo proxy (`./dev-react.sh` o `./dev.sh`, con `REMOTE_BACKEND_BASE_URL` apuntando al central)
- navegador del desarrollador: usa el microfono local
- backend local del desarrollador: reenvia `/api/*` y `/generated/*` al servidor central

En este modo no se inicializan Whisper, Ollama ni Kokoro localmente, ni hace falta tenerlos instalados si usas `requirements.proxy.txt`. `/api/tutors` es la unica excepcion — el catalogo de tutores es codigo estatico, asi que un cliente proxy lo responde localmente sin ida y vuelta al servidor central.

### Requisito de red

Los equipos cliente deben poder alcanzar por red al computador central en el puerto `8090` (IP local o Tailscale si todos estan en la misma Tailnet). Para pruebas rapidas contra el LLM real sin pasar por el backend, Ollama tambien es alcanzable directo en el puerto `11434` del servidor central.

## Flujo de uso

1. Abre la interfaz web.
2. Permite acceso al microfono.
3. Elige tutor y nivel para un chat nuevo (o continua uno pasado desde el sidebar).
4. Graba una frase en ingles — la grabacion se corta sola despues de un silencio, o puedes tocar el microfono manualmente.
5. La app transcribe, consulta el tutor y reproduce la respuesta; las correcciones aparecen directo en el mensaje.

## Endpoints

### `GET /api/health`

Comprueba si los servicios principales estan cargados y si Ollama responde. `status` pasa a `degraded` si Whisper, Ollama, TTS o la base de datos no estan disponibles; incluye `startup_errors` con el detalle si algo fallo al arrancar.

### `POST /api/tutor`

Recibe `multipart/form-data` con:

- `audio` (obligatorio): la grabacion.
- `session_id` (opcional): id de sesion generado por el navegador. Si no se envia, el servidor genera uno nuevo. El tutor y el nivel de la sesion quedan fijados en el primer turno.
- `teaching_config_override` (opcional): JSON con cualquier subconjunto de los campos de `config/TEACHING_CONFIG_SPEC.md`, con la precedencia mas alta.

Respuesta JSON:

```json
{
  "transcription": "How are you today?",
  "response": "I'm good, thank you. What did you do today?",
  "tutor_id": "emma",
  "level": "B1",
  "corrections": "No important corrections.",
  "natural_version": "How are you today?",
  "vocabulary": "No vocabulary suggestion provided.",
  "key_phrases": "No key phrases this turn.",
  "session_id": "5c7e5b0e6f5545e1b8b6a9f0b6e9b111",
  "timings": {
    "whisper": 0.28,
    "ollama": 1.03,
    "tts": 0.06,
    "total": 1.76
  },
  "audio_url": "/generated/example.wav"
}
```

### Sesiones y progreso

- `GET /api/sessions` — sesiones del alumno (no borradas), con `title` (generado por IA), fecha y cantidad de turnos.
- `GET /api/sessions/{id}/turns` — turnos completos de una sesion, mas su `tutor_id`/`level` bloqueados.
- `DELETE /api/sessions/{id}` — soft-delete: la sesion desaparece del sidebar pero sus turnos se conservan para `/api/history`.
- `GET /api/history` — turnos recientes del alumno a traves de todas sus sesiones, para el dashboard "My Progress".

### Tutor y alumno

- `GET /api/tutors` — catalogo de los 5 tutores (id, nombre, acento, especialidad, tagline) — siempre respondido localmente, incluso en modo proxy.
- `GET /api/learner` — preferencias del alumno por defecto (`tutor_id`, `level` actuales — es decir, el default para el *proximo* chat nuevo, no el de una sesion ya bloqueada).
- `PUT /api/learner/tutor` — cambia el tutor por defecto para el proximo chat.
- `PUT /api/learner/level` — cambia el nivel CEFR por defecto para el proximo chat.

## Estructura del proyecto

```text
backend/
  config.py                Configuracion por entorno
  main.py                  FastAPI app, endpoints y logging
  tutors.py                Catalogo de tutores (personalidad, voz, especialidad)
  schemas/
    teacher_output.py      Esquema Pydantic de la respuesta del tutor
    teaching_config.py     Esquema y precedencia de configuracion de ensenanza
  storage/
    db.py                  Conexion SQLite y esquema (DDL + migraciones aditivas)
    learner_repository.py  Alumno por defecto y sus preferencias
    session_repository.py  Sesiones (tutor/nivel bloqueados, titulo, soft-delete)
    turn_repository.py     Turnos (transcripcion + salida estructurada)
  prompts/
    role.txt               Rol compartido de todos los tutores
    teaching_policy.txt    Politica pedagogica compartida
  services/
    whisper_service.py     Transcripcion
    tutor_service.py       Llamada a Ollama con salida estructurada, reintento y titulo de sesion
    prompt_builder.py      Ensamblado del prompt en capas (incluye guia por nivel CEFR)
    tts_service.py         Sintesis de voz (una voz/pipeline por tutor)
  static/                  Frontend legado (vanilla HTML/CSS/JS), sin selector de tutor/nivel
  generated/               Audios temporales y respuestas generadas
  data/                    Base de datos SQLite (ignorada por git)

frontend/                  Frontend principal en React + TypeScript + Vite + Mantine
  src/
    components/
      conversation/         Timeline del chat (correcciones inline, avatar dinamico)
      feedback/              Panel "Teacher Notes" (natural version, vocabulario, key phrases)
      layout/                Sidebar (secciones Sessions / Profile), sesiones, modal de borrado
      progress/              Dashboard "My Progress" (graficos SVG hechos a mano)
      recorder/              Control de grabacion (auto-stop por silencio)
      teacher/                Selector de tutor y de nivel CEFR
    context/TutorContext.tsx  Estado global: sesion activa, tutor/nivel bloqueados
    hooks/                   useTutor, useSessions, useTutorProfile, useLevelProfile, useAutoStopOnSilence...
    pages/                   TutorSessionPage, ProgressPage
    services/                Clientes HTTP por dominio (tutorApi, sessionsApi, learnerApi, historyApi)
    types/                   Tipos compartidos con el contrato del backend

scripts/
  test_conversation_quality.py  Pruebas cualitativas en vivo contra el Ollama real (no es parte de `unittest discover`)
  legacy/                        Scripts de prueba manual de un solo archivo, no mantenidos
    tutor.py                      Flujo completo sin navegador
    test_whisper.py                Prueba aislada de Whisper
    test_tts.py                     Prueba aislada de Kokoro

tests/
  test_tutor_service.py         Servicio del tutor (mock de Ollama)
  test_teacher_output_schema.py Esquema de salida estructurada
  test_teaching_config.py       Precedencia de configuracion
  test_prompt_builder.py        Ensamblado de prompt (incluye guia por nivel)
  test_storage.py                Repositorios SQLite y migraciones
  test_tutors.py                 Catalogo de tutores
  test_api_tutor_endpoint.py    Test end-to-end del endpoint (servicios mockeados)

dev.sh                      Backend local con HTTPS (frontend vanilla)
dev-react.sh                 Backend + Vite juntos (frontend React) — recomendado para desarrollo
server.sh                     Servidor central con Tailscale Serve opcional
requirements.txt           Dependencias Python (servidor)
requirements.server.txt    Alias de requirements.txt
requirements.proxy.txt     Dependencias minimas del cliente proxy
requirements-dev.txt       Dependencias adicionales solo para tests
```

## Scripts utiles

### Probar calidad conversacional en vivo

```bash
OLLAMA_BASE_URL=http://tu-servidor:11434 venv/bin/python scripts/test_conversation_quality.py
```

Corre varios escenarios (continuidad, correccion natural, no sobre-corregir, no entrevistar al alumno, diferenciacion entre tutores) contra el Ollama real y los imprime para revision — no es parte de `unittest discover` porque depende de un LLM real, no de mocks.

### Ejecutar tests unitarios

```bash
venv/bin/python -m unittest discover -s tests
```

Todos los tests usan mocks y una base de datos SQLite temporal — ninguno requiere Ollama, Whisper ni Kokoro reales. El test de endpoint (`tests/test_api_tutor_endpoint.py`) usa `fastapi.testclient.TestClient`, que requiere `httpx2`:

```bash
venv/bin/python -m pip install -r requirements-dev.txt
```

### Scripts legados (`scripts/legacy/`)

Pruebas manuales de un solo archivo, anteriores a la app FastAPI actual — tienen rutas fijas y no reflejan necesariamente el contrato actual de `TutorService`. Se conservan solo como referencia rapida para probar Whisper o Kokoro de forma aislada (`venv/bin/python scripts/legacy/tutor.py`, `test_whisper.py`, `test_tts.py`).

## Limitaciones actuales

- Whisper esta configurado solo para ingles: `language="en"`.
- Un unico alumno por defecto: no hay autenticacion ni multiples usuarios.
- Tutor y nivel CEFR ya son configurables desde la UI (por chat, bloqueados al empezar), pero el resto de `teaching_config_override` (modo de correccion, "strictness", exposicion al ingles, etc.) solo se puede ejercitar via API o tests, no desde la interfaz web.
- El campo `key_phrases` (glosar modismos que el propio tutor uso) y la instruccion de pedir repeticion tras un error recurrente estan implementados y probados en la infraestructura, pero el modelo actual (`qwen3.5:9b-32k`) no los dispara de forma confiable — quedan como comportamiento "best effort", no garantizado.
- Los agentes Planner, Evaluator, Grammar, Vocabulary y Pronunciation descritos en `agents/` todavia no existen como logica separada; el turno sigue siendo una unica llamada al modelo. La tabla `vocabulary_items` ya existe en el esquema pero nada escribe en ella todavia.
- Los archivos de audio generados se sirven desde `backend/generated/` y se limpian por antiguedad, no por cuota de espacio.
- El modo proxy asume que el servidor central expone esta misma API en `/api/*` y los audios en `/generated/*`.
- El logging de errores mejoro (ver mas abajo), pero sigue siendo solo consola/stdout — no hay agregacion externa ni alertas.

## Logging

`backend/main.py` configura `logging.basicConfig` al arrancar. Fallos de inicializacion de Whisper/Ollama/TTS y errores no controlados en `/api/tutor` ahora se loguean con traceback completo (antes, un 500 inesperado no dejaba ningun rastro mas alla de la linea de acceso de uvicorn). Los errores "conocidos" (Whisper/Tutor/TTS especificos, HTTPException controladas) se loguean como warning con el `session_id` correspondiente.

## Archivos clave

- Entrada web: `backend/main.py`
- Configuracion: `backend/config.py`
- Catalogo de tutores: `backend/tutors.py`
- Logica del tutor (salida estructurada, reintento, titulo de sesion): `backend/services/tutor_service.py`
- Ensamblado del prompt en capas: `backend/services/prompt_builder.py`
- Esquemas Pydantic: `backend/schemas/teacher_output.py`, `backend/schemas/teaching_config.py`
- Persistencia SQLite: `backend/storage/db.py` y los repositorios en `backend/storage/`
- Transcripcion: `backend/services/whisper_service.py`
- Sintesis de voz: `backend/services/tts_service.py`
- Prompts estaticos compartidos: `backend/prompts/role.txt`, `backend/prompts/teaching_policy.txt`
- Frontend React: `frontend/src/context/TutorContext.tsx` (estado global), `frontend/src/pages/`

## Siguiente mejora razonable

Ya implementado desde la ultima revision de este documento: frontend React completo (sesiones, progreso, seleccion de tutor y nivel), 5 personalidades de tutor distintas, nivel CEFR por chat, titulos de sesion generados por IA, correcciones inline en el chat, auto-stop de grabacion por silencio, y logging de errores con traceback.

Las siguientes mejoras con mejor retorno:

1. **Logica de Vocabulary sobre `vocabulary_items`**
   La tabla y sus estados (`new` -> ... -> `mastered`) ya existen; falta la logica deterministica que decide las transiciones y una pantalla de repaso. Es el punto de entrada mas barato hacia el resto del roadmap de `agents/` porque la mitad de la infraestructura ya esta ahi.

2. **UI de configuracion de ensenanza mas completa**
   `teaching_config_override` (modo de correccion, strictness, exposicion al ingles) solo se puede fijar via API/tests hoy — solo tutor y nivel tienen UI.

3. **Evaluator y Planner como llamadas por limite de sesion**
   Convertir los turnos guardados en evidencia de progreso real (nivel, errores recurrentes) y en una recomendacion de proximo objetivo, en vez de dejar esa informacion sin usar en la base de datos.

4. **Hacer confiable "key phrases" y "repite conmigo"**
   Ambos dependen hoy de que el modelo se auto-audite via instrucciones en el prompt, y en pruebas en vivo casi nunca disparan. El patron que si funcionó fue mover la deteccion a codigo Python (como el chequeo de "no preguntes siempre" en `prompt_builder.py`) en vez de confiar solo en texto de prompt.

5. **Politica de limpieza mas robusta para audio generado**
   La limpieza actual es por antiguedad. Una politica adicional por cantidad o tamano total evitaria crecimiento descontrolado si el uso aumenta.
