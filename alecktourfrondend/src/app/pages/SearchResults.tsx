import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HeadphonesIcon,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import Footer from "../components/Footer";
import HalloweenAccentDiscreto from "../components/HalloweenAccentDiscreto";
import HotelCard from "../components/HotelCard";
import Navbar from "../components/Navbar";
import { useTema } from "../context/TemaContext";
import { HotelDetailResponse, hotelService } from "../services/hotel.service";
import { normalizarTexto } from "../utils/normalizarTexto";

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { temaActivo } = useTema();
  const esHalloween = temaActivo?.clave === "halloween";

  const [hoteles, setHoteles] = useState<HotelDetailResponse[]>([]);
  const [filtrados, setFiltrados] = useState<HotelDetailResponse[]>([]);
  // Paginación client-side: los resultados ya vienen completos del
  // backend (hotelService.getAll con limit=300) y se filtran/ordenan acá
  // mismo, así que paginar es solo cortar `filtrados` -- antes se
  // renderizaba la lista entera de una sola vez, sin límite.
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  // Catálogo completo SIN filtrar por fechas — solo se pide cuando sí hay
  // fechas de búsqueda, para poder decir "X de Y hoteles disponibles" con un
  // denominador real (nunca inventado). null mientras no aplica.
  const [totalCatalogo, setTotalCatalogo] = useState<HotelDetailResponse[] | null>(null);

  // Los filtros viven también en la URL (f_cal, f_pais, f_ciudad, f_precio,
  // f_serv): antes se perdían al entrar a un hotel y volver con "atrás", y
  // no se podía compartir una búsqueda filtrada.
  const [calificacionFilter, setCalificacionFilter] =
    useState<string>(() => searchParams.get("f_cal") ?? "all");

  const [paisFilter, setPaisFilter] =
    useState<string>(() => searchParams.get("f_pais") ?? "all");

  const [ciudadFilter, setCiudadFilter] =
    useState<string>(() => searchParams.get("f_ciudad") ?? "all");

  const [ciudadSearch, setCiudadSearch] =
    useState<string>("");

  const [showFilters, setShowFilters] =
    useState(false);

  type PrecioBucket = "all" | "lt300" | "300-600" | "600-1000" | "gt1000";
  const [precioFilter, setPrecioFilter] = useState<PrecioBucket>(() => {
    const v = searchParams.get("f_precio");
    return v === "lt300" || v === "300-600" || v === "600-1000" || v === "gt1000" ? v : "all";
  });

  // Filtro de servicios populares (estilo Despegar: checkboxes con conteo
  // real de cuántos hoteles del resultado tienen cada servicio).
  const [caracteristicasFilter, setCaracteristicasFilter] = useState<string[]>(
    () => searchParams.get("f_serv")?.split("|").filter(Boolean) ?? []
  );

  // Filtros -> URL (replace: no llena el historial con cada clic).
  useEffect(() => {
    const valores: Record<string, string> = {
      f_cal: calificacionFilter === "all" ? "" : calificacionFilter,
      f_pais: paisFilter === "all" ? "" : paisFilter,
      f_ciudad: ciudadFilter === "all" ? "" : ciudadFilter,
      f_precio: precioFilter === "all" ? "" : precioFilter,
      f_serv: caracteristicasFilter.join("|"),
    };
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(valores)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next.toString() === prev.toString() ? prev : next;
      },
      { replace: true }
    );
  }, [calificacionFilter, paisFilter, ciudadFilter, precioFilter, caracteristicasFilter, setSearchParams]);
  const toggleCaracteristica = (nombre: string) =>
    setCaracteristicasFilter((prev) =>
      prev.includes(nombre) ? prev.filter((c) => c !== nombre) : [...prev, nombre]
    );

  const PRECIO_BUCKETS: { id: PrecioBucket; label: string; test: (p: number) => boolean }[] = [
    { id: "all", label: "Cualquier precio", test: () => true },
    { id: "lt300", label: "Menos de $300.000", test: (p) => p < 300000 },
    { id: "300-600", label: "$300.000 – $600.000", test: (p) => p >= 300000 && p < 600000 },
    { id: "600-1000", label: "$600.000 – $1.000.000", test: (p) => p >= 600000 && p < 1000000 },
    { id: "gt1000", label: "Más de $1.000.000", test: (p) => p >= 1000000 },
  ];

  type OrdenPor = "relevancia" | "precio_asc" | "precio_desc" | "calificacion";
  const [ordenPor, setOrdenPor] = useState<OrdenPor>("relevancia");

  const [startDate, setStartDate] =
    useState<string>("");

  const [endDate, setEndDate] =
    useState<string>("");

  const [people, setPeople] =
    useState<string>("");

  /*
   * IMPORTANTE:
   * Este es el destino enviado desde SearchBar.
   *
   * Ejemplo:
   * /search?destination=Cartagena
   */
  const destinationSearch =
    searchParams.get("destination")?.trim() ?? "";

  function precioMinimo(h: HotelDetailResponse): number | null {
    const disponibles =
      h.habitaciones?.filter(
        (hab) => hab.estado?.toLowerCase() === "disponible"
      ) ?? [];
    if (!disponibles.length) return null;
    return Math.min(...disponibles.map((hab) => hab.precio_noche));
  }

  /*
   * CARGAR HOTELES
   */
  // Solo la búsqueda (destino, fechas, personas) dispara una nueva carga:
  // los filtros f_* también están en la URL pero se aplican en el navegador.
  const paramStart = searchParams.get("start");
  const paramEnd = searchParams.get("end");
  const paramPeople = searchParams.get("people");
  useEffect(() => {
    setLoading(true);

    const start = paramStart;
    const end = paramEnd;
    const ppl = paramPeople;

    if (start) setStartDate(start);
    if (end) setEndDate(end);
    if (ppl) setPeople(ppl);

    // BUG real corregido (FASE G): antes las fechas se leían de la URL solo
    // para mostrarlas como badges, nunca se mandaban al backend — un hotel
    // sin disponibilidad real para esas fechas exactas aparecía igual en
    // los resultados. Ahora, si vienen fechas completas y válidas, se
    // filtran de verdad en GET /hoteles/ (ver hotel_repository.py). También
    // se sube el límite pedido de 50 a 300 (el máximo real del backend,
    // mismo ajuste ya hecho en los demás módulos con este patrón).
    const fechasValidas = !!start && !!end && end > start;

    // Para poder avisar "X de Y hoteles en {destino} tienen disponibilidad"
    // sin inventar el denominador, se pide también el catálogo SIN filtro de
    // fechas cuando sí hay fechas — mismo endpoint cacheado 2 min, no es una
    // petición cara.
    Promise.all([
      hotelService.getAll(0, 300, fechasValidas ? { fechaCheckin: start!, fechaCheckout: end! } : undefined),
      fechasValidas ? hotelService.getAll(0, 300) : Promise.resolve(null),
    ])
      .then(([disponibles, catalogoCompleto]) => {
        setHoteles(disponibles);
        setTotalCatalogo(catalogoCompleto);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paramStart, paramEnd, paramPeople]);

  /*
   * FILTRADO
   *
   * Esta es la lógica que conecta SearchBar
   * con los hoteles.
   */
  useEffect(() => {
    // normalizarTexto (no toLowerCase a secas) para que buscar sin tilde
    // (ej. "medellin") sí encuentre ciudades guardadas con tilde
    // ("Medellín") -- antes un hotel real quedaba fuera del resultado solo
    // por esa diferencia de acentos.
    const destination =
      normalizarTexto(destinationSearch);

    const resultado = hoteles.filter((h) => {
      /*
       * DESTINO DESDE EL SEARCHBAR
       */
      const matchesDestination =
        !destination ||
        (h.ciudad ? normalizarTexto(h.ciudad).includes(destination) : false) ||
        (h.pais ? normalizarTexto(h.pais).includes(destination) : false) ||
        (h.nombre_hotel ? normalizarTexto(h.nombre_hotel).includes(destination) : false);

      /*
       * FILTRO CALIFICACIÓN
       */
      const matchesCal =
        calificacionFilter === "all" ||
        h.calificacion ===
        parseInt(calificacionFilter);

      /*
       * FILTRO PAÍS
       */
      const matchesPais =
        paisFilter === "all" ||
        h.pais === paisFilter;

      /*
       * FILTRO CIUDAD
       */
      const matchesCiudad =
        ciudadFilter === "all" ||
        h.ciudad === ciudadFilter;

      /*
       * FILTRO PRECIO POR NOCHE
       */
      const bucket = PRECIO_BUCKETS.find((b) => b.id === precioFilter)!;
      const precio = precioMinimo(h);
      const matchesPrecio =
        precioFilter === "all" ||
        (precio != null && bucket.test(precio));

      /*
       * FILTRO SERVICIOS POPULARES
       */
      const nombresServicios = new Set(
        h.hotel_caracteristicas
          ?.filter((hc) => hc.disponible && hc.caracteristica)
          .map((hc) => hc.caracteristica!.nombre_caracteristica) ?? []
      );
      const matchesCaracteristicas =
        caracteristicasFilter.length === 0 ||
        caracteristicasFilter.every((c) => nombresServicios.has(c));

      /*
       * FILTRO HUÉSPEDES — antes `people` se leía de la URL y se mostraba
       * como badge, pero nunca se cruzaba contra la capacidad real de
       * ninguna habitación (Habitacion.tipo_habitacion.capacidad_personas,
       * dato que el backend ya manda). Se aproxima a nivel de hotel: califica
       * si tiene al menos una habitación cuyo tipo alcance para el grupo.
       */
      const personasNum = parseInt(people, 10);
      const matchesPersonas =
        !personasNum ||
        (h.habitaciones ?? []).some(
          (hab) => (hab.tipo_habitacion?.capacidad_personas ?? 0) >= personasNum
        );

      return (
        matchesDestination &&
        matchesCal &&
        matchesPais &&
        matchesCiudad &&
        matchesPrecio &&
        matchesCaracteristicas &&
        matchesPersonas
      );
    });

    const ordenado = [...resultado].sort((a, b) => {
      if (ordenPor === "precio_asc" || ordenPor === "precio_desc") {
        const pa = precioMinimo(a);
        const pb = precioMinimo(b);
        // Los hoteles sin precio disponible se mandan al final, sin importar la dirección.
        if (pa == null) return pb == null ? 0 : 1;
        if (pb == null) return -1;
        return ordenPor === "precio_asc" ? pa - pb : pb - pa;
      }
      if (ordenPor === "calificacion") {
        return (b.calificacion ?? 0) - (a.calificacion ?? 0);
      }
      return 0; // relevancia: se respeta el orden que entrega la API
    });

    setFiltrados(ordenado);
    setPagina(1);
  }, [
    hoteles,
    destinationSearch,
    calificacionFilter,
    paisFilter,
    ciudadFilter,
    precioFilter,
    caracteristicasFilter,
    ordenPor,
    people,
  ]);

  /*
   * LIMPIAR FILTROS
   */
  function limpiarFiltros() {
    setCalificacionFilter("all");
    setPaisFilter("all");
    setCiudadFilter("all");
    setCiudadSearch("");
    setPrecioFilter("all");
    setCaracteristicasFilter([]);
  }

  /*
   * DISPONIBILIDAD REAL PARA EL DESTINO BUSCADO — usa el mismo criterio de
   * coincidencia que matchesDestination de arriba, contra el catálogo
   * completo (totalCatalogo, sin filtrar por fechas) y contra los hoteles
   * ya filtrados por disponibilidad real (hoteles). null cuando no hay
   * fechas de búsqueda válidas, para no mostrar una fracción sin sentido.
   */
  const disponibilidadDestino = (() => {
    if (!totalCatalogo) return null;
    const destino = normalizarTexto(destinationSearch);
    const matchDestino = (h: HotelDetailResponse) =>
      !destino ||
      (h.ciudad ? normalizarTexto(h.ciudad).includes(destino) : false) ||
      (h.pais ? normalizarTexto(h.pais).includes(destino) : false) ||
      (h.nombre_hotel ? normalizarTexto(h.nombre_hotel).includes(destino) : false);
    const total = totalCatalogo.filter(matchDestino).length;
    const disponibles = hoteles.filter(matchDestino).length;
    return { disponibles, total };
  })();

  /*
   * ALTERNATIVAS SIN DISPONIBILIDAD PARA LAS FECHAS EXACTAS.
   *
   * Cuando la búsqueda trae fechas válidas y NO hay ningún hotel disponible
   * para ese rango exacto, en vez de mostrar el vacío genérico ("No
   * encontramos hoteles") mostramos los hoteles del destino que sí existen
   * (catálogo completo, sin filtro de fechas) marcados claramente como "sin
   * disponibilidad para esas fechas" — son coincidencias / alternativas
   * reales que ayudan al cliente a decidir (consultar otras fechas) en lugar
   * de un callejón sin salida. La lista sale de `totalCatalogo`, que solo se
   * pide cuando hay fechas; si no hay fechas este bloque queda vacío.
   */
  const alternativas = (() => {
    if (!totalCatalogo) return [];
    // Si hay filtros de cliente activos (calificación, precio, país, ciudad,
    // servicios...), el cero de resultados puede deberse a esos filtros y NO a
    // la disponibilidad por fechas. En ese caso no tratamos los descartados
    // como "alternativas sin disponibilidad" (sería engañoso): solo mostramos
    // las alternativas por fecha cuando la búsqueda está limpia de filtros y
    // lo único que deja el resultado en cero es la disponibilidad real.
    const hayFiltrosDeCliente =
      calificacionFilter !== "all" ||
      paisFilter !== "all" ||
      ciudadFilter !== "all" ||
      precioFilter !== "all" ||
      caracteristicasFilter.length > 0;
    if (hayFiltrosDeCliente) return [];
    if (!destinationSearch) return [];
    const destino = normalizarTexto(destinationSearch);
    const matchDestino = (h: HotelDetailResponse) =>
      (h.ciudad ? normalizarTexto(h.ciudad).includes(destino) : false) ||
      (h.pais ? normalizarTexto(h.pais).includes(destino) : false) ||
      (h.nombre_hotel ? normalizarTexto(h.nombre_hotel).includes(destino) : false);
    const disponiblesIds = new Set(hoteles.map((h) => h.id_hotel));
    return totalCatalogo.filter((h) => matchDestino(h) && !disponiblesIds.has(h.id_hotel));
  })();

  /*
   * PAGINACIÓN — 10 alojamientos por página sobre `filtrados` (ya
   * filtrado/ordenado arriba). `paginaActual` se recalcula por si el total
   * de páginas bajó (p. ej. se quitó un filtro) y `pagina` quedó apuntando
   * más allá del final.
   */
  const RESULTADOS_POR_PAGINA = 10;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / RESULTADOS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const resultadosPagina = filtrados.slice(
    (paginaActual - 1) * RESULTADOS_POR_PAGINA,
    paginaActual * RESULTADOS_POR_PAGINA
  );

  /*
   * DATOS PARA FILTROS
   */
  const paises = [
    ...new Set(
      hoteles
        .map((h) => h.pais)
        .filter(Boolean)
    ),
  ].sort();

  const ciudades = [
    ...new Set(
      hoteles
        .map((h) => h.ciudad)
        .filter(Boolean)
    ),
  ].sort();

  const ciudadesFiltradas =
    ciudades.filter((c) =>
      c.toLowerCase().includes(
        ciudadSearch.toLowerCase()
      )
    );

  // Servicios populares del resultado actual: conteo real de cuántos
  // hoteles ofrecen cada característica (estilo Despegar: checkboxes con
  // número al lado), no una lista inventada — se deriva de los hoteles
  // que ya trajo la API para esta búsqueda.
  const serviciosPopulares = (() => {
    const counts = new Map<string, number>();
    hoteles.forEach((h) => {
      const nombres = new Set(
        h.hotel_caracteristicas
          ?.filter((hc) => hc.disponible && hc.caracteristica)
          .map((hc) => hc.caracteristica!.nombre_caracteristica) ?? []
      );
      nombres.forEach((nombre) => {
        counts.set(nombre, (counts.get(nombre) ?? 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  })();

  /*
   * FILTROS
   */
  const FilterContent = () => (
    <>
      {/* PRECIO POR NOCHE */}
      <div className="mb-6">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground/80">
          Precio por noche
        </h3>

        <div className="space-y-2.5">
          {PRECIO_BUCKETS.map((bucket) => (
            <motion.label
              key={bucket.id}
              whileHover={{ x: 3 }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="radio"
                name="precio"
                checked={precioFilter === bucket.id}
                onChange={() => setPrecioFilter(bucket.id)}
                className="w-4 h-4 text-primary focus:ring-primary border-border bg-input-background cursor-pointer"
              />

              <span className="text-sm text-foreground/90 group-hover:text-primary transition-colors">
                {bucket.label}
              </span>
            </motion.label>
          ))}
        </div>
      </div>

      {/* CALIFICACIÓN */}
      <div className="mb-6 border-t border-border/60 pt-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground/80">
          Calificación
        </h3>

        <div className="space-y-2.5">
          <motion.label
            whileHover={{ x: 3 }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <input
              type="radio"
              name="cal"
              checked={
                calificacionFilter === "all"
              }
              onChange={() =>
                setCalificacionFilter("all")
              }
              className="w-4 h-4 text-primary focus:ring-primary border-border bg-input-background cursor-pointer"
            />

            <span className="text-sm text-foreground/90 group-hover:text-primary transition-colors">
              Todas las estrellas
            </span>
          </motion.label>

          {[5, 4, 3, 2, 1].map((n) => (
            <motion.label
              key={n}
              whileHover={{ x: 3 }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="radio"
                name="cal"
                checked={
                  calificacionFilter ===
                  String(n)
                }
                onChange={() =>
                  setCalificacionFilter(
                    String(n)
                  )
                }
                className="w-4 h-4 text-primary focus:ring-primary border-border bg-input-background cursor-pointer"
              />

              <span className="flex items-center gap-0.5 text-sm">
                {Array.from(
                  { length: n },
                  (_, i) => (
                    <Star
                      key={i}
                      className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                    />
                  )
                )}

                {Array.from(
                  { length: 5 - n },
                  (_, i) => (
                    <Star
                      key={i}
                      className="w-3.5 h-3.5 fill-muted text-muted/40"
                    />
                  )
                )}
              </span>
            </motion.label>
          ))}
        </div>
      </div>

      {/* PAÍS */}
      <div className="mb-6 border-t border-border/60 pt-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground/80">
          País
        </h3>

        <div className="space-y-2.5">
          <motion.label
            whileHover={{ x: 3 }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <input
              type="radio"
              name="pais"
              checked={
                paisFilter === "all"
              }
              onChange={() =>
                setPaisFilter("all")
              }
              className="w-4 h-4 text-primary"
            />

            <span className="text-sm text-foreground/90">
              Todos los destinos
            </span>
          </motion.label>

          {paises.map((pais) => (
            <motion.label
              key={pais}
              whileHover={{ x: 3 }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="radio"
                name="pais"
                checked={
                  paisFilter === pais
                }
                onChange={() =>
                  setPaisFilter(pais)
                }
                className="w-4 h-4 text-primary"
              />

              <span className="text-sm text-foreground/90">
                {pais}
              </span>
            </motion.label>
          ))}
        </div>
      </div>

      {/* CIUDAD */}
      <div className="mb-6 border-t border-border/60 pt-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground/80">
          Ciudad
        </h3>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />

          <input
            type="text"
            value={ciudadSearch}
            onChange={(e) =>
              setCiudadSearch(e.target.value)
            }
            placeholder="Buscar ciudad..."
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-border bg-input-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />

          {ciudadSearch && (
            <button
              type="button"
              onClick={() =>
                setCiudadSearch("")
              }
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
          <motion.label
            whileHover={{ x: 3 }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <input
              type="radio"
              name="ciudad"
              checked={
                ciudadFilter === "all"
              }
              onChange={() =>
                setCiudadFilter("all")
              }
              className="w-4 h-4 text-primary"
            />

            <span className="text-sm">
              Todas las ciudades
            </span>
          </motion.label>

          <AnimatePresence>
            {ciudadesFiltradas.map(
              (ciudad) => (
                <motion.label
                  key={ciudad}
                  initial={{
                    opacity: 0,
                    x: -6,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  exit={{
                    opacity: 0,
                    x: -6,
                  }}
                  whileHover={{ x: 3 }}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="ciudad"
                    checked={
                      ciudadFilter ===
                      ciudad
                    }
                    onChange={() =>
                      setCiudadFilter(
                        ciudad
                      )
                    }
                    className="w-4 h-4 text-primary"
                  />

                  <span className="text-sm">
                    {ciudad}
                  </span>
                </motion.label>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* SERVICIOS POPULARES */}
      {serviciosPopulares.length > 0 && (
        <div className="mb-6 border-t border-border/60 pt-5">
          <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground/80">
            Servicios populares
          </h3>

          <div className="space-y-2.5">
            {serviciosPopulares.map(([nombre, cantidad]) => (
              <motion.label
                key={nombre}
                whileHover={{ x: 3 }}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={caracteristicasFilter.includes(nombre)}
                  onChange={() => toggleCaracteristica(nombre)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-input-background cursor-pointer"
                />

                <span className="flex-1 text-sm text-foreground/90 group-hover:text-primary transition-colors">
                  {nombre}
                </span>

                <span className="text-xs text-muted-foreground/70 font-medium tabular-nums">
                  ({cantidad})
                </span>
              </motion.label>
            ))}
          </div>
        </div>
      )}

      {/* LIMPIAR */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        type="button"
        onClick={limpiarFiltros}
        className="w-full mt-2 py-2.5 border border-border bg-card text-foreground rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-muted transition-colors"
      >
        Limpiar filtros
      </motion.button>
    </>
  );

  return (
    <>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* HEADER */}
          <motion.div
            initial={{
              opacity: 0,
              y: 15,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="mb-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>

                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Resultados de búsqueda
                  </span>
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl mb-2">
                  {destinationSearch
                    ? `Hoteles en ${destinationSearch}`
                    : "Encuentra tu alojamiento"}
                </h1>

                <p className="text-muted-foreground text-sm md:text-base font-medium">
                  {loading
                    ? "Buscando las mejores opciones..."
                    : `${filtrados.length} ${filtrados.length === 1
                      ? "alojamiento encontrado"
                      : "alojamientos encontrados"
                    }`}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {startDate && (
                    <span className="px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                      {startDate}
                    </span>
                  )}

                  {endDate && (
                    <span className="px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                      {endDate}
                    </span>
                  )}

                  {people && (
                    <span className="px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                      {people}{" "}
                      {people === "1"
                        ? "persona"
                        : "personas"}
                    </span>
                  )}
                </div>

                {/* Disponibilidad real para las fechas buscadas — antes la
                    franja de "confianza" más abajo prometía "disponibilidad
                    verificada en tiempo real" sin que las fechas filtraran
                    nada de verdad (bug corregido en FASE G). Este aviso usa
                    el mismo dato real que ya filtra los resultados, nunca
                    un número inventado. */}
                {disponibilidadDestino && (
                  <p
                    className={`mt-2 text-xs font-medium ${
                      disponibilidadDestino.disponibles > 0 ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {disponibilidadDestino.disponibles} de {disponibilidadDestino.total}{" "}
                    {disponibilidadDestino.total === 1 ? "hotel tiene" : "hoteles tienen"} disponibilidad real
                    {destinationSearch ? ` en ${destinationSearch}` : ""} para esas fechas.
                  </p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() =>
                  setShowFilters(
                    !showFilters
                  )
                }
                className="lg:hidden flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filtrar
              </motion.button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">

            {/* SIDEBAR */}
            <aside className="hidden lg:block lg:col-span-1 sticky top-24">
              <motion.div
                initial={{
                  opacity: 0,
                  x: -15,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                className="bg-card rounded-2xl border border-border p-6 shadow-xs"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                  </div>

                  <h2 className="text-lg font-bold">
                    Filtros avanzados
                  </h2>
                </div>

                <FilterContent />
              </motion.div>
            </aside>

            {/* MOBILE FILTER */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden"
                  onClick={() =>
                    setShowFilters(false)
                  }
                >
                  <motion.div
                    initial={{
                      x: "100%",
                    }}
                    animate={{
                      x: 0,
                    }}
                    exit={{
                      x: "100%",
                    }}
                    transition={{
                      type: "spring",
                      damping: 25,
                      stiffness: 200,
                    }}
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                    className="absolute right-0 top-0 bottom-0 w-80 bg-card p-6 overflow-y-auto border-l border-border shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-primary" />
                        <h2 className="text-lg font-bold">
                          Filtros
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setShowFilters(
                            false
                          )
                        }
                        className="p-2 hover:bg-muted rounded-xl"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <FilterContent />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* RESULTADOS */}
            <main className="lg:col-span-3">
              {/* BANNER COMERCIAL — el mismo beneficio real que ya se
                  publicita en el Home (Benefits.tsx: "Paga en cuotas, sin
                  intereses"), reutilizado aquí en formato compacto tipo
                  Despegar. Nunca una oferta o descuento inventado. Único
                  punto de esta página con acento de temporada -- a
                  propósito NO se decora HotelCard.tsx (se repite por cada
                  resultado, decorarlo saturaría la lista). */}
              <div className="relative overflow-hidden mb-4 rounded-2xl bg-gradient-to-r from-primary to-[#5c1229] p-4 sm:p-5 text-primary-foreground flex items-center gap-3 sm:gap-4">
                {esHalloween && (
                  <HalloweenAccentDiscreto variante="foto" posicion="top-right" tamano="sm" />
                )}
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">Paga en hasta 12 cuotas sin intereses</p>
                  <p className="text-xs text-primary-foreground/80">
                    El plan que mejor se acomode a tu bolsillo, no al revés.
                  </p>
                </div>
              </div>

              {/* FRANJA DE CONFIANZA — mismos beneficios reales del Home
                  (asesoría humana, compra protegida) más un dato real sobre
                  cómo funciona el propio buscador (precios/disponibilidad
                  verificados contra la base de datos en cada consulta). */}
              <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
                  <HeadphonesIcon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground">Asesoría humana, siempre</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground">Compra protegida</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
                  <Building2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground">Disponibilidad verificada en tiempo real</span>
                </div>
              </div>

              {/* CHIPS DE FILTROS ACTIVOS — resumen rápido estilo Despegar,
                  cada uno se puede quitar sin abrir el panel de filtros. */}
              {(calificacionFilter !== "all" ||
                paisFilter !== "all" ||
                ciudadFilter !== "all" ||
                precioFilter !== "all" ||
                caracteristicasFilter.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {calificacionFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setCalificacionFilter("all")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
                    >
                      {calificacionFilter} estrellas
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {paisFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setPaisFilter("all")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
                    >
                      {paisFilter}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {ciudadFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setCiudadFilter("all")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
                    >
                      {ciudadFilter}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {precioFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setPrecioFilter("all")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
                    >
                      {PRECIO_BUCKETS.find((b) => b.id === precioFilter)?.label}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {caracteristicasFilter.map((nombre) => (
                    <button
                      key={nombre}
                      type="button"
                      onClick={() => toggleCaracteristica(nombre)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
                    >
                      {nombre}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}

              {!loading && filtrados.length > 0 && (
                <div className="flex items-center justify-end gap-2 mb-4">
                  <label htmlFor="ordenar-por" className="text-xs font-medium text-muted-foreground">
                    Ordenar por
                  </label>
                  <select
                    id="ordenar-por"
                    value={ordenPor}
                    onChange={(e) => setOrdenPor(e.target.value as OrdenPor)}
                    className="text-sm font-semibold bg-card border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="relevancia">Más relevantes</option>
                    <option value="precio_asc">Precio: menor a mayor</option>
                    <option value="precio_desc">Precio: mayor a menor</option>
                    <option value="calificacion">Mejor calificados</option>
                  </select>
                </div>
              )}

              {loading ? (
                <div className="bg-card rounded-2xl border border-border p-16 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent" />

                  <p className="text-muted-foreground text-sm mt-3">
                    Buscando alojamientos...
                  </p>
                </div>
              ) : filtrados.length > 0 ? (
                <div className="flex flex-col gap-5">
                  {resultadosPagina.map(
                    (hotel, index) => (
                      <HotelCard
                        key={hotel.id_hotel}
                        hotel={hotel}
                        index={index}
                      />
                    )
                  )}

                  {totalPaginas > 1 && (
                    <nav
                      aria-label="Paginación de resultados"
                      className="flex items-center justify-center gap-1.5 mt-4"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPagina((n) => Math.max(1, n - 1));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        disabled={paginaActual === 1}
                        aria-label="Página anterior"
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                        .filter(
                          (n) =>
                            n === 1 ||
                            n === totalPaginas ||
                            Math.abs(n - paginaActual) <= 1
                        )
                        .map((n, i, arr) => (
                          <span key={n} className="flex items-center gap-1.5">
                            {i > 0 && arr[i - 1] !== n - 1 && (
                              <span className="text-muted-foreground text-sm px-1">…</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPagina(n);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              aria-current={n === paginaActual ? "page" : undefined}
                              className={`h-9 min-w-9 px-2.5 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                                n === paginaActual
                                  ? "bg-primary text-primary-foreground"
                                  : "border border-border bg-card text-foreground hover:border-primary/40"
                              }`}
                            >
                              {n}
                            </button>
                          </span>
                        ))}

                      <button
                        type="button"
                        onClick={() => {
                          setPagina((n) => Math.min(totalPaginas, n + 1));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        disabled={paginaActual === totalPaginas}
                        aria-label="Página siguiente"
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </nav>
                  )}
                </div>
              ) : alternativas.length > 0 ? (
                <div className="flex flex-col gap-5">
                  {/* Aviso de que nada coincide con las fechas exactas */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 text-amber-900 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        No hay disponibilidad en esas fechas exactas
                      </p>
                      <p className="text-xs text-amber-800/90 mt-0.5">
                        Estos {alternativas.length} {alternativas.length === 1 ? "hotel es" : "hoteles son"} coincidencia
                        {alternativas.length === 1 ? "" : "s"} para{" "}
                        <strong>{destinationSearch}</strong> pero no tienen
                        habitaciones libres entre {startDate} y {endDate}. Te los
                        mostramos como alternativa: consulta otras fechas en su
                        detalle.
                      </p>
                    </div>
                  </div>

                  {alternativas.map((hotel, index) => (
                    <HotelCard
                      key={hotel.id_hotel}
                      hotel={hotel}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    No encontramos alojamientos con esos criterios
                  </h3>
                  <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
                    {destinationSearch ? (
                      <>
                        No hay resultados en{" "}
                        <strong className="text-foreground">{destinationSearch}</strong>{" "}
                        con las fechas y filtros seleccionados. Prueba ampliar las
                        fechas, quitar filtros o buscar en otro destino.
                      </>
                    ) : (
                      "Prueba modificar el destino, las fechas o quitar algunos filtros para ver más opciones."
                    )}
                  </p>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}