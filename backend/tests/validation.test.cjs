const { validateRegistration, validateTask, validateTaskPatch } = require('../src/validation');

describe('validateTask para creación', () => {
  test('normaliza título y aplica description/status predeterminados', () => {
    expect(validateTask({ title: '  Informe  ' })).toEqual({
      ok: true,
      errors: [],
      value: { title: 'Informe', description: '', status: 'pendiente' },
    });
  });

  test('acepta texto y estados admitidos sin añadir ni transformar campos', () => {
    expect(validateTask({ title: '  Informe  ', description: 'Resumen', status: 'completado' })).toEqual({
      ok: true,
      errors: [],
      value: { title: 'Informe', description: 'Resumen', status: 'completado' },
    });
  });

  test('rechaza cuerpos no objeto, owner, propiedades desconocidas, tipos y longitudes inválidos', () => {
    expect(validateTask(null)).toMatchObject({ ok: false, errors: expect.any(Array) });
    const invalid = validateTask({ title: {}, description: {}, status: 'hecho', owner: 'otro', extra: true });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toHaveLength(5);
    expect(invalid.value).toBeNull();
    expect(validateTask({ title: 'x'.repeat(81) }).ok).toBe(false);
    expect(validateTask({ title: 'Tarea', description: 'x'.repeat(501) }).ok).toBe(false);
  });

  test('U2. Rechaza un título vacío', () => {
    const result = validateTask({ title: '' });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.value).toBeNull();
  });

  test('U4. Rechaza un título compuesto solo por espacios', () => {
    const result = validateTask({ title: '   ' });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.value).toBeNull();
  });

  test('U5. Acepta un título de 80 caracteres y rechaza uno de 81', () => {
    const atLimit = validateTask({ title: 'x'.repeat(80) });
    const overLimit = validateTask({ title: 'x'.repeat(81) });

    expect(atLimit).toEqual({
      ok: true,
      errors: [],
      value: { title: 'x'.repeat(80), description: '', status: 'pendiente' },
    });
    expect(overLimit.ok).toBe(false);
    expect(overLimit.errors.length).toBeGreaterThan(0);
    expect(overLimit.value).toBeNull();
  });

  test('U6. Rechaza un estado que no está permitido', () => {
    const result = validateTask({ title: 'Preparar práctica', status: 'invalido' });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.value).toBeNull();
  });
});

describe('validateTaskPatch para actualización parcial', () => {
  test('valida solo los campos presentes y no agrega defaults de creación', () => {
    expect(validateTaskPatch({ status: 'completado' })).toEqual({ ok: true, errors: [], value: { status: 'completado' } });
    expect(validateTaskPatch({ title: '  Ajustada  ' })).toEqual({ ok: true, errors: [], value: { title: 'Ajustada' } });
  });

  test('rechaza cuerpo vacío, owner, objetos en campos de texto y valores inválidos', () => {
    expect(validateTaskPatch({}).ok).toBe(false);
    expect(validateTaskPatch({ owner: 'otro' }).ok).toBe(false);
    expect(validateTaskPatch({ description: { text: 'no' } }).ok).toBe(false);
    expect(validateTaskPatch({ title: '   ' }).ok).toBe(false);
    expect(validateTaskPatch({ status: 'desconocido' }).ok).toBe(false);
  });
});

test('la validación de registro conserva exactamente los espacios de la contraseña', () => {
  const result = validateRegistration({ username: 'usuario', email: 'u@example.com', password: '  clave segura  ' });
  expect(result.errors).toEqual([]);
  expect(result.value.password).toBe('  clave segura  ');
});
