// FLUJO: reservar una habitación de hotel paso a paso (datos → fechas →
// revisar → pago). El encabezado muestra en qué paso va, deja volver a un
// paso completado y el precio total coincide con noches × tarifa.
import { test, expect } from './fixtures.js';
import { API_URL, abrirSesionEnNavegador, borrarHotel, crearClienteConPerfil, crearHotel, enDias, tokenAdmin, unico } from './support/api.js';

test('reservar un hotel: avanzar por los 4 pasos y llegar al pago con el total correcto', async ({ page, request }) => {
  test.setTimeout(60_000);
  // Arrange (API): hotel con una habitación de $320.000 la noche y cliente con perfil
  const token = await tokenAdmin(request);
  const nombre = unico('Hotel Flujo');
  const hotel = await crearHotel(request, token, { nombre_hotel: nombre, ciudad: 'Cartagena' });
  const habitaciones = await (await request.get(`${API_URL}/api/hoteles/${hotel.id_hotel}/habitaciones`)).json();
  const { sesion, cliente } = await crearClienteConPerfil(request);
  await request.post(`${API_URL}/api/metodos-pago-guardados`, {
    headers: { Authorization: `Bearer ${sesion.access_token}` },
    data: { alias: 'Nequi personal', tipo: 'nequi', clave: '1234' },
  });
  await abrirSesionEnNavegador(page, sesion, { id_cliente: cliente.id_cliente });

  try {
    const entrada = enDias(40);
    const salida = enDias(43);
    await page.goto(`/checkout/${hotel.id_hotel}?habitacion=${habitaciones[0].id_habitacion}&start=${entrada}&end=${salida}&people=2`);

    // Encabezado: hotel, 3 noches, 2 huéspedes y el paso 1 actual
    await expect(page.getByRole('heading', { name: nombre, level: 1 })).toBeVisible();
    await expect(page.getByText('3 noches').first()).toBeVisible();
    const pasos = page.getByRole('navigation', { name: 'Pasos de la reserva' });
    await expect(pasos.locator('[aria-current="step"]')).toContainText('Datos del viajero');

    // Paso 1: los datos vienen del perfil; se completa lo que falte
    await page.getByLabel('Celular').fill('3001234567');
    await page.getByRole('button', { name: /^Continuar/ }).click();
    await expect(pasos.locator('[aria-current="step"]')).toContainText('Fechas y huéspedes');

    // Paso 2 → 3: revisar
    await page.getByRole('button', { name: /^Continuar/ }).click();
    await expect(pasos.locator('[aria-current="step"]')).toContainText('Revisar reserva');

    // La revisión muestra la estadía como un pase: 3 noches y el desglose
    await expect(page.getByText('$320.000 × 3 noches')).toBeVisible();

    // Recargar retoma la reserva donde iba (borrador en el navegador)
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: 'Retomamos tu reserva' })).toBeVisible();
    await expect(pasos.locator('[aria-current="step"]')).toContainText('Revisar reserva');

    // Volver al paso 1 desde el encabezado y regresar
    await pasos.getByRole('button', { name: 'Volver al paso 1: Datos del viajero' }).click();
    await expect(pasos.locator('[aria-current="step"]')).toContainText('Datos del viajero');
    await page.getByRole('button', { name: /^Continuar/ }).click();
    await page.getByRole('button', { name: /^Continuar/ }).click();

    // Paso 4: pago. 3 noches × $320.000 = $960.000 y no deja confirmar sin aceptar términos
    await page.getByRole('button', { name: /Ir al pago/ }).click();
    await expect(pasos.locator('[aria-current="step"]')).toContainText('Pago');
    await expect(page.getByText('$960.000').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirmar y autorizar/ })).toBeDisabled();
  } finally {
    await borrarHotel(request, token, hotel.id_hotel);
  }
});
