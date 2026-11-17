import { ComponentProps, lazy, Suspense, useEffect, useState } from "react";

// Los modales de login y registro pesan ~90 KB de código (validaciones,
// borradores, términos) y casi nadie los abre al entrar. Antes viajaban en
// el paquete inicial de TODAS las páginas; ahora se descargan:
//  - en segundo plano, cuando el navegador queda libre tras cargar, y
//  - al abrirlos, si aún no habían llegado.
// Una vez abiertos quedan montados para que su animación de cierre funcione.
const cargarLogin = () => import("./LoginModal");
const cargarRegistro = () => import("./RegisterModal");
const LoginModal = lazy(cargarLogin);
const RegisterModal = lazy(cargarRegistro);

let precargado = false;
function precargarEnReposo() {
  if (precargado || typeof window === "undefined") return;
  precargado = true;
  const tarea = () => {
    cargarLogin().catch(() => {});
    cargarRegistro().catch(() => {});
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback;
  if (ric) ric(tarea, { timeout: 4000 });
  else window.setTimeout(tarea, 2500);
}

function useMontadoTrasAbrir(isOpen: boolean) {
  const [montado, setMontado] = useState(isOpen);
  useEffect(() => {
    precargarEnReposo();
  }, []);
  useEffect(() => {
    if (isOpen) setMontado(true);
  }, [isOpen]);
  return montado || isOpen;
}

export function LoginModalDiferido(props: ComponentProps<typeof LoginModal>) {
  if (!useMontadoTrasAbrir(props.isOpen)) return null;
  return (
    <Suspense fallback={null}>
      <LoginModal {...props} />
    </Suspense>
  );
}

export function RegisterModalDiferido(props: ComponentProps<typeof RegisterModal>) {
  if (!useMontadoTrasAbrir(props.isOpen)) return null;
  return (
    <Suspense fallback={null}>
      <RegisterModal {...props} />
    </Suspense>
  );
}
