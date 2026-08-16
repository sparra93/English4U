# Agent Runbook

Guia operativa para Codex u otro agente que necesite levantar este proyecto sin adivinar la arquitectura.

## Objetivo

Este proyecto soporta dos modos:

- `server`: esta maquina procesa todo. Corre Whisper, Ollama y Kokoro.
- `proxy`: otra maquina solo levanta la UI y reenvia audio y requests a un servidor central.

Regla principal:

- si existe `REMOTE_BACKEND_BASE_URL` con valor no vacio, levantar en modo `proxy`
- si `REMOTE_BACKEND_BASE_URL` esta vacio o ausente, levantar en modo `server`

## Archivos importantes

- `backend/main.py`: app FastAPI principal
- `backend/config.py`: carga `.env` automaticamente
- `backend/schemas/`: esquemas Pydantic (salida estructurada del tutor, configuracion de ensenanza)
- `backend/storage/`: acceso a la base de datos SQLite (alumno, sesiones, turnos)
- `.env.example`: plantilla de configuracion
- `requirements.server.txt`: dependencias completas del servidor central
- `requirements.proxy.txt`: dependencias minimas para cliente proxy
- `requirements-dev.txt`: dependencias adicionales solo para correr los tests (incluye `httpx2`, requerido por `TestClient`)
- `dev.sh`: arranque local con HTTPS para usar microfono en navegador
- `server.sh`: arranque del servidor central en HTTP local con Tailscale Serve opcional

Nota importante: la persistencia (SQLite) y la resolucion de configuracion de
ensenanza (Pydantic) solo se cargan en modo `server`. El modo `proxy` nunca
importa `backend/schemas/` ni `backend/storage/` — sigue siendo un reenviador HTTP
delgado, igual que hoy con Whisper, Ollama y Kokoro.

## Modo 1: servidor central

Usar este modo cuando esta maquina tiene los modelos y servicios instalados.

### Requisitos

- `venv/` disponible
- Ollama corriendo en `http://127.0.0.1:11434`
- modelo `qwen3.5:9b-32k` descargado
- dependencias Python instaladas

### Instalacion

```bash
venv/bin/python -m pip install -r requirements.server.txt
```

### Configuracion recomendada

Crear `.env` en la raiz del repo con:

```dotenv
APP_HOST=0.0.0.0
APP_PORT=8090
REMOTE_BACKEND_BASE_URL=
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:9b-32k
WHISPER_MODEL=distil-large-v3
WHISPER_LANGUAGE=en
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
WHISPER_FALLBACK_DEVICE=cpu
WHISPER_FALLBACK_COMPUTE_TYPE=int8
TTS_VOICE=af_heart
TTS_REPO_ID=hexgrad/Kokoro-82M
GENERATED_RETENTION_SECONDS=3600
DB_PATH=backend/data/english46.db
RECENT_TURNS_LIMIT=10
```

### Arranque

Produccion simple:

```bash
venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8090
```

Script recomendado para servidor central:

```bash
./server.sh
```

Este script:

- arranca FastAPI en HTTP local
- evita mezclar HTTPS local con Tailscale Serve
- intenta configurar `tailscale serve` si `ENABLE_TAILSCALE_SERVE=1`
- falla si `REMOTE_BACKEND_BASE_URL` esta configurado

Desarrollo con HTTPS:

```bash
./dev.sh
```

### Verificacion

- abrir `http://127.0.0.1:8090`
- o consultar `GET /api/health`
- el estado esperado es `ok`

## Modo 2: cliente proxy

Usar este modo cuando la maquina local no debe instalar Ollama, Whisper ni Kokoro.

### Requisitos

- `venv/` disponible
- acceso de red al servidor central en `http://IP-DEL-SERVIDOR:8090`
- o acceso a un dominio publicado por Tailscale Serve, por ejemplo `https://tu-servidor.tu-tailnet.ts.net`

### Instalacion

```bash
venv/bin/python -m pip install -r requirements.proxy.txt
```

### Configuracion obligatoria

Crear `.env` en la raiz del repo con:

```dotenv
APP_HOST=0.0.0.0
APP_PORT=8090
REMOTE_BACKEND_BASE_URL=http://IP-DEL-SERVIDOR-CENTRAL:8090
```

Ejemplo usando Tailscale Serve en el servidor central:

```dotenv
APP_HOST=0.0.0.0
APP_PORT=8090
REMOTE_BACKEND_BASE_URL=https://tu-servidor.tu-tailnet.ts.net
```

Importante:

- si se usa Tailscale Serve con `--https=443`, no agregar `:8090`
- si se usa acceso directo por LAN sin Tailscale Serve, usar `http://IP:8090`

No instalar Ollama. No descargar modelos. No instalar `faster-whisper`. No instalar `kokoro`.

### Arranque

Produccion simple:

```bash
venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8090
```

Desarrollo con HTTPS:

```bash
./dev.sh
```

### Verificacion

- abrir `http://127.0.0.1:8090`
- grabar audio desde el navegador local
- confirmar que `GET /api/health` responde usando el estado del servidor central
- si usas Tailscale Serve, confirmar que `https://tu-servidor.tu-tailnet.ts.net/api/health` responde desde una maquina de la misma tailnet

## Comportamiento esperado en proxy

Cuando `REMOTE_BACKEND_BASE_URL` tiene valor:

- no se cargan Whisper, Ollama ni Kokoro localmente
- `POST /api/tutor` se reenvia al servidor central
- `GET /api/health` se reenvia al servidor central
- `GET /generated/*` se sirve por proxy desde el servidor central

## Que no debe asumir un agente

- no asumir que todas las maquinas deben instalar modelos
- no asumir que el proyecto siempre corre en modo local completo
- no asumir que hay que tocar el frontend para cambiar entre `server` y `proxy`

## Decision rapida para un agente

1. Revisar si existe `.env`.
2. Leer `REMOTE_BACKEND_BASE_URL`.
3. Si tiene valor, instalar `requirements.proxy.txt` y levantar como `proxy`.
4. Si esta vacio, instalar `requirements.server.txt` y levantar como `server`.

## Ejemplo recomendado para un entorno con Tailscale

Servidor central en esta maquina:

- FastAPI local en `http://127.0.0.1:8090`
- publicado por Tailscale Serve en `https://tu-servidor.tu-tailnet.ts.net`

Cliente proxy en otra maquina:

```dotenv
REMOTE_BACKEND_BASE_URL=https://tu-servidor.tu-tailnet.ts.net
```

## Frontend en React (en desarrollo, no reemplaza `backend/static/` todavia)

Existe una migracion en progreso a React + TypeScript + Vite + Mantine en
`frontend/`. `backend/static/` (vanilla HTML/CSS/JS) sigue siendo el frontend de
produccion y no se toca hasta que el de React quede validado. El backend no
cambio: ambos frontends hablan con la misma API (`/api/*`, `/generated/*`).

Forma recomendada, un solo comando (levanta el backend en HTTP plano, espera
a que responda, y recien ahi arranca Vite; Ctrl+C baja los dos):

```bash
./dev-react.sh
```

O a mano, en dos terminales:

```bash
# Terminal 1: backend en HTTP plano (sin el certificado autofirmado de dev.sh)
venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8090 --reload

# Terminal 2: Vite, con proxy de /api y /generated hacia :8090
cd frontend
npm install
npm run dev   # http://localhost:5173
```

`http://localhost` se trata como contexto seguro por el navegador, asi que el
microfono funciona sin HTTPS local en este modo. No hace falta usar `dev.sh`
para el frontend de React (ese script sigue sirviendo solo el vanilla con
HTTPS).
