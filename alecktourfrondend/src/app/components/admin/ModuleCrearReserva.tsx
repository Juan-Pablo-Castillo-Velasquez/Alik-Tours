import { useEffect, useMemo, useState } from "react";
import {
  Bed, Calendar, Check, CheckCircle, ChevronLeft, Clock, FileText, Hotel,
  Package, Search, Tag, User, Users, XCircle,
} from "lucide-react";
import { Cliente, HotelData, Paquete, inputCls, labelCls, resolveFotoUrl } from "./types";
import { hotelService, RangoOcupado } from "../../services/hotel.service";
import CalendarioOcupacion from "../hotel/CalendarioOcupacion";
import AdminModal from "./ui/AdminModal";
import Avatar from "./ui/Avatar";
import SectionHeader from "./ui/SectionHeader";
import StepProgress from "../ui/StepProgress";

interface Props {
  clientes: Cliente[];
  paquetes: Paquete[];
  hoteles: HotelData[];
  onSubmit: (data: any) => Promise<void>;
  loading: boolean;
}

interface HabitacionElegida {
  id_habitacion: number;
  numero_habitacion: string;
  tipo: string;
  precio_noche: number;
  nombre_hotel: string;
}

const FORM_INICIAL = {
  id_cliente: "", id_paquete: "", fecha_inicio: "",
  fecha_fin: "", numero_personas: "1", estado: "pendiente",
};

function nochesEntre(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  const dias = Math.round(ms / (1000 * 60 * 60 * 24));
  return dias > 0 ? dias : 0;
}

// Estado inicial de la reserva — mismos 4 estados, mismo ícono y mismo
// color que el selector de estado del detalle de una reserva ya existente
// (ver ESTADO_OPTIONS/EstadoPicker en ModuleReservas.tsx), para que elegir
// el estado se sienta igual en todo el panel en vez de un <select> HTML
// plano perdido entre el resto de campos.
const ESTADO_OPTIONS: { value: string; label: string; icon: React.ReactNode; cls: string }[] = [
  {
    value: "pendiente",
    label: "Pendiente",
    icon: <Clock className="w-3.5 h-3.5" />,
    cls: "border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227] ring-[#C9A227]/50",
  },
  {
    value: "confirmada",
    label: "Confirmada",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    cls: "border-primary/40 bg-primary/10 text-primary ring-primary/50",
  },
  {
    value: "cancelada",
    label: "Cancelada",
    icon: <XCircle className="w-3.5 h-3.5" />,
    cls: "border-destructive/40 bg-destructive/10 text-destructive ring-destructive/50",
  },
  {
    value: "finalizada",
    label: "Finalizada",
    icon: <FileText className="w-3.5 h-3.5" />,
    cls: "border-[#A13B55]/40 bg-[#A13B55]/10 text-[#A13B55] ring-[#A13B55]/50",
  },
];

// Fila de resumen (ícono + etiqueta + valor) — mismo patrón que DetailRow
// en ModuleReservas.tsx (cada módulo define el suyo, no hay uno compartido
// todavía en ./ui), usada acá en el panel de resumen de la derecha.
function DetailRow({ icon: Icon, label, value }: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-border/50 last:border-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground min-w-[84px]">{label}</span>
      <span className="text-xs font-medium text-foreground text-right ml-auto truncate">{value ?? "—"}</span>
    </div>
  );
}

// Módulo "Crear Reserva" del admin. Antes solo permitía elegir un Paquete
// turístico de un <select> plano y un cliente por id/cédula en otro — no
// había forma de reservar directamente una habitación de un hotel (algo que
// el backend ya soporta de sobra: POST /reservas acepta `habitaciones`
// junto con id_paquete opcional, usado hoy por el checkout público), ni de
// ver más que el nombre del cliente al elegirlo. Ahora:
// - El cliente se elige desde un buscador en pop-up con foto real (o
//   iniciales si no tiene) para identificarlo de un vistazo, no solo por id.
// - Se puede armar la reserva sobre un Paquete turístico (como antes) O
//   directo sobre un Hotel + habitación(es) real(es), igual que en el
//   flujo de reserva del sitio público — sin inventar ningún endpoint
//   nuevo, el backend ya validaba y soportaba esto.
//
// Rediseño visual: este es el módulo donde de verdad se arma una reserva
// completa (antes vivía como una tarjeta angosta y genérica, perdida en el
// resto del ancho de la página) — ahora usa el mismo lenguaje visual que
// el detalle de una reserva ya existente (secciones con encabezado en
// mayúsculas + ícono, tarjetas `card`) y un panel de resumen fijo a la
// derecha (mismo patrón que el checkout público) que muestra el total en
// tiempo real en vez de aparecer solo hasta el final del formulario.
export default function ModuleCrearReserva({ clientes, paquetes, hoteles, onSubmit, loading }: Props) {
  const [modo, setModo] = useState<"paquete" | "hotel">("paquete");
  const [form, setForm] = useState({ ...FORM_INICIAL });
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [habitaciones, setHabitaciones] = useState<HabitacionElegida[]>([]);

  // Pop-up de cliente
  const [clientePickerOpen, setClientePickerOpen] = useState(false);
  const [clienteQuery, setClienteQuery] = useState("");

  // Pop-up de hotel/habitación
  const [hotelPickerOpen, setHotelPickerOpen] = useState(false);
  const [hotelQuery, setHotelQuery] = useState("");
  const [hotelExpandido, setHotelExpandido] = useState<HotelData | null>(null);

  // Disponibilidad REAL por fecha de cada habitación del hotel expandido —
  // antes este picker solo miraba Habitacion.estado (un flag estático), así
  // que una habitación marcada "disponible" en la BD pero con una reserva
  // real que se cruza con las fechas elegidas igual aparecía seleccionable
  // acá, y el backend recién la rechazaba al intentar crear la reserva.
  // Se resuelve igual que en el buscador público (SearchResults.tsx):
  // GET /hoteles/{id}/fechas-ocupadas ya existía, solo nadie lo usaba acá.
  const [fechasOcupadas, setFechasOcupadas] = useState<Record<number, { fecha_checkin: string; fecha_checkout: string }[]>>({});
  const [cargandoFechas, setCargandoFechas] = useState(false);

  useEffect(() => {
    if (!hotelExpandido) { setFechasOcupadas({}); return; }
    setCargandoFechas(true);
    hotelService.getFechasOcupadas(hotelExpandido.id_hotel)
      .then((lista) => {
        const mapa: Record<number, { fecha_checkin: string; fecha_checkout: string }[]> = {};
        for (const item of lista) mapa[item.id_habitacion] = item.rangos;
        setFechasOcupadas(mapa);
      })
      .catch(() => setFechasOcupadas({}))
      .finally(() => setCargandoFechas(false));
  }, [hotelExpandido]);

  const fechasElegidasValidas = !!form.fecha_inicio && !!form.fecha_fin;

  function haySolapeFechas(id_habitacion: number): boolean {
    if (!fechasElegidasValidas) return false;
    const rangos = fechasOcupadas[id_habitacion] ?? [];
    return rangos.some((r) => r.fecha_checkin < form.fecha_fin && r.fecha_checkout > form.fecha_inicio);
  }

  // Fechas ocupadas agregadas de las habitaciones ya elegidas en modo hotel.
  // Se muestran en la sección "Fechas y huéspedes" reutilizando el mismo
  // calendario de ocupación del detalle público (CalendarioOcupacion), como
  // ayuda visual al admin al elegir las fechas — nunca inventa datos.
  const rangosSeleccionados: RangoOcupado[] = habitaciones.flatMap(
    (h) => fechasOcupadas[h.id_habitacion] ?? []
  );

  // ¿Alguna habitación elegida ya está ocupada entre las fechas del form?
  const haySolapeEnSeleccionadas = fechasElegidasValidas &&
    habitaciones.some((h) => haySolapeFechas(h.id_habitacion));

  const clienteSeleccionado = clientes.find((c) => c.id_cliente === parseInt(form.id_cliente));
  const paqueteSeleccionado = paquetes.find((p) => p.id_paquete === parseInt(form.id_paquete));

  const clientesFiltrados = useMemo(() => {
    const q = clienteQuery.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      `${c.nombre} ${c.apellido} ${c.cedula} ${c.correo ?? ""} ${c.ciudad ?? ""}`.toLowerCase().includes(q)
    );
  }, [clientes, clienteQuery]);

  const hotelesFiltrados = useMemo(() => {
    const q = hotelQuery.trim().toLowerCase();
    if (!q) return hoteles;
    return hoteles.filter((h) =>
      `${h.nombre_hotel} ${h.ciudad ?? ""} ${h.pais ?? ""}`.toLowerCase().includes(q)
    );
  }, [hoteles, hotelQuery]);

  // Un paquete armado para salir de Bogotá no le sirve tal cual a un
  // cliente que vive en Barranquilla (necesitaría cubrir el tramo hasta
  // Bogotá aparte) — pero SÍ puede tener sentido igual en casos puntuales,
  // así que esto es solo un orden sugerido (el paquete que coincide con la
  // ciudad del cliente sube al principio), nunca un filtro que oculte o
  // bloquee el resto.
  const paquetesOrdenados = useMemo(() => {
    const ciudadCliente = clienteSeleccionado?.ciudad?.trim().toLowerCase();
    if (!ciudadCliente) return paquetes;
    const coincide = (p: Paquete) => p.ciudad_salida?.trim().toLowerCase() === ciudadCliente;
    return [...paquetes].sort((a, b) => Number(coincide(b)) - Number(coincide(a)));
  }, [paquetes, clienteSeleccionado]);

  const noches = nochesEntre(form.fecha_inicio, form.fecha_fin);
  const total = modo === "paquete"
    ? (paqueteSeleccionado ? paqueteSeleccionado.precio_base * parseInt(form.numero_personas || "1") : 0)
    : habitaciones.reduce((acc, h) => acc + h.precio_noche, 0) * (noches || 1);

  function toggleHabitacion(hotel: HotelData, hab: NonNullable<HotelData["habitaciones"]>[number]) {
    if (hab.estado !== "disponible") return;
    setHabitaciones((prev) => {
      const yaEsta = prev.find((h) => h.id_habitacion === hab.id_habitacion);
      if (yaEsta) return prev.filter((h) => h.id_habitacion !== hab.id_habitacion);
      return [
        ...prev,
        {
          id_habitacion: hab.id_habitacion,
          numero_habitacion: hab.numero_habitacion,
          tipo: hab.tipo_habitacion?.nombre_tipo ?? "Habitación",
          precio_noche: hab.precio_noche,
          nombre_hotel: hotel.nombre_hotel,
        },
      ];
    });
  }

  function cambiarModo(nuevo: "paquete" | "hotel") {
    setModo(nuevo);
    setMsg(null);
    // Cambiar de modo limpia lo del modo anterior para no mandar al backend
    // una mezcla de paquete + habitaciones sueltas que no tiene sentido.
    if (nuevo === "paquete") setHabitaciones([]);
    else setForm((f) => ({ ...f, id_paquete: "" }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!form.id_cliente) {
      setMsg({ type: "err", text: "Selecciona un cliente" });
      return;
    }
    if (modo === "hotel" && habitaciones.length === 0) {
      setMsg({ type: "err", text: "Selecciona al menos una habitación" });
      return;
    }

    const payload: any = {
      id_cliente: parseInt(form.id_cliente),
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      numero_personas: parseInt(form.numero_personas),
      estado: form.estado,
    };
    if (modo === "paquete") {
      payload.id_paquete = parseInt(form.id_paquete);
    } else {
      // El backend calcula el precio real desde la BD (nunca confía en lo
      // que mande el frontend) y valida disponibilidad real de fechas —
      // ver ReservaRepository.create / _verificar_disponibilidad.
      payload.habitaciones = habitaciones.map((h) => ({
        id_habitacion: h.id_habitacion,
        fecha_checkin: form.fecha_inicio,
        fecha_checkout: form.fecha_fin,
      }));
    }

    try {
      await onSubmit(payload);
      setMsg({ type: "ok", text: "Reserva creada exitosamente" });
      setForm({ ...FORM_INICIAL });
      setHabitaciones([]);
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Error al crear reserva" });
    }
  };

  const card = "bg-card rounded-xl border border-border p-4";
  const section = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Crear reserva"
        subtitle="Arma la reserva completa de un cliente — paquete o habitación, fechas y estado inicial — en un solo lugar."
      />

      {msg && (
        <div className={`p-3 rounded-xl text-sm font-medium ${msg.type === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </div>
      )}

      <StepProgress
        title="Avance"
        steps={[
          { label: "Cliente", ok: !!clienteSeleccionado },
          { label: "Tipo", ok: !!modo },
          {
            label: "Detalles",
            ok:
              modo === "paquete"
                ? !!paqueteSeleccionado && !!form.fecha_inicio && !!form.fecha_fin
                : habitaciones.length > 0 && !!form.fecha_inicio && !!form.fecha_fin,
          },
          { label: "Estado", ok: !!form.estado },
        ]}
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">

        {/* Columna izquierda: el formulario en secciones — mismo lenguaje
            visual que el detalle de una reserva ya existente, en vez de
            una sola tarjeta angosta con todos los campos apilados. */}
        <div className="space-y-5 min-w-0">

          {/* Cliente — buscador con foto real en vez de un <select> por id/cédula */}
          <section>
            <h3 className={section}><User className="w-3.5 h-3.5" /> Cliente</h3>
            <div className={card}>
              {clienteSeleccionado ? (
                <div className="flex items-center gap-3">
                  <Avatar
                    nombre={clienteSeleccionado.nombre}
                    apellido={clienteSeleccionado.apellido}
                    fotoUrl={resolveFotoUrl(clienteSeleccionado.foto_perfil)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {clienteSeleccionado.cedula} · {clienteSeleccionado.correo}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClientePickerOpen(true)}
                    className="text-xs font-semibold text-primary hover:underline flex-shrink-0"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setClientePickerOpen(true)}
                  className={`${inputCls} text-left text-muted-foreground flex items-center gap-2`}
                >
                  <Search className="w-4 h-4 flex-shrink-0" /> Buscar cliente por nombre, cédula o correo...
                </button>
              )}
            </div>
          </section>

          {/* Tipo de reserva */}
          <section>
            <h3 className={section}><Tag className="w-3.5 h-3.5" /> Tipo de reserva</h3>
            <div className={`${card} grid grid-cols-2 gap-2`}>
              <button
                type="button"
                onClick={() => cambiarModo("paquete")}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  modo === "paquete" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Paquete turístico
              </button>
              <button
                type="button"
                onClick={() => cambiarModo("hotel")}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  modo === "hotel" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Hotel y habitación
              </button>
            </div>
          </section>

          {/* Paquete, o Hotel + habitación(es) según el modo elegido */}
          <section>
            <h3 className={section}>
              {modo === "paquete"
                ? <><Package className="w-3.5 h-3.5" /> Paquete</>
                : <><Hotel className="w-3.5 h-3.5" /> Hotel y habitación</>}
            </h3>
            <div className={card}>
              {modo === "paquete" ? (
                <div className="space-y-1.5">
                  <select value={form.id_paquete}
                    onChange={(e) => setForm({ ...form, id_paquete: e.target.value })}
                    className={inputCls} required>
                    <option value="">Seleccionar paquete...</option>
                    {paquetesOrdenados.map((p) => {
                      const salida = p.ciudad_salida?.trim();
                      const destino = p.ciudad_destino?.trim();
                      const ruta = salida && destino ? ` · Sale de ${salida} → ${destino}`
                        : destino ? ` · Destino: ${destino}`
                        : salida ? ` · Sale de ${salida}` : "";
                      const recomendado = clienteSeleccionado?.ciudad
                        && salida?.toLowerCase() === clienteSeleccionado.ciudad.trim().toLowerCase();
                      return (
                        <option key={p.id_paquete} value={p.id_paquete}>
                          {recomendado ? "★ " : ""}{p.nombre_paquete} — ${p.precio_base?.toLocaleString()} ({p.duracion_dias}d){ruta}
                        </option>
                      );
                    })}
                  </select>
                  {/* Aviso suave, nunca un bloqueo: el admin puede igual elegir
                      cualquier paquete si el caso lo amerita (ver ★ arriba
                      para el que sí coincide con la ciudad del cliente). */}
                  {paqueteSeleccionado?.ciudad_salida && clienteSeleccionado?.ciudad
                    && paqueteSeleccionado.ciudad_salida.trim().toLowerCase() !== clienteSeleccionado.ciudad.trim().toLowerCase() && (
                    <p className="text-[11px] text-[#C9A227] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Este paquete sale de {paqueteSeleccionado.ciudad_salida}, pero {clienteSeleccionado.nombre} vive en {clienteSeleccionado.ciudad}.
                    </p>
                  )}
                </div>
              ) : habitaciones.length > 0 ? (
                <div className="space-y-2">
                  {habitaciones.map((h) => (
                    <div key={h.id_habitacion} className="flex items-center gap-3 p-2.5 border border-border rounded-xl bg-muted/30">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <Bed className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {h.nombre_hotel} — Hab. {h.numero_habitacion}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {h.tipo} · ${h.precio_noche.toLocaleString()}/noche
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHabitaciones((prev) => prev.filter((x) => x.id_habitacion !== h.id_habitacion))}
                        className="text-xs font-semibold text-destructive hover:underline flex-shrink-0"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setHotelPickerOpen(true)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + Agregar otra habitación
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setHotelPickerOpen(true)}
                  className={`${inputCls} text-left text-muted-foreground flex items-center gap-2`}
                >
                  <Hotel className="w-4 h-4 flex-shrink-0" /> Buscar hotel y elegir habitación...
                </button>
              )}
            </div>
          </section>

          {/* Fechas y huéspedes */}
          <section>
            <h3 className={section}><Calendar className="w-3.5 h-3.5" /> Fechas y huéspedes</h3>
            <div className={`${card} grid grid-cols-1 sm:grid-cols-3 gap-4`}>
              <div>
                <label className={labelCls}>Fecha inicio</label>
                <input type="date"
                max="2100-12-31" value={form.fecha_inicio}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                  className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Fecha fin</label>
                <input type="date"
                max="2100-12-31" value={form.fecha_fin}
                  onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                  className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Número de personas</label>
                <input type="number" min="1" value={form.numero_personas}
                  onChange={(e) => setForm({ ...form, numero_personas: e.target.value })}
                  className={inputCls} required />
              </div>
            </div>

            {/* En modo hotel, con habitaciones elegidas, se reutiliza el
                calendario de ocupación del detalle público (el mismo que
                GET /hoteles/{id}/fechas-ocupadas alimenta en HotelDetail)
                para que el admin vea de un vistazo qué días están ocupados
                mientras elige las fechas. */}
            {modo === "hotel" && habitaciones.length > 0 && (
              <div className={`${card} mt-4`}>
                {haySolapeEnSeleccionadas && (
                  <p className="text-[11px] text-destructive flex items-center gap-1 mb-3">
                    <XCircle className="w-3 h-3 shrink-0" /> Alguna de las habitaciones elegidas ya está ocupada entre las fechas seleccionadas. Ajusta las fechas o elige otra habitación.
                  </p>
                )}
                <CalendarioOcupacion
                  rangos={rangosSeleccionados}
                  rangoSeleccionado={{
                    fechaInicio: form.fecha_inicio || undefined,
                    fechaFin: form.fecha_fin || undefined,
                  }}
                />
              </div>
            )}
          </section>

          {/* Estado inicial — mismo picker visual (ícono + color) que el
              detalle de una reserva ya existente, en vez de un <select>
              perdido entre el resto de campos. */}
          <section>
            <h3 className={section}><Clock className="w-3.5 h-3.5" /> Estado inicial</h3>
            <div className={`${card} grid grid-cols-2 sm:grid-cols-4 gap-1.5`}>
              {ESTADO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, estado: opt.value })}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    form.estado === opt.value
                      ? `${opt.cls} ring-2 ring-offset-1 ring-offset-card shadow-sm`
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Columna derecha: resumen fijo, siempre visible mientras se llena
            el formulario (antes el resumen solo aparecía al final, una vez
            todo diligenciado) — mismo patrón que el resumen del checkout
            público. */}
        <div className="lg:sticky lg:top-6">
          <div className={`${card} p-5 space-y-4`}>
            <h3 className={section}>Resumen de la reserva</h3>

            <div>
              <DetailRow icon={User} label="Cliente" value={clienteSeleccionado ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}` : undefined} />
              <DetailRow icon={Tag} label="Tipo" value={modo === "paquete" ? "Paquete turístico" : "Hotel y habitación"} />
              {modo === "paquete" ? (
                <DetailRow icon={Package} label="Paquete" value={paqueteSeleccionado?.nombre_paquete} />
              ) : (
                <DetailRow
                  icon={Bed}
                  label="Habitaciones"
                  value={habitaciones.length > 0 ? `${habitaciones.length} seleccionada${habitaciones.length > 1 ? "s" : ""}` : undefined}
                />
              )}
              <DetailRow
                icon={Calendar}
                label="Fechas"
                value={form.fecha_inicio && form.fecha_fin ? `${form.fecha_inicio} → ${form.fecha_fin}` : undefined}
              />
              {modo === "hotel" && <DetailRow icon={Clock} label="Noches" value={noches || undefined} />}
              <DetailRow icon={Users} label="Huéspedes" value={form.numero_personas} />
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-sm text-foreground">Total estimado</span>
                <span className="text-2xl font-bold text-primary tracking-tight">${total.toLocaleString()}</span>
              </div>
              {modo === "hotel" && habitaciones.length > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  ${habitaciones.reduce((acc, h) => acc + h.precio_noche, 0).toLocaleString()}/noche × {noches || 1} noche{(noches || 1) > 1 ? "s" : ""}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-primary to-[#A13B55] text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50">
              {loading ? "Creando..." : "Crear reserva"}
            </button>
          </div>
        </div>
      </form>

      {/* Pop-up: seleccionar cliente */}
      <AdminModal
        open={clientePickerOpen}
        onOpenChange={(o) => { setClientePickerOpen(o); if (!o) setClienteQuery(""); }}
        title="Seleccionar cliente"
        description="Busca por nombre, cédula, correo o ciudad."
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={clienteQuery}
              onChange={(e) => setClienteQuery(e.target.value)}
              placeholder="Ej: María Gómez, 1020304050..."
              className={`${inputCls} pl-10`}
            />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {clientesFiltrados.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No se encontraron clientes.</p>
            )}
            {clientesFiltrados.map((c) => (
              <button
                key={c.id_cliente}
                type="button"
                onClick={() => { setForm((f) => ({ ...f, id_cliente: String(c.id_cliente) })); setClientePickerOpen(false); setClienteQuery(""); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-border hover:bg-muted/50 transition-all text-left"
              >
                <Avatar nombre={c.nombre} apellido={c.apellido} fotoUrl={resolveFotoUrl(c.foto_perfil)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{c.nombre} {c.apellido}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.cedula} · {c.correo} {c.ciudad ? `· ${c.ciudad}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </AdminModal>

      {/* Pop-up: seleccionar hotel y habitación */}
      <AdminModal
        open={hotelPickerOpen}
        onOpenChange={(o) => { setHotelPickerOpen(o); if (!o) { setHotelExpandido(null); setHotelQuery(""); } }}
        title={hotelExpandido ? `Habitaciones — ${hotelExpandido.nombre_hotel}` : "Seleccionar hotel"}
        description={hotelExpandido ? "Toca una habitación disponible para agregarla." : "Busca por nombre, ciudad o país."}
        maxWidth="sm:max-w-lg"
      >
        {!hotelExpandido ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={hotelQuery}
                onChange={(e) => setHotelQuery(e.target.value)}
                placeholder="Ej: Cartagena, Hotel Bahía..."
                className={`${inputCls} pl-10`}
              />
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1.5">
              {hotelesFiltrados.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No se encontraron hoteles.</p>
              )}
              {hotelesFiltrados.map((h) => {
                const disponibles = (h.habitaciones ?? []).filter((hab) => hab.estado === "disponible").length;
                return (
                  <button
                    key={h.id_hotel}
                    type="button"
                    onClick={() => setHotelExpandido(h)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-border hover:bg-muted/50 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#C9A227]/15 text-[#C9A227] flex items-center justify-center flex-shrink-0">
                      <Hotel className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{h.nombre_hotel}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[h.ciudad, h.pais].filter(Boolean).join(", ")}
                        {h.calificacion_promedio != null ? ` · ${h.calificacion_promedio}★ (${h.total_resenas ?? 0})` : ""}
                      </p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${disponibles > 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {disponibles} libres
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setHotelExpandido(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Volver a hoteles
            </button>
            {!fechasElegidasValidas && (
              <p className="text-[11px] text-[#C9A227] flex items-center gap-1">
                <Clock className="w-3 h-3" /> Elige fecha inicio y fin abajo para ver disponibilidad real por fecha (por ahora solo se ve el estado general de la habitación).
              </p>
            )}
            <div className="max-h-96 overflow-y-auto space-y-1.5">
              {(hotelExpandido.habitaciones ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Este hotel no tiene habitaciones registradas.</p>
              )}
              {cargandoFechas && (
                <p className="text-xs text-muted-foreground text-center py-2">Consultando disponibilidad real...</p>
              )}
              {(hotelExpandido.habitaciones ?? []).map((hab) => {
                const elegida = habitaciones.some((h) => h.id_habitacion === hab.id_habitacion);
                const ocupadaEsasFechas = haySolapeFechas(hab.id_habitacion);
                const disponible = hab.estado === "disponible" && !ocupadaEsasFechas;
                return (
                  <button
                    key={hab.id_habitacion}
                    type="button"
                    disabled={!disponible}
                    onClick={() => toggleHabitacion(hotelExpandido, hab)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                      elegida ? "border-primary bg-primary/5" : "border-border"
                    } ${disponible ? "hover:bg-muted/50 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${elegida ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {elegida ? <Check className="w-4 h-4" /> : <Bed className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        Hab. {hab.numero_habitacion} — {hab.tipo_habitacion?.nombre_tipo ?? "Habitación"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Users className="w-3 h-3" /> {hab.tipo_habitacion?.capacidad_personas ?? "—"} personas · ${hab.precio_noche.toLocaleString()}/noche
                      </p>
                    </div>
                    {!disponible && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0 capitalize">
                        {hab.estado !== "disponible" ? hab.estado : "Ocupada esas fechas"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {habitaciones.length > 0 && (
              <button
                type="button"
                onClick={() => setHotelPickerOpen(false)}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-95 transition-all"
              >
                Listo ({habitaciones.length} habitación{habitaciones.length > 1 ? "es" : ""})
              </button>
            )}
          </div>
        )}
      </AdminModal>
    </div>
  );
}
