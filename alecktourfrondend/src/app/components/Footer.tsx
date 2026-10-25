import { Plane } from "lucide-react";
import { Link } from "react-router";
import HalloweenAccentDiscreto from "./HalloweenAccentDiscreto";
import { useTema } from "../context/TemaContext";

export default function Footer() {
  const { temaActivo } = useTema();
  const esHalloween = temaActivo?.clave === "halloween";

  const footerLinks = {
    empresa: [
      { name: "Inicio", href: "/" },
      { name: "Viajes Corporativos", href: "/corporate" },
      { name: "Alik tours Rewards", href: "/benefits" },
      { name: "Contacto", href: "/contact" },
    ],
    soporte: [
      { name: "Preguntas Frecuentes", href: "/faq" },
      { name: "Información de Viaje", href: "/travel-info" },
      { name: "Buscar Destinos", href: "/search" },
    ],
    cuenta: [
      { name: "Mi Perfil", href: "/profile" },
      { name: "Preferencias de Viaje", href: "/preferences" },
    ],
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-brand pt-16 pb-8 relative overflow-hidden">
      {/* Un solo acento discreto de temporada -- máximo un elemento
          decorativo por sección, mismo criterio que el resto del sitio.
          Se retira solo (sin residuos) en cuanto el tema deja de ser
          Halloween, ver TemaContext.tsx. */}
      {esHalloween && (
        <HalloweenAccentDiscreto variante="telarana" posicion="top-left" tamano="lg" />
      )}
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand + Newsletter Column */}
          <div className="col-span-1 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-5 group w-fit">
              <div className="w-10 h-10 bg-gradient-to-br from-[var(--gold,#D9B25B)] to-[#B8912E] rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                <Plane className="w-5 h-5 text-[#2E2611]" />
              </div>
              <span className="text-2xl font-bold text-white">alik tours</span>
            </Link>

            <p
              className="text-sm leading-relaxed mb-6 max-w-sm"
              style={{ color: "rgba(243,228,232,0.75)" }}
            >
              Descubre el mundo con confianza. Ofrecemos experiencias de viaje
              personalizadas y seguras, con acompañamiento humano real en cada
              paso.
            </p>

            {/* Social */}
          </div>

          {/* Links Columns */}
          <div>
            <h3 className="footer-heading mb-6">Empresa</h3>
            <ul className="space-y-4">
              {footerLinks.empresa.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="footer-link text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="footer-heading mb-6">Ayuda e Información</h3>
            <ul className="space-y-4">
              {footerLinks.soporte.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="footer-link text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="footer-heading mb-6">Mi Cuenta</h3>
            <ul className="space-y-4">
              {footerLinks.cuenta.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="footer-link text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <hr className="footer-divider mb-8" />

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p
            className="text-sm text-center md:text-left"
            style={{ color: "rgba(243,228,232,0.55)" }}
          >
            © {currentYear} Alik tours. Todos los derechos reservados.
          </p>
          <div className="flex gap-6 text-sm">
            <Link to="/terms" className="footer-link">
              Términos y Condiciones
            </Link>
            <Link to="/privacy" className="footer-link">
              Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
