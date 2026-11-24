// Accesibilidad: auditoría automática (axe-core, reglas WCAG 2.1 A y AA)
// de las páginas principales y de los formularios de acceso, más las
// ayudas propias del sitio (saltar al contenido, panel con Alt + A,
// cambio de idioma con <html lang>).
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';
import { abrirSesionEnNavegador, crearClienteConPerfil, sesionAdmin } from './support/api.js';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function sinViolacionesGraves(page) {
  // Sin animaciones: axe mediría el contraste de textos a medio aparecer.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(500);
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

// --- Paneles con sesión: administración y perfil del cliente ---

const MODULOS_ADMIN = [
  'Reservas', 'Crear reserva', 'Solicitudes de cancelación', 'PQR', 'Clientes', 'Hoteles',
  'Paquetes turísticos', 'Vuelos', 'Empresas', 'Promociones', 'Temas', 'Pagos',
  'Notificaciones', 'Mensajes', 'Comunidad', 'Usuarios', 'Roles', 'Actividad', 'Configuración', 'Mi cuenta',
];

test('el panel de administración no tiene barreras graves en ningún módulo', async ({ page, request }) => {
  test.setTimeout(240_000);
  await abrirSesionEnNavegador(page, await sesionAdmin(request));
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: /^Reservas/ }).first()).toBeVisible({ timeout: 20_000 });
  await sinViolacionesGraves(page);
  for (const modulo of MODULOS_ADMIN) {
    await test.step(modulo, async () => {
      await page.getByRole('button', { name: new RegExp(`^${modulo}`) }).first().click();
      await page.waitForLoadState('networkidle');
      await sinViolacionesGraves(page);
    });
  }
});

test('el perfil del cliente no tiene barreras graves en sus pestañas', async ({ page, request }) => {
  const { sesion } = await crearClienteConPerfil(request);
  await abrirSesionEnNavegador(page, sesion);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await sinViolacionesGraves(page);
  for (const pestana of ['Mis reservas', 'Favoritos', 'Mensajes', 'Solicitudes PQR', 'Métodos de pago']) {
    const boton = page.getByRole('button', { name: new RegExp(pestana, 'i') }).first();
    if (!(await boton.isEnabled().catch(() => false))) continue;
    await test.step(pestana, async () => {
      await boton.click();
      await page.waitForLoadState('networkidle');
      await sinViolacionesGraves(page);
    });
  }
});

test('en inglés se traduce todo el sitio, también el panel de administración', async ({ page, request }) => {
  await abrirSesionEnNavegador(page, await sesionAdmin(request));
  await page.evaluate(() => localStorage.setItem('alik_idioma', 'en'));
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: /^Bookings/ }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /^Customers/ }).first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // Volver a español restaura los textos originales sin recargar.
  await page.evaluate(() => localStorage.setItem('alik_idioma', 'es'));
  await page.goto('/pqr');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Peticiones|PQR/);
});

test('al navegar se anuncia la página nueva y el foco va a su título', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('contentinfo').getByRole('link', { name: /Accesibilidad/ }).first().click();
  await expect(page).toHaveURL(/\/accesibilidad/);
  const anuncio = page.getByRole('status').filter({ hasText: /^Página:/ });
  await expect(anuncio).toHaveText(/Página: .+/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('lectura en voz alta: velocidad, leer al enfocar y atajos', async ({ page }) => {
  // El navegador de CI no trae voces instaladas: una voz falsa que "habla"
  // hasta que la detienen permite probar los controles.
  await page.addInitScript(() => {
    const cola = [];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (u) => { cola.push(u); setTimeout(() => u.onstart?.(), 0); },
        cancel: () => { cola.splice(0).forEach((u) => u.onerror?.()); },
        pause() {}, resume() {}, getVoices: () => [],
        addEventListener() {}, removeEventListener() {},
      },
    });
  });
  await page.goto('/pqr');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.keyboard.press('Alt+a');
  const panel = page.getByRole('dialog', { name: 'Accesibilidad' });
  await panel.getByRole('radio', { name: '1.5×' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alik_voz')).velocidad)).toBe(1.5);
  await panel.getByRole('switch', { name: /Leer al enfocar o tocar/ }).click();
  await expect(panel.getByRole('switch', { name: /Leer al enfocar o tocar/ })).toHaveAttribute('aria-checked', 'true');
  await panel.getByRole('switch', { name: /Leer al enfocar o tocar/ }).click();
  await page.keyboard.press('Escape');

  // Alt + L lee la página: aparece la barra con pausa y detener; Alt + S la cierra.
  await page.keyboard.press('Alt+l');
  const barra = page.getByRole('region', { name: 'Controles de lectura en voz alta' });
  await expect(barra).toBeVisible();
  await expect(barra.getByRole('button', { name: 'Detener lectura' })).toBeVisible();
  await page.keyboard.press('Alt+s');
  await expect(barra).toBeHidden();
});
