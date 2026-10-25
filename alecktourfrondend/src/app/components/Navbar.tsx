import {
  Building2,
  ChevronDown,
  Compass,
  Gift,
  LogIn,
  LogOut,
  Menu,
  Package,
  Phone,
  Plane,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useTema } from "../context/TemaContext";
import { ClienteResponse, clienteService } from "../services/cliente.service";
import { resolveImagenTema } from "../services/tema.service";
import { DURACION, EASE_ENTRADA, EASE_SUAVE } from "../utils/motion";
import { getTemaIcono } from "../utils/temaIconos";
import { resolveFotoUrl } from "./admin/types";
import LoginModal from "./LoginModal";
import NotificacionesBell from "./NotificacionesBell";
import RegisterModal from "./RegisterModal";
import { ThemeToggle } from "./ThemeToggle";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showOffersMenu, setShowOffersMenu] = useState(false);
  const [showBenefitsMenu, setShowBenefitsMenu] = useState(false);
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [cliente, setCliente] = useState<ClienteResponse | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, usuario, logout } = useAuth();
  const { temaActivo } = useTema();

  // Solo se muestra cuando hay un tema de temporada distinto al de marca --
  // así el navbar deja claro de un vistazo que Halloween/Navidad/Amor y
  // Amistad está activo, sin inventar un ícono si el admin no eligió uno
  // (getTemaIcono ya cae en Sparkles, pero ese caso no se muestra como
  // "temporada especial" porque es el mismo ícono que el tema de marca).
  const temaTemporadaActivo =
    temaActivo && !temaActivo.es_predeterminado ? temaActivo : null;
  const IconoTemaTemporada = temaTemporadaActivo
    ? getTemaIcono(temaTemporadaActivo.icono)
    : null;

  // Pestaña activa (estilo tabs de Despegar: subrayado persistente, no solo
  // al pasar el mouse) para los enlaces directos de la barra desktop.
  const isActivePath = (path: string) => location.pathname === path;

  useEffect(() => {
    if (isAuthenticated && usuario?.id_cliente) {
      clienteService
        .getById(usuario.id_cliente)
        .then(setCliente)
        .catch(() => setCliente(null));
    } else {
      setCliente(null);
    }
  }, [isAuthenticated, usuario?.id_cliente]);

  const handleLogout = () => {
    logout();
    setCliente(null);
    navigate("/");
  };

  function getRoleLabel(roles?: string[]) {
    if (!roles || roles.length === 0) return "Cliente";
    if (roles.includes("admin")) return "Admin";
    if (roles.includes("empleado")) return "Empleado";
    if (roles.includes("cliente")) return "Cliente";
    return roles[0];
  }

  const displayName = cliente
    ? `${cliente.nombre} ${cliente.apellido}`
    : (usuario?.username ?? "");

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: DURACION.lenta, ease: EASE_ENTRADA }}
        className="
          sticky top-0 z-[9999]
          navbar-surface
          text-foreground
        "
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Grid de 3 columnas (no flex justify-between) a propósito: con
              justify-between el grupo del centro no queda realmente
              centrado en la barra si los dos extremos tienen ancho
              distinto -- con grid-cols-[auto_1fr_auto] + justify-self-center
              en la columna del medio, los links de navegación sí quedan
              centrados de verdad sin importar cuánto ocupen el logo o las
              acciones de usuario. */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 h-[76px]">
            {/* =========================================================
                LOGO
            ========================================================= */}
            <div className="col-start-1 flex items-center gap-3 shrink-0">
              <Link to="/" className="flex items-center gap-3 group">
                <motion.div
                  whileHover={{
                    scale: 1.06,
                    rotate: 3,
                  }}
                  whileTap={{ scale: 0.96 }}
                  className="
                  relative
                  w-11 h-11
                  rounded-[14px]
                  flex items-center justify-center
                  bg-primary
                  text-primary-foreground
                  shadow-sm
                  shadow-primary/15
                  overflow-hidden
                "
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />

                  <Plane className="relative w-[19px] h-[19px]" />
                </motion.div>

                <div className="leading-none">
                  <div
                    className="
                    text-[22px]
                    tracking-[-0.5px]
                    text-primary
                  "
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontWeight: 800,
                    }}
                  >
                    {/* Nombre de marca real: coincide con el <title> del sitio
                      (index.html) y con SITE_NAME en useSeoMeta.ts. El navbar
                      antes decía "AlekTours" (sin la segunda "c") -- una marca
                      que se escribe distinto en su propio logo que en la
                      pestaña del navegador resta confianza, así que se unifica
                      acá con el nombre oficial. */}
                    Alik tours
                  </div>

                  <div
                    className="
                    mt-1
                    text-[8px]
                    uppercase
                    tracking-[1.8px]
                    font-bold
                    text-muted-foreground/70
                  "
                  >
                    Agencia de viajes
                  </div>
                </div>
              </Link>

              {temaTemporadaActivo && IconoTemaTemporada && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: DURACION.base, ease: EASE_SUAVE }}
                  title={`Tema de temporada activo: ${temaTemporadaActivo.nombre}`}
                  className="hidden sm:flex items-center gap-1.5 pl-1.5 pr-3 xl:pr-1.5 2xl:pr-3 py-1.5 rounded-full border shrink-0"
                  style={{
                    borderColor: "rgba(var(--primary-rgb), 0.28)",
                    background: "rgba(var(--primary-rgb), 0.1)",
                    color: "var(--primary)",
                  }}
                >
                  {temaTemporadaActivo.imagen_url ? (
                    <img
                      src={resolveImagenTema(temaTemporadaActivo.imagen_url)}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover border border-white/70 shadow-sm shrink-0"
                    />
                  ) : (
                    <IconoTemaTemporada className="w-3.5 h-3.5 ml-1 shrink-0" />
                  )}
                  {/* Entre xl y 2xl compite por espacio con la barra de nav
                    desktop completa (que solo aparece desde xl) -- se
                    esconde la etiqueta y queda solo el ícono/imagen para
                    que nada se vea forzado a partirse en dos líneas. */}
                  <span className="hidden sm:inline xl:hidden 2xl:inline text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                    {temaTemporadaActivo.nombre}
                  </span>
                </motion.div>
              )}
            </div>

            {/* =========================================================
                DESKTOP NAVIGATION
            ========================================================= */}
            <div className="col-start-2 justify-self-center hidden xl:flex items-center gap-0.5 2xl:gap-1 text-[12px] font-semibold whitespace-nowrap">
              {/* OFERTAS */}
              <div className="relative shrink-0">
                <button
                  onMouseEnter={() => setShowOffersMenu(true)}
                  onMouseLeave={() => setShowOffersMenu(false)}
                  className="
                    group
                    relative
                    flex items-center gap-1.5
                    px-2.5 2xl:px-3 py-2.5
                    rounded-xl
                    text-foreground/75
                    hover:text-primary
                    hover:bg-primary/[0.05]
                    transition-all
                  "
                >
                  <Plane className="w-3.5 h-3.5 text-primary transition-transform group-hover:-translate-y-0.5" />

                  <span>Ofertas</span>

                  <ChevronDown className="w-3 h-3 text-muted-foreground" />

                  <span className="absolute bottom-1 left-3 right-3 h-[2px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" />
                </button>

                <AnimatePresence>
                  {showOffersMenu && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                      }}
                      transition={{
                        duration: DURACION.rapida,
                        ease: EASE_SUAVE,
                      }}
                      onMouseEnter={() => setShowOffersMenu(true)}
                      onMouseLeave={() => setShowOffersMenu(false)}
                      className="
                        absolute
                        top-full
                        left-0
                        mt-2
                        w-[270px]
                        bg-card
                        text-card-foreground
                        rounded-2xl
                        shadow-lg
                        shadow-black/5
                        border border-border/60
                        overflow-hidden
                        p-2
                      "
                    >
                      <div className="px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-primary">
                          Descubre tu próximo viaje
                        </p>
                      </div>

                      <Link
                        to="/search"
                        className="
                          flex items-center gap-3
                          px-3 py-3
                          rounded-xl
                          hover:bg-accent
                          transition-all
                          group/item
                        "
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Plane className="w-4 h-4 text-primary" />
                        </div>

                        <div>
                          <span className="block text-sm font-bold">
                            Todos los destinos
                          </span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            Explora todas nuestras opciones
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* HOTELES */}
              <Link
                to="/search"
                className={`
                  group
                  relative
                  flex items-center gap-1.5
                  px-2.5 2xl:px-3 py-2.5
                  rounded-xl
                  shrink-0
                  transition-all
                  ${isActivePath("/search") ? "text-primary bg-primary/[0.06]" : "text-foreground/75 hover:text-primary hover:bg-primary/[0.05]"}
                `}
              >
                <Building2 className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform shrink-0" />
                Hoteles
                <span
                  className={`absolute bottom-1 left-3 right-3 h-[2px] bg-primary rounded-full transition-transform origin-left ${isActivePath("/search") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}
                />
              </Link>

              {/* INFO DE VIAJE — antes escondida dentro de "Más", ahora es su
                  propia pestaña visible para que la barra se sienta más
                  informativa (estilo Despegar) sin inventar secciones que
                  el sitio no tiene realmente. */}
              <Link
                to="/travel-info"
                className={`
                  group
                  relative
                  flex items-center gap-1.5
                  px-2.5 2xl:px-3 py-2.5
                  rounded-xl
                  shrink-0
                  transition-all
                  ${isActivePath("/travel-info") ? "text-primary bg-primary/[0.06]" : "text-foreground/75 hover:text-primary hover:bg-primary/[0.05]"}
                `}
              >
                <Compass className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform shrink-0" />
                Info de viaje
                <span
                  className={`absolute bottom-1 left-3 right-3 h-[2px] bg-primary rounded-full transition-transform origin-left ${isActivePath("/travel-info") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}
                />
              </Link>

              {/* PAQUETES - CTA COMERCIAL */}
              <Link
                to="/packages"
                className="
                  group
                  flex items-center gap-1.5
                  px-2.5 2xl:px-3.5 py-2.5
                  rounded-xl
                  shrink-0
                  bg-primary/[0.08]
                  text-primary
                  hover:bg-primary
                  hover:text-primary-foreground
                  transition-all
                  shadow-sm
                "
              >
                <Package className="w-3.5 h-3.5 group-hover:scale-110 transition-transform shrink-0" />
                <span>Paquetes</span>
              </Link>

              {/* BENEFICIOS */}
              <div className="relative shrink-0">
                <button
                  onMouseEnter={() => setShowBenefitsMenu(true)}
                  onMouseLeave={() => setShowBenefitsMenu(false)}
                  className="
                    group
                    flex items-center gap-1.5
                    px-2.5 2xl:px-3 py-2.5
                    rounded-xl
                    text-foreground/75
                    hover:text-primary
                    hover:bg-primary/[0.05]
                    transition-all
                  "
                >
                  <Gift className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform shrink-0" />
                  Beneficios
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>

                <AnimatePresence>
                  {showBenefitsMenu && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                      }}
                      onMouseEnter={() => setShowBenefitsMenu(true)}
                      onMouseLeave={() => setShowBenefitsMenu(false)}
                      className="
                        absolute
                        top-full
                        left-0
                        mt-2
                        w-[270px]
                        bg-card
                        rounded-2xl
                        shadow-lg
                        shadow-black/5
                        border border-border/60
                        overflow-hidden
                        p-2
                      "
                    >
                      <div className="px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-primary">
                          Viajar tiene sus ventajas
                        </p>
                      </div>

                      <Link
                        to="/benefits"
                        className="
                          flex items-center gap-3
                          px-3 py-3
                          rounded-xl
                          hover:bg-accent
                          transition-all
                        "
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Gift className="w-4 h-4 text-primary" />
                        </div>

                        <div>
                          <span className="block text-sm font-bold">
                            Programa de puntos
                          </span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            Obtén beneficios en tus viajes
                          </span>
                        </div>
                      </Link>

                      <Link
                        to="/corporate"
                        className="
                          flex items-center gap-3
                          px-3 py-3
                          rounded-xl
                          hover:bg-accent
                          transition-all
                        "
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>

                        <div>
                          <span className="block text-sm font-bold">
                            Convenios empresariales
                          </span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            Soluciones para empresas
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* MÁS */}
              <div className="relative shrink-0">
                <button
                  onMouseEnter={() => setShowInfoMenu(true)}
                  onMouseLeave={() => setShowInfoMenu(false)}
                  className="
                    group
                    flex items-center gap-1.5
                    px-2.5 2xl:px-3 py-2.5
                    rounded-xl
                    text-foreground/75
                    hover:text-primary
                    hover:bg-primary/[0.05]
                    transition-all
                  "
                >
                  Más
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>

                <AnimatePresence>
                  {showInfoMenu && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                      }}
                      onMouseEnter={() => setShowInfoMenu(true)}
                      onMouseLeave={() => setShowInfoMenu(false)}
                      className="
                        absolute
                        top-full
                        right-0
                        mt-2
                        w-[230px]
                        bg-card
                        rounded-2xl
                        shadow-lg
                        shadow-black/5
                        border border-border/60
                        overflow-hidden
                        p-2
                      "
                    >
                      <Link
                        to="/faq"
                        className="block px-4 py-3 rounded-xl hover:bg-accent transition-all"
                      >
                        <span className="block text-sm font-bold">
                          Preguntas frecuentes
                        </span>
                      </Link>

                      <Link
                        to="/contact"
                        className="block px-4 py-3 rounded-xl hover:bg-accent transition-all"
                      >
                        <span className="block text-sm font-bold">
                          Contáctanos
                        </span>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* =========================================================
                RIGHT SIDE
            ========================================================= */}
            {/* Separador visual (borde izquierdo) para que este grupo de
                acciones de usuario se lea como un bloque aparte del menú
                de navegación, no como más links sueltos. */}
            <div className="col-start-3 hidden xl:flex items-center gap-2 2xl:gap-3 pl-4 border-l border-border/60 shrink-0">
              {/* CONTACT */}
              <div
                className="
                  hidden 2xl:flex
                  items-center gap-2.5
                  px-3 py-2
                  rounded-xl
                  bg-muted/40
                  border border-border/40
                "
              >
                <div
                  className="
                  w-8 h-8
                  rounded-lg
                  bg-primary/10
                  flex items-center justify-center
                "
                >
                  <Phone className="w-3.5 h-3.5 text-primary" />
                </div>

                <div className="leading-tight">
                  <small className="text-[8px] text-muted-foreground">
                    Asesoría 24/7
                  </small>
                </div>
              </div>

              {isAuthenticated && cliente && (
                <NotificacionesBell idCliente={cliente.id_cliente} />
              )}

              <ThemeToggle />

              {/* AUTH */}
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <Link
                    to="/profile"
                    className="
                      group
                      flex items-center gap-3
                      pl-2 pr-3.5 py-2
                      rounded-full
                      border border-border/70
                      bg-card
                      hover:border-primary/30
                      hover:bg-primary/[0.04]
                      transition-all
                    "
                  >
                    <div
                      className="
                      relative
                      w-10 h-10
                      rounded-full
                      bg-gradient-to-br from-primary to-[#4A1023]
                      flex items-center justify-center
                      ring-2 ring-primary/15
                      group-hover:ring-primary/40
                      transition-all
                      overflow-hidden
                      shrink-0
                    "
                    >
                      {usuario?.foto_perfil ? (
                        <img
                          src={resolveFotoUrl(usuario.foto_perfil)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User
                          className="
                          w-4.5 h-4.5
                          text-primary-foreground
                        "
                        />
                      )}
                    </div>

                    <div className="leading-tight max-w-[130px]">
                      <span className="block truncate text-[13px] font-bold text-foreground">
                        {displayName}
                      </span>

                      <span
                        className="block text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--gold)" }}
                      >
                        {getRoleLabel(usuario?.roles)}
                      </span>
                    </div>

                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </Link>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="
                      w-9 h-9
                      flex items-center justify-center
                      rounded-xl
                      text-muted-foreground
                      hover:text-destructive
                      hover:bg-destructive/10
                      transition-all
                    "
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-4 h-4" />
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  whileHover={{
                    scale: 1.02,
                    y: -1,
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLoginModal(true)}
                  className="
                    group
                    flex items-center gap-2
                    px-4 py-2.5
                    rounded-xl
                    border border-primary/20
                    bg-primary/[0.06]
                    text-primary
                    hover:bg-primary
                    hover:text-primary-foreground
                    hover:border-primary
                    transition-all
                    font-bold
                    text-[11px]
                  "
                >
                  <LogIn className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  Iniciar sesión
                </motion.button>
              )}
            </div>

            {/* =========================================================
                MOBILE
            ========================================================= */}
            <div className="col-start-3 flex items-center gap-2 xl:hidden">
              {isAuthenticated && cliente && (
                <NotificacionesBell idCliente={cliente.id_cliente} />
              )}

              <ThemeToggle />

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="
                  w-10 h-10
                  flex items-center justify-center
                  rounded-xl
                  border border-border/60
                  hover:bg-muted
                  text-foreground
                  transition-all
                "
              >
                {isMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </motion.button>
            </div>
          </div>

          {/* =========================================================
              MOBILE MENU
          ========================================================= */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{
                  opacity: 0,
                  height: 0,
                }}
                animate={{
                  opacity: 1,
                  height: "auto",
                }}
                exit={{
                  opacity: 0,
                  height: 0,
                }}
                transition={{ duration: DURACION.base, ease: EASE_SUAVE }}
                className="
                  xl:hidden
                  border-t border-border/50
                  overflow-hidden
                  bg-background
                "
              >
                <div className="py-4 space-y-1">
                  <Link
                    to="/"
                    className="
                      block px-4 py-3
                      text-sm font-semibold
                      text-foreground
                      hover:bg-muted
                      rounded-xl
                      transition-all
                    "
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Inicio
                  </Link>

                  <Link
                    to="/packages"
                    className="
                      flex items-center justify-between
                      px-4 py-3
                      text-sm font-semibold
                      text-primary
                      bg-primary/[0.06]
                      hover:bg-primary/[0.1]
                      rounded-xl
                      transition-all
                    "
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="flex items-center gap-3">
                      <Package className="w-4 h-4" />
                      Explorar paquetes
                    </span>

                    <ChevronDown className="w-4 h-4 -rotate-90" />
                  </Link>

                  <Link
                    to="/search"
                    className="
                      flex items-center gap-3
                      px-4 py-3
                      text-sm font-semibold
                      text-foreground
                      hover:bg-muted
                      rounded-xl
                      transition-all
                    "
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Building2 className="w-4 h-4 text-primary" />
                    Hoteles
                  </Link>

                  <Link
                    to="/benefits"
                    className="
                      flex items-center gap-3
                      px-4 py-3
                      text-sm font-semibold
                      text-foreground
                      hover:bg-muted
                      rounded-xl
                      transition-all
                    "
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Gift className="w-4 h-4 text-primary" />
                    Beneficios
                  </Link>

                  <Link
                    to="/travel-info"
                    className="
                      flex items-center gap-3
                      px-4 py-3
                      text-sm font-semibold
                      text-foreground
                      hover:bg-muted
                      rounded-xl
                      transition-all
                    "
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Compass className="w-4 h-4 text-primary" />
                    Info de viaje
                  </Link>

                  <Link
                    to="/contact"
                    className="
                      flex items-center gap-3
                      px-4 py-3
                      text-sm font-semibold
                      text-foreground
                      hover:bg-muted
                      rounded-xl
                      transition-all
                    "
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Phone className="w-4 h-4 text-primary" />
                    Contáctanos
                  </Link>

                  {/* CONTACT CARD */}
                  <div
                    className="
                    mt-3
                    mx-1
                    p-4
                    rounded-2xl
                    bg-muted/50
                    border border-border/50
                  "
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="
                        w-10 h-10
                        rounded-xl
                        bg-primary/10
                        flex items-center justify-center
                      "
                      >
                        <Phone className="w-4 h-4 text-primary" />
                      </div>

                      <div>
                        <p className="text-xs font-bold">¿Necesitas ayuda?</p>

                        <p className="text-[11px] text-muted-foreground">
                          {/* Mismo número real que ya usa WhatsAppButton.tsx
                              (573228127104) -- antes este card mostraba un
                              +57 601 123 4567 de relleno que no coincidía con
                              ningún canal real de contacto del sitio. */}
                          +57 322 812 7104 · Asesoría 24/7
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AUTH */}
                  {isAuthenticated ? (
                    <div className="pt-3 mt-2 border-t border-border/50">
                      <Link
                        to="/profile"
                        className="
                          flex items-center gap-3
                          px-4 py-3
                          bg-primary
                          text-primary-foreground
                          rounded-xl
                          shadow-sm
                          shadow-primary/15
                        "
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <div
                          className="
                          w-9 h-9
                          rounded-lg
                          bg-primary-foreground/15
                          flex items-center justify-center
                          overflow-hidden
                        "
                        >
                          {usuario?.foto_perfil ? (
                            <img
                              src={resolveFotoUrl(usuario.foto_perfil)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex flex-col items-start leading-tight">
                          <span className="font-bold text-sm">
                            {displayName}
                          </span>

                          <span className="text-[9px] opacity-70 uppercase tracking-wider">
                            {getRoleLabel(usuario?.roles)}
                          </span>
                        </div>
                      </Link>

                      <button
                        onClick={handleLogout}
                        className="
                          w-full
                          mt-2
                          px-4 py-3
                          text-destructive
                          hover:bg-destructive/10
                          rounded-xl
                          text-center
                          font-semibold
                          text-sm
                          transition-all
                        "
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  ) : (
                    <div
                      className="
                      flex flex-col gap-2
                      pt-3 mt-2
                      border-t border-border/50
                    "
                    >
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setShowLoginModal(true);
                        }}
                        className="
                          flex items-center justify-center gap-2
                          px-4 py-3
                          bg-primary
                          text-primary-foreground
                          rounded-xl
                          text-center
                          font-bold
                          text-sm
                          shadow-sm
                          shadow-primary/15
                        "
                      >
                        <LogIn className="w-4 h-4" />
                        Iniciar sesión
                      </button>

                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setShowRegisterModal(true);
                        }}
                        className="
                          px-4 py-3
                          border border-border
                          text-foreground
                          rounded-xl
                          text-center
                          font-semibold
                          text-sm
                          hover:bg-muted
                          transition-all
                        "
                      >
                        Crear cuenta
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      {/* Modales fuera del nav sticky */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToRegister={() => {
          setShowLoginModal(false);
          setShowRegisterModal(true);
        }}
      />

      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSwitchToLogin={() => {
          setShowRegisterModal(false);
          setShowLoginModal(true);
        }}
      />
    </>
  );
}
