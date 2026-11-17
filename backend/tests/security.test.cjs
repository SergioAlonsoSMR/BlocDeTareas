const request = require('supertest');
const session = require('express-session');
const { createApp } = require('../src/app');

const app = createApp({
  sessionStore: new session.MemoryStore(),
  sessionSecret: 'test-session-secret-that-is-long-enough-123456',
  allowedOrigin: 'http://localhost:5173',
});

describe('controles del apartado 3.3', () => {
  test('emite CSRF guardado con cookie HttpOnly, SameSite Strict y sin HSTS local', async () => {
    const response = await request(app).get('/api/auth/csrf').expect(200);
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Strict/i);
    expect(response.headers['set-cookie'][0]).not.toMatch(/; Secure/i);
    expect(response.headers['strict-transport-security']).toBeUndefined();
    expect(response.headers['content-security-policy']).not.toMatch(/upgrade-insecure-requests/i);
  });

  test('rechaza Origin ajeno cuando viene en una operación protegida', async () => {
    await request(app).post('/api/auth/login').set('Origin', 'http://sitio-ajeno.test')
      .send({ username: 'x', password: 'x' }).expect(403, { error: 'Origen no permitido.' });
  });

  test('devuelve 413 para cuerpos mayores de 16 KB', async () => {
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'x'.repeat(17 * 1024) }))
      .expect(413, { error: 'El cuerpo supera el límite permitido de 16 KB.' });
  });

  test('devuelve 429 tras 60 intentos de login desde la misma IP en un minuto', async () => {
    const limitedApp = createApp({
      sessionStore: new session.MemoryStore(),
      sessionSecret: 'another-test-session-secret-that-is-long-123456',
      allowedOrigin: 'http://localhost:5173',
    });
    const client = request.agent(limitedApp);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await client.post('/api/auth/login').send({ username: 'x', password: 'x' }).expect(403);
    }
    await client.post('/api/auth/login').send({ username: 'x', password: 'x' })
      .expect(429, { error: 'Demasiados intentos de inicio de sesión. Espera un minuto y vuelve a intentarlo.' });
  });
});
