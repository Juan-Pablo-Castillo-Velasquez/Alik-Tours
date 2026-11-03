// Flujo: una persona sin cuenta escribe a la agencia desde /contact.
// Autor (semana 1, capa E2E): Cristian Sinisterra.
//
// Por qué es crítico: es el canal de cotización para quien todavía no
// tiene cuenta. Si el mensaje no sale (o sale sin confirmación), la
// agencia pierde a un cliente que ya estaba interesado.
import { test, expect } from './fixtures.js';

test('un invitado envía un mensaje de contacto y ve la confirmación', async ({ page }) => {
  // Arrange: datos únicos para reconocer este mensaje en la bandeja del admin
  const marca = Date.now();
  await page.goto('/contact');
  const formulario = page.getByRole('form', { name: 'Formulario de contacto' });

  // Act
  await formulario.getByLabel('Tu nombre completo').fill('Invitado E2E');
  await formulario.getByLabel('Correo electrónico').fill(`invitado.${marca}@alektours.test`);
  await formulario.getByLabel('Asunto del mensaje').fill(`Cotización E2E ${marca}`);
  await formulario
    .getByLabel('¿En qué podemos ayudarte?')
    .fill('Quisiera cotizar un paquete a Cartagena para dos personas en diciembre.');
  await formulario.getByRole('button', { name: 'Enviar Mensaje de Consulta' }).click();

  // Assert
  await expect(page.getByRole('heading', { name: '¡Mensaje enviado con éxito!' })).toBeVisible();
  await expect(formulario).toBeHidden();
});
