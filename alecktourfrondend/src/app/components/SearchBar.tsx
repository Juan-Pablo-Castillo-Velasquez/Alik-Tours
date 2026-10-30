import {
  Building2,
  Calendar,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { DestinoReal, hotelService } from "../services/hotel.service";

interface MenuRect {
  top: number;
  left: number;
  width: number;
}

type ModoBusqueda = "hoteles" | "paquetes";

export default function SearchBar() {
  const navigate = useNavigate();
  const destinoWrapperRef = useRef<HTMLDivElement>(null);

  // Modo de búsqueda: hoteles (comportamiento original, sin cambios) o
  // paquetes (filtra por destino sobre /packages, ver Packages.tsx). No
  // agregamos un tercer modo "Vuelos" porque la app no tiene búsqueda de
  // vuelos real -- un tab así sería decorativo y no llevaría a nada.
  const [modo, setModo] = useState<ModoBusqueda>("hoteles");

  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [people, setPeople] = useState("1");

  // Antes los campos de fecha no tenían ningún límite: se podía buscar con
  // "Entrada" en el pasado o "Salida" antes que "Entrada". El mismo
  // constraint ya existe en Checkout.tsx (min en los inputs + validación
  // fechaFin<=fechaInicio) — se replica acá para que el buscador nunca deje
  // armar una búsqueda con fechas imposibles.
  const todayStr = new Date().toISOString().slice(0, 10);
  const [showDestinations, setShowDestinations] = useState(false);
  const [filteredDestinations, setFilteredDestinations] = useState<DestinoReal[]>([]);
  // Posición del dropdown calculada en coordenadas de viewport, para
  // renderizarlo con un portal (ver comentario más abajo) en vez de dejarlo
  // anidado dentro de la barra.
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);

  // Precarga destinos disponibles apenas se monta la barra (sin esperar a
  // que el usuario haga foco ni escriba) — así el dropdown ya tiene datos
  // reales listos para mostrarse "automáticamente" en cuanto se abre.
  //
  // Antes esto usaba destinoService.getSugerencias, que lee el catálogo
  // `destinos` (pensado para servicios/actividades, sin ninguna relación
  // con Hotel.ciudad) -- podía sugerir una ciudad para la que no existía
  // ningún hotel ni paquete real, así que buscar "encontraba" un destino
  // pero la búsqueda en sí siempre daba vacío. hotelService.getDestinosSugeridos
  // agrupa los hoteles reales por ciudad, así que toda sugerencia tiene
  // inventario real detrás (ver HotelRepository.get_destinos_reales).
  useEffect(() => {
    hotelService
      .getDestinosSugeridos("", 8)
      .then(setFilteredDestinations)
      .catch(() => setFilteredDestinations([]));
  }, []);

  // Autocompletado real contra la base de datos (con debounce para no
  // disparar una petición en cada tecla). Con destination vacío el backend
  // ya devuelve destinos reales (no filtra), así que el dropdown muestra
  // opciones disponibles incluso antes de escribir.
  useEffect(() => {
    if (!showDestinations) return;
    const timeout = setTimeout(() => {
      hotelService
        .getDestinosSugeridos(destination.trim(), 8)
        .then(setFilteredDestinations)
        .catch(() => setFilteredDestinations([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [destination, showDestinations]);

  // El dropdown se renderiza con un portal directo a <body> (ver el bloque
  // de sugerencias más abajo) porque la barra vive dentro del Hero, cuyo
  // fondo (foto/video) necesita "overflow-hidden" y crea un contexto de
  // apilamiento propio: cualquier sección normal que venga después en el
  // HTML (ej. "Benefits") termina pintándose ENCIMA de un dropdown
  // absolute que se sale de esa caja, aunque tenga z-index alto — es una
  // limitación real de CSS (contextos de apilamiento), no algo que se
  // arregle subiendo el z-index dentro del Hero. Un portal a <body> saca
  // el dropdown de esa jerarquía por completo. Como usa position:fixed,
  // hay que recalcular su posición en cada apertura y si la página hace
  // scroll o cambia de tamaño mientras está abierto.
  useEffect(() => {
    if (!showDestinations) return;

    const actualizarPosicion = () => {
      const rect = destinoWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };

    actualizarPosicion();
    window.addEventListener("scroll", actualizarPosicion, true);
    window.addEventListener("resize", actualizarPosicion);
    return () => {
      window.removeEventListener("scroll", actualizarPosicion, true);
      window.removeEventListener("resize", actualizarPosicion);
    };
  }, [showDestinations]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!destination.trim()) return;

    if (modo === "hoteles") {
      if (startDate && endDate && endDate <= startDate) return;

      const params = new URLSearchParams({
        destination: destination.trim(),
        start: startDate,
        end: endDate,
        people,
      });

      navigate(`/search?${params.toString()}`);
      return;
    }

    // Modo paquetes: Packages.tsx lee "destino" de la URL y aplica un
    // filtro real (client-side, sobre los paquetes ya cargados) por
    // nombre/ciudad de destino/ciudad de salida -- no es un campo decorativo.
    const params = new URLSearchParams({ destino: destination.trim() });
    navigate(`/packages?${params.toString()}`);
  };

  const selectDestination = (value: string) => {
    setDestination(value);
    setShowDestinations(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.25,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full"
    >
      {/* Encabezado, breve — la barra habla por sí sola */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span
          className="text-white text-[15px]"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}
        >
          {modo === "hoteles" ? "Encuentra tu próximo hotel" : "Encuentra tu próximo paquete"}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5" />
          Reserva segura
        </span>
      </div>

      {/* Tabs Hoteles / Paquetes. Sin tab de "Vuelos": la app no tiene
          búsqueda de vuelos real, así que un tab así sería decorativo. */}
      <div className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full p-1 mb-3 border border-white/25">
        <ModoTab
          active={modo === "hoteles"}
          onClick={() => setModo("hoteles")}
          icon={Building2}
          label="Hoteles"
        />
        <ModoTab
          active={modo === "paquetes"}
          onClick={() => setModo("paquetes")}
          icon={Package}
          label="Paquetes"
        />
      </div>

      {/* rounded-2xl en vez del rounded-full de antes: el radio "píldora"
          completa no es el que usa el resto del sitio (tarjetas, botones,
          paginación -- todo en rounded-xl/2xl), así que se ajusta acá
          también. Fondo con un leve tinte de marca (color-mix con
          --primary) en vez de blanco puro, para que no compita "blanco
          sobre blanco" con el resto de tarjetas de la página. */}
      <form
        onSubmit={handleSearch}
        className="rounded-2xl w-full text-foreground relative border border-primary/10 flex flex-col sm:flex-row items-stretch divide-y sm:divide-y-0 sm:divide-x divide-border"
        style={{
          background: "color-mix(in srgb, var(--primary) 4%, white)",
          boxShadow:
            "0 24px 60px -16px rgba(var(--primary-rgb), 0.32), 0 4px 16px rgba(0,0,0,0.04)",
          // Antes de esto, en modo oscuro (sitio en .dark o el SO con
          // preferencia de tema oscuro) el navegador dibujaba el texto y
          // el ícono del selector nativo de <input type="date"> / <select>
          // en su variante clara del sistema -- porque nunca se declaraba
          // ningún color-scheme, así que Chrome/Firefox usan la
          // preferencia del sistema para pintarlos, no las clases .dark
          // del sitio. El fondo de esta barra es SIEMPRE casi blanco
          // (arriba, color-mix con blanco fijo), así que ese texto
          // quedaba blanco sobre blanco -- ilegible. Fijar color-scheme a
          // "light" acá fuerza que las fechas y el <select> de huéspedes
          // siempre se pinten con su variante clara (texto oscuro),
          // coherente con el fondo de esta barra sin importar el tema del
          // sitio o del sistema operativo. Se hereda a todos los inputs
          // de este <form>, así que basta con declararlo una vez acá.
          colorScheme: "light",
        }}
      >
        {/* DESTINO — presente en ambos modos */}
        <div ref={destinoWrapperRef} className="relative flex-[1.3] min-w-0">
          <Segment label="Destino" icon={MapPin}>
            <input
              type="text"
              value={destination}
              onFocus={() => setShowDestinations(true)}
              onBlur={() => {
                // Pequeño delay para que el click en una sugerencia
                // (selectDestination) alcance a registrarse antes de cerrar.
                setTimeout(() => setShowDestinations(false), 150);
              }}
              onChange={(e) => {
                setDestination(e.target.value);
                setShowDestinations(true);
              }}
              placeholder={modo === "hoteles" ? "¿A qué ciudad viajas?" : "¿A qué destino quieres ir?"}
              required
              autoComplete="off"
              className="w-full bg-transparent text-[13px] font-semibold outline-none truncate placeholder:text-[#b9adb2] placeholder:font-normal"
            />
          </Segment>
        </div>

        {modo === "hoteles" && (
          <>
            {/* ENTRADA */}
            <div className="flex-1 min-w-0">
              <Segment label="Entrada" icon={Calendar}>
                <input
                  type="date"
                max="2100-12-31"
                  value={startDate}
                  min={todayStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full bg-transparent text-[13px] font-semibold outline-none"
                />
              </Segment>
            </div>

            {/* SALIDA */}
            <div className="flex-1 min-w-0">
              <Segment label="Salida" icon={Calendar}>
                <input
                  type="date"
                max="2100-12-31"
                  value={endDate}
                  min={startDate || todayStr}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full bg-transparent text-[13px] font-semibold outline-none"
                />
              </Segment>
            </div>

            {/* HUÉSPEDES */}
            <div className="flex-1 min-w-0">
              <Segment label="Huéspedes" icon={Users}>
                <select
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  className="w-full bg-transparent text-[13px] font-semibold outline-none appearance-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? "huésped" : "huéspedes"}
                    </option>
                  ))}
                </select>
              </Segment>
            </div>
          </>
        )}

        {/* BUSCAR — dorado/ámbar (--gold), no --primary: el resto de la
            barra (borde, tabs activos, íconos) ya usa el color primario
            de marca: si el botón también fuera ese mismo color, el CTA
            más importante de la barra se mezclaría con su propio marco
            en vez de resaltar. El acento secundario de marca es
            justamente para esto. */}
        <motion.button
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="m-1.5 sm:m-1.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 py-3.5 sm:py-0 sm:px-7 shrink-0"
          style={{
            background: "var(--gold)",
            color: "var(--gold-foreground)",
            boxShadow: "0 8px 20px -6px rgba(var(--gold-rgb), 0.5)",
          }}
        >
          <Search className="w-4 h-4" />
          {modo === "hoteles" ? "Buscar hoteles" : "Buscar paquetes"}
        </motion.button>
      </form>

      <div className="flex items-center justify-center sm:justify-end pt-2 px-1">
        <span className="flex items-center gap-1.5 text-[11px] text-white/80">
          <ShieldCheck className="w-3.5 h-3.5" />
          Pagos seguros
        </span>
      </div>

      {/* SUGERENCIAS — portal a <body> (ver comentario junto al useEffect
          de arriba); position:fixed con coordenadas de viewport calculadas
          desde el propio input, así nunca queda recortado ni tapado por
          las secciones que vienen después del Hero. */}
      {createPortal(
        <AnimatePresence>
            {showDestinations && menuRect && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                style={{
                  position: "fixed",
                  top: menuRect.top,
                  left: menuRect.left,
                  width: menuRect.width,
                }}
                className="z-[10000] bg-card rounded-xl border border-border shadow-xl overflow-hidden min-w-[240px]"
              >
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    {destination.trim() ? "Destinos disponibles" : "Destinos populares"}
                  </p>
                </div>

                {filteredDestinations.length > 0 ? (
                  <div className="py-1.5">
                    {filteredDestinations.map((item) => (
                      <button
                        key={item.ciudad}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectDestination(item.ciudad)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-primary/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-foreground truncate">
                            {item.ciudad}
                          </p>

                          {/* Conteo real de hoteles (nunca inventado, ver
                              DestinoRealResponse) -- reemplaza el antiguo
                              "ciudad · país" que ya era redundante con la
                              línea de arriba (era la misma ciudad). */}
                          <p className="text-[10px] text-muted-foreground">
                            {[
                              item.pais,
                              `${item.total_hoteles} ${item.total_hoteles === 1 ? "hotel" : "hoteles"}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center">
                    <MapPin className="w-5 h-5 text-muted-foreground mx-auto mb-2" />

                    <p className="text-xs font-semibold text-muted-foreground">
                      Buscaremos este destino
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-1">
                      Presiona Buscar para consultar los alojamientos.
                    </p>
                  </div>
                )}

                <div className="px-3 py-2 border-t border-border bg-muted">
                  <p className="text-[9px] text-muted-foreground">
                    Escribe una ciudad o país para encontrar hoteles.
                  </p>
                </div>
              </motion.div>
            )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}

function ModoTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
        active ? "text-primary" : "text-white/85 hover:text-white"
      }`}
    >
      {active && (
        <motion.span
          layoutId="searchbar-modo-activo"
          className="absolute inset-0 bg-white rounded-full shadow-sm"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function Segment({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3 h-full flex flex-col justify-center min-w-0">
      <label className="flex items-center gap-1 text-[9px] uppercase tracking-wide font-bold text-[#9d8e94] mb-1">
        <Icon className="w-2.5 h-2.5 text-primary" />
        {label}
      </label>

      {children}
    </div>
  );
}
