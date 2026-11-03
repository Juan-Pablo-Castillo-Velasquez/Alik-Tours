// FLUJO CRÍTICO 2 (semana 7): buscar un destino y abrir la ficha del hotel.
// Autor: Fernando Gutiérrez.
//
// Por qué es crítico: es lo que hace TODOS los días quien visita la
// agencia. Si el buscador no encuentra el hotel o la ficha no abre, no
// hay reserva posible.
import { test, expect } from './fixtures.js';
import { borrarHotel, crearHotel, tokenAdmin, unico } from './support/api.js';

test.describe('Buscar hotel y ver su ficha', () => {
  let token;
  let hotel;

  test.beforeEach(async ({ request }) => {
    // Arrange por API: un hotel en una ciudad inventada (única por test)
    token = await tokenAdmin(request);
    hotel = await crearHotel(request, token, { nombre_hotel: unico('Hotel E2E'), ciudad: unico('Villa Prueba') });
  });

  test.afterEach(async ({ request }) => {
    if (hotel) await borrarHotel(request, token, hotel.id_hotel);
  });

  test('el destino buscado muestra el hotel y "Ver hotel" abre su ficha', async ({ page }) => {
    // Act
    await page.goto(`/search?destination=${encodeURIComponent(hotel.ciudad)}`);
    const tarjeta = page.getByRole('article').filter({ has: page.getByRole('heading', { name: hotel.nombre_hotel }) });
    await expect(tarjeta).toHaveCount(1);
    await tarjeta.getByRole('link', { name: 'Ver hotel' }).click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`/hotel/${hotel.id_hotel}`));
    await expect(page.getByRole('heading', { level: 1, name: hotel.nombre_hotel })).toBeVisible();
  });

  test('la búsqueda no distingue mayúsculas ni tildes del destino escrito', async ({ page }) => {
    const escrito = hotel.ciudad.toUpperCase().replace('VILLA', 'VÍLLA');

    await page.goto(`/search?destination=${encodeURIComponent(escrito)}`);

    await expect(page.getByRole('heading', { name: hotel.nombre_hotel })).toBeVisible();
  });
});

test.describe('Errores visibles', () => {
  test('un destino sin hoteles muestra el aviso de que no hay resultados', async ({ page }) => {
    await page.goto(`/search?destination=${encodeURIComponent(unico('Atlantida'))}`);

    await expect(page.getByRole('heading', { name: 'No encontramos alojamientos con esos criterios' })).toBeVisible();
  });

  test('un hotel que no existe muestra "Hotel no encontrado" con un camino de vuelta', async ({ page }) => {
    await page.goto('/hotel/999999');

    await expect(page.getByRole('heading', { name: 'Hotel no encontrado' })).toBeVisible();
    await page.getByRole('link', { name: '← Volver a explorar destinos' }).click();
    await expect(page).toHaveURL(/\/search/);
  });
});

test.describe('Defectos de tiempos', () => {
  test('con la red lenta se ve que está cargando y luego llegan los resultados', async ({ page, request }) => {
    // Arrange: el GET de hoteles tarda 2 s (red simulada)
    const token = await tokenAdmin(request);
    const lento = await crearHotel(request, token, { nombre_hotel: unico('Hotel Lento'), ciudad: unico('Ciudad Lenta') });
    await page.route(/\/api\/hoteles\/\?/, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    // Act
    await page.goto(`/search?destination=${encodeURIComponent(lento.ciudad)}`);

    // Assert: mientras carga NO dice "no hay resultados" (eso confundiría)
    await expect(page.getByText('No encontramos alojamientos con esos criterios')).toBeHidden();
    await expect(page.getByRole('heading', { name: lento.nombre_hotel })).toBeVisible();

    await borrarHotel(request, token, lento.id_hotel);
  });
});
