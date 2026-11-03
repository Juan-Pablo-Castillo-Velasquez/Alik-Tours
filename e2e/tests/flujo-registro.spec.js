// FLUJO CRÍTICO 3 (semana 7): crear una cuenta.
// Autor: Cristian Sinisterra.
//
// Por qué es crítico: maneja datos personales (cédula, celular) y es la
// puerta de entrada de cada cliente nuevo. Si se rompe, la agencia no
// consigue clientes en línea; si guarda mal, quedan cuentas a medias.
import { test, expect } from './fixtures.js';
import { ModalRegistro } from './paginas/ModalRegistro.js';
import { PASSWORD_E2E, cedulaUnica, codigoDeVerificacion, correoUnico, crearClienteConCedula, registrarCuenta } from './support/api.js';

test.describe('Crear una cuenta', () => {
  test('una persona nueva se registra, confirma el código del correo y queda en su perfil', async ({ page, request }) => {
    // Arrange
    const correo = correoUnico('registro');
    const registro = new ModalRegistro(page);
    await registro.abrir();

    // Act: los cuatro pasos por la interfaz (es lo que se prueba)
    await registro.pasoCuenta(correo, PASSWORD_E2E);
    await registro.pasoDatos({ cedula: cedulaUnica() });
    await registro.aceptarTerminos();
    await registro.botonCrear.click();
    await expect(page.getByRole('dialog', { name: 'Confirma tu correo' })).toBeVisible();
    await registro.escribirCodigo(await codigoDeVerificacion(request, correo));

    // Assert: se verifica sola al completar el código y entra al perfil
    await expect(page).toHaveURL(/\/profile$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('usuario') ?? '{}').id_cliente)).toBeTruthy();
  });

  test('con un correo ya registrado avisa y no pasa a la verificación', async ({ page, request }) => {
    const { correo } = await registrarCuenta(request);
    const registro = new ModalRegistro(page);
    await registro.abrir();

    await registro.pasoCuenta(correo, PASSWORD_E2E);
    await registro.pasoDatos({ cedula: cedulaUnica() });
    await registro.aceptarTerminos();
    await registro.botonCrear.click();

    await expect(registro.error).toHaveText('El correo electrónico ya está registrado');
    await expect(page.getByRole('dialog', { name: 'Confirma tu correo' })).toBeHidden();
  });

  test('sin aceptar los términos no deja crear la cuenta', async ({ page }) => {
    const registro = new ModalRegistro(page);
    await registro.abrir();

    await registro.pasoCuenta(correoUnico('terminos'), PASSWORD_E2E);
    await registro.pasoDatos({ cedula: cedulaUnica() });

    await expect(registro.botonCrear).toBeDisabled();
  });

  // INCIDENCIA (hallazgo de la semana 7): el registro crea la CUENTA y
  // después el PERFIL de cliente en dos peticiones separadas. Si la cédula
  // ya existe, la cuenta queda creada sin perfil, y al corregir la cédula
  // el segundo intento falla con "El correo electrónico ya está
  // registrado": la persona queda bloqueada. Registrar en el repo como
  // incidencia y reemplazar "#N" por su número. test.fail(): el test
  // describe el comportamiento CORRECTO y hoy falla; cuando se corrija,
  // Playwright avisará para quitar la marca.
  test('una cédula repetida se puede corregir sin que la cuenta quede a medias (incidencia #N)', async ({ page, request }) => {
    test.fail(true, 'Incidencia #N: el registro deja la cuenta creada sin perfil de cliente');
    const cedulaOcupada = cedulaUnica();
    await crearClienteConCedula(request, cedulaOcupada);
    const registro = new ModalRegistro(page);
    await registro.abrir();
    await registro.pasoCuenta(correoUnico('cedula'), PASSWORD_E2E);
    await registro.pasoDatos({ cedula: cedulaOcupada });
    await registro.aceptarTerminos();
    await registro.botonCrear.click();
    await expect(registro.error).toHaveText('Cliente con esa cédula ya existe');

    // La persona vuelve, corrige la cédula y lo intenta de nuevo
    await registro.dialogo.getByRole('button', { name: 'Atrás' }).click();
    await registro.dialogo.getByLabel('Cédula').fill(cedulaUnica());
    await registro.dialogo.getByRole('button', { name: 'Continuar' }).click();
    await registro.botonCrear.click();

    await expect(page.getByRole('dialog', { name: 'Confirma tu correo' })).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Defectos de tiempos', () => {
  test('doble clic en "Crear cuenta" con el API lento crea UNA sola cuenta', async ({ page }) => {
    // Arrange: el POST /auth/register tarda 1,5 s (red simulada)
    let registros = 0;
    await page.route('**/auth/register', async (route) => {
      registros += 1;
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    const registro = new ModalRegistro(page);
    await registro.abrir();
    await registro.pasoCuenta(correoUnico('doble'), PASSWORD_E2E);
    await registro.pasoDatos({ cedula: cedulaUnica() });
    await registro.aceptarTerminos();

    // Act
    await registro.botonCrear.dblclick();

    // Assert
    await expect(page.getByRole('dialog', { name: 'Confirma tu correo' })).toBeVisible();
    expect(registros).toBe(1);
  });
});
