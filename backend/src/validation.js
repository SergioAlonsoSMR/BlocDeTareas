'use strict';

const USERNAME_RE = /^[\p{L}\p{N}_.-]+$/u;
const TASK_STATUSES = ['pendiente', 'en_progreso', 'completado'];

function validateTask(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['El cuerpo debe ser un objeto JSON.'], value: null };
  }
  const value = { title: '', description: '', status: 'pendiente' };
  const allowed = new Set(['title', 'description', 'status']);
  for (const key of Object.keys(body)) if (!allowed.has(key)) errors.push(`El campo ${key} no está permitido.`);
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 80) errors.push('El título es obligatorio y debe tener como máximo 80 caracteres.');
  else value.title = body.title.trim();
  if (Object.hasOwn(body, 'description')) {
    if (typeof body.description !== 'string' || body.description.length > 500) errors.push('La descripción debe ser texto de hasta 500 caracteres.');
    else value.description = body.description;
  }
  if (Object.hasOwn(body, 'status')) {
    if (!TASK_STATUSES.includes(body.status)) errors.push(`El estado debe ser uno de: ${TASK_STATUSES.join(', ')}.`);
    else value.status = body.status;
  }
  return errors.length ? { ok: false, errors, value: null } : { ok: true, errors: [], value };
}

function validateTaskPatch(body) {
  const errors = [];
  const value = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['El cuerpo debe ser un objeto JSON.'], value: null };
  }
  const allowed = new Set(['title', 'description', 'status']);
  for (const key of Object.keys(body)) if (!allowed.has(key)) errors.push(`El campo ${key} no está permitido.`);
  if (Object.keys(body).length === 0) errors.push('Indica al menos un campo para modificar.');
  if (Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 80) errors.push('El título debe contener entre 1 y 80 caracteres.');
    else value.title = body.title.trim();
  }
  if (Object.hasOwn(body, 'description')) {
    if (typeof body.description !== 'string' || body.description.length > 500) errors.push('La descripción debe ser texto de hasta 500 caracteres.');
    else value.description = body.description;
  }
  if (Object.hasOwn(body, 'status')) {
    if (!TASK_STATUSES.includes(body.status)) errors.push(`El estado debe ser uno de: ${TASK_STATUSES.join(', ')}.`);
    else value.status = body.status;
  }
  return errors.length ? { ok: false, errors, value: null } : { ok: true, errors: [], value };
}

function validateRegistration(body) {
  const errors = [];
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  if (!username || username.length < 3 || username.length > 25 || !USERNAME_RE.test(username)) {
    errors.push('El nombre de usuario debe tener entre 3 y 25 caracteres y solo puede incluir letras, números, punto, guion y guion bajo.');
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Introduce un correo electrónico válido.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) errors.push('La contraseña debe tener entre 8 y 128 caracteres.');
  return { errors, value: { username, email, password } };
}

function validateLogin(body) {
  const errors = [];
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() :
    typeof body?.username === 'string' ? body.username.trim() :
    typeof body?.email === 'string' ? body.email.trim() : '';
  const password = body?.password;
  if (!identifier || identifier.length > 254) errors.push('Introduce tu nombre de usuario o correo.');
  if (typeof password !== 'string' || !password || password.length > 128) errors.push('Introduce tu contraseña.');
  return { errors, value: { identifier, password } };
}

module.exports = { validateRegistration, validateLogin, validateTask, validateTaskPatch, TASK_STATUSES };
