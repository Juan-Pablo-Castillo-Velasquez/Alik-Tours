// Sesión de cliente preparada UNA vez para toda la suite (semana 7).
//
// Se crea una cuenta verificada por API y se guarda en el estado del
// navegador lo mismo que deja el login real: "token" y "usuario" en
// localStorage (ver AuthContext.tsx). Los tests que necesitan sesión
// hacen test.use({ storageState: SESION_CLIENTE }) y arrancan ya logueados.
import { test as setup } from '@playwright/test';
import { SESION_CLIENTE, crearClienteVerificado } from './support/api.js';

setup('preparar la sesión de un cliente verificado', async ({ page, request }) => {
  const { sesion } = await crearClienteVerificado(request);
  await page.goto('/');
  await page.evaluate((s) => {
    localStorage.setItem('token', s.access_token);
    localStorage.setItem(
      'usuario',
      JSON.stringify({
        username: s.username,
        user_id: s.user_id,
        id_cliente: s.id_cliente,
        roles: s.roles,
        verificado: true,
        activo: true,
      }),
    );
    localStorage.setItem('cookie_consent_ack', '1');
  }, sesion);
  await page.context().storageState({ path: SESION_CLIENTE });
});
