// E2E nacido del análisis de la capa E2E en la semana 8.
// Autor: Cristian Sinisterra.
//
// Al revisar qué rutas de la app no tenía ningún E2E, faltaba la de error:
// un enlace viejo o mal escrito (por ejemplo, de una campaña en redes)
// debe llevar a una salida clara, no a una página en blanco.
import { test, expect } from './fixtures.js';

test('una ruta que no existe muestra la página 404 con salidas al inicio y a soporte', async ({ page }) => {
  // Act
  await page.goto('/promo-black-friday-2019');

  // Assert
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contactar Soporte' })).toHaveAttribute('href', '/contact');

  await page.getByRole('link', { name: 'Volver a casa' }).click();
  await expect(page).toHaveURL(/\/$/);
});
