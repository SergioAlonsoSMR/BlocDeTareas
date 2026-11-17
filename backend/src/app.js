'use strict';

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const path = require('node:path');
const User = require('./models/User');
const Task = require('./models/Task');
const { validateRegistration, validateLogin, validateTask, validateTaskPatch, TASK_STATUSES } = require('./validation');

function createApp({ sessionStore, sessionSecret, cookieSecure = false, allowedOrigin } = {}) {
  if (!sessionSecret || typeof sessionSecret !== 'string' || sessionSecret.length < 32) {
    throw new Error('sessionSecret debe tener al menos 32 caracteres.');
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    strictTransportSecurity: false,
  }));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.use(session({
    name: 'task.sid', secret: sessionSecret, store: sessionStore,
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: cookieSecure, sameSite: 'strict', maxAge: 1000 * 60 * 60 * 8 },
  }));

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Demasiados intentos de inicio de sesión. Espera un minuto y vuelve a intentarlo.' }),
  });
  const csrfGuard = (req, res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== allowedOrigin) return res.status(403).json({ error: 'Origen no permitido.' });
    const supplied = req.get('x-csrf-token');
    const expected = req.session.csrfToken;
    if (typeof supplied !== 'string' || typeof expected !== 'string' || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return res.status(403).json({ error: 'Token CSRF inválido o ausente.' });
    }
    next();
  };
  const authRequired = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Autenticación requerida.' });
    next();
  };
  const publicUser = (user) => ({ id: String(user._id), username: user.username });
  const publicTask = (task) => ({ id: String(task._id), title: task.title, description: task.description, status: task.status });
  const validId = (id) => /^[a-f\d]{24}$/i.test(id);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/auth/csrf', (req, res, next) => {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    req.session.save((error) => error ? next(error) : res.json({ csrfToken: req.session.csrfToken }));
  });
  app.post('/api/auth/register', csrfGuard, async (req, res, next) => {
    try {
      const { errors, value } = validateRegistration(req.body);
      if (errors.length) return res.status(400).json({ errors });
      const existing = await User.findOne({ $or: [{ username: value.username }, { email: value.email }] }).lean();
      if (existing) return res.status(409).json({ error: 'El nombre de usuario o correo ya está registrado.' });
      const passwordHash = await bcrypt.hash(value.password, 12);
      let user;
      try { user = await User.create({ username: value.username, email: value.email, passwordHash }); }
      catch (error) {
        if (error?.code === 11000) return res.status(409).json({ error: 'El nombre de usuario o correo ya está registrado.' });
        throw error;
      }
      req.session.regenerate((error) => {
        if (error) return next(error);
        req.session.userId = String(user._id);
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        req.session.save((saveError) => saveError ? next(saveError) : res.status(201).json({ user: publicUser(user) }));
      });
    } catch (error) { next(error); }
  });
  app.post('/api/auth/login', loginLimiter, csrfGuard, async (req, res, next) => {
    try {
      const { errors, value } = validateLogin(req.body);
      if (errors.length) return res.status(400).json({ errors });
      const isEmail = value.identifier.includes('@');
      const query = isEmail ? { email: value.identifier.toLowerCase() } : { username: value.identifier };
      const user = await User.findOne(query).select('+passwordHash');
      const valid = user ? await bcrypt.compare(value.password, user.passwordHash) : false;
      if (!valid) return res.status(401).json({ error: 'Credenciales inválidas.' });
      req.session.regenerate((error) => {
        if (error) return next(error);
        req.session.userId = String(user._id);
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        req.session.save((saveError) => saveError ? next(saveError) : res.json({ user: publicUser(user) }));
      });
    } catch (error) { next(error); }
  });
  app.get('/api/auth/me', authRequired, async (req, res, next) => {
    try {
      const user = await User.findById(req.session.userId).select('username').lean();
      if (!user) return req.session.destroy(() => res.status(401).json({ error: 'Autenticación requerida.' }));
      res.json({ user: publicUser(user) });
    } catch (error) { next(error); }
  });
  app.post('/api/auth/logout', authRequired, csrfGuard, (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('task.sid', { httpOnly: true, secure: cookieSecure, sameSite: 'strict' });
      res.status(204).end();
    });
  });

  app.get('/api/tasks', authRequired, (req, res, next) => {
    if (req.query.status !== undefined && !TASK_STATUSES.includes(req.query.status)) return res.status(400).json({ errors: [`El estado debe ser uno de: ${TASK_STATUSES.join(', ')}.`] });
    Task.find({ owner: req.session.userId, ...(req.query.status ? { status: req.query.status } : {}) }).sort({ createdAt: -1 }).lean()
      .then((tasks) => res.json({ tasks: tasks.map(publicTask) })).catch(next);
  });
  app.post('/api/tasks', authRequired, csrfGuard, async (req, res, next) => {
    try {
      const result = validateTask(req.body);
      if (!result.ok) return res.status(400).json({ errors: result.errors });
      const task = await Task.create({ ...result.value, owner: req.session.userId });
      res.status(201).json({ task: publicTask(task) });
    } catch (error) { next(error); }
  });
  app.patch('/api/tasks/:id', authRequired, csrfGuard, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(400).json({ error: 'Identificador de tarea incorrecto.' });
      const result = validateTaskPatch(req.body);
      if (!result.ok) return res.status(400).json({ errors: result.errors });
      const task = await Task.findOneAndUpdate({ _id: req.params.id, owner: req.session.userId }, { $set: result.value }, { new: true, runValidators: true });
      if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
      res.json({ task: publicTask(task) });
    } catch (error) { next(error); }
  });
  app.delete('/api/tasks/:id', authRequired, csrfGuard, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(400).json({ error: 'Identificador de tarea incorrecto.' });
      const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.session.userId });
      if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  const publicDir = process.env.PUBLIC_DIR || path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));
  app.use((_req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error?.status === 413 || error?.type === 'entity.too.large') return res.status(413).json({ error: 'El cuerpo supera el límite permitido de 16 KB.' });
    if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) return res.status(400).json({ error: 'JSON malformado.' });
    res.status(500).json({ error: 'Error interno del servidor.' });
  });
  return app;
}

module.exports = { createApp };
