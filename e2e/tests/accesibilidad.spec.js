// Accesibilidad: auditoría automática (axe-core, reglas WCAG 2.1 A y AA)
// de las páginas principales y de los formularios de acceso, más las
// ayudas propias del sitio (saltar al contenido, panel con Alt + A,
// cambio de idioma con <html lang>).
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function sinViolacionesGraves(page) {
  const r = await new AxeBuilder({ page })
    .withTags(WCAG)
    // Imágenes de terceros que el entorno de prueba no carga.
    .exclude('iframe')
    .analyze();
  const graves = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(
    graves.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

for (const ruta of ['/', '/pqr', '/accesibilidad', '/login', '/register']) {
  test(`sin barreras graves de accesibilidad en ${ruta}`, async ({ page }) => {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await sinViolacionesGraves(page);
  });
}

test('saltar al contenido, panel de accesibilidad e idioma', async ({ page }) => {
  await page.goto('/pqr');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  const saltar = page.getByRole('link', { name: 'Saltar al contenido principal' });
  await expect(saltar).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#contenido-principal')).toBeFocused();

  await page.keyboard.press('Alt+a');
  const panel = page.getByRole('dialog', { name: 'Accesibilidad' });
  await expect(panel).toBeVisible();
  await panel.getByRole('switch', { name: /Alto contraste/ }).click();
  await expect(page.locator('html')).toHaveClass(/a11y-contraste/);
  await panel.getByRole('radio', { name: 'Muy grande' }).click();
  await expect(page.locator('html')).toHaveClass(/a11y-texto-2/);

  await panel.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('dialog', { name: 'Accessibility' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Accessibility' }).getByRole('button', { name: 'Reset all' }).click();
  await expect(page.locator('html')).not.toHaveClass(/a11y-contraste/);
  await page.getByRole('dialog', { name: 'Accessibility' }).getByRole('button', { name: 'Español' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
});
