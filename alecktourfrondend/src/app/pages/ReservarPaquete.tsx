import { AlertTriangle, ArrowLeft, Baby, Bed, CalendarDays, Check, CheckCircle2, Loader2, Minus, Plane, Plus, Sparkles, User, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast, Toaster } from "sonner";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import PagoDeReserva from "../components/payment/PagoDeReserva";
import ResumenCotizacion, { pesos } from "../components/reserva/ResumenCotizacion";
import { resolveFotoUrl } from "../components/admin/types";
import { TERMINOS_VERSION } from "../content/terminos";
import { useAuth } from "../context/AuthContext";
import type { SeleccionProducto, ViajeroInput } from "../data/reservaTypes";
import { useCotizacion } from "../hooks/useCotizacion";
import { clienteService } from "../services/cliente.service";
import { HabitacionResponse, HotelDetailResponse, hotelService } from "../services/hotel.service";
import { nuevoClientMsgId } from "../services/mensajeChat.service";
import { ETIQUETA_MODALIDAD_VUELO, PaqueteDetalleResponse, paqueteService } from "../services/paquete.service";
import { reservaService } from "../services/reserva.service";
import { ETIQUETA_CLASE, hora, OfertaVuelo, rutaOferta } from "../services/vuelo.service";

const PASOS = ["Tu viaje", "Viajeros", "Revisión", "Pago"];
const HOY = new Date().toISOString().slice(0, 10);

function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function fechaLarga(iso?: string | null) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

type ViajeroForm = ViajeroInput & { clave: string };

function Contador({ label, ayuda, valor, min, max, onChange, icono: Icono }: { label: string; ayuda?: string; valor: number; min: number; max: number; onChange: (n: number) => void; icono: typeof User }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2.5">
        <Icono className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {ayuda && <p className="text-[11px] text-muted-foreground">{ayuda}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(valor - 1)} disabled={valor <= min} aria-label={`Quitar ${label.toLowerCase()}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"><Minus className="h-4 w-4" /></button>
        <span className="w-6 text-center font-bold" aria-live="polite">{valor}</span>
        <button type="button" onClick={() => onChange(valor + 1)} disabled={valor >= max} aria-label={`Agregar ${label.toLowerCase()}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function DetalleVuelo({ o }: { o: OfertaVuelo }) {
  return (
    <div className="text-xs text-muted-foreground">
      <p className="font-semibold text-foreground">{rutaOferta(o)}</p>
      <p>
        Ida: {fechaLarga(o.fecha_salida)}{hora(o.hora_salida) ? ` · ${hora(o.hora_salida)}` : " · hora por confirmar"}
        {o.fecha_regreso && <> · Regreso: {fechaLarga(o.fecha_regreso)}{hora(o.hora_regreso) ? ` · ${hora(o.hora_regreso)}` : ""}</>}
      </p>
      <p>
        {o.aerolinea || "Aerolínea por confirmar"}{o.clase ? ` · ${ETIQUETA_CLASE[o.clase]}` : ""}
        {o.escalas != null ? ` · ${o.escalas === 0 ? "Directo" : `${o.escalas} escala(s)`}` : ""}
        {o.equipaje_bodega ? ` · Bodega: ${o.equipaje_bodega}` : ""}
      </p>
    </div>
  );
}

export default function ReservarPaquete() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [pkg, setPkg] = useState<PaqueteDetalleResponse | null>(null);
  const [hoteles, setHoteles] = useState<HotelDetailResponse[]>([]);
  const [cargando, setCargando] = useState(true);
  const [paso, setPaso] = useState(0);

  // Selección
  const [idSalida, setIdSalida] = useState<number | null>(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [adultos, setAdultos] = useState(2);
  const [ninos, setNinos] = useState(0);
  const [infantes, setInfantes] = useState(0);
  const [habitaciones, setHabitaciones] = useState<number[]>([]);
  const [conVuelo, setConVuelo] = useState(false);
  const [idOferta, setIdOferta] = useState<number | null>(null);
  const [opcionales, setOpcionales] = useState<number[]>([]);
  const [viajeros, setViajeros] = useState<ViajeroForm[]>([]);
  const [solicitudes, setSolicitudes] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [creando, setCreando] = useState(false);
  const [reserva, setReserva] = useState<{ id_reserva: number; precio_total: number; total_pagado: number } | null>(null);
  const [celular, setCelular] = useState<string | null>(null);
  const clave = useRef(nuevoClientMsgId());

  useEffect(() => {
    if (!id) return;
    paqueteService
      .getDetalle(Number(id))
      .then(async (d) => {
        if (!d.activo) {
          toast.error("Este paquete no está disponible.");
          navigate(`/package/${id}`);
          return;
        }
        setPkg(d);
        const abiertas = (d.salidas ?? []).filter((s) => s.estado === "abierta" && s.fecha_salida >= HOY && (s.cupos_disponibles ?? 1) > 0);
        if (abiertas.length) setIdSalida(abiertas[0].id_salida ?? null);
        if (d.min_viajeros && d.min_viajeros > 2) setAdultos(d.min_viajeros);
        if (d.vuelos?.length === 1) setIdOferta(d.vuelos[0].id_oferta);
        if (d.modalidad_alojamiento === "opcional") {
          const hs = await Promise.all(d.hoteles.map((h) => hotelService.getById(h.id_hotel).catch(() => null)));
          setHoteles(hs.filter((h): h is HotelDetailResponse => !!h));
        }
      })
      .catch(() => {
        toast.error("No encontramos ese paquete.");
        navigate("/packages");
      })
      .finally(() => setCargando(false));
  }, [id, navigate]);

  // Titular precargado con los datos del cliente.
  useEffect(() => {
    if (!usuario?.id_cliente) return;
    clienteService
      .getById(usuario.id_cliente)
      .then((c) => {
        setCelular(c.celular ?? null);
        setViajeros((v) => {
          if (v.length) return v;
          return [{ clave: "t", tipo: "adulto", es_titular: true, nombres: c.nombre ?? "", apellidos: c.apellido ?? "", tipo_documento: "CC", numero_documento: c.cedula ?? "", fecha_nacimiento: (c as any).fecha_nacimiento ?? "", nacionalidad: "Colombiana" }];
        });
      })
      .catch(() => {});
  }, [usuario?.id_cliente]);

  const noches = pkg ? (pkg.noches ?? (pkg.duracion_dias ? pkg.duracion_dias - 1 : 0)) : 0;
  const salidas = useMemo(() => (pkg?.salidas ?? []).filter((s) => s.estado === "abierta" && s.fecha_salida >= HOY), [pkg]);
  const usaSalidas = (pkg?.salidas ?? []).length > 0;
  const salida = salidas.find((s) => s.id_salida === idSalida);
  const inicio = usaSalidas ? salida?.fecha_salida ?? "" : fechaInicio;
  const fin = usaSalidas ? salida?.fecha_regreso || (inicio ? sumarDias(inicio, noches) : "") : inicio ? sumarDias(inicio, noches) : "";
  const aceptaInfantes = pkg?.unidad_precio === "por_paquete" || pkg?.precio_infante != null;
  const modVuelo = pkg?.modalidad_vuelo ?? "sin";
  const ofertaElegida = pkg?.vuelos?.find((v) => v.id_oferta === idOferta) ?? null;
  const llevaVuelo = (modVuelo === "incluido" && !!ofertaElegida) || (modVuelo === "opcional" && conVuelo);
  const totalViajeros = adultos + ninos + infantes;

  // Mantiene la lista de viajeros al ritmo de los contadores.
  useEffect(() => {
    setViajeros((prev) => {
      const porTipo = (t: ViajeroForm["tipo"], n: number) => {
        const actuales = prev.filter((v) => v.tipo === t);
        const extra = Array.from({ length: Math.max(n - actuales.length, 0) }, (_, i) => ({ clave: `${t}-${Date.now()}-${i}`, tipo: t, nombres: "", apellidos: "", tipo_documento: t === "adulto" ? "CC" : "TI", numero_documento: "", fecha_nacimiento: "", nacionalidad: "Colombiana" }) as ViajeroForm);
        return [...actuales, ...extra].slice(0, n);
      };
      return [...porTipo("adulto", adultos), ...porTipo("nino", ninos), ...porTipo("infante", infantes)];
    });
  }, [adultos, ninos, infantes]);

  const seleccion: SeleccionProducto | null = useMemo(() => {
    if (!pkg || !inicio) return null;
    return {
      tipo_producto: "paquete",
      id_paquete: pkg.id_paquete,
      id_salida: usaSalidas ? idSalida : null,
      fecha_inicio: usaSalidas ? null : inicio,
      adultos,
      ninos,
      infantes,
      habitaciones: habitaciones.map((h) => ({ id_habitacion: h, fecha_checkin: inicio, fecha_checkout: fin })),
      incluir_vuelo: modVuelo === "opcional" ? conVuelo : modVuelo === "cotizacion" ? conVuelo : false,
      id_oferta_vuelo: (modVuelo === "opcional" && conVuelo) || modVuelo === "incluido" ? idOferta : null,
      servicios_opcionales: opcionales,
    };
  }, [pkg, inicio, fin, usaSalidas, idSalida, adultos, ninos, infantes, habitaciones, modVuelo, conVuelo, idOferta, opcionales]);

  const { cotizacion, cargando: cotizando, error: errorCot } = useCotizacion(reserva ? null : seleccion);

  // Validaciones por paso
  const errorPaso1 = !inicio
    ? usaSalidas ? "Elige una fecha de salida" : "Elige la fecha de inicio"
    : modVuelo === "opcional" && conVuelo && !idOferta
      ? "Elige el vuelo"
      : modVuelo === "incluido" && (pkg?.vuelos?.length ?? 0) > 1 && !idOferta
        ? "Elige con qué vuelo quieres viajar"
        : errorCot;
  const viajeroIncompleto = (v: ViajeroForm) =>
    !v.nombres.trim() || !v.apellidos.trim() || (llevaVuelo && (!v.fecha_nacimiento || !v.tipo_documento || !String(v.numero_documento ?? "").trim()));
  const errorPaso2 = viajeros.length && viajeroIncompleto(viajeros[0])
    ? "Completa los datos del titular"
    : llevaVuelo && viajeros.some(viajeroIncompleto)
      ? "Para el vuelo necesitamos nombre, fecha de nacimiento y documento de cada pasajero"
      : null;

  const setViajero = (i: number, campo: keyof ViajeroInput, valor: string) =>
    setViajeros((vs) => vs.map((v, j) => (j === i ? { ...v, [campo]: valor } : v)));

  async function confirmar() {
    if (!usuario?.id_cliente || !seleccion || !cotizacion) return;
    if (!aceptaTerminos) {
      toast.error("Debes aceptar los términos y condiciones.");
      return;
    }
    setCreando(true);
    try {
      const viajerosPayload = viajeros
        .filter((v) => v.nombres.trim() && v.apellidos.trim())
        .map(({ clave: _c, ...v }) => ({
          ...v,
          nombres: v.nombres.trim(),
          apellidos: v.apellidos.trim(),
          fecha_nacimiento: v.fecha_nacimiento || null,
          numero_documento: String(v.numero_documento ?? "").trim() || null,
          tipo_documento: v.tipo_documento || null,
          nacionalidad: v.nacionalidad?.trim() || null,
        }));
      const r = await reservaService.create({
        id_cliente: usuario.id_cliente,
        ...seleccion,
        id_paquete: seleccion.id_paquete ?? undefined,
        viajeros: viajerosPayload,
        solicitudes_especiales: solicitudes.trim() || null,
        terminos_version: TERMINOS_VERSION,
        clave_idempotencia: clave.current,
        precio_esperado: cotizacion.total,
      });
      setReserva({ id_reserva: r.id_reserva, precio_total: r.precio_total ?? cotizacion.total, total_pagado: r.total_pagado ?? 0 });
      setPaso(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success(`Reserva #${r.id_reserva} registrada`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear la reserva");
    } finally {
      setCreando(false);
    }
  }

  if (cargando || !pkg) {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  const opcionalesDisponibles = pkg.servicios.filter((s) => !s.incluido);
  const siguiente = () => {
    const err = paso === 0 ? errorPaso1 : paso === 1 ? errorPaso2 : null;
    if (err) {
      toast.error(err);
      return;
    }
    setPaso((p) => p + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Toaster position="top-center" richColors />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link to={`/package/${pkg.id_paquete}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver al paquete
        </Link>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          {pkg.imagen_url && <img src={resolveFotoUrl(pkg.imagen_url)} alt="" className="h-20 w-28 rounded-xl object-cover" />}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Reservar paquete</p>
            <h1 className="text-2xl font-bold">{pkg.nombre_paquete}</h1>
            <p className="text-sm text-muted-foreground">
              {pkg.duracion_dias ? `${pkg.duracion_dias} días / ${noches} noches` : ""}
              {pkg.destino_ciudad || pkg.ciudad_destino ? ` · ${pkg.destino_ciudad || pkg.ciudad_destino}` : ""}
            </p>
          </div>
        </div>

        <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Pasos de la reserva">
          {PASOS.map((p, i) => (
            <li key={p} className={`rounded-full px-2 py-1.5 text-center text-xs font-semibold ${i === paso ? "bg-primary text-primary-foreground" : i < paso ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`} aria-current={i === paso ? "step" : undefined}>
              {i < paso ? <Check className="mr-1 inline h-3 w-3" /> : `${i + 1}. `}{p}
            </li>
          ))}
        </ol>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {paso === 0 && (
              <>
                <section className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-3 flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5 text-primary" /> ¿Cuándo viajas?</h2>
                  {usaSalidas ? (
                    salidas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Este paquete no tiene salidas disponibles por ahora. Escríbenos y te avisamos de las próximas.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {salidas.map((s) => {
                          const agotada = s.cupos_disponibles === 0;
                          return (
                            <button key={s.id_salida} type="button" disabled={agotada} onClick={() => setIdSalida(s.id_salida ?? null)}
                              className={`rounded-xl border p-3 text-left disabled:opacity-50 ${idSalida === s.id_salida ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                              <p className="text-sm font-semibold">{fechaLarga(s.fecha_salida)}</p>
                              <p className="text-xs text-muted-foreground">Regreso: {fechaLarga(s.fecha_regreso || sumarDias(s.fecha_salida, noches))}</p>
                              <p className={`mt-1 text-xs font-semibold ${agotada ? "text-destructive" : "text-success"}`}>
                                {agotada ? "Agotada" : s.cupos_disponibles == null ? "Disponible" : `${s.cupos_disponibles} cupo(s) disponibles`}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        <span className="mb-1 block font-medium">Fecha de inicio</span>
                        <input type="date" min={pkg.vigencia_desde && pkg.vigencia_desde > HOY ? pkg.vigencia_desde : HOY} max={pkg.vigencia_hasta ?? undefined} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5" />
                      </label>
                      {fin && <p className="self-end text-sm text-muted-foreground">Regreso: <b className="text-foreground">{fechaLarga(fin)}</b></p>}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-1 flex items-center gap-2 font-bold"><Users className="h-5 w-5 text-primary" /> ¿Quiénes viajan?</h2>
                  {(pkg.min_viajeros || pkg.max_viajeros) && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      {pkg.min_viajeros ? `Mínimo ${pkg.min_viajeros}` : ""}{pkg.min_viajeros && pkg.max_viajeros ? " · " : ""}{pkg.max_viajeros ? `Máximo ${pkg.max_viajeros}` : ""} viajero(s)
                    </p>
                  )}
                  <div className="divide-y divide-border">
                    <Contador label="Adultos" ayuda={pkg.unidad_precio === "por_persona" ? `${pesos(pkg.precio_base)} c/u` : undefined} valor={adultos} min={1} max={pkg.max_viajeros ?? 20} onChange={setAdultos} icono={User} />
                    <Contador label="Niños" ayuda={pkg.unidad_precio === "por_persona" ? (pkg.precio_nino != null ? `${pesos(pkg.precio_nino)} c/u` : "Pagan tarifa de adulto") : undefined} valor={ninos} min={0} max={20} onChange={setNinos} icono={User} />
                    {aceptaInfantes ? (
                      <Contador label="Infantes" ayuda={pkg.unidad_precio === "por_persona" ? (pkg.precio_infante ? `${pesos(pkg.precio_infante)} c/u` : "Sin costo") : "Menores de 2 años"} valor={infantes} min={0} max={adultos} onChange={setInfantes} icono={Baby} />
                    ) : (
                      <p className="py-2 text-xs text-muted-foreground">Para viajar con bebés, consulta con un asesor.</p>
                    )}
                  </div>
                </section>

                {pkg.modalidad_alojamiento === "incluido" && pkg.hoteles.length > 0 && (
                  <section className="rounded-2xl border border-success/30 bg-success/5 p-5">
                    <h2 className="mb-1 flex items-center gap-2 font-bold"><Bed className="h-5 w-5 text-success" /> Alojamiento incluido</h2>
                    <ul className="text-sm">
                      {pkg.hoteles.map((h) => <li key={h.id_hotel}>{h.nombre_hotel}{h.ciudad ? `, ${h.ciudad}` : ""}{h.noches_incluidas ? ` · ${h.noches_incluidas} noche(s)` : ""}</li>)}
                    </ul>
                    <p className="mt-1 text-xs text-muted-foreground">Ya está en el precio: no se cobra aparte. La agencia asigna la habitación.</p>
                  </section>
                )}

                {pkg.modalidad_alojamiento === "opcional" && (
                  <section className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="mb-1 flex items-center gap-2 font-bold"><Bed className="h-5 w-5 text-primary" /> Alojamiento (opcional)</h2>
                    <p className="mb-3 text-xs text-muted-foreground">Puedes reservar sin hotel. Si quieres, agrega una o varias habitaciones para las {noches} noche(s) del viaje.</p>
                    {hoteles.flatMap((h) => (h.habitaciones ?? []).filter((x: HabitacionResponse) => x.estado === "disponible").map((hab: HabitacionResponse) => {
                      const sel = habitaciones.includes(hab.id_habitacion);
                      return (
                        <label key={hab.id_habitacion} className={`mb-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${sel ? "border-primary bg-primary/5" : "border-border"}`}>
                          <input type="checkbox" checked={sel} onChange={() => setHabitaciones((hs) => (sel ? hs.filter((x) => x !== hab.id_habitacion) : [...hs, hab.id_habitacion]))} />
                          {hab.imagenes?.[0] && <img src={resolveFotoUrl(hab.imagenes[0].url)} alt="" className="h-12 w-16 rounded-lg object-cover" />}
                          <span className="flex-1 text-sm">
                            <b>{hab.tipo_habitacion?.nombre_tipo ?? "Habitación"}</b> #{hab.numero_habitacion} · {h.nombre_hotel}
                            <span className="block text-xs text-muted-foreground">Hasta {hab.tipo_habitacion?.capacidad_personas ?? "?"} personas{hab.tipo_cama ? ` · ${hab.tipo_cama}` : ""}{hab.desayuno_incluido ? " · Desayuno incluido" : ""}</span>
                          </span>
                          <span className="text-right text-sm font-semibold">{pesos(hab.precio_noche)}<span className="block text-[10px] font-normal text-muted-foreground">por noche</span></span>
                        </label>
                      );
                    }))}
                    {hoteles.length === 0 && <p className="text-sm text-muted-foreground">No hay habitaciones disponibles para agregar en este momento.</p>}
                  </section>
                )}

                {modVuelo !== "sin" && (
                  <section className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="mb-1 flex items-center gap-2 font-bold"><Plane className="h-5 w-5 text-primary" /> {ETIQUETA_MODALIDAD_VUELO[modVuelo]}</h2>
                    {modVuelo === "incluido" && (
                      <>
                        <p className="mb-3 text-xs text-muted-foreground">El vuelo ya está en el precio del paquete: no se cobra otra vez.</p>
                        {(pkg.vuelos ?? []).length === 0 && <p className="text-sm">La agencia te confirmará los horarios del vuelo.</p>}
                      </>
                    )}
                    {modVuelo === "opcional" && (
                      <label className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={conVuelo} onChange={(e) => setConVuelo(e.target.checked)} /> Quiero agregar el vuelo
                      </label>
                    )}
                    {modVuelo === "cotizacion" && (
                      <>
                        <p className="mb-2 text-xs text-muted-foreground">La tarifa del vuelo no es fija: si lo pides, la agencia te envía la cotización y solo se cobra si la aceptas.</p>
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input type="checkbox" checked={conVuelo} onChange={(e) => setConVuelo(e.target.checked)} /> Quiero que me coticen el vuelo
                        </label>
                      </>
                    )}
                    {(modVuelo === "incluido" || (modVuelo === "opcional" && conVuelo)) && (pkg.vuelos ?? []).map((o) => (
                      <label key={o.id_oferta} className={`mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${idOferta === o.id_oferta ? "border-primary bg-primary/5" : "border-border"}`}>
                        <input type="radio" name="vuelo" checked={idOferta === o.id_oferta} onChange={() => setIdOferta(o.id_oferta)} className="mt-1" disabled={o.cupos_disponibles === 0} />
                        <span className="flex-1"><DetalleVuelo o={o} />{o.cupos_disponibles === 0 && <span className="text-xs font-semibold text-destructive">Sin sillas disponibles</span>}</span>
                        {modVuelo === "opcional" && <span className="text-right text-sm font-semibold">+{pesos(o.precio_adulto)}<span className="block text-[10px] font-normal text-muted-foreground">por adulto</span></span>}
                      </label>
                    ))}
                    {(modVuelo === "incluido" || modVuelo === "opcional") && (pkg.vuelos ?? []).length > 0 && (
                      <p className="text-[11px] text-muted-foreground">Oferta gestionada por la agencia; los horarios sin hora los confirma la aerolínea.</p>
                    )}
                  </section>
                )}

                {opcionalesDisponibles.length > 0 && (
                  <section className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="mb-1 flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5 text-primary" /> Actividades opcionales</h2>
                    <p className="mb-3 text-xs text-muted-foreground">No están en el precio base. Se cobran por persona (adultos y niños).</p>
                    {opcionalesDisponibles.map((s) => {
                      const sel = opcionales.includes(s.id_servicio);
                      return (
                        <label key={s.id_servicio} className={`mb-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${sel ? "border-primary bg-primary/5" : "border-border"}`}>
                          <input type="checkbox" checked={sel} onChange={() => setOpcionales((o) => (sel ? o.filter((x) => x !== s.id_servicio) : [...o, s.id_servicio]))} />
                          <span className="flex-1 text-sm"><b>{s.nombre_servicio}</b>{s.descripcion && <span className="block text-xs text-muted-foreground">{s.descripcion}</span>}</span>
                          {s.precio_por_persona != null && <span className="text-sm font-semibold">+{pesos(s.precio_por_persona)} <span className="text-[10px] font-normal text-muted-foreground">p/p</span></span>}
                        </label>
                      );
                    })}
                  </section>
                )}
              </>
            )}

            {paso === 1 && (
              <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <h2 className="font-bold">Datos de los viajeros</h2>
                <p className="text-xs text-muted-foreground">
                  {llevaVuelo
                    ? "Como tu reserva incluye vuelo, necesitamos los datos de todos los pasajeros tal como aparecen en su documento."
                    : "El titular es obligatorio. Los demás puedes completarlos ahora o enviárselos después a tu asesor."}
                  {" "}Tus documentos solo los ve el equipo de la agencia.
                </p>
                {viajeros.map((v, i) => (
                  <fieldset key={v.clave} className="rounded-xl border border-border p-3">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {v.es_titular ? "Titular de la reserva" : v.tipo === "adulto" ? "Adulto" : v.tipo === "nino" ? "Niño" : "Infante"}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={v.nombres} onChange={(e) => setViajero(i, "nombres", e.target.value)} maxLength={100} placeholder="Nombres *" aria-label="Nombres" className="rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm" />
                      <input value={v.apellidos} onChange={(e) => setViajero(i, "apellidos", e.target.value)} maxLength={100} placeholder="Apellidos *" aria-label="Apellidos" className="rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm" />
                      <label className="text-xs text-muted-foreground">Fecha de nacimiento{llevaVuelo && " *"}
                        <input type="date" max={HOY} value={v.fecha_nacimiento ?? ""} onChange={(e) => setViajero(i, "fecha_nacimiento", e.target.value)} className="mt-0.5 w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground" />
                      </label>
                      <label className="text-xs text-muted-foreground">Nacionalidad
                        <input value={v.nacionalidad ?? ""} onChange={(e) => setViajero(i, "nacionalidad", e.target.value)} maxLength={60} className="mt-0.5 w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground" />
                      </label>
                      <select value={v.tipo_documento ?? ""} onChange={(e) => setViajero(i, "tipo_documento", e.target.value)} aria-label="Tipo de documento" className="rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm">
                        <option value="CC">Cédula de ciudadanía</option>
                        <option value="TI">Tarjeta de identidad</option>
                        <option value="RC">Registro civil</option>
                        <option value="CE">Cédula de extranjería</option>
                        <option value="PA">Pasaporte</option>
                      </select>
                      <input value={v.numero_documento ?? ""} onChange={(e) => setViajero(i, "numero_documento", e.target.value.replace(/[^A-Za-z0-9.\- ]/g, ""))} maxLength={30} placeholder={`Número de documento${llevaVuelo ? " *" : ""}`} aria-label="Número de documento" className="rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm" />
                    </div>
                  </fieldset>
                ))}
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Solicitudes especiales (opcional)</span>
                  <textarea value={solicitudes} onChange={(e) => setSolicitudes(e.target.value)} maxLength={2000} rows={3} placeholder="Ej: cama adicional, dieta especial, celebración..." className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5" />
                  <span className="text-[11px] text-muted-foreground">Las revisa la agencia; no se garantizan hasta que te las confirmen.</span>
                </label>
              </section>
            )}

            {paso === 2 && (
              <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <h2 className="font-bold">Revisa tu reserva</h2>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">Paquete</dt><dd className="font-semibold">{pkg.nombre_paquete}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Fechas</dt><dd className="font-semibold">{fechaLarga(inicio)} → {fechaLarga(fin)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Viajeros</dt><dd className="font-semibold">{adultos} adulto(s){ninos ? `, ${ninos} niño(s)` : ""}{infantes ? `, ${infantes} infante(s)` : ""}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Titular</dt><dd className="font-semibold">{viajeros[0] ? `${viajeros[0].nombres} ${viajeros[0].apellidos}` : "—"}</dd></div>
                  {ofertaElegida && (modVuelo === "incluido" || conVuelo) && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Vuelo</dt><dd><DetalleVuelo o={ofertaElegida} /></dd></div>}
                </dl>
                {(pkg.inclusiones ?? []).some((i) => i.tipo === "no_incluye") || pkg.no_incluye ? (
                  <div className="rounded-xl bg-muted/50 p-3 text-xs">
                    <p className="mb-1 font-semibold">No incluye</p>
                    <ul className="list-inside list-disc text-muted-foreground">
                      {((pkg.inclusiones ?? []).filter((i) => i.tipo === "no_incluye").map((i) => i.descripcion).length
                        ? (pkg.inclusiones ?? []).filter((i) => i.tipo === "no_incluye").map((i) => i.descripcion)
                        : (pkg.no_incluye ?? "").split("\n").filter(Boolean)
                      ).map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                ) : null}
                {pkg.condiciones && (
                  <div className="rounded-xl bg-muted/50 p-3 text-xs">
                    <p className="mb-1 font-semibold">Condiciones del paquete</p>
                    <p className="whitespace-pre-line text-muted-foreground">{pkg.condiciones}</p>
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)} className="mt-1" />
                  <span>Acepto los <Link to="/terms" target="_blank" className="font-semibold text-primary underline">términos y condiciones</Link> y las condiciones de este paquete.</span>
                </label>
              </section>
            )}

            {paso === 3 && reserva && (
              <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <p className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-5 w-5" /> Tu reserva #{reserva.id_reserva} quedó registrada (pendiente de pago).
                </p>
                <PagoDeReserva idReserva={reserva.id_reserva} total={reserva.precio_total} totalPagado={reserva.total_pagado} celularCliente={celular} />
                <button type="button" onClick={() => navigate("/profile", { state: { tab: "reservas" } })} className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">
                  Pagar después — ver mis reservas
                </button>
              </section>
            )}

            {paso < 3 && (
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0} className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-40">← Atrás</button>
                {paso < 2 ? (
                  <button type="button" onClick={siguiente} disabled={cotizando && paso === 0} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">Continuar →</button>
                ) : (
                  <button type="button" onClick={confirmar} disabled={creando || !cotizacion || !aceptaTerminos} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                    {creando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar reserva
                  </button>
                )}
              </div>
            )}
            {paso === 0 && errorPaso1 && !cotizando && inicio && (
              <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {errorPaso1}</p>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <ResumenCotizacion
              cotizacion={reserva ? null : cotizacion}
              cargando={cotizando}
              error={reserva ? null : errorCot}
              titulo={reserva ? `Reserva #${reserva.id_reserva}` : "Resumen de tu reserva"}
            />
            {reserva && <p className="mt-2 rounded-xl bg-muted/50 p-3 text-sm">Total: <b>{pesos(reserva.precio_total)}</b></p>}
            {!reserva && totalViajeros > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">El precio lo calcula el sistema con las tarifas vigentes. Si cambia antes de confirmar, te avisamos.</p>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
