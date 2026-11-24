import { Outlet } from "react-router";
import { Suspense } from "react";
import { Plane } from "lucide-react";
import { Toaster } from "../components/ui/sonner";
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
            <Toaster position="top-right" richColors closeButton />
            {/* La nieve (y demás partículas de temporada) va DETRÁS del
                contenido: la capa del ambiente queda en z-0 y la página en
                z-[1], así los copos solo se ven en el fondo y pasan por
                detrás de tarjetas, textos y formularios, sin taparlos. */}
            <AmbienteTemporada />
            <div className="temporada-contenido relative z-[1]">
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
