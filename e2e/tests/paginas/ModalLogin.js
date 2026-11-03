// Objeto de página del modal de inicio de sesión (sin aserciones: solo
// sabe CÓMO se usa la pantalla; qué esperar lo decide cada test).
export class ModalLogin {
  constructor(page) {
    this.page = page;
    this.dialogo = page.getByRole('dialog', { name: /Bienvenido de nuevo|Confirma tu correo/ });
    this.correo = this.dialogo.getByLabel('Correo electrónico');
    this.password = this.dialogo.getByLabel('Contraseña', { exact: true });
    this.botonEntrar = this.dialogo.getByRole('button', { name: 'Iniciar sesión' });
    this.error = this.dialogo.getByRole('alert');
  }

  async abrir() {
    // /login abre el modal sobre el home (AuthRedirects.tsx)
    await this.page.goto('/login');
  }

  async iniciarSesion(correo, password) {
    await this.correo.fill(correo);
    await this.password.fill(password);
    await this.botonEntrar.click();
  }
}
