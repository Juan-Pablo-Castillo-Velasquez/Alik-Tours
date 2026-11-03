// FLUJO CRÍTICO 1 (semana 7): iniciar sesión.
// Autor: Juan Pablo Castillo.
//
// Por qué es crítico: es la puerta a reservas, pagos y datos personales.
// Si falla, ningún cliente puede gestionar su viaje.
import { test, expect } from './fixtures.js';
import { ModalLogin } from './paginas/ModalLogin.js';
import { SESION_CLIENTE, crearClienteVerificado, registrarCuenta } from './support/api.js';

test.describe('Iniciar sesión', () => {
  test('una persona con la cuenta verificada entra y llega a su perfil', async ({ page, request }) => {
    // Arrange: la cuenta se crea por API (lo que se prueba es el login, no el registro)
    const cuenta = await crearClienteVerificado(request);
    const login = new ModalLogin(page);
    await login.abrir();

    // Act
    await login.iniciarSesion(cuenta.correo, cuenta.password);

    // Assert: aserciones web-first (esperan solas el redirect de 1,8 s)
    await expect(page).toHaveURL(/\/profile$/);
    await expect(login.dialogo).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy();
  });

  test('una cuenta que no ha confirmado su correo no entra y se le pide el código', async ({ page, request }) => {
    const cuenta = await registrarCuenta(request); // sin verificar
    const login = new ModalLogin(page);
    await login.abrir();

    await login.iniciarSesion(cuenta.correo, cuenta.password);

    await expect(page.getByRole('dialog', { name: 'Confirma tu correo' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/profile/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('con la contraseña equivocada muestra el error y se puede reintentar', async ({ page, request }) => {
    const cuenta = await crearClienteVerificado(request);
    const login = new ModalLogin(page);
    await login.abrir();

    await login.iniciarSesion(cuenta.correo, 'ClaveEquivocada1');
    await expect(login.error).toHaveText('Credenciales inválidas');

    // Al corregir la contraseña el error desaparece y entra
    await login.password.fill(cuenta.password);
    await expect(login.error).toBeHidden();
    await login.botonEntrar.click();
    await expect(page).toHaveURL(/\/profile$/);
  });
});

test.describe('Con la sesión ya preparada (storageState)', () => {
  test.use({ storageState: SESION_CLIENTE });

  test('entrar a /profile no vuelve a pedir credenciales', async ({ page }) => {
    await page.goto('/profile');

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('dialog', { name: 'Bienvenido de nuevo' })).toBeHidden();
  });
});

test.describe('Defectos de tiempos', () => {
  test('doble clic en "Iniciar sesión" con el API lento envía UNA sola petición', async ({ page, request }) => {
    // Arrange: el POST /auth/login tarda 1,5 s en responder
    const cuenta = await crearClienteVerificado(request);
    let peticiones = 0;
    await page.route('**/auth/login', async (route) => {
      peticiones += 1;
      await new Promise((r) => setTimeout(r, 1500)); // retraso de la RED simulada, no del test
      await route.continue();
    });
    const login = new ModalLogin(page);
    await login.abrir();
    await login.correo.fill(cuenta.correo);
    await login.password.fill(cuenta.password);

    // Act
    await login.botonEntrar.dblclick();

    // Assert
    await expect(page).toHaveURL(/\/profile$/);
    expect(peticiones).toBe(1);
  });
});
