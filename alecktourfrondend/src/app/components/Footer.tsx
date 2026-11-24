import { useT } from "../i18n";
import BrandLogo from "./BrandLogo";
import { BRAND } from "../config/brand";
import { Link } from "react-router";
import BotonWhatsApp from "./BotonWhatsApp";
import HalloweenAccentDiscreto from "./HalloweenAccentDiscreto";
import MunecoNieve from "./temporada/MunecoNieve";
import { BotonAnimacionTemporada, NieveFooter } from "./temporada/NieveFooter";
import { useTema } from "../context/TemaContext";

export default function Footer() {
  const t = useT();
  const { temaActivo } = useTema();
  const esHalloween = temaActivo?.clave === "halloween";

  const footerLinks = {
    empresa: [
      { name: t("footer.inicio"), href: "/" },
      { name: t("footer.vuelos"), href: "/vuelos" },
      { name: t("footer.corporativos"), href: "/corporate" },
      { name: t("footer.rewards"), href: "/benefits" },
      { name: t("footer.comunidad"), href: "/comunidad" },
      { name: t("footer.contacto"), href: "/contact" },
    ],
    soporte: [
      { name: t("footer.comoReservar"), href: "/como-reservar" },
      { name: t("footer.faq"), href: "/faq" },
      { name: t("footer.pqrLargo"), href: "/pqr" },
      { name: t("footer.infoViaje"), href: "/travel-info" },
      { name: t("footer.buscar"), href: "/search" },
    ],
    cuenta: [
      { name: t("footer.perfil"), href: "/profile" },
      { name: t("footer.preferencias"), href: "/preferences" },
    ],
  };

  const currentYear = new Date().getFullYear();

  return (
    // Envoltorio sin overflow-hidden: el muñeco de nieve de temporada se
    // asoma por encima del borde del footer (el <footer> sí recorta).
    <div className="relative">
      <MunecoNieve />
    <footer className="footer-brand pt-16 pb-8 relative overflow-hidden">
      {/* Un solo acento discreto de temporada -- máximo un elemento
          decorativo por sección, mismo criterio que el resto del sitio.
          Se retira solo (sin residuos) en cuanto el tema deja de ser
          Halloween, ver TemaContext.tsx. */}
      {esHalloween && (
        <HalloweenAccentDiscreto variante="telarana" posicion="top-left" tamano="lg" />
      )}
      <NieveFooter />
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand + Newsletter Column */}
          <div className="col-span-1 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-5 group w-fit">
              <span className="bg-white rounded-full p-0.5 shadow-lg group-hover:shadow-xl transition-all">
                <BrandLogo size={44} />
              </span>
              <span className="text-2xl font-bold text-white">{BRAND.name}</span>
            </Link>

            <p
              className="text-sm leading-relaxed mb-6 max-w-sm"
              style={{ color: "rgba(243,228,232,0.75)" }}
            >
              Descubre el mundo con confianza. Ofrecemos experiencias de viaje
              personalizadas y seguras, con acompañamiento humano real en cada
              paso.
            </p>

            {/* Contacto directo: WhatsApp e Instagram oficiales (el bloque
                "Social" estaba vacío). */}
            <div className="flex flex-wrap items-center gap-3">
              <BotonWhatsApp texto="Escríbenos por WhatsApp" detalle={BRAND.whatsapp} />
              <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link text-sm font-semibold"
              >
                Instagram @aliktours
              </a>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h3 className="footer-heading mb-6">{t("footer.empresa")}</h3>
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
            <h3 className="footer-heading mb-6">{t("footer.ayuda")}</h3>
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
            <h3 className="footer-heading mb-6">{t("footer.cuenta")}</h3>
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
            © {currentYear} {BRAND.name}. Todos los derechos reservados. · RNT {BRAND.rnt}
            <span className="block mt-1">{t("footer.fundadores")}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <BotonAnimacionTemporada />
            <Link to="/terms" className="footer-link">
              {t("footer.terminos")}
            </Link>
            <Link to="/privacy" className="footer-link">
              {t("footer.privacidad")}
            </Link>
            <Link to="/pqr" className="footer-link">
              {t("footer.pqr")}
            </Link>
            <Link to="/accesibilidad" className="footer-link">
              {t("footer.accesibilidad")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
    </div>
  );
}
