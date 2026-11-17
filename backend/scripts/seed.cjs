'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

async function seed() {
  const { MONGO_URI, ALICE_PASSWORD, BOB_PASSWORD } = process.env;
  if (!MONGO_URI || !ALICE_PASSWORD || !BOB_PASSWORD) {
    throw new Error('Faltan variables para inicializar usuarios.');
  }
  if (ALICE_PASSWORD.length < 12 || BOB_PASSWORD.length < 12 || ALICE_PASSWORD === BOB_PASSWORD) {
    throw new Error('Usa dos contraseñas ficticias distintas con al menos 12 caracteres.');
  }

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  if (mongoose.connection.name !== 'pps14') {
    throw new Error('La inicialización solo se permite en pps14.');
  }

  for (const [username, email, password] of [
    ['alice', 'alice@example.local', ALICE_PASSWORD],
    ['bob', 'bob@example.local', BOB_PASSWORD],
  ]) {
    const passwordHash = await bcrypt.hash(password, 12);
    await User.findOneAndUpdate(
      { username },
      { $set: { passwordHash }, $setOnInsert: { email } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }
  console.log('Usuarios ficticios alice y bob preparados.');
}

seed()
  .catch(async () => {
    console.error('No se pudo inicializar: revisa .env y el modelo User.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
