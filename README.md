# Gestor de tareas

Aplicación de gestión de tareas con React, Express, MongoDB y sesiones. La API limita las tareas al usuario autenticado y valida las operaciones en el servidor.

## Requisitos

- Node.js 24.x y npm incluidos con Node.js.
- Docker Desktop con Docker Compose v2 para MongoDB y para ejecutar la aplicación completa.
- Git, si se desea clonar el proyecto.

Comprueba las versiones con `node --version`, `npm --version` y `docker compose version`.

## Preparación de variables de entorno

No compartas ni subas los archivos `.env`; contienen credenciales locales. Git los excluye. Usa las plantillas y completa los valores en tu equipo:

- Raíz del proyecto: copia `.env.example` a `.env`. Lo utiliza Docker Compose para configurar MongoDB. Define credenciales propias para MongoDB.
- `backend`: copia `backend/.env.example` a `backend/.env`. Define `MONGO_URI`, `SESSION_SECRET`, `APP_ORIGIN` y las contraseñas ficticias de Alice y Bob. La contraseña de la cuenta MongoDB `app` en `MONGO_URI` debe coincidir con `APP_DB_PASSWORD` del `.env` de la raíz.
- `backend`: copia `backend/.env.test.example` a `backend/.env.test` y configura el URI para la base exclusiva `pps14_test`. No cambies ese nombre por `pps14`: las pruebas pueden limpiar sus propios datos de laboratorio.

En PowerShell, desde la raíz del proyecto:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item backend/.env.test.example backend/.env.test
```

Edita los tres archivos y sustituye todos los valores de ejemplo antes de continuar. Usa una clave aleatoria de al menos 32 caracteres para la sesión. No reutilices contraseñas reales.

## Instalación y ejecución local

Instala las dependencias según los archivos de bloqueo, desde la raíz:

```powershell
cd backend
npm ci
cd ../frontend
npm ci
cd ..
```

Inicia MongoDB en una terminal, desde la raíz:

```powershell
docker compose up -d
```

Prepara los usuarios ficticios y arranca el backend en otra terminal:

```powershell
cd backend
npm.cmd run seed
npm.cmd run dev
```

El seed crea o actualiza los usuarios ficticios `alice` y `bob` usando las contraseñas definidas localmente en `backend/.env`; no imprime ni guarda contraseñas en claro en la base de datos.

Arranca el frontend en una tercera terminal:

```powershell
cd frontend
npm.cmd run dev
```

Abre <http://localhost:5173>. Vite envía las rutas `/api` al backend local. La API está en <http://localhost:3000>; su comprobación de salud es <http://localhost:3000/api/health>.

Para parar MongoDB local sin eliminar sus datos:

```powershell
docker compose down
```

## Pruebas y compilación

Con `backend/.env.test` configurado y MongoDB disponible:

```powershell
cd backend
npm.cmd test
```

Las pruebas de integración utilizan la base `pps14_test`, separada de la base local de la aplicación. Para compilar React:

```powershell
cd frontend
npm.cmd run build
```

## Ejecución completa con Docker

Completa `.env` de la raíz con los valores que solicita `.env.example`, detén el backend local si ocupa el puerto 3000 y ejecuta desde la raíz:

```powershell
docker compose -f compose.yaml -f compose.full.yaml up -d --build
docker compose -f compose.yaml -f compose.full.yaml ps
docker compose -f compose.yaml -f compose.full.yaml logs --tail 30 app
```

Espera a que los registros indiquen que Express está disponible. Abre <http://localhost:3000>. Si es una instalación con un volumen nuevo, prepara los usuarios ficticios con:

```powershell
docker compose -f compose.yaml -f compose.full.yaml exec app node scripts/seed.cjs
```

Para detener toda la aplicación conservando el volumen de MongoDB:

```powershell
docker compose -f compose.yaml -f compose.full.yaml down
```

Ambos comandos `down` conservan el volumen persistente mientras no se añada `-v`. Eliminar el volumen borra los datos guardados en MongoDB.

## Configuración relevante

- Backend CommonJS; frontend React con módulos ES.
- Cuerpos JSON limitados a 16 KB y login limitado a 60 intentos por minuto y por IP.
- Las sesiones de producción local se almacenan en MongoDB; las pruebas usan MemoryStore.
- `backend/README.md` documenta detalles de seguridad, validación, sesiones y límites de la API. `frontend/README.md` contiene instrucciones adicionales del cliente.
