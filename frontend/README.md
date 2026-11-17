# Interfaz de Tanda

Inicia primero MongoDB y el backend desde sus terminales. Después, desde `frontend`, ejecuta:

```powershell
npm.cmd run dev
```

Si vienes de la terminal del backend, usa `cd ../frontend`. La interfaz estará en <http://localhost:5173>. Vite fija el puerto 5173 y reenvía las rutas relativas `/api` al backend local en `127.0.0.1:3000`, conservando el encabezado `Origin`.

El cliente realiza las llamadas con `credentials: 'same-origin'`, solicita un token CSRF antes del login y vuelve a solicitarlo después. Las cookies de sesión se mantienen en el navegador; la aplicación no guarda contraseñas en `localStorage`.
