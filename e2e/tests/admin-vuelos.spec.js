// Panel: el admin crea una oferta aérea desde el formulario por pasos.
import { test, expect } from './fixtures.js';
import { abrirSesionEnNavegador, API_URL, enDias, sesionAdmin, unico } from './support/api.js';

test('el admin crea una oferta aérea y la ve en el listado', async ({ page, request }) => {
  const sesion = await sesionAdmin(request);
  await abrirSesionEnNavegador(page, sesion);
  const titulo = unico('Oferta panel');

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Vuelos' }).click();
  await page.getByRole('button', { name: 'Nueva oferta aérea' }).click();

  const modal = page.getByRole('dialog');
  await modal.getByLabel(/Título comercial/).fill(titulo);
  await modal.getByRole('button', { name: 'Siguiente →' }).click();
  await modal.getByRole('group', { name: 'Origen' }).getByLabel(/Ciudad/).fill('Bogotá');
  await modal.getByRole('group', { name: 'Destino' }).getByLabel(/Ciudad/).fill('San Andrés');
  await modal.getByRole('button', { name: 'Siguiente →' }).click();
  await modal.getByLabel(/Fecha de salida/).fill(enDias(50));
  await modal.getByLabel(/Fecha de regreso/).fill(enDias(55));
  await modal.getByRole('button', { name: 'Siguiente →' }).click();
  await modal.getByRole('button', { name: 'Siguiente →' }).click();
  await modal.getByLabel(/Precio por adulto/).fill('520000');
  await modal.getByRole('button', { name: 'Crear oferta' }).click();

  const tarjeta = page.getByRole('article').filter({ has: page.getByRole('heading', { name: titulo }) });
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toContainText('$520.000');

  // Limpieza por API
  const r = await request.get(`${API_URL}/api/vuelos/admin`, {
    params: { q: titulo },
    headers: { Authorization: `Bearer ${sesion.access_token}` },
  });
  for (const o of (await r.json()).items) {
    await request.delete(`${API_URL}/api/vuelos/${o.id_oferta}`, { headers: { Authorization: `Bearer ${sesion.access_token}` } });
  }
});
