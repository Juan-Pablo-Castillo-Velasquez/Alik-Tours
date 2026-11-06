// Filtros de búsqueda que se conservan al volver de un hotel, y botón de
// WhatsApp de la agencia (mejora integral, fases 2 y contacto).
// Autor: Juan Pablo Castillo.
import { test, expect } from './fixtures.js';
import { borrarHotel, crearHotel, tokenAdmin, unico } from './support/api.js';

test.describe('Filtros de hoteles en la URL', () => {
  let token;
  let hotel;

  test.beforeEach(async ({ request }) => {
    // Arrange por API: hotel con habitación de $320.000 la noche
    token = await tokenAdmin(request);
    hotel = await crearHotel(request, token, { nombre_hotel: unico('Hotel Filtros'), ciudad: unico('Villa Filtro') });
  });

  test.afterEach(async ({ request }) => {
    if (hotel) await borrarHotel(request, token, hotel.id_hotel);
  });

  test('el filtro de precio sigue puesto al entrar a un hotel y volver atrás', async ({ page }) => {
    await page.goto(`/search?destination=${encodeURIComponent(hotel.ciudad)}`);
    const rango = page.getByRole('radio', { name: '$300.000 – $600.000' });

    // Act: filtrar, abrir el hotel y volver
    await rango.check();
    await expect(page).toHaveURL(/f_precio=300-600/);
    await page.getByRole('link', { name: 'Ver hotel' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/hotel/${hotel.id_hotel}`));
    await page.goBack();

    // Assert: el filtro y el resultado siguen ahí
    await expect(page.getByRole('radio', { name: '$300.000 – $600.000' })).toBeChecked();
    await expect(page.getByRole('heading', { name: hotel.nombre_hotel })).toBeVisible();
  });

  test('un rango de precio que no le sirve al hotel lo oculta', async ({ page }) => {
    await page.goto(`/search?destination=${encodeURIComponent(hotel.ciudad)}&f_precio=gt1000`);

    await expect(page.getByRole('radio', { name: 'Más de $1.000.000' })).toBeChecked();
    await expect(page.getByRole('heading', { name: hotel.nombre_hotel })).toBeHidden();
  });
});

test.describe('Contacto por WhatsApp', () => {
  test('el pie de página tiene el WhatsApp de la agencia con un mensaje inicial', async ({ page }) => {
    await page.goto('/');

    const whatsapp = page.locator('footer a[href^="https://wa.me/573228174200"]').first();
    await expect(whatsapp).toHaveAttribute('href', /\?text=/);
    await expect(whatsapp).toHaveAttribute('target', '_blank');
  });
});
