// Fixture compartida por todos los E2E de AlekTours.
//
// La app muestra dos capas encima de cualquier página la primera vez que
// se abre: el aviso de cookies (localStorage "cookie_consent_ack") y el
// folleto de bienvenida (sessionStorage "alectours_welcome_splash_visto").
// No son lo que prueban estos tests y, si aparecen, tapan los botones.
// Se marcan como ya vistos ANTES de que cargue la app, en cada página.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent_ack', '1');
      sessionStorage.setItem('alectours_welcome_splash_visto', '1');
    });
    await use(page);
  },
});

export { expect };
