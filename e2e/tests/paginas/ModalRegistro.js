// Objeto de página del modal de registro (4 pasos). Sin aserciones.
export class ModalRegistro {
  constructor(page) {
    this.page = page;
    this.dialogo = page.getByRole('dialog', {
      name: /Crea tu cuenta|Cuéntanos de ti|Ya casi está|Confirma tu correo/,
    });
    this.error = this.dialogo.getByRole('alert');
    this.botonCrear = this.dialogo.getByRole('button', { name: 'Crear cuenta →' });
  }

  async abrir() {
    // /register abre el modal sobre el home (AuthRedirects.tsx)
    await this.page.goto('/register');
  }

  async pasoCuenta(correo, password) {
    await this.dialogo.getByLabel('Correo electrónico').fill(correo);
    await this.dialogo.getByLabel('Contraseña', { exact: true }).fill(password);
    await this.dialogo.getByLabel('Confirmar contraseña').fill(password);
    await this.dialogo.getByRole('button', { name: 'Continuar' }).click();
  }

  async pasoDatos({ nombre = 'Viajera', apellido = 'Prueba', cedula, celular = '3001234567', ciudad = 'Cartagena' }) {
    await this.dialogo.getByLabel('Nombre', { exact: true }).fill(nombre);
    await this.dialogo.getByLabel('Apellido').fill(apellido);
    await this.dialogo.getByLabel('Cédula').fill(cedula);
    await this.dialogo.getByLabel('Celular').fill(celular);
    await this.dialogo.getByLabel('Ciudad').selectOption(ciudad);
    await this.dialogo.getByLabel('Fecha de nacimiento').fill('1995-05-10');
    await this.dialogo.getByRole('button', { name: 'Continuar' }).click();
  }

  async aceptarTerminos() {
    // El checkbox real es "sr-only" (lo tapa una caja dibujada) y el texto de
    // su label tiene botones que abren los términos: por eso se marca con
    // force, que hace clic directo sobre el checkbox accesible.
    await this.dialogo.getByRole('checkbox', { name: /He leído y acepto/ }).check({ force: true });
  }

  async escribirCodigo(codigo) {
    for (const [i, digito] of [...codigo].entries()) {
      await this.dialogo.getByRole('textbox', { name: `Dígito ${i + 1} de 6` }).fill(digito);
    }
  }
}
