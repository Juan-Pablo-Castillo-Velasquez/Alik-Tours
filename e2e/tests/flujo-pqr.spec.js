// PQR de punta a punta: el cliente radica un reclamo desde su perfil, un
// asesor lo encuentra en el panel y da la respuesta de fondo, y el cliente
// la ve en su perfil y califica la atención.
import { test, expect } from './fixtures.js';
import { API_URL, abrirSesionEnNavegador, crearClienteConPerfil, sesionAdmin, unico } from './support/api.js';

async function guardarMedioDePago(request, sesion) {
  const r = await request.post(`${API_URL}/api/metodos-pago-guardados`, {
    headers: { Authorization: `Bearer ${sesion.access_token}` },
    data: { alias: 'Nequi personal', tipo: 'nequi', clave: '1234' },
  });
  expect(r.ok(), `medio de pago: ${r.status()} ${await r.text()}`).toBeTruthy();
}

test('reclamo: el cliente radica, el asesor responde y el cliente califica', async ({ page, browser, request }) => {
  const { sesion, cliente } = await crearClienteConPerfil(request);
  await guardarMedioDePago(request, sesion);
  const asunto = unico('Cobro doble');

  // 1. El cliente radica el reclamo desde su perfil.
  await abrirSesionEnNavegador(page, sesion, { id_cliente: cliente.id_cliente });
  await page.goto('/profile?tab=pqr');
  await expect(page.getByRole('heading', { name: 'Solicitudes (PQR)' })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva solicitud' }).click();
  await page.getByRole('radio', { name: /Reclamo/ }).check();
  await page.getByLabel('Asunto').fill(asunto);
  await page.getByLabel('Descripción').fill('Me cobraron dos veces el anticipo de la reserva con la misma tarjeta.');
  const radicar = page.getByRole('button', { name: 'Radicar solicitud' });
  await expect(radicar).toBeDisabled(); // en un reclamo falta decir qué espera
  await page.getByLabel(/Qué esperas que hagamos/).fill('Que me devuelvan el cobro repetido.');
  await page.getByRole('checkbox').check();
  await radicar.click();

  await expect(page.getByRole('heading', { name: asunto })).toBeVisible();
  const radicado = (await page.getByRole('button', { name: /Copiar radicado/ }).textContent()).trim();
  expect(radicado).toMatch(/^PQR-\d{4}-\d{6}$/);
  await expect(page.getByText('Respuesta a más tardar el')).toBeVisible();
  await expect(page.getByText(/15 días hábiles/).first()).toBeVisible();

  // 2. Un asesor la encuentra por el radicado y responde de fondo.
  const admin = await sesionAdmin(request);
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    localStorage.setItem('cookie_consent_ack', '1');
    sessionStorage.setItem('alectours_welcome_splash_visto', '1');
  });
  const panel = await ctx.newPage();
  await abrirSesionEnNavegador(panel, admin);
  await panel.goto('/admin');
  await panel.getByRole('button', { name: 'PQR', exact: true }).first().click();
  await panel.getByLabel('Buscar PQR').fill(radicado);
  await panel.getByText(asunto).click();
  await panel.getByRole('tab', { name: /Respuesta de fondo/ }).click();
  await panel.getByLabel(/Decisión/).selectOption('favorable');
  await panel
    .getByLabel('Texto')
    .fill('Confirmamos el cobro repetido con el banco y ya ordenamos la devolución a tu tarjeta.');
  await panel.getByRole('button', { name: 'Enviar respuesta' }).click();
  await expect(panel.getByRole('dialog').getByText('Respondida', { exact: true })).toBeVisible();
  await expect(panel.getByRole('dialog').locator('p', { hasText: /^Accedemos a lo que pediste$/ })).toBeVisible();
  await ctx.close();

  // 3. El cliente ve la respuesta y califica; la solicitud queda cerrada.
  await page.goto('/profile?tab=pqr');
  await page.getByText(asunto).click();
  await expect(page.getByText('Nuestra respuesta')).toBeVisible();
  await expect(page.getByText('Accedemos a lo que pediste')).toBeVisible();
  await page.getByRole('radio', { name: '5 de 5' }).click();
  await page.getByRole('button', { name: 'Enviar calificación' }).click();
  await expect(page.getByText('Cerrada', { exact: true })).toBeVisible();
});
