// FLUJOS DEL PERFIL: el cuestionario de preferencias (no deja seguir sin
// responder, guarda y muestra textos legibles) y Mis reservas (la reserva
// aparece en "Próximas" y "Por pagar" con su código y botón de pago).
import { test, expect } from './fixtures.js';
import { API_URL, abrirSesionEnNavegador, crearClienteConPerfil, crearOfertaVuelo, tokenAdmin, unico } from './support/api.js';

// Las cuentas nuevas deben guardar un medio de pago antes de usar el resto
// del perfil (Profile.tsx, REQUIERE_METODO_PAGO_DESDE): se guarda por API.
async function guardarMedioDePago(request, sesion) {
  const r = await request.post(`${API_URL}/api/metodos-pago-guardados`, {
    headers: { Authorization: `Bearer ${sesion.access_token}` },
    data: { alias: 'Nequi personal', tipo: 'nequi', clave: '1234' },
  });
  expect(r.ok(), `medio de pago: ${r.status()} ${await r.text()}`).toBeTruthy();
}

test('responder el cuestionario de preferencias y verlas en el perfil', async ({ page, request }) => {
  const { sesion, cliente } = await crearClienteConPerfil(request);
  await guardarMedioDePago(request, sesion);
  await abrirSesionEnNavegador(page, sesion, { id_cliente: cliente.id_cliente });

  await page.goto('/preferences');
  await expect(page.getByRole('heading', { name: '¿Qué te apasiona cuando viajas?' })).toBeVisible();

  // Sin elegir nada no deja seguir y dice por qué
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.getByRole('alert')).toContainText('Elige al menos un interés');

  await page.getByRole('button', { name: /Playa y Relax/ }).click();
  await page.getByRole('button', { name: /Gastronomía/ }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();

  await page.getByRole('radio', { name: /En Pareja/ }).click();
  await page.getByRole('radio', { name: /Estándar/ }).click();
  await page.getByRole('radio', { name: /Clima Cálido/ }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();

  await page.getByRole('radio', { name: /Relajado/ }).click();
  await page.getByRole('radio', { name: /Privado/ }).click();
  await page.getByRole('button', { name: 'Guardar mis preferencias' }).click();

  // Vuelve al perfil, pestaña Preferencias, con los textos (no "mid" ni "couple")
  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole('heading', { name: 'Preferencias de viaje' })).toBeVisible();
  await expect(page.getByText('Estándar', { exact: true })).toBeVisible();
  await expect(page.getByText('En Pareja', { exact: true })).toBeVisible();
  await expect(page.getByText('mid', { exact: true })).toHaveCount(0);
});

test('una reserva nueva aparece en Mis reservas con su código y botón de pago', async ({ page, request }) => {
  // Arrange (API): oferta de vuelo y reserva del cliente sin pagar
  const token = await tokenAdmin(request);
  const oferta = await crearOfertaVuelo(request, token, { venta_independiente: true, destino_ciudad: unico('Isla'), destino_iata: null });
  const { sesion, cliente } = await crearClienteConPerfil(request);
  const r = await request.post(`${API_URL}/api/reservas`, {
    headers: { Authorization: `Bearer ${sesion.access_token}` },
    data: {
      id_cliente: cliente.id_cliente,
      tipo_producto: 'vuelo',
      id_oferta_vuelo: oferta.id_oferta,
      adultos: 1,
      ninos: 0,
      infantes: 0,
      viajeros: [{ tipo: 'adulto', nombres: 'Viajera', apellidos: 'Prueba', tipo_documento: 'CC', numero_documento: '10203040', fecha_nacimiento: '1995-04-10' }],
      terminos_version: '2026-10-30-borrador',
    },
  });
  expect(r.ok(), `crear reserva: ${r.status()} ${await r.text()}`).toBeTruthy();
  const reserva = await r.json();
  await guardarMedioDePago(request, sesion);
  const codigo = `AT-${String(reserva.id_reserva).padStart(6, '0')}`;

  await abrirSesionEnNavegador(page, sesion, { id_cliente: cliente.id_cliente });
  await page.goto('/profile');
  await page.getByRole('button', { name: /^Mis reservas/ }).first().click();

  // Está en Próximas (pestaña por defecto) con su código y el botón de pago
  await expect(page.getByRole('tab', { name: /Próximas/ })).toHaveAttribute('aria-selected', 'true');
  const tarjeta = page.getByRole('article').filter({ hasText: codigo });
  await expect(tarjeta).toHaveCount(1);
  await expect(tarjeta.getByRole('link', { name: 'Pagar' })).toHaveAttribute('href', `/pagar/${reserva.id_reserva}`);

  // También en "Por pagar"; "Canceladas" queda vacía y ofrece volver a todas
  await page.getByRole('tab', { name: /Por pagar/ }).click();
  await expect(page.getByRole('article').filter({ hasText: codigo })).toHaveCount(1);
  await page.getByRole('tab', { name: /Canceladas/ }).click();
  await expect(page.getByText('No hay reservas en esta pestaña')).toBeVisible();
  await page.getByRole('button', { name: 'Ver todas mis reservas' }).click();
  await expect(page.getByRole('article').filter({ hasText: codigo })).toHaveCount(1);

  // El detalle abre con el código y ofrece pagar
  await tarjeta.getByRole('button', { name: 'Ver detalle', exact: true }).click();
  const detalle = page.getByRole('dialog');
  await expect(detalle.getByRole('heading', { name: /^Vuelo Bogotá/ })).toBeVisible();
  await expect(detalle.getByRole('button', { name: `Copiar el código de la reserva ${codigo}` })).toBeVisible();
  // "Lo que sigue": como no está pagada, lo primero es pagarla
  await expect(detalle.getByText(/^Te falta pagar/)).toBeVisible();
  await expect(detalle.getByRole('link', { name: /Pagar reserva/ })).toBeVisible();
});
