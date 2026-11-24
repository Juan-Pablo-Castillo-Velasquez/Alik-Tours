import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useAuthModal } from "../context/AuthModalContext";
import { guardarVuelta } from "../utils/volverTrasLogin";

export function LoginRedirect() {
    const { openLogin } = useAuthModal();
    const [params] = useSearchParams();
    const volver = params.get("volver");

    useEffect(() => {
        // Si viene de una página que exige sesión (p. ej. el checkout), se
        // guarda para regresar a ella al iniciar sesión.
        guardarVuelta(volver);
        openLogin();
    }, []);

    // Mientras tanto se muestra el inicio (no el perfil, que también pide
    // sesión) con la ventana de inicio de sesión abierta.
    return <Navigate to={volver ? "/" : "/profile"} replace />;
}

export function RegisterRedirect() {
    const { openRegister } = useAuthModal();

    useEffect(() => {
        openRegister();
    }, []);

    return <Navigate to="/" replace />;
}