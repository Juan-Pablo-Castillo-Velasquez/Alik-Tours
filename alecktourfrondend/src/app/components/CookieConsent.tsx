import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "cookie_consent_ack";

// Aviso honesto de almacenamiento local: Alik Tours no usa cookies de
// publicidad de terceros, solo localStorage esencial (sesión, tema —
// ver PrivacyPolicy.tsx sección 3). Por eso este banner no ofrece un
// falso "rechazar" que en realidad no cambiaría nada técnicamente; solo
// informa y deja constancia de que el usuario lo vio, una vez por
// navegador (localStorage, nunca se vuelve a mostrar tras aceptarlo).
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Si el navegador bloquea localStorage (modo privado estricto, etc.)
      // simplemente no mostramos el banner en vez de romper la página.
    }
  }, []);

  function aceptar() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // best-effort — si falla, el banner reaparecerá la próxima visita,
      // no es un problema crítico.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-5">
      <div className="max-w-3xl mx-auto bg-card border border-border rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Cookie className="w-4.5 h-4.5 text-primary" />
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1">
          Usamos almacenamiento local esencial para mantener tu sesión iniciada y recordar tus preferencias.
          No usamos cookies de publicidad de terceros.{" "}
          <Link to="/privacy" className="text-primary font-medium hover:underline">
            Más información
          </Link>
          .
        </p>
        <button
          onClick={aceptar}
          className="w-full sm:w-auto flex-shrink-0 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-95 transition-all"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
