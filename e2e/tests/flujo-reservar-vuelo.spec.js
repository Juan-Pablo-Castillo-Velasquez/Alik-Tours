// FLUJO: el cliente encuentra un vuelo en /vuelos, elige pasajeros y lo
// reserva. El total que ve es el que queda guardado.
import { test, expect } from './fixtures.js';
import { abrirSesionEnNavegador, crearClienteConPerfil, crearOfertaVuelo, obtenerReserva, tokenAdmin, unico } from './support/api.js';

test('buscar, ver y reservar un vuelo para un adulto y un niño', async ({ page, request }) => {
  // Arrange (API): oferta que se vende sola, con tarifa de niño
  const token = await tokenAdmin(request);
  const destino = unico('Isla');
  const oferta = await crearOfertaVuelo(request, token, {
    venta_independiente: true,
    destino_ciudad: destino,
    destino_iata: null,
    precio_nino: 300000,
    cargos_adicionales: 20000,
  });
  const { sesion, cliente } = await crearClienteConPerfil(request);
  await abrirSesionEnNavegador(page, sesion, { id_cliente: cliente.id_cliente });

  // Buscar
  await page.goto('/vuelos');
  await page.getByPlaceholder('Ciudad o código (CTG)').fill(destino);
  await page.getByRole('button', { name: 'Buscar vuelos' }).click();
  const tarjeta = page.getByRole('article').filter({ has: page.getByRole('heading', { name: oferta.titulo }) });
  await expect(tarjeta).toHaveCount(1);
  await tarjeta.getByRole('link', { name: 'Ver vuelo' }).click();

  // Detalle: 1 adulto + 1 niño → 450.000 + 300.000 + 2 × 20.000
  await page.getByRole('button', { name: 'Agregar niños' }).click();
  await expect(page.getByText('Total a pagar').locator('..')).toContainText('$790.000');
  await page.getByRole('button', { name: 'Reservar este vuelo' }).click();

  // Pasajeros (el titular ya viene con los datos del cliente)
  await page.getByLabel('Fecha de nacimiento del pasajero 1').fill('1988-03-15');
  await page.getByLabel('Nombres del pasajero 2').fill('Tomás');
  await page.getByLabel('Apellidos del pasajero 2').fill('Prueba');
  await page.getByLabel('Fecha de nacimiento del pasajero 2').fill('2018-07-01');
  await page.getByLabel('Documento del pasajero 2', { exact: true }).fill('1122334455');
  await page.getByRole('checkbox', { name: /Acepto los/ }).check();
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();

  const aviso = page.getByText(/Tu reserva de vuelo #\d+ quedó registrada/);
  await expect(aviso).toBeVisible();
  const idReserva = Number((await aviso.textContent()).match(/#(\d+)/)[1]);
  const reserva = await obtenerReserva(request, token, idReserva);
  expect(reserva.precio_total).toBe(790000);
  expect(reserva.tipo_producto).toBe('vuelo');
  expect(reserva.viajeros.map((v) => v.tipo).sort()).toEqual(['adulto', 'nino']);
});
