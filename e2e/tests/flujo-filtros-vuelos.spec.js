// FLUJO: el buscador de /vuelos encuentra el destino escrito sin tildes y
// los filtros (trayecto, orden) cambian el resultado y quedan en la URL.
import { test, expect } from './fixtures.js';
import { crearOfertaVuelo, tokenAdmin, unico } from './support/api.js';

test('buscar sin tildes, filtrar solo ida y ordenar por precio', async ({ page, request }) => {
  // Arrange (API): dos ofertas al mismo destino con tilde
  const token = await tokenAdmin(request);
  const marca = unico('Pruebasón');
  const destino = `Isla ${marca}`;
  const idaVuelta = await crearOfertaVuelo(request, token, {
    venta_independiente: true,
    destino_ciudad: destino,
    destino_iata: null,
    precio_adulto: 900000,
  });
  const soloIda = await crearOfertaVuelo(request, token, {
    venta_independiente: true,
    destino_ciudad: destino,
    destino_iata: null,
    tipo_trayecto: 'solo_ida',
    fecha_regreso: null,
    precio_adulto: 300000,
  });

  // Buscar escribiendo sin tilde y en minúsculas
  await page.goto('/vuelos');
  await page.getByPlaceholder('Ciudad o código (CTG)').fill(destino.toLowerCase().replace('ó', 'o'));
  await page.getByRole('button', { name: 'Buscar vuelos' }).click();
  await expect(page.getByText('2 vuelos coinciden')).toBeVisible();

  // Ordenar por menor precio: primero el de 300.000
  await page.getByLabel('Ordenar vuelos').selectOption('precio');
  await expect(page.getByRole('article').first().getByRole('heading')).toHaveText(soloIda.titulo);
  await expect(page).toHaveURL(/orden=precio/);

  // Filtrar solo ida (en móvil el panel de filtros se abre con un botón)
  const filtros = page.getByRole('button', { name: /^Filtros/ });
  if (await filtros.isVisible()) await filtros.click();
  await page.getByRole('radio', { name: 'Solo ida' }).first().click();
  await expect(page.getByText('1 vuelo coincide')).toBeVisible();
  await expect(page.getByRole('heading', { name: idaVuelta.titulo })).toHaveCount(0);

  // Quitar el filtro desde su chip
  await page.getByRole('button', { name: 'Quitar filtro Solo ida' }).click();
  await expect(page.getByText('2 vuelos coinciden')).toBeVisible();
});
