import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bed, CalendarDays, CheckCircle, Clock, FileText, Hotel, Loader2, Package, Plane,
  Plus, Search, Sparkles, User, UserPlus, Users,
} from "lucide-react";
import { apiFetch } from "../../api/v1/api";
import type { SeleccionProducto, ViajeroInput } from "../../data/reservaTypes";
import { useCotizacion } from "../../hooks/useCotizacion";
import { hotelService } from "../../services/hotel.service";
import { ETIQUETA_MODALIDAD_ALOJAMIENTO, ETIQUETA_MODALIDAD_VUELO, PaqueteDetalleResponse, paqueteService } from "../../services/paquete.service";
import { OfertaVueloAdmin, rutaOferta, vueloService } from "../../services/vuelo.service";
import ResumenCotizacion from "../reserva/ResumenCotizacion";
import { Cliente, HotelData, Paquete, inputCls, labelCls, resolveFotoUrl } from "./types";
import Avatar from "./ui/Avatar";
import SectionHeader from "./ui/SectionHeader";

interface Props {
  clientes: Cliente[];
  paquetes: Paquete[];
  hoteles: HotelData[];
  onSubmit: (data: any) => Promise<void>;
  loading: boolean;
}

type Tipo = "hotel" | "paquete" | "vuelo";
type ViajeroForm = ViajeroInput & { clave: string };

const HOY = new Date().toISOString().slice(0, 10);

function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const card = "rounded-2xl border border-border bg-card p-4 shadow-sm";
const titulo = "mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

function Numero({ label, valor, min, max, onChange }: { label: string; valor: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input type="number" min={min} max={max} value={valor} onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))} className={inputCls} />
    </label>
  );
}

/**
 * Crear reserva desde el panel: hotel, paquete o vuelo. El total lo calcula
 * el backend en vivo (POST /reservas/cotizar) — con descuento autorizado si
 * aplica — y al guardar se manda el precio esperado: si cambió, el backend
 * avisa en vez de guardar otro valor.
 */
export default function ModuleCrearReserva({ clientes, paquetes, hoteles, onSubmit, loading }: Props) {
  const [tipo, setTipo] = useState<Tipo>("paquete");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // Cliente
  const [clientesLocales, setClientesLocales] = useState<Cliente[]>([]);
  const todosClientes = useMemo(() => [...clientesLocales, ...clientes], [clientes, clientesLocales]);
  const [idCliente, setIdCliente] = useState<number | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [nuevoCliente, setNuevoCliente] = useState<null | { nombre: string; apellido: string; cedula: string; correo: string; celular: string }>(null);
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const cliente = todosClientes.find((c) => c.id_cliente === idCliente) ?? null;

  // Viajeros
  const [adultos, setAdultos] = useState(2);
  const [ninos, setNinos] = useState(0);
  const [infantes, setInfantes] = useState(0);
  const [viajeros, setViajeros] = useState<ViajeroForm[]>([]);

  // Hotel
  const [idHotel, setIdHotel] = useState<number | null>(null);
  const [entrada, setEntrada] = useState("");
  const [salidaHotel, setSalidaHotel] = useState("");
  const [habitaciones, setHabitaciones] = useState<number[]>([]);
  const [ocupadas, setOcupadas] = useState<Record<number, { fecha_checkin: string; fecha_checkout: string }[]>>({});

  // Paquete
  const [idPaquete, setIdPaquete] = useState<number | null>(null);
  const [pkg, setPkg] = useState<PaqueteDetalleResponse | null>(null);
  const [idSalida, setIdSalida] = useState<number | null>(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [conVuelo, setConVuelo] = useState(false);
  const [idOferta, setIdOferta] = useState<number | null>(null);
  const [opcionales, setOpcionales] = useState<number[]>([]);

  // Vuelo independiente
  const [ofertas, setOfertas] = useState<OfertaVueloAdmin[]>([]);

  // Económico y observaciones
  const [conDescuento, setConDescuento] = useState(false);
  const [descuento, setDescuento] = useState({ monto: "", motivo: "" });
  const [solicitudes, setSolicitudes] = useState("");
  const [notasInternas, setNotasInternas] = useState("");
  const [estadoInicial, setEstadoInicial] = useState<"pendiente" | "confirmada">("pendiente");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    vueloService.listarAdmin({ por_pagina: 100 }).then((r) => setOfertas(r.items.filter((o) => ["publicada", "pausada"].includes(o.estado)))).catch(() => {});
  }, []);

  useEffect(() => {
    setPkg(null);
    setIdSalida(null);
    setIdOferta(null);
    setConVuelo(false);
    setOpcionales([]);
    setHabitaciones([]);
    if (!idPaquete) return;
    paqueteService.getDetalle(idPaquete).then((d) => {
      setPkg(d);
      const abiertas = (d.salidas ?? []).filter((s) => s.estado === "abierta" && s.fecha_salida >= HOY);
      if (abiertas.length) setIdSalida(abiertas[0].id_salida ?? null);
      if (d.vuelos?.length === 1) setIdOferta(d.vuelos[0].id_oferta);
    }).catch(() => setMsg({ ok: false, texto: "No se pudo cargar el paquete" }));
  }, [idPaquete]);

  // Disponibilidad real de las habitaciones del hotel elegido (o de los hoteles del paquete).
  const hotelesRelevantes = useMemo(() => {
    if (tipo === "hotel") return hoteles.filter((h) => h.id_hotel === idHotel);
    if (tipo === "paquete" && pkg && pkg.modalidad_alojamiento !== "sin") {
      const ids = new Set(pkg.hoteles.map((h) => h.id_hotel));
      return hoteles.filter((h) => ids.has(h.id_hotel));
    }
    return [];
  }, [tipo, idHotel, pkg, hoteles]);
  useEffect(() => {
    if (!hotelesRelevantes.length) { setOcupadas({}); return; }
    Promise.all(hotelesRelevantes.map((h) => hotelService.getFechasOcupadas(h.id_hotel).catch(() => [])))
      .then((listas) => {
        const mapa: Record<number, { fecha_checkin: string; fecha_checkout: string }[]> = {};
        for (const lista of listas) for (const item of lista) mapa[item.id_habitacion] = item.rangos;
        setOcupadas(mapa);
      });
  }, [hotelesRelevantes]);

  // Fechas del paquete
  const nochesPkg = pkg ? (pkg.noches ?? (pkg.duracion_dias ? pkg.duracion_dias - 1 : 0)) : 0;
  const usaSalidas = (pkg?.salidas ?? []).length > 0;
  const salidaElegida = pkg?.salidas?.find((s) => s.id_salida === idSalida);
  const inicioPkg = usaSalidas ? salidaElegida?.fecha_salida ?? "" : fechaInicio;
  const finPkg = usaSalidas ? salidaElegida?.fecha_regreso || (inicioPkg ? sumarDias(inicioPkg, nochesPkg) : "") : inicioPkg ? sumarDias(inicioPkg, nochesPkg) : "";
  const inicioEstadia = tipo === "hotel" ? entrada : inicioPkg;
  const finEstadia = tipo === "hotel" ? salidaHotel : finPkg;
  const ocupada = (idHab: number) =>
    !!inicioEstadia && !!finEstadia && (ocupadas[idHab] ?? []).some((r) => r.fecha_checkin < finEstadia && r.fecha_checkout > inicioEstadia);

  const modVuelo = pkg?.modalidad_vuelo ?? "sin";
  const ofertaIndependiente = ofertas.find((o) => o.id_oferta === idOferta);
  const llevaVuelo = tipo === "vuelo" || (tipo === "paquete" && ((modVuelo === "incluido" && !!idOferta) || (modVuelo === "opcional" && conVuelo)));

  // Lista de viajeros al ritmo de los contadores (titular = datos del cliente).
  useEffect(() => {
    setViajeros((prev) => {
      const porTipo = (t: ViajeroForm["tipo"], n: number) => {
        const actuales = prev.filter((v) => v.tipo === t);
        const extra = Array.from({ length: Math.max(n - actuales.length, 0) }, (_, i) => ({ clave: `${t}-${Date.now()}-${i}`, tipo: t, nombres: "", apellidos: "", tipo_documento: t === "adulto" ? "CC" : "TI", numero_documento: "", fecha_nacimiento: "" }) as ViajeroForm);
        return [...actuales, ...extra].slice(0, n);
      };
      return [...porTipo("adulto", adultos), ...porTipo("nino", ninos), ...porTipo("infante", infantes)];
    });
  }, [adultos, ninos, infantes]);
  useEffect(() => {
    if (!cliente) return;
    setViajeros((vs) => vs.map((v, i) => (i === 0 ? { ...v, es_titular: true, nombres: cliente.nombre, apellidos: cliente.apellido, numero_documento: cliente.cedula, tipo_documento: "CC", fecha_nacimiento: cliente.fecha_nacimiento ?? "" } : v)));
  }, [cliente]);

  const descuentoValido = conDescuento && Number(descuento.monto) > 0 && descuento.motivo.trim().length >= 3;

  const seleccion: SeleccionProducto | null = useMemo(() => {
    const base = { adultos, ninos, infantes, descuento: descuentoValido ? { monto: Number(descuento.monto), motivo: descuento.motivo.trim() } : null };
    if (tipo === "hotel") {
      if (!entrada || !salidaHotel || salidaHotel <= entrada || !habitaciones.length) return null;
      return { ...base, tipo_producto: "hotel", habitaciones: habitaciones.map((h) => ({ id_habitacion: h, fecha_checkin: entrada, fecha_checkout: salidaHotel })) };
    }
    if (tipo === "vuelo") {
      if (!idOferta) return null;
      return { ...base, tipo_producto: "vuelo", id_oferta_vuelo: idOferta };
    }
    if (!pkg || !inicioPkg) return null;
    return {
      ...base,
      tipo_producto: "paquete",
      id_paquete: pkg.id_paquete,
      id_salida: usaSalidas ? idSalida : null,
      fecha_inicio: usaSalidas ? null : inicioPkg,
      habitaciones: habitaciones.map((h) => ({ id_habitacion: h, fecha_checkin: inicioPkg, fecha_checkout: finPkg })),
      incluir_vuelo: (modVuelo === "opcional" || modVuelo === "cotizacion") && conVuelo,
      id_oferta_vuelo: modVuelo === "incluido" || (modVuelo === "opcional" && conVuelo) ? idOferta : null,
      servicios_opcionales: opcionales,
    };
  }, [tipo, adultos, ninos, infantes, descuentoValido, descuento, entrada, salidaHotel, habitaciones, idOferta, pkg, inicioPkg, finPkg, usaSalidas, idSalida, modVuelo, conVuelo, opcionales]);

  const { cotizacion, cargando: cotizando, error: errorCot } = useCotizacion(seleccion);

  function cambiarTipo(t: Tipo) {
    setTipo(t);
    setMsg(null);
    setHabitaciones([]);
    setIdOferta(null);
    setIdPaquete(null);
    setIdHotel(null);
    setConVuelo(false);
  }

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return todosClientes.slice(0, 8);
    return todosClientes.filter((c) => `${c.nombre} ${c.apellido} ${c.cedula} ${c.correo ?? ""} ${c.celular ?? ""}`.toLowerCase().includes(q)).slice(0, 8);
  }, [busquedaCliente, todosClientes]);

  async function crearCliente() {
    if (!nuevoCliente) return;
    setGuardandoCliente(true);
    try {
      const c = await apiFetch<Cliente>("/clientes", { method: "POST", body: { ...nuevoCliente, correo: nuevoCliente.correo || null } });
      setClientesLocales((l) => [c, ...l]);
      setIdCliente(c.id_cliente);
      setNuevoCliente(null);
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.message || "No se pudo registrar el cliente" });
    } finally {
      setGuardandoCliente(false);
    }
  }

  const faltaViajero = (v: ViajeroForm) => !v.nombres.trim() || !v.apellidos.trim() || (llevaVuelo && (!v.fecha_nacimiento || !String(v.numero_documento ?? "").trim()));
  const problema = !cliente
    ? "Elige o registra el cliente"
    : !seleccion
      ? "Completa el producto y las fechas"
      : errorCot
        ? errorCot
        : llevaVuelo && viajeros.some(faltaViajero)
          ? "Con vuelo, cada pasajero necesita nombre, fecha de nacimiento y documento"
          : conDescuento && !descuentoValido
            ? "El descuento necesita monto y motivo"
            : null;

  async function guardar() {
    if (problema || !seleccion || !cotizacion || !cliente) {
      setMsg({ ok: false, texto: problema ?? "Falta información" });
      return;
    }
    setEnviando(true);
    setMsg(null);
    try {
      await onSubmit({
        id_cliente: cliente.id_cliente,
        ...seleccion,
        id_paquete: seleccion.id_paquete ?? undefined,
        viajeros: viajeros
          .filter((v) => v.nombres.trim() && v.apellidos.trim())
          .map(({ clave: _c, ...v }) => ({ ...v, fecha_nacimiento: v.fecha_nacimiento || null, numero_documento: String(v.numero_documento ?? "").trim() || null })),
        solicitudes_especiales: solicitudes.trim() || null,
        notas_internas: notasInternas.trim() || null,
        estado_inicial: estadoInicial,
        precio_esperado: cotizacion.total,
      });
      setMsg({ ok: true, texto: "Reserva creada" });
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.message || "No se pudo crear la reserva" });
    } finally {
      setEnviando(false);
    }
  }

  const ofertasIndep = ofertas.filter((o) => o.fecha_salida >= HOY);

  return (
    <div className="space-y-5">
      <SectionHeader title="Crear reserva" subtitle="Hotel, paquete o vuelo: el precio lo calcula el sistema y queda congelado en la reserva." />
      {msg && <div role="alert" className={`rounded-xl p-3 text-sm font-medium ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{msg.texto}</div>}

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de reserva">
        {([["hotel", "Hotel", Hotel], ["paquete", "Paquete turístico", Package], ["vuelo", "Vuelo", Plane]] as const).map(([t, l, Icono]) => (
          <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => cambiarTipo(t)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${tipo === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>
            <Icono className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Cliente */}
          <section className={card}>
            <h3 className={titulo}><User className="h-3.5 w-3.5" /> Cliente</h3>
            {cliente ? (
              <div className="flex items-center gap-3">
                <Avatar nombre={cliente.nombre} apellido={cliente.apellido} fotoUrl={resolveFotoUrl(cliente.foto_perfil)} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{cliente.nombre} {cliente.apellido}</p>
                  <p className="text-xs text-muted-foreground">CC {cliente.cedula} · {cliente.celular || "sin celular"} · {cliente.correo || "sin correo"}</p>
                </div>
                <button type="button" onClick={() => setIdCliente(null)} className="text-xs font-semibold text-primary hover:underline">Cambiar</button>
              </div>
            ) : nuevoCliente ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {(["nombre", "apellido", "cedula", "celular", "correo"] as const).map((k) => (
                  <input key={k} value={nuevoCliente[k]} onChange={(e) => setNuevoCliente({ ...nuevoCliente, [k]: e.target.value })} placeholder={`${k[0].toUpperCase()}${k.slice(1)}${k === "correo" ? "" : " *"}`} aria-label={k} className={inputCls} />
                ))}
                <div className="flex gap-2 sm:col-span-2">
                  <button type="button" onClick={crearCliente} disabled={guardandoCliente || !nuevoCliente.nombre || !nuevoCliente.apellido || !nuevoCliente.cedula || !nuevoCliente.celular} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {guardandoCliente && <Loader2 className="h-4 w-4 animate-spin" />} Registrar cliente
                  </button>
                  <button type="button" onClick={() => setNuevoCliente(null)} className="rounded-xl border border-border px-4 py-2 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={busquedaCliente} onChange={(e) => setBusquedaCliente(e.target.value)} placeholder="Buscar por nombre, cédula, correo o celular" aria-label="Buscar cliente" className={inputCls + " pl-9"} />
                </div>
                <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {clientesFiltrados.map((c) => (
                    <li key={c.id_cliente}>
                      <button type="button" onClick={() => setIdCliente(c.id_cliente)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted">
                        <Avatar nombre={c.nombre} apellido={c.apellido} fotoUrl={resolveFotoUrl(c.foto_perfil)} size="sm" />
                        <span className="text-sm">{c.nombre} {c.apellido} <span className="text-xs text-muted-foreground">· CC {c.cedula}</span></span>
                      </button>
                    </li>
                  ))}
                  {clientesFiltrados.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Sin resultados.</li>}
                </ul>
                <button type="button" onClick={() => setNuevoCliente({ nombre: "", apellido: "", cedula: "", correo: "", celular: "" })} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  <UserPlus className="h-4 w-4" /> Registrar cliente nuevo
                </button>
              </>
            )}
          </section>

          {/* Producto */}
          <section className={card}>
            <h3 className={titulo}>{tipo === "hotel" ? <Hotel className="h-3.5 w-3.5" /> : tipo === "paquete" ? <Package className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />} Producto y fechas</h3>

            {tipo === "hotel" && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="sm:col-span-3"><span className={labelCls}>Hotel</span>
                    <select value={idHotel ?? ""} onChange={(e) => { setIdHotel(Number(e.target.value) || null); setHabitaciones([]); }} className={inputCls}>
                      <option value="">Elige un hotel…</option>
                      {hoteles.map((h) => <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel} · {h.ciudad}</option>)}
                    </select>
                  </label>
                  <label><span className={labelCls}>Entrada</span><input type="date" value={entrada} onChange={(e) => setEntrada(e.target.value)} className={inputCls} /></label>
                  <label><span className={labelCls}>Salida</span><input type="date" min={entrada || undefined} value={salidaHotel} onChange={(e) => setSalidaHotel(e.target.value)} className={inputCls} /></label>
                </div>
                <ListaHabitaciones hoteles={hotelesRelevantes} elegidas={habitaciones} ocupada={ocupada} onToggle={(id) => setHabitaciones((hs) => hs.includes(id) ? hs.filter((x) => x !== id) : [...hs, id])} />
              </div>
            )}

            {tipo === "paquete" && (
              <div className="space-y-3">
                <label className="block"><span className={labelCls}>Paquete</span>
                  <select value={idPaquete ?? ""} onChange={(e) => setIdPaquete(Number(e.target.value) || null)} className={inputCls}>
                    <option value="">Elige un paquete…</option>
                    {paquetes.map((p) => <option key={p.id_paquete} value={p.id_paquete}>{p.nombre_paquete}{p.activo ? "" : " (inactivo)"} — ${Number(p.precio_base).toLocaleString("es-CO")}</option>)}
                  </select>
                </label>
                {idPaquete && !pkg && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {pkg && (
                  <>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full bg-muted px-2 py-0.5">{pkg.duracion_dias ?? "?"} días / {nochesPkg} noches</span>
                      <span className="rounded-full bg-muted px-2 py-0.5">{ETIQUETA_MODALIDAD_ALOJAMIENTO[pkg.modalidad_alojamiento ?? "sin"]}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5">{ETIQUETA_MODALIDAD_VUELO[pkg.modalidad_vuelo ?? "sin"]}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5">{pkg.unidad_precio === "por_paquete" ? "Precio por paquete" : "Precio por persona"}</span>
                    </div>
                    {usaSalidas ? (
                      <label className="block"><span className={labelCls}>Salida</span>
                        <select value={idSalida ?? ""} onChange={(e) => setIdSalida(Number(e.target.value) || null)} className={inputCls}>
                          <option value="">Elige la salida…</option>
                          {(pkg.salidas ?? []).filter((s) => s.estado === "abierta").map((s) => (
                            <option key={s.id_salida} value={s.id_salida}>{s.fecha_salida} → {s.fecha_regreso || sumarDias(s.fecha_salida, nochesPkg)} · {s.cupos_disponibles == null ? "sin límite" : `${s.cupos_disponibles} cupos`}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label><span className={labelCls}>Fecha de inicio</span><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputCls} /></label>
                        {finPkg && <p className="self-end pb-2 text-sm text-muted-foreground">Regreso: <b className="text-foreground">{finPkg}</b></p>}
                      </div>
                    )}
                    {pkg.modalidad_alojamiento !== "sin" && hotelesRelevantes.length > 0 && (
                      <div>
                        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Bed className="h-4 w-4 text-primary" /> {pkg.modalidad_alojamiento === "incluido" ? "Asignar habitación (incluida, $0) — opcional" : "Habitaciones opcionales (se cobran)"}</p>
                        <ListaHabitaciones hoteles={hotelesRelevantes} elegidas={habitaciones} ocupada={ocupada} incluidas={pkg.modalidad_alojamiento === "incluido"} onToggle={(id) => setHabitaciones((hs) => hs.includes(id) ? hs.filter((x) => x !== id) : [...hs, id])} />
                      </div>
                    )}
                    {modVuelo !== "sin" && (
                      <div className="space-y-2 rounded-xl border border-border p-3">
                        <p className="flex items-center gap-1.5 text-sm font-semibold"><Plane className="h-4 w-4 text-primary" /> {ETIQUETA_MODALIDAD_VUELO[modVuelo]}</p>
                        {(modVuelo === "opcional" || modVuelo === "cotizacion") && (
                          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={conVuelo} onChange={(e) => setConVuelo(e.target.checked)} /> {modVuelo === "opcional" ? "Agregar vuelo" : "El cliente pide cotización del vuelo"}</label>
                        )}
                        {(modVuelo === "incluido" || (modVuelo === "opcional" && conVuelo)) && (pkg.vuelos ?? []).map((o) => (
                          <label key={o.id_oferta} className="flex items-center gap-2 text-xs">
                            <input type="radio" name="vuelo-pkg" checked={idOferta === o.id_oferta} onChange={() => setIdOferta(o.id_oferta)} />
                            {rutaOferta(o)} · {o.fecha_salida} · ${Number(o.precio_adulto).toLocaleString("es-CO")} · {o.cupos_disponibles == null ? "sin límite" : `${o.cupos_disponibles} sillas`}
                          </label>
                        ))}
                      </div>
                    )}
                    {pkg.servicios.some((s) => !s.incluido) && (
                      <div className="space-y-1 rounded-xl border border-border p-3">
                        <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Actividades opcionales</p>
                        {pkg.servicios.filter((s) => !s.incluido).map((s) => (
                          <label key={s.id_servicio} className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={opcionales.includes(s.id_servicio)} onChange={() => setOpcionales((o) => o.includes(s.id_servicio) ? o.filter((x) => x !== s.id_servicio) : [...o, s.id_servicio])} />
                            {s.nombre_servicio}{s.precio_por_persona != null && ` · +$${s.precio_por_persona.toLocaleString("es-CO")} p/p`}
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tipo === "vuelo" && (
              <div className="space-y-2">
                {ofertasIndep.length === 0 && <p className="text-sm text-muted-foreground">No hay ofertas aéreas publicadas o pausadas con salida futura. Créalas en el módulo Vuelos.</p>}
                {ofertasIndep.map((o) => (
                  <label key={o.id_oferta} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${idOferta === o.id_oferta ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="vuelo" checked={idOferta === o.id_oferta} onChange={() => setIdOferta(o.id_oferta)} className="mt-1" />
                    <span className="flex-1 text-sm">
                      <b>{o.titulo}</b> <span className="text-xs text-muted-foreground">{o.venta_independiente ? "" : "(solo paquete — venta manual de la agencia)"}</span>
                      <span className="block text-xs text-muted-foreground">{rutaOferta(o)} · {o.fecha_salida}{o.fecha_regreso ? ` → ${o.fecha_regreso}` : ""} · {o.aerolinea || "aerolínea por confirmar"} · {o.cupos_disponibles == null ? "sin límite" : `${o.cupos_disponibles} sillas`}</span>
                    </span>
                    <span className="text-sm font-semibold">${Number(o.precio_adulto).toLocaleString("es-CO")}</span>
                  </label>
                ))}
                {ofertaIndependiente && <p className="text-xs text-muted-foreground">Estado de la oferta: {ofertaIndependiente.estado}</p>}
              </div>
            )}
          </section>

          {/* Viajeros */}
          <section className={card}>
            <h3 className={titulo}><Users className="h-3.5 w-3.5" /> Viajeros</h3>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Numero label="Adultos" valor={adultos} min={1} max={50} onChange={setAdultos} />
              <Numero label="Niños" valor={ninos} min={0} max={50} onChange={setNinos} />
              <Numero label="Infantes" valor={infantes} min={0} max={adultos} onChange={setInfantes} />
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{llevaVuelo ? "Con vuelo: completa todos los pasajeros con fecha de nacimiento y documento." : "El titular se toma del cliente; los demás son opcionales."}</p>
            <div className="space-y-2">
              {viajeros.map((v, i) => (
                <div key={v.clave} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-2 sm:grid-cols-[90px_1fr_1fr_130px_70px_1fr]">
                  <span className="self-center text-xs font-semibold text-muted-foreground">{v.es_titular ? "Titular" : v.tipo === "adulto" ? "Adulto" : v.tipo === "nino" ? "Niño" : "Infante"}</span>
                  <input value={v.nombres} onChange={(e) => setViajeros((vs) => vs.map((x, j) => j === i ? { ...x, nombres: e.target.value } : x))} placeholder="Nombres" aria-label="Nombres" className={inputCls} />
                  <input value={v.apellidos} onChange={(e) => setViajeros((vs) => vs.map((x, j) => j === i ? { ...x, apellidos: e.target.value } : x))} placeholder="Apellidos" aria-label="Apellidos" className={inputCls} />
                  <input type="date" value={v.fecha_nacimiento ?? ""} onChange={(e) => setViajeros((vs) => vs.map((x, j) => j === i ? { ...x, fecha_nacimiento: e.target.value } : x))} aria-label="Fecha de nacimiento" className={inputCls} />
                  <select value={v.tipo_documento ?? "CC"} onChange={(e) => setViajeros((vs) => vs.map((x, j) => j === i ? { ...x, tipo_documento: e.target.value } : x))} aria-label="Tipo de documento" className={inputCls}>
                    {["CC", "TI", "RC", "CE", "PA"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input value={v.numero_documento ?? ""} onChange={(e) => setViajeros((vs) => vs.map((x, j) => j === i ? { ...x, numero_documento: e.target.value.replace(/[^A-Za-z0-9.\- ]/g, "") } : x))} placeholder="Documento" aria-label="Documento" className={inputCls} />
                </div>
              ))}
            </div>
          </section>

          {/* Observaciones */}
          <section className={card}>
            <h3 className={titulo}><FileText className="h-3.5 w-3.5" /> Observaciones</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className={labelCls}>Solicitudes especiales (las ve el cliente)</span><textarea value={solicitudes} onChange={(e) => setSolicitudes(e.target.value)} rows={3} maxLength={2000} className={inputCls} /></label>
              <label><span className={labelCls}>Notas internas (solo el equipo)</span><textarea value={notasInternas} onChange={(e) => setNotasInternas(e.target.value)} rows={3} maxLength={4000} className={inputCls} /></label>
            </div>
          </section>
        </div>

        {/* Resumen */}
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <ResumenCotizacion cotizacion={cotizacion} cargando={cotizando} error={errorCot} titulo="Total calculado por el sistema" compacto />
          <section className={card}>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={conDescuento} onChange={(e) => setConDescuento(e.target.checked)} /> Aplicar descuento autorizado</label>
            {conDescuento && (
              <div className="mt-2 grid gap-2">
                <input type="number" min={0} step={1000} value={descuento.monto} onChange={(e) => setDescuento({ ...descuento, monto: e.target.value })} placeholder="Monto (COP)" aria-label="Monto del descuento" className={inputCls} />
                <input value={descuento.motivo} onChange={(e) => setDescuento({ ...descuento, motivo: e.target.value })} maxLength={200} placeholder="Motivo (queda en el historial)" aria-label="Motivo del descuento" className={inputCls} />
              </div>
            )}
          </section>
          <section className={card}>
            <p className={titulo}><CalendarDays className="h-3.5 w-3.5" /> Estado inicial</p>
            <div className="grid grid-cols-2 gap-2">
              {([["pendiente", "Pendiente", Clock], ["confirmada", "Confirmada", CheckCircle]] as const).map(([v, l, Icono]) => (
                <button key={v} type="button" onClick={() => setEstadoInicial(v)} aria-pressed={estadoInicial === v}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold ${estadoInicial === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                  <Icono className="h-4 w-4" /> {l}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">El pago se registra después, en Pagos o en el detalle de la reserva.</p>
          </section>
          {problema && !cotizando && <p className="flex items-start gap-2 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {problema}</p>}
          <button type="button" onClick={guardar} disabled={!!problema || enviando || loading || cotizando || !cotizacion}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {(enviando || loading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear reserva
          </button>
        </aside>
      </div>
    </div>
  );
}

function ListaHabitaciones({ hoteles, elegidas, ocupada, onToggle, incluidas }: {
  hoteles: HotelData[];
  elegidas: number[];
  ocupada: (id: number) => boolean;
  onToggle: (id: number) => void;
  incluidas?: boolean;
}) {
  const habs = hoteles.flatMap((h) => (h.habitaciones ?? []).map((hab) => ({ h, hab })));
  if (!habs.length) return <p className="text-sm text-muted-foreground">Este hotel no tiene habitaciones registradas.</p>;
  return (
    <ul className="space-y-1.5">
      {habs.map(({ h, hab }) => {
        const noDisp = hab.estado !== "disponible" || ocupada(hab.id_habitacion);
        const sel = elegidas.includes(hab.id_habitacion);
        return (
          <li key={hab.id_habitacion}>
            <label className={`flex items-center gap-3 rounded-xl border p-2.5 text-sm ${sel ? "border-primary bg-primary/5" : "border-border"} ${noDisp && !sel ? "opacity-50" : "cursor-pointer"}`}>
              <input type="checkbox" checked={sel} disabled={noDisp && !sel} onChange={() => onToggle(hab.id_habitacion)} />
              <span className="flex-1">
                {hab.tipo_habitacion?.nombre_tipo ?? "Habitación"} #{hab.numero_habitacion} · {h.nombre_hotel}
                <span className="block text-xs text-muted-foreground">Hasta {hab.tipo_habitacion?.capacidad_personas ?? "?"} personas{noDisp ? ` · ${hab.estado !== "disponible" ? hab.estado : "ocupada en esas fechas"}` : ""}</span>
              </span>
              <span className="text-xs font-semibold">{incluidas ? "Incluida" : `$${Number(hab.precio_noche).toLocaleString("es-CO")}/noche`}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
