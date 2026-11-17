const mongoose = require('mongoose');
const request = require('supertest');
const session = require('express-session');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const mongoUri = process.env.MONGODB_TEST_URI;

jest.setTimeout(30000);

describe('API de autenticación', () => {
  let app;
  let agent;
  let sessionStore;
  let testDatabaseVerified = false;

  beforeAll(async () => {
    if (!mongoUri) throw new Error('Define MONGODB_TEST_URI para ejecutar las pruebas de integración de autenticación.');
    const parsed = new URL(mongoUri);
    if (parsed.protocol !== 'mongodb:' || parsed.pathname.replace(/\/$/, '') !== '/pps14_test') {
      throw new Error('Las pruebas de autenticación solo pueden utilizar la base pps14_test.');
    }
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    if (mongoose.connection.name !== 'pps14_test') throw new Error('La conexión de autenticación no corresponde a pps14_test.');
    testDatabaseVerified = true;
    sessionStore = new session.MemoryStore();
    app = createApp({ sessionStore, sessionSecret: 'test-session-secret-that-is-long-enough-123456', allowedOrigin: 'http://localhost:5173' });
  });

  beforeEach(async () => {
    if (!testDatabaseVerified) throw new Error('Base de pruebas no verificada; no se limpiarán colecciones.');
    await User.deleteMany({});
    agent = request.agent(app);
  });

  afterAll(async () => {
    try {
      if (testDatabaseVerified && mongoose.connection.readyState === 1) await User.deleteMany({});
      if (sessionStore) await new Promise((resolve, reject) => sessionStore.clear((error) => error ? reject(error) : resolve()));
    } finally {
      await mongoose.disconnect();
    }
  });

  async function csrf() {
    const response = await agent.get('/api/auth/csrf').expect(200);
    return response.body.csrfToken;
  }

  test('registra con password hasheada y devuelve identidad pública', async () => {
    const token = await csrf();
    const response = await agent.post('/api/auth/register').set('X-CSRF-Token', token)
      .send({ username: 'sergio', email: 'Sergio@example.com', password: 'Clave-segura-123' }).expect(201);
    expect(response.body).toEqual({ user: { id: expect.any(String), username: 'sergio' } });
    const stored = await User.findById(response.body.user.id).select('+passwordHash');
    expect(stored.email).toBe('sergio@example.com');
    expect(stored.passwordHash).not.toBe('Clave-segura-123');
    expect(response.body).not.toHaveProperty('passwordHash');
    await agent.get('/api/auth/me').expect(200, { user: { id: response.body.user.id, username: 'sergio' } });
  });

  test('permite login por username o correo y rechaza credenciales incorrectas', async () => {
    await User.create({ username: 'sergio', email: 'sergio@example.com', passwordHash: await require('bcryptjs').hash('Clave-segura-123', 4) });
    for (const [field, identifier] of [['username', 'sergio'], ['identifier', 'sergio@example.com']]) {
      const client = request.agent(app);
      const token = (await client.get('/api/auth/csrf').expect(200)).body.csrfToken;
      const response = await client.post('/api/auth/login').set('X-CSRF-Token', token).send({ [field]: identifier, password: 'Clave-segura-123' }).expect(200);
      expect(response.body).toEqual({ user: { id: String((await User.findOne({ username: 'sergio' }))._id), username: 'sergio' } });
      const newToken = (await client.get('/api/auth/csrf').expect(200)).body.csrfToken;
      expect(newToken).not.toBe(token);
    }
    const invalidClient = request.agent(app);
    const invalidToken = (await invalidClient.get('/api/auth/csrf').expect(200)).body.csrfToken;
    await invalidClient.post('/api/auth/login').set('X-CSRF-Token', invalidToken).send({ identifier: 'sergio', password: 'incorrecta' }).expect(401);
  });

  test('protege rutas privadas, CSRF y duplicados', async () => {
    await agent.get('/api/auth/me').expect(401);
    await agent.post('/api/auth/register').send({}).expect(403);
    let token = await csrf();
    const payload = { username: 'sergio', email: 'sergio@example.com', password: 'Clave-segura-123' };
    await agent.post('/api/auth/register').set('X-CSRF-Token', token).send(payload).expect(201);
    token = await csrf();
    await agent.post('/api/auth/register').set('X-CSRF-Token', token).send(payload).expect(409);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', token).expect(204);
    const invalidClient = request.agent(app);
    const invalidToken = (await invalidClient.get('/api/auth/csrf').expect(200)).body.csrfToken;
    await invalidClient.post('/api/auth/register').set('X-CSRF-Token', invalidToken).send({ username: 'x', email: 'bad', password: 'x' }).expect(400);
  });

  test('expone health, rechaza token CSRF incorrecto y destruye la sesión al salir', async () => {
    await request(app).get('/api/health').expect(200, { ok: true });
    const token = await csrf();
    await agent.post('/api/auth/register').set('X-CSRF-Token', token)
      .send({ username: 'salida', email: 'salida@example.com', password: 'Clave-segura-123' }).expect(201);
    const rotatedToken = await csrf();
    await agent.post('/api/auth/logout').set('X-CSRF-Token', 'token-incorrecto').expect(403);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', rotatedToken).expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  test('rechaza correo duplicado aunque el username sea distinto', async () => {
    await User.create({ username: 'primero', email: 'mismo@example.com', passwordHash: 'hash-de-prueba' });
    const token = await csrf();
    await agent.post('/api/auth/register').set('X-CSRF-Token', token)
      .send({ username: 'segundo', email: 'MISMO@example.com', password: 'Clave-segura-123' }).expect(409);
  });

  test('emite cookie HttpOnly SameSite Strict, valida Origin y devuelve 413 para cuerpos grandes', async () => {
    const csrfResponse = await agent.get('/api/auth/csrf').expect(200);
    const cookie = csrfResponse.headers['set-cookie'].join('; ');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    await agent.post('/api/auth/register').set('Origin', 'http://sitio-ajeno.test')
      .set('X-CSRF-Token', csrfResponse.body.csrfToken)
      .send({ username: 'origen', email: 'origen@example.com', password: 'Clave-segura-123' })
      .expect(403, { error: 'Origen no permitido.' });
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: 'x', password: 'x'.repeat(17 * 1024) }))
      .expect(413, { error: 'El cuerpo supera el límite permitido de 16 KB.' });
  });

  test('limita el login a 60 intentos por minuto por IP y responde 429', async () => {
    const limitedApp = createApp({
      sessionStore: new session.MemoryStore(),
      sessionSecret: 'test-session-secret-that-is-long-enough-123456',
      allowedOrigin: 'http://localhost:5173',
    });
    const client = request.agent(limitedApp);
    const token = (await client.get('/api/auth/csrf').expect(200)).body.csrfToken;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await client.post('/api/auth/login').set('X-CSRF-Token', token)
        .send({ username: 'no-existe', password: 'incorrecta' }).expect(401);
    }
    await client.post('/api/auth/login').set('X-CSRF-Token', token)
      .send({ username: 'no-existe', password: 'incorrecta' })
      .expect(429, { error: 'Demasiados intentos de inicio de sesión. Espera un minuto y vuelve a intentarlo.' });
  });
});
