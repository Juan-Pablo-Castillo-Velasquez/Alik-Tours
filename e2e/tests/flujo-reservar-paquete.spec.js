// FLUJO CRÍTICO: reservar un paquete con vuelo opcional (ecosistema de
// reservas). El precio lo calcula el backend; aquí se comprueba que lo que
// ve el cliente en el resumen es exactamente lo que queda guardado.
import { test, expect } from './fixtures.js';
import {
  abrirSesionEnNavegador,
  crearClienteConPerfil,
  crearOfertaVuelo,
  crearPaquete,
  enDias,
  obtenerReserva,
  tokenAdmin,
} from './support/api.js';

test.describe('Reservar un paquete', () => {
  test('sin vuelo paga el paquete; al agregar el vuelo el total sube y la reserva lo conserva', async ({ page, request }) => {
    // Arrange (API): oferta aérea + paquete con vuelo opcional + cliente con perfil
    const token = await tokenAdmin(request);
    const oferta = await crearOfertaVuelo(request, token);
    const paquete = await crearPaquete(request, token, { modalidad_vuelo: 'opcional', vuelos: [oferta.id_oferta] });
    const { sesion, cliente } = await crearClienteConPerfil(request);
    await abrirSesionEnNavegador(page, sesion, { id_cliente: cliente.id_cliente });

    // Act: tu viaje
    await page.goto(`/package/${paquete.id_paquete}/reservar`);
    await page.getByLabel('Fecha de inicio').fill(enDias(40));
    await page.getByRole('button', { name: 'Quitar adultos' }).click(); // 2 → 1 adulto
    const total = page.getByText('Total a pagar').locator('..');
    await expect(total).toContainText('$1.000.000');

    await page.getByLabel('Quiero agregar el vuelo').check();
    await expect(total).toContainText('$1.450.000');

    // Viajeros: con vuelo se piden fecha de nacimiento y documento
    await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.getByLabel(/Fecha de nacimiento/).first().fill('1990-05-20');
    await page.getByLabel('Número de documento').first().fill('1020304050');
    await page.getByRole('button', { name: 'Continuar →' }).click();

    // Revisión y confirmación
    await page.getByRole('checkbox', { name: /Acepto los/ }).check();
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    const aviso = page.getByText(/Tu reserva #\d+ quedó registrada/);
    await expect(aviso).toBeVisible();

    // Assert: lo guardado coincide con lo que vio el cliente
    const idReserva = Number((await aviso.textContent()).match(/#(\d+)/)[1]);
    const reserva = await obtenerReserva(request, token, idReserva);
    expect(reserva.precio_total).toBe(1450000);
    expect(reserva.id_oferta_vuelo).toBe(oferta.id_oferta);
    expect(reserva.viajeros).toHaveLength(1);
    // Y se puede pagar desde ahí mismo (pagos en modo de prueba)
    await expect(page.getByText('Pagos en línea en modo de prueba')).toBeVisible();
  });

  test('sin iniciar sesión, reservar lleva a iniciar sesión', async ({ page, request }) => {
    const token = await tokenAdmin(request);
    const paquete = await crearPaquete(request, token);

    await page.goto(`/package/${paquete.id_paquete}/reservar`);

    await expect(page).not.toHaveURL(/\/reservar$/);
  });
});
