const mongoose = require('mongoose');
const request = require('supertest');
const session = require('express-session');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const bcrypt = require('bcryptjs');

const mongoUri = process.env.MONGODB_TEST_URI;
jest.setTimeout(30000);

describe('API de tareas', () => {
  let app;
  let sessionStore;
  let alice;
  let bob;
  let aliceAgent;
  let bobAgent;
  let anonymous;
  let aliceCsrf;
  let bobCsrf;
  let testDatabaseVerified = false;

  beforeAll(async () => {
    if (!mongoUri) throw new Error('Define MONGODB_TEST_URI para ejecutar las pruebas de integración de tareas.');
    const parsed = new URL(mongoUri);
    if (parsed.protocol !== 'mongodb:' || parsed.pathname.replace(/\/$/, '') !== '/pps14_test') {
      throw new Error('Las pruebas de tareas solo pueden utilizar la base pps14_test.');
    }
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    if (mongoose.connection.name !== 'pps14_test') throw new Error('La conexión de tareas no corresponde a pps14_test.');
    testDatabaseVerified = true;
    sessionStore = new session.MemoryStore();
    app = createApp({ sessionStore, sessionSecret: 'test-session-secret-that-is-long-enough-123456', allowedOrigin: 'http://localhost:5173' });
  });

  beforeEach(async () => {
    if (!testDatabaseVerified) throw new Error('Base de pruebas no verificada; no se limpiarán colecciones.');
    await Task.deleteMany({});
    await User.deleteMany({});
    alice = await User.create({ username: 'ana', email: 'ana@example.com', passwordHash: await bcrypt.hash('Clave-ana-123', 4) });
    bob = await User.create({ username: 'bruno', email: 'bruno@example.com', passwordHash: await bcrypt.hash('Clave-bruno-123', 4) });
    aliceAgent = request.agent(app);
    bobAgent = request.agent(app);
    anonymous = request.agent(app);
    aliceCsrf = await login(aliceAgent, 'ana');
    bobCsrf = await login(bobAgent, 'bruno');
  });

  afterAll(async () => {
    try {
      if (testDatabaseVerified && mongoose.connection.readyState === 1) {
        await Task.deleteMany({});
        await User.deleteMany({});
      }
      if (sessionStore) await new Promise((resolve, reject) => sessionStore.clear((error) => error ? reject(error) : resolve()));
    } finally {
      await mongoose.disconnect();
    }
  });

  async function login(agent, username) {
    const token = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;
    const user = username === 'ana' ? { password: 'Clave-ana-123' } : { password: 'Clave-bruno-123' };
    const response = await agent.post('/api/auth/login').set('X-CSRF-Token', token).send({ username, ...user }).expect(200);
    const refreshed = await agent.get('/api/auth/csrf').expect(200);
    expect(response.body).toEqual({ user: { id: expect.any(String), username } });
    return refreshed.body.csrfToken;
  }

  test('asigna owner desde la sesión, lista solo propias y filtra por estado', async () => {
    await aliceAgent.post('/api/tasks').set('X-CSRF-Token', aliceCsrf)
      .send({ title: 'Informe', owner: String(bob._id) }).expect(400);
    const created = await aliceAgent.post('/api/tasks').set('X-CSRF-Token', aliceCsrf)
      .send({ title: '  Informe  ' }).expect(201);
    expect(created.body.task).toEqual({ id: expect.any(String), title: 'Informe', description: '', status: 'pendiente' });
    const stored = await Task.findById(created.body.task.id);
    expect(String(stored.owner)).toBe(String(alice._id));
    await Task.create({ title: 'Tarea de Bruno', owner: bob._id, status: 'pendiente' });
    await Task.create({ title: 'Terminada', owner: alice._id, status: 'completado' });
    const list = await aliceAgent.get('/api/tasks').expect(200);
    expect(list.body.tasks.map((task) => task.title).sort()).toEqual(['Informe', 'Terminada']);
    expect((await aliceAgent.get('/api/tasks?status=pendiente').expect(200)).body.tasks.map((task) => task.title)).toEqual(['Informe']);
    expect((await aliceAgent.get('/api/tasks?status=invalid').expect(400)).body.errors).toBeDefined();
  });

  test('permite al owner editar y borrar; deniega tareas de otros con 404', async () => {
    const own = await Task.create({ title: 'Propia', owner: alice._id });
    const foreign = await Task.create({ title: 'Ajena', owner: bob._id });
    await aliceAgent.patch(`/api/tasks/${own.id}`).set('X-CSRF-Token', aliceCsrf).send({ status: 'en_progreso' }).expect(200)
      .then((r) => expect(r.body.task.status).toBe('en_progreso'));
    await aliceAgent.patch(`/api/tasks/${foreign.id}`).set('X-CSRF-Token', aliceCsrf).send({ title: 'Toma' }).expect(404);
    await aliceAgent.delete(`/api/tasks/${foreign.id}`).set('X-CSRF-Token', aliceCsrf).expect(404);
    await aliceAgent.delete(`/api/tasks/${own.id}`).set('X-CSRF-Token', aliceCsrf).expect(204);
    expect(await Task.exists({ _id: foreign._id })).not.toBeNull();
  });

  test('I5. Elimina una tarea propia y comprueba que ya no persiste en MongoDB', async () => {
    const { body: { task } } = await aliceAgent.post('/api/tasks').set('X-CSRF-Token', aliceCsrf)
      .send({ title: 'Tarea para eliminar' }).expect(201);
    expect(await Task.findById(task.id)).not.toBeNull();

    await aliceAgent.delete(`/api/tasks/${task.id}`).set('X-CSRF-Token', aliceCsrf).expect(204);

    expect(await Task.findById(task.id)).toBeNull();
  });

  test('comprueba autenticación antes de CSRF y valida campos e identificadores', async () => {
    await anonymous.post('/api/tasks').send({ title: 'Anónimo' }).expect(401);
    await anonymous.patch('/api/tasks/bad').send({ title: 'Anónimo' }).expect(401);
    await anonymous.delete('/api/tasks/bad').expect(401);
    await aliceAgent.post('/api/tasks').send({ title: 'Sin token' }).expect(403);
    await aliceAgent.post('/api/tasks').set('X-CSRF-Token', aliceCsrf).send({ title: '   ' }).expect(400);
    await aliceAgent.patch('/api/tasks/not-an-id').set('X-CSRF-Token', aliceCsrf).send({ title: 'Ok' }).expect(400);
    await aliceAgent.patch(`/api/tasks/${new mongoose.Types.ObjectId()}`).set('X-CSRF-Token', aliceCsrf).send({ owner: String(bob._id) }).expect(400);
  });
});
