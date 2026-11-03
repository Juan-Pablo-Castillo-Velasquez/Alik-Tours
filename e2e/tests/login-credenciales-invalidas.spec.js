// Flujo: inicio de sesión con contraseña incorrecta.
// Autor (semana 1, capa E2E): Juan Pablo Castillo.
//
// Por qué es crítico: el login es la puerta a reservas, pagos y datos
// personales. Si un error de credenciales no se muestra (o, peor, deja
// entrar), la persona no sabe qué pasó o queda expuesta su cuenta.
import { test, expect } from './fixtures.js';

test('muestra "Credenciales inválidas" y no deja entrar con una contraseña incorrecta', async ({ page }) => {
  // Arrange: /login abre el modal de inicio de sesión sobre el home.
  // El correo es único en cada corrida: nunca coincide con una cuenta real.
  const correo = `nadie.${Date.now()}@alektours.test`;
  await page.goto('/login');
  const dialogo = page.getByRole('dialog', { name: 'Bienvenido de nuevo' });
  await expect(dialogo).toBeVisible();

  // Act
  await dialogo.getByLabel('Correo electrónico').fill(correo);
  await dialogo.getByLabel('Contraseña', { exact: true }).fill('ClaveIncorrecta123');
  await dialogo.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Assert: lo que ve la persona usuaria
  await expect(dialogo.getByRole('alert')).toHaveText('Credenciales inválidas');
  await expect(dialogo).toBeVisible();
  await expect(page).not.toHaveURL(/\/profile|\/admin/);
});
