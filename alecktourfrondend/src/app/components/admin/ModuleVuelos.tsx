import {
  ImagePlus,
  Info,
  Loader2,
  Pause,
  Pencil,
  Plane,
  PlusCircle,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ETIQUETA_CLASE,
  ETIQUETA_ESTADO_OFERTA,
  ETIQUETA_TRAYECTO,
  EstadoOferta,
  FiltrosOfertas,
  OfertaVueloAdmin,
  OfertaVueloInput,
  PasajeroOferta,
  ReservaDeOferta,
  hora,
  rutaOferta,
  vueloService,
} from "../../services/vuelo.service";
import Pagination from "../ui/pagination";
import AdminModal from "./ui/AdminModal";
import ConfirmDialog from "./ui/ConfirmDialog";
import EmptyState from "./ui/EmptyState";
import PasosFormulario from "./ui/PasosFormulario";
import SectionHeader from "./ui/SectionHeader";
import { inputCls, labelCls, resolveFotoUrl } from "./types";

const POR_PAGINA = 12;

const COLOR_ESTADO: Record<EstadoOferta, string> = {
  borrador: "bg-muted text-muted-foreground",
  publicada: "bg-success/10 text-success",
  pausada: "bg-warning/10 text-warning",
  agotada: "bg-destructive/10 text-destructive",
  finalizada: "bg-muted text-muted-foreground line-through",
};

type Form = Record<string, string | boolean>;

const VACIO: Form = {
  titulo: "", descripcion: "", estado: "borrador", aerolinea: "", numero_vuelo: "", codigo_referencia: "",
  venta_independiente: false,
  origen_pais: "Colombia", origen_ciudad: "", origen_aeropuerto: "", origen_iata: "", origen_zona_horaria: "America/Bogota",
  destino_pais: "", destino_ciudad: "", destino_aeropuerto: "", destino_iata: "", destino_zona_horaria: "",
  tipo_trayecto: "ida_regreso",
  fecha_salida: "", hora_salida: "", fecha_llegada: "", hora_llegada: "",
  fecha_regreso: "", hora_regreso: "", fecha_llegada_regreso: "", hora_llegada_regreso: "",
  duracion_estimada: "", clase: "", escalas: "", aeropuertos_conexion: "", horarios_conexion: "",
  equipaje_mano: "", equipaje_bodega: "",
  condiciones_cambio: "", condiciones_cancelacion: "", restricciones: "", informacion_adicional: "",
  precio_adulto: "", precio_nino: "", precio_infante: "", impuestos_incluidos: "", cargos_adicionales: "0",
  descripcion_cargos: "", cupos: "", vigencia_hasta: "", condiciones_comerciales: "",
};

const NUMEROS = new Set(["escalas", "precio_adulto", "precio_nino", "precio_infante", "cargos_adicionales", "cupos"]);

function desdeOferta(o: OfertaVueloAdmin): Form {
  const f: Form = { ...VACIO };
  for (const k of Object.keys(VACIO)) {
    const v = (o as unknown as Record<string, unknown>)[k];
    if (k === "venta_independiente") f[k] = !!v;
    else if (k === "impuestos_incluidos") f[k] = v === true ? "si" : v === false ? "no" : "";
    else if (k.startsWith("hora_")) f[k] = hora(v as string | null) ?? "";
    else f[k] = v === null || v === undefined ? "" : String(v);
  }
  return f;
}

function aPayload(f: Form): OfertaVueloInput {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === "venta_independiente") out[k] = v;
    else if (k === "impuestos_incluidos") out[k] = v === "si" ? true : v === "no" ? false : null;
    else if (typeof v === "string") {
      const t = v.trim();
      out[k] = t === "" ? null : NUMEROS.has(k) ? Number(t) : t;
    }
  }
  if (out.cargos_adicionales === null) out.cargos_adicionales = 0;
  return out as OfertaVueloInput;
}

function pesos(n?: number | null) {
  return n === null || n === undefined ? "—" : `$${Number(n).toLocaleString("es-CO")}`;
}

function fechaCorta(iso?: string | null) {
  if (!iso) return null;
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------

export default function ModuleVuelos() {
  const [filtros, setFiltros] = useState<FiltrosOfertas>({ pagina: 1, por_pagina: POR_PAGINA });
  const [busqueda, setBusqueda] = useState("");
  const [datos, setDatos] = useState<{ items: OfertaVueloAdmin[]; total: number }>({ items: [], total: 0 });
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<OfertaVueloAdmin | null | "nueva">(null);
  const [borrar, setBorrar] = useState<OfertaVueloAdmin | null>(null);
  const [verPasajeros, setVerPasajeros] = useState<OfertaVueloAdmin | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await vueloService.listarAdmin(filtros);
      setDatos({ items: r.items, total: r.total });
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar las ofertas aéreas");
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Búsqueda con pausa para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.q === busqueda ? f : { ...f, q: busqueda || undefined, pagina: 1 })), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const setFiltro = (k: keyof FiltrosOfertas, v: string) => setFiltros((f) => ({ ...f, [k]: v || undefined, pagina: 1 }));

  async function cambiarEstado(o: OfertaVueloAdmin, estado: EstadoOferta) {
    try {
      await vueloService.cambiarEstado(o.id_oferta, estado);
      toast.success(`Oferta ${ETIQUETA_ESTADO_OFERTA[estado].toLowerCase()}`);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cambiar el estado");
    }
  }

  const paginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Vuelos"
        subtitle="Ofertas aéreas que vende la agencia, solas o dentro de paquetes"
        action={
          <button
            type="button"
            onClick={() => setEditando("nueva")}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PlusCircle className="h-4 w-4" /> Nueva oferta aérea
          </button>
        }
      />

      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Son ofertas gestionadas por la agencia con lo que confirma cada aerolínea o proveedor. No hay conexión con
        sistemas de aerolíneas: no es disponibilidad en tiempo real. Lo que dejes vacío no se le muestra al cliente.
      </p>

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={inputCls + " pl-9"}
            placeholder="Título, código o número de vuelo"
            aria-label="Buscar ofertas"
          />
        </div>
        <select value={filtros.estado ?? ""} onChange={(e) => setFiltro("estado", e.target.value)} className={inputCls} aria-label="Estado">
          <option value="">Todos los estados</option>
          {(Object.keys(ETIQUETA_ESTADO_OFERTA) as EstadoOferta[]).map((e) => (
            <option key={e} value={e}>{ETIQUETA_ESTADO_OFERTA[e]}</option>
          ))}
        </select>
        <input value={filtros.origen ?? ""} onChange={(e) => setFiltro("origen", e.target.value)} className={inputCls} placeholder="Origen" aria-label="Origen" />
        <input value={filtros.destino ?? ""} onChange={(e) => setFiltro("destino", e.target.value)} className={inputCls} placeholder="Destino" aria-label="Destino" />
        <input value={filtros.aerolinea ?? ""} onChange={(e) => setFiltro("aerolinea", e.target.value)} className={inputCls} placeholder="Aerolínea" aria-label="Aerolínea" />
        <label className="col-span-1 text-xs text-muted-foreground">
          Salida desde
          <input type="date" value={filtros.fecha_desde ?? ""} onChange={(e) => setFiltro("fecha_desde", e.target.value)} className={inputCls} />
        </label>
        <label className="col-span-1 text-xs text-muted-foreground">
          Salida hasta
          <input type="date" value={filtros.fecha_hasta ?? ""} onChange={(e) => setFiltro("fecha_hasta", e.target.value)} className={inputCls} />
        </label>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : datos.items.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="No hay ofertas aéreas"
          description="Crea la primera oferta con los datos que te confirmó la aerolínea o el proveedor."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {datos.items.map((o) => (
            <article key={o.id_oferta} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${COLOR_ESTADO[o.estado]}`}>
                      {ETIQUETA_ESTADO_OFERTA[o.estado]}
                    </span>
                    {o.venta_independiente && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Se vende sola</span>
                    )}
                    {o.codigo_referencia && <span className="text-[11px] text-muted-foreground">#{o.codigo_referencia}</span>}
                  </div>
                  <h3 className="mt-1 truncate font-bold text-foreground">{o.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{rutaOferta(o)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{pesos(o.precio_adulto)}</p>
                  <p className="text-[11px] text-muted-foreground">por adulto</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Salida</dt><dd className="font-medium">{fechaCorta(o.fecha_salida)}{hora(o.hora_salida) ? ` · ${hora(o.hora_salida)}` : ""}</dd></div>
                {o.fecha_regreso && <div><dt className="text-muted-foreground">Regreso</dt><dd className="font-medium">{fechaCorta(o.fecha_regreso)}{hora(o.hora_regreso) ? ` · ${hora(o.hora_regreso)}` : ""}</dd></div>}
                <div><dt className="text-muted-foreground">Aerolínea</dt><dd className="font-medium">{o.aerolinea || "Por confirmar"}{o.numero_vuelo ? ` ${o.numero_vuelo}` : ""}</dd></div>
                {o.clase && <div><dt className="text-muted-foreground">Clase</dt><dd className="font-medium">{ETIQUETA_CLASE[o.clase]}</dd></div>}
                <div>
                  <dt className="text-muted-foreground">Cupos</dt>
                  <dd className="font-medium">{o.cupos == null ? "No se controlan" : `${o.cupos_usados} vendidos de ${o.cupos}`}</dd>
                </div>
                <div><dt className="text-muted-foreground">Reservas activas</dt><dd className="font-medium">{o.reservas_activas}</dd></div>
              </dl>
              {o.paquetes.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  En paquetes: {o.paquetes.map((p) => p.nombre_paquete).join(", ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                <BotonAccion icono={Pencil} onClick={() => setEditando(o)}>Editar</BotonAccion>
                {o.estado !== "publicada" && o.estado !== "finalizada" && (
                  <BotonAccion icono={Send} onClick={() => cambiarEstado(o, "publicada")}>Publicar</BotonAccion>
                )}
                {o.estado === "publicada" && <BotonAccion icono={Pause} onClick={() => cambiarEstado(o, "pausada")}>Pausar</BotonAccion>}
                <BotonAccion icono={Users} onClick={() => setVerPasajeros(o)}>Reservas y pasajeros</BotonAccion>
                {o.estado !== "finalizada" && (
                  <BotonAccion onClick={() => cambiarEstado(o, "finalizada")}>Finalizar</BotonAccion>
                )}
                <BotonAccion icono={Trash2} peligro onClick={() => setBorrar(o)}>Eliminar</BotonAccion>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination page={(filtros.pagina ?? 1) - 1} pageCount={paginas} onPageChange={(p) => setFiltros((f) => ({ ...f, pagina: p + 1 }))} />

      {editando && (
        <FormOferta
          oferta={editando === "nueva" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
      {verPasajeros && <PasajerosOferta oferta={verPasajeros} onCerrar={() => setVerPasajeros(null)} />}
      <ConfirmDialog
        open={!!borrar}
        onOpenChange={(o) => !o && setBorrar(null)}
        title="¿Eliminar esta oferta aérea?"
        description="Solo se puede eliminar si no tiene reservas ni está en un paquete. Si ya se vendió, márcala como finalizada."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (!borrar) return;
          try {
            await vueloService.eliminar(borrar.id_oferta);
            toast.success("Oferta eliminada");
            setBorrar(null);
            cargar();
          } catch (e: any) {
            toast.error(e?.message || "No se pudo eliminar");
          }
        }}
      />
    </div>
  );
}

function BotonAccion({
  icono: Icono,
  children,
  onClick,
  peligro,
}: {
  icono?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
  peligro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
        peligro ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-border text-foreground hover:bg-muted"
      }`}
    >
      {Icono && <Icono className="h-3.5 w-3.5" />} {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Formulario por pasos
// ---------------------------------------------------------------------------

function Campo({ label, obligatorio, children, ayuda, className = "" }: { label: string; obligatorio?: boolean; children: React.ReactNode; ayuda?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>
        {label} {obligatorio && <span className="text-destructive" aria-hidden>*</span>}
      </span>
      {children}
      {ayuda && <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{ayuda}</span>}
    </label>
  );
}

function FormOferta({ oferta, onCerrar, onGuardada }: { oferta: OfertaVueloAdmin | null; onCerrar: () => void; onGuardada: () => void }) {
  const inicial = useMemo(() => (oferta ? desdeOferta(oferta) : VACIO), [oferta]);
  const [f, setF] = useState<Form>(inicial);
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [imagen, setImagen] = useState<File | null>(null);
  const sucio = JSON.stringify(f) !== JSON.stringify(inicial) || !!imagen;

  const s = (k: string) => (v: string | boolean) => setF((prev) => ({ ...prev, [k]: v }));
  const txt = (k: string) => ({ value: String(f[k] ?? ""), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => s(k)(e.target.value) });

  const pendientes = {
    general: !String(f.titulo).trim() ? "Falta el título" : null,
    ruta: !String(f.origen_ciudad).trim() || !String(f.destino_ciudad).trim()
      ? "Faltan las ciudades de origen y destino"
      : [f.origen_iata, f.destino_iata].some((x) => x && !/^[A-Za-z]{3}$/.test(String(x)))
        ? "El código IATA son 3 letras"
        : null,
    fechas: !f.fecha_salida
      ? "Falta la fecha de salida"
      : f.tipo_trayecto === "ida_regreso" && !f.fecha_regreso
        ? "Falta la fecha de regreso"
        : f.fecha_regreso && String(f.fecha_regreso) < String(f.fecha_salida)
          ? "El regreso es antes de la salida"
          : f.tipo_trayecto === "solo_ida" && f.fecha_regreso
            ? "Un vuelo solo de ida no lleva regreso"
            : null,
    caracteristicas: null,
    precio: String(f.precio_adulto).trim() === "" ? "Falta el precio por adulto" : null,
    condiciones: null,
  };
  const pasos = [
    { id: "general", titulo: "General", pendiente: pendientes.general },
    { id: "ruta", titulo: "Ruta", pendiente: pendientes.ruta },
    { id: "fechas", titulo: "Fechas y horarios", pendiente: pendientes.fechas },
    { id: "caracteristicas", titulo: "Equipaje y clase", pendiente: null },
    { id: "precio", titulo: "Precio y cupos", pendiente: pendientes.precio },
    { id: "condiciones", titulo: "Condiciones", pendiente: null },
  ];
  const faltante = pasos.find((p) => p.pendiente);

  async function guardar() {
    if (faltante) {
      setPaso(pasos.indexOf(faltante));
      setError(faltante.pendiente ?? "");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const payload = aPayload(f);
      const guardada = oferta ? await vueloService.editar(oferta.id_oferta, payload) : await vueloService.crear(payload);
      if (imagen) await vueloService.subirImagen(guardada.id_oferta, imagen);
      toast.success(oferta ? "Oferta actualizada" : "Oferta creada");
      onGuardada();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar la oferta");
    } finally {
      setGuardando(false);
    }
  }

  const cerrar = () => (sucio ? setConfirmarSalida(true) : onCerrar());

  return (
    <>
      <AdminModal
        open
        onOpenChange={(o) => !o && cerrar()}
        title={oferta ? `Editar: ${oferta.titulo}` : "Nueva oferta aérea"}
        description="Los campos con * son obligatorios. Lo que no sepas todavía, déjalo vacío."
        maxWidth="sm:max-w-3xl"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <button type="button" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)} className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-40">
              ← Anterior
            </button>
            <div className="flex gap-2">
              {paso < pasos.length - 1 && (
                <button type="button" onClick={() => setPaso((p) => p + 1)} className="rounded-xl border border-border px-4 py-2 text-sm">
                  Siguiente →
                </button>
              )}
              <button type="button" onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />} {oferta ? "Guardar cambios" : "Crear oferta"}
              </button>
            </div>
          </div>
        }
      >
        <PasosFormulario pasos={pasos} actual={paso} onIr={setPaso} />
        {error && <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {paso === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Título comercial" obligatorio className="sm:col-span-2">
              <input {...txt("titulo")} maxLength={150} className={inputCls} placeholder="Ej: Bogotá - Cartagena temporada de vacaciones" />
            </Campo>
            <Campo label="Estado">
              <select {...txt("estado")} className={inputCls}>
                {(Object.keys(ETIQUETA_ESTADO_OFERTA) as EstadoOferta[]).map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_OFERTA[e]}</option>)}
              </select>
            </Campo>
            <Campo label="Código interno" ayuda="Para encontrarla rápido (ej. VUE-CTG-0626)">
              <input {...txt("codigo_referencia")} maxLength={40} className={inputCls} />
            </Campo>
            <Campo label="Aerolínea o proveedor">
              <input {...txt("aerolinea")} maxLength={100} className={inputCls} />
            </Campo>
            <Campo label="Número de vuelo" ayuda="Solo si ya está confirmado">
              <input {...txt("numero_vuelo")} maxLength={20} className={inputCls} />
            </Campo>
            <Campo label="Descripción" className="sm:col-span-2">
              <textarea {...txt("descripcion")} rows={3} maxLength={5000} className={inputCls} />
            </Campo>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={!!f.venta_independiente} onChange={(e) => s("venta_independiente")(e.target.checked)} />
              Se puede vender sola (no solo dentro de un paquete)
            </label>
            <Campo label="Imagen promocional" className="sm:col-span-2">
              <div className="flex items-center gap-3">
                {(imagen || oferta?.imagen_url) && (
                  <img src={imagen ? URL.createObjectURL(imagen) : resolveFotoUrl(oferta?.imagen_url)} alt="" className="h-14 w-20 rounded-lg object-cover" />
                )}
                <span className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40">
                  <ImagePlus className="h-4 w-4" /> {imagen ? imagen.name : "Elegir imagen (JPG, PNG o WEBP)"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setImagen(e.target.files?.[0] ?? null)} />
                </span>
              </div>
            </Campo>
          </div>
        )}

        {paso === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["origen", "destino"] as const).map((lado) => (
              <fieldset key={lado} className="space-y-2 rounded-xl border border-border p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lado === "origen" ? "Origen" : "Destino"}</legend>
                <Campo label="Ciudad" obligatorio><input {...txt(`${lado}_ciudad`)} maxLength={100} className={inputCls} /></Campo>
                <Campo label="País"><input {...txt(`${lado}_pais`)} maxLength={100} className={inputCls} /></Campo>
                <Campo label="Aeropuerto"><input {...txt(`${lado}_aeropuerto`)} maxLength={150} className={inputCls} placeholder="Ej: El Dorado" /></Campo>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Código IATA"><input {...txt(`${lado}_iata`)} maxLength={3} className={inputCls + " uppercase"} placeholder="BOG" /></Campo>
                  <Campo label="Zona horaria"><input {...txt(`${lado}_zona_horaria`)} maxLength={60} className={inputCls} placeholder="America/Bogota" /></Campo>
                </div>
              </fieldset>
            ))}
            <Campo label="Tipo de trayecto" className="sm:col-span-2">
              <select {...txt("tipo_trayecto")} className={inputCls}>
                {Object.entries(ETIQUETA_TRAYECTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <fieldset className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 sm:grid-cols-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ida</legend>
              <Campo label="Fecha de salida" obligatorio><input type="date" {...txt("fecha_salida")} className={inputCls} /></Campo>
              <Campo label="Hora de salida"><input type="time" {...txt("hora_salida")} className={inputCls} /></Campo>
              <Campo label="Fecha de llegada"><input type="date" {...txt("fecha_llegada")} className={inputCls} /></Campo>
              <Campo label="Hora de llegada"><input type="time" {...txt("hora_llegada")} className={inputCls} /></Campo>
            </fieldset>
            {f.tipo_trayecto !== "solo_ida" && (
              <fieldset className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 sm:grid-cols-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regreso</legend>
                <Campo label="Fecha de regreso" obligatorio={f.tipo_trayecto === "ida_regreso"}><input type="date" {...txt("fecha_regreso")} className={inputCls} /></Campo>
                <Campo label="Hora de salida"><input type="time" {...txt("hora_regreso")} className={inputCls} /></Campo>
                <Campo label="Fecha de llegada"><input type="date" {...txt("fecha_llegada_regreso")} className={inputCls} /></Campo>
                <Campo label="Hora de llegada"><input type="time" {...txt("hora_llegada_regreso")} className={inputCls} /></Campo>
              </fieldset>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              <Campo label="Duración estimada" ayuda="Ej: 1 h 25 min"><input {...txt("duracion_estimada")} maxLength={40} className={inputCls} /></Campo>
              <Campo label="Escalas"><input type="number" min={0} max={10} {...txt("escalas")} className={inputCls} /></Campo>
              <Campo label="Aeropuertos de conexión"><input {...txt("aeropuertos_conexion")} maxLength={255} className={inputCls} placeholder="Ej: MDE" /></Campo>
              <Campo label="Horarios de conexión" className="sm:col-span-3"><textarea {...txt("horarios_conexion")} rows={2} className={inputCls} /></Campo>
            </div>
            <p className="text-[11px] text-muted-foreground">Las horas son opcionales: ponlas solo cuando la aerolínea las haya confirmado.</p>
          </div>
        )}

        {paso === 3 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Clase">
              <select {...txt("clase")} className={inputCls}>
                <option value="">Sin especificar</option>
                {Object.entries(ETIQUETA_CLASE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <div />
            <Campo label="Equipaje de mano" ayuda="Ej: 1 pieza de 10 kg"><input {...txt("equipaje_mano")} maxLength={150} className={inputCls} /></Campo>
            <Campo label="Equipaje de bodega" ayuda="Ej: 1 maleta de 23 kg / No incluido"><input {...txt("equipaje_bodega")} maxLength={150} className={inputCls} /></Campo>
            <Campo label="Información adicional" className="sm:col-span-2"><textarea {...txt("informacion_adicional")} rows={3} className={inputCls} /></Campo>
          </div>
        )}

        {paso === 4 && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Precio por adulto (COP)" obligatorio><input type="number" min={0} step={1000} {...txt("precio_adulto")} className={inputCls} /></Campo>
            <Campo label="Precio por niño" ayuda="Vacío = paga como adulto"><input type="number" min={0} step={1000} {...txt("precio_nino")} className={inputCls} /></Campo>
            <Campo label="Precio por infante" ayuda="Vacío = no se aceptan infantes"><input type="number" min={0} step={1000} {...txt("precio_infante")} className={inputCls} /></Campo>
            <Campo label="¿Incluye impuestos?">
              <select {...txt("impuestos_incluidos")} className={inputCls}>
                <option value="">No informado</option>
                <option value="si">Sí, incluidos</option>
                <option value="no">No incluidos</option>
              </select>
            </Campo>
            <Campo label="Cargos adicionales por pasajero"><input type="number" min={0} step={1000} {...txt("cargos_adicionales")} className={inputCls} /></Campo>
            <Campo label="¿Qué son esos cargos?"><input {...txt("descripcion_cargos")} maxLength={255} className={inputCls} placeholder="Ej: tasa aeroportuaria" /></Campo>
            <Campo label="Cupos (sillas)" ayuda="Vacío = la agencia no controla cupos"><input type="number" min={0} {...txt("cupos")} className={inputCls} /></Campo>
            <Campo label="Tarifa vigente hasta"><input type="date" {...txt("vigencia_hasta")} className={inputCls} /></Campo>
            {oferta && <p className="self-end text-xs text-muted-foreground">Ya vendidos: {oferta.cupos_usados} silla(s)</p>}
          </div>
        )}

        {paso === 5 && (
          <div className="grid gap-3">
            <Campo label="Condiciones de cambio"><textarea {...txt("condiciones_cambio")} rows={2} className={inputCls} /></Campo>
            <Campo label="Condiciones de cancelación"><textarea {...txt("condiciones_cancelacion")} rows={2} className={inputCls} /></Campo>
            <Campo label="Restricciones"><textarea {...txt("restricciones")} rows={2} className={inputCls} /></Campo>
            <Campo label="Condiciones comerciales"><textarea {...txt("condiciones_comerciales")} rows={2} className={inputCls} /></Campo>
          </div>
        )}
      </AdminModal>
      <ConfirmDialog
        open={confirmarSalida}
        onOpenChange={setConfirmarSalida}
        title="¿Salir sin guardar?"
        description="Tienes cambios sin guardar en esta oferta. Si sales, se pierden."
        confirmLabel="Salir sin guardar"
        destructive
        onConfirm={() => {
          setConfirmarSalida(false);
          onCerrar();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function PasajerosOferta({ oferta, onCerrar }: { oferta: OfertaVueloAdmin; onCerrar: () => void }) {
  const [reservas, setReservas] = useState<ReservaDeOferta[] | null>(null);
  const [pasajeros, setPasajeros] = useState<PasajeroOferta[]>([]);

  useEffect(() => {
    Promise.all([vueloService.reservas(oferta.id_oferta), vueloService.pasajeros(oferta.id_oferta)])
      .then(([r, p]) => {
        setReservas(r);
        setPasajeros(p);
      })
      .catch(() => setReservas([]));
  }, [oferta.id_oferta]);

  return (
    <AdminModal open onOpenChange={(o) => !o && onCerrar()} title={`Reservas y pasajeros · ${oferta.titulo}`} description={rutaOferta(oferta)} maxWidth="sm:max-w-3xl">
      {reservas === null ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : reservas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Esta oferta todavía no tiene reservas.</p>
      ) : (
        <div className="space-y-5">
          <section>
            <h4 className="mb-2 text-sm font-semibold">Reservas ({reservas.length})</h4>
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {reservas.map((r) => (
                <li key={r.id_reserva} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>#{r.id_reserva} · {r.cliente}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.adultos ?? 0} adulto(s){r.ninos ? `, ${r.ninos} niño(s)` : ""}{r.infantes ? `, ${r.infantes} infante(s)` : ""} · {r.estado}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="mb-2 text-sm font-semibold">Manifiesto de pasajeros (reservas activas)</h4>
            <p className="mb-2 text-[11px] text-muted-foreground">Contiene documentos de identidad: no lo compartas fuera de la operación.</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Reserva</th><th className="px-3 py-2">Pasajero</th><th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Nacimiento</th><th className="px-3 py-2">Documento</th><th className="px-3 py-2">Nacionalidad</th>
                  </tr>
                </thead>
                <tbody>
                  {pasajeros.map((p, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">#{p.id_reserva}</td>
                      <td className="px-3 py-2">{p.nombres} {p.apellidos}</td>
                      <td className="px-3 py-2">{p.tipo}</td>
                      <td className="px-3 py-2">{p.fecha_nacimiento ?? "—"}</td>
                      <td className="px-3 py-2">{p.tipo_documento ? `${p.tipo_documento} ${p.numero_documento ?? ""}` : "—"}</td>
                      <td className="px-3 py-2">{p.nacionalidad ?? "—"}</td>
                    </tr>
                  ))}
                  {pasajeros.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Las reservas activas todavía no tienen pasajeros registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AdminModal>
  );
}
