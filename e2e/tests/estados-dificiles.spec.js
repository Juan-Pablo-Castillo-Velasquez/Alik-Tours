// Estados difíciles de provocar con el backend real, simulados con page.route.
// Autor (semana 5, capa E2E): Fernando Gutiérrez.
//
// Tipo de doble: STUB de red. page.route intercepta la petición del
// navegador ANTES de que salga y responde lo que el test necesita (API
// caído, lista vacía, error de validación). El frontend no sabe que es
// falso: así se prueba cómo reacciona la interfaz, sin depender de los
// datos ni del estado del backend.
import { test, expect } from './fixtures.js';

const API_PAQUETES = /\/api\/paquetes\?/;

const paquete = (id, nombre, ciudad, precio) => ({
  id_paquete: id,
  nombre_paquete: nombre,
  descripcion: 'Paquete de prueba E2E',
  duracion_dias: 4,
  precio_base: precio,
  activo: true,
  ciudad_salida: 'Bogotá',
  ciudad_destino: ciudad,
  condiciones: null,
  imagen_url: null,
});

test.describe('Paquetes', () => {
  test('si el API no responde, avisa del error en vez de decir que no hay viajes', async ({ page }) => {
    // Arrange: API caído (503)
    await page.route(API_PAQUETES, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Servicio no disponible"}' }),
    );
    // Act
    await page.goto('/packages');
    // Assert
    await expect(page.getByRole('alert')).toContainText('No pudimos cargar los paquetes');
    await expect(page.getByRole('heading', { name: 'Todavía no hay paquetes publicados' })).toBeHidden();
  });

  test('"Reintentar" vuelve a pedir los paquetes y los muestra cuando el API se recupera', async ({ page }) => {
    let intentos = 0;
    await page.route(API_PAQUETES, (route) => {
      intentos += 1;
      return intentos === 1
        ? route.fulfill({ status: 503, body: '' })
        : route.fulfill({ json: [paquete(1, 'Cartagena Mágica', 'Cartagena', 1500000)] });
    });
    await page.goto('/packages');

    await page.getByRole('button', { name: 'Reintentar' }).click();

    await expect(page.getByText('1 paquete disponible')).toBeVisible();
    expect(intentos).toBe(2);
  });

  test('una agencia sin paquetes publicados muestra el estado vacío', async ({ page }) => {
    await page.route(API_PAQUETES, (route) => route.fulfill({ json: [] }));

    await page.goto('/packages');

    await expect(page.getByRole('heading', { name: 'Todavía no hay paquetes publicados' })).toBeVisible();
    await expect(page.getByText('0 paquetes disponibles')).toBeVisible();
  });

  test('el filtro encuentra el destino escrito sin tilde (datos controlados)', async ({ page }) => {
    // Con un stub los datos son siempre los mismos: el test ya no depende
    // de lo que haya en la BD (a diferencia del E2E de la semana 1).
    await page.route(API_PAQUETES, (route) =>
      route.fulfill({
        json: [
          paquete(1, 'Medellín y Guatapé', 'Medellín', 1200000),
          paquete(2, 'Caribe total', 'San Andrés', 2400000),
          paquete(3, 'Eje cafetero', 'Salento', 900000),
        ],
      }),
    );
    await page.goto('/packages');
    await expect(page.getByText('3 paquetes disponibles')).toBeVisible();

    await page.getByRole('textbox', { name: 'Filtrar por destino' }).fill('medellin');

    await expect(page.getByText('1 paquete disponible')).toBeVisible();
  });
});

test.describe('Contacto', () => {
  test('si el API rechaza el mensaje, avisa y no borra lo que la persona escribió', async ({ page }) => {
    // Arrange: el backend responde 422 (por ejemplo, un correo que no acepta)
    await page.route('**/api/contacto', (route) =>
      route.fulfill({
        status: 422,
        json: { detail: [{ loc: ['body', 'correo'], msg: 'value is not a valid email address', type: 'value_error' }] },
      }),
    );
    await page.goto('/contact');
    const formulario = page.getByRole('form', { name: 'Formulario de contacto' });
    await formulario.getByLabel('Tu nombre completo').fill('Invitado E2E');
    await formulario.getByLabel('Correo electrónico').fill('invitado@e2e.alektours.com');
    await formulario.getByLabel('Asunto del mensaje').fill('Cotización');
    await formulario.getByLabel('¿En qué podemos ayudarte?').fill('Quiero cotizar un viaje a Santa Marta.');

    // Act
    await formulario.getByRole('button', { name: 'Enviar Mensaje de Consulta' }).click();

    // Assert
    await expect(formulario.getByRole('alert')).toHaveText('No pudimos enviar tu mensaje. Intenta de nuevo en unos minutos.');
    await expect(formulario.getByLabel('Asunto del mensaje')).toHaveValue('Cotización');
  });
});
