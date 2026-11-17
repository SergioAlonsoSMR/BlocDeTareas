'use strict';

if (!process.env.MONGODB_TEST_URI && process.env.MONGO_URI) {
  try {
    const testUri = new URL(process.env.MONGO_URI);
    if (testUri.pathname.replace(/\/$/, '') === '/pps14') {
      testUri.pathname = '/pps14_test';
      process.env.MONGODB_TEST_URI = testUri.toString();
    }
  } catch {
    // Las pruebas fallarán con un mensaje explícito si la URI de prueba no está configurada.
  }
}

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.cjs'],
  clearMocks: true,
};
