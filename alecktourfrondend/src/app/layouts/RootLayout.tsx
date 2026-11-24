import { Outlet } from "react-router";
import { Suspense } from "react";
import { Plane } from "lucide-react";
import { Toaster } from "../components/ui/sonner";
import ConfirmacionGlobal from "../components/ui/ConfirmacionGlobal";
import { AuthModalProvider } from "../context/AuthModalContext";
import WhatsAppButton from "../components/WhatsAppButton";
import CookieConsent from "../components/CookieConsent";
import GuiaUso from "../components/GuiaUso";
import AmbienteTemporada from "../components/temporada/AmbienteTemporada";

// Fallback mientras se descarga el bundle de la página que se está
// navegando (ver el comentario en routes.tsx -- cada página ahora carga
// bajo demanda con lazy()). En una conexión normal solo se ve una fracción
// de segundo, y en la primera carga de "/" ni siquiera aparece porque Home
// no es lazy.
function RouteFallback() {
    return (
        <div className="flex min-h-[60vh] w-full items-center justify-center">
            <Plane className="h-8 w-8 animate-pulse text-primary" />
        </div>
    );
}

export default function RootLayout() {
    return (
        <AuthModalProvider>
            <Toaster />
            <ConfirmacionGlobal />
            {/* La nieve (y demás partículas de temporada) va DETRÁS del
                contenido: la capa del ambiente tiene z-index -1 (ver
                temporada.css), así los copos solo se ven en el fondo y pasan
                por detrás de tarjetas, textos y formularios. Este contenedor
                NO crea un contexto de apilamiento propio: si lo hiciera, los
                modales de las páginas quedarían debajo de los botones
                flotantes (ayuda, asesor). */}
            <AmbienteTemporada />
            <div className="temporada-contenido">
                <Suspense fallback={<RouteFallback />}>
                    <Outlet />
                </Suspense>
            </div>
            <GuiaUso />
            <WhatsAppButton />
            <CookieConsent />
        </AuthModalProvider>
    );
}
