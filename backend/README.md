# Backend local

## Preparación y arranque

Desde `backend`, crea los archivos locales a partir de las plantillas y sustituye sus valores cuando corresponda:

```powershell
Copy-Item .env.example .env
Copy-Item .env.test.example .env.test
```

El valor de contraseña incluido en `MONGO_URI` debe coincidir con `APP_DB_PASSWORD` configurado para MongoDB en el `.env` de la raíz. Sustituye `SESSION_SECRET` por una cadena aleatoria larga. Los dos secretos `ALICE_PASSWORD` y `BOB_PASSWORD` son datos ficticios distintos de al menos 12 caracteres.

Después, desde la raíz del proyecto, inicia MongoDB y, desde `backend`, prepara los usuarios y el servidor:

```powershell
docker compose up -d
cd backend
npm.cmd run seed
npm.cmd run dev
```

El servidor local queda disponible en `http://localhost:3000`. Mantén abierta esa terminal. `npm.cmd start` inicia el servidor sin watch; `npm.cmd test` ejecuta Jest usando `.env.test`, que apunta a `pps14_test`; `npm.cmd run test:ci` usa variables de entorno proporcionadas por el entorno de CI.

Desde otra terminal puedes comprobar el estado con:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

El seed solo crea o actualiza los usuarios ficticios `alice` y `bob` en `pps14`, guarda sus contraseñas con bcrypt y asigna correos `@example.local` al insertarlos. No modifica tareas ni otros usuarios.

## Límites de la API

- Los cuerpos JSON aceptan hasta **16 KB**. Una petición que excede ese tamaño responde con **413**.
- El inicio de sesión permite **60 intentos por minuto y por IP**. El intento número 61 dentro de la ventana responde con **429**. El contador se aplica a `POST /api/auth/login`.

## Validación de tareas

`validateTask(body)` valida las tareas nuevas y devuelve `{ ok, errors, value }`. Acepta `title` como texto obligatorio (hasta 80 caracteres), `description` como texto opcional (hasta 500) y `status` como valor opcional de la enumeración. Recorta espacios exteriores de `title`; si faltan `description` y `status`, aplica `""` y `"pendiente"`. Rechaza `owner`, campos desconocidos, tipos no textuales e incluso objetos donde se espera texto. El servidor asigna el propietario desde la sesión.

PATCH utiliza `validateTaskPatch(body)`, que solo valida y devuelve los campos presentes y nunca añade defaults de creación. Ambas rutas construyen sus datos persistidos desde los valores validados, no desde el cuerpo recibido.

## Sesiones y CSRF

El backend local usa una cookie de sesión `HttpOnly`, `SameSite=Strict`, con duración de ocho horas y `Secure=false` para HTTP en localhost. En producción con HTTPS se debe configurar `COOKIE_SECURE=true`, revisar la confianza en proxy, el origen permitido y el transporte.

Las sesiones de ejecución se guardan mediante `connect-mongo`. Las pruebas inyectan explícitamente `express-session` MemoryStore.

`GET /api/auth/csrf` crea o recupera el token y guarda la sesión antes de responder. Login y registro regeneran la sesión, guardan usuario y token nuevos antes de responder, y mantienen el contrato `{ user: { id, username } }`. El cliente debe solicitar de nuevo `GET /api/auth/csrf` después de login o registro. Las solicitudes `POST`, `PATCH` y `DELETE` protegidas envían `X-CSRF-Token`; cuando llega una cabecera `Origin`, debe coincidir con `APP_ORIGIN`.

## Helmet

Helmet conserva CSP y las demás protecciones, pero desactiva HSTS y `upgrade-insecure-requests` para que el navegador no fuerce HTTPS en el servidor HTTP local. Antes de desplegar con HTTPS, revisar estas opciones y habilitar los ajustes adecuados al TLS y al proxy.
