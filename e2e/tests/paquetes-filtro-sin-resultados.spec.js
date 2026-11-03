// Flujo: filtrar paquetes por un destino que no existe.
// Autor (semana 1, capa E2E): Fernando Gutiérrez.
//
// Por qué es crítico: buscar destino es lo primero que hace quien llega a
// la agencia. Si un filtro sin coincidencias deja la página en blanco o
// sin salida, la persona cree que no hay viajes y se va.
import { test, expect } from './fixtures.js';

test('un destino sin coincidencias muestra el aviso y "Quitar filtro" vuelve a la lista', async ({ page }) => {
  // Arrange
  const destino = `Atlantida-${Date.now()}`;
  await page.goto('/packages');
  const contador = page.getByText(/^\d+ paquetes? disponibles?$/);
  await expect(contador).toBeVisible();
  const textoInicial = await contador.textContent();
  // El filtro solo aparece si hay paquetes publicados. En la semana 6 cada
  // E2E creará sus propios datos; por ahora se salta con un motivo claro.
  test.skip(textoInicial?.startsWith('0 ') ?? true, 'La BD no tiene paquetes publicados');

  // Act
  await page.getByRole('textbox', { name: 'Filtrar por destino' }).fill(destino);

  // Assert: aviso visible con el destino escrito
  await expect(page.getByRole('heading', { name: `No encontramos paquetes para «${destino}»` })).toBeVisible();
  await expect(page.getByText('0 paquetes disponibles')).toBeVisible();

  // Act 2 + Assert 2: quitar el filtro devuelve la lista completa
  await page.getByRole('button', { name: 'Quitar filtro' }).click();
  await expect(page.getByRole('heading', { name: /No encontramos paquetes/ })).toBeHidden();
  await expect(contador).toHaveText(textoInicial);
});
