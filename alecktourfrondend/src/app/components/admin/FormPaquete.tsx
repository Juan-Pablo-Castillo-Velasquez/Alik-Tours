import { ArrowDown, ArrowUp, Hotel, ImageIcon, Loader2, Plane, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CategoriaInclusion,
  ETIQUETA_CATEGORIA_INCLUSION,
  ETIQUETA_MODALIDAD_ALOJAMIENTO,
  ETIQUETA_MODALIDAD_VUELO,
  InclusionPaquete,
  ItinerarioDia,
  ModalidadAlojamiento,
  ModalidadVuelo,
  paqueteService,
  SalidaPaquete,
  UnidadPrecio,
} from "../../services/paquete.service";
import { servicioService, ServicioResponse } from "../../services/servicio.service";
import { OfertaVueloAdmin, rutaOferta, vueloService } from "../../services/vuelo.service";
import { Switch } from "../ui/switch";
import AdminModal from "./ui/AdminModal";
import ConfirmDialog from "./ui/ConfirmDialog";
import PasosFormulario from "./ui/PasosFormulario";
import { HotelData, inputCls, labelCls, Paquete, resolveFotoUrl } from "./types";

interface HotelSel { id_hotel: number; noches_incluidas: string }
interface ServicioSel { id_servicio: number; dia_actividad: string; incluido: boolean }
type DiaForm = Omit<ItinerarioDia, "dia"> & { dia: string };
type SalidaForm = { id_salida?: number; fecha_salida: string; fecha_regreso: string; cupos: string; estado: "abierta" | "cerrada"; notas: string; cupos_usados?: number };

interface FormState {
  nombre_paquete: string;
  descripcion: string;
  categoria: string;
  destino_ciudad: string;
  destino_pais: string;
  destinos_secundarios: string;
  ciudad_salida: string;
  duracion_dias: string;
  noches: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  activo: boolean;
  condiciones: string;
  no_incluye: string;
  modalidad_alojamiento: ModalidadAlojamiento;
  modalidad_vuelo: ModalidadVuelo;
  unidad_precio: UnidadPrecio;
  precio_base: string;
  precio_nino: string;
  precio_infante: string;
  min_viajeros: string;
  max_viajeros: string;
  hoteles: HotelSel[];
  servicios: ServicioSel[];
  itinerario: DiaForm[];
  inclusiones: InclusionPaquete[];
  salidas: SalidaForm[];
  vuelos: number[];
}

const VACIO: FormState = {
  nombre_paquete: "", descripcion: "", categoria: "", destino_ciudad: "", destino_pais: "Colombia",
  destinos_secundarios: "", ciudad_salida: "", duracion_dias: "", noches: "", vigencia_desde: "", vigencia_hasta: "",
  activo: true, condiciones: "", no_incluye: "", modalidad_alojamiento: "sin", modalidad_vuelo: "sin",
  unidad_precio: "por_persona", precio_base: "", precio_nino: "", precio_infante: "", min_viajeros: "", max_viajeros: "",
  hoteles: [], servicios: [], itinerario: [], inclusiones: [], salidas: [], vuelos: [],
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

interface Props {
  paquete: Paquete | null;
  hoteles: HotelData[];
  loading: boolean;
  onSubmit: (data: any, id?: number) => Promise<void>;
  onCerrar: () => void;
}

const DESCRIPCION_ALOJAMIENTO: Record<ModalidadAlojamiento, string> = {
  sin: "El paquete no lleva hotel (por ejemplo, solo actividades). Al cliente no se le piden datos de hotel.",
  incluido: "El hotel ya está en el precio del paquete. Se muestra como incluido ($0) en el resumen.",
  opcional: "El cliente decide si agrega una habitación de los hoteles que elijas; se cobra aparte por noche.",
};

const DESCRIPCION_VUELO: Record<ModalidadVuelo, string> = {
  sin: "El paquete no incluye ni ofrece vuelo.",
  incluido: "El vuelo está en el precio del paquete: no se cobra otra vez. Asocia la oferta aérea si ya la tienes.",
  opcional: "El cliente puede agregar uno de los vuelos asociados y ve su precio adicional.",
  cotizacion: "El cliente pide el vuelo y la agencia le envía la tarifa después. No se presenta como precio garantizado.",
};

export default function FormPaquete({ paquete, hoteles, loading, onSubmit, onCerrar }: Props) {
  const [f, setF] = useState<FormState>(VACIO);
  const [inicial, setInicial] = useState<string>(JSON.stringify(VACIO));
  const [cargando, setCargando] = useState(!!paquete);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState("");
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [catalogo, setCatalogo] = useState<ServicioResponse[]>([]);
  const [ofertas, setOfertas] = useState<OfertaVueloAdmin[]>([]);
  const [nuevaInclusion, setNuevaInclusion] = useState<{ tipo: "incluye" | "no_incluye"; categoria: CategoriaInclusion; descripcion: string }>({
    tipo: "incluye", categoria: "actividades", descripcion: "",
  });

  useEffect(() => {
    servicioService.getAll().then(setCatalogo).catch(() => {});
    vueloService.listarAdmin({ por_pagina: 100 }).then((r) => setOfertas(r.items.filter((o) => o.estado !== "finalizada"))).catch(() => {});
  }, []);

  // Al editar: trae la ficha completa (itinerario, inclusiones, salidas...).
  useEffect(() => {
    if (!paquete) return;
    paqueteService
      .getDetalle(paquete.id_paquete)
      .then((d) => {
        const estado: FormState = {
          nombre_paquete: d.nombre_paquete,
          descripcion: str(d.descripcion),
          categoria: str(d.categoria),
          destino_ciudad: str(d.destino_ciudad),
          destino_pais: str(d.destino_pais),
          destinos_secundarios: str(d.destinos_secundarios),
          ciudad_salida: str(d.ciudad_salida),
          duracion_dias: str(d.duracion_dias),
          noches: str(d.noches),
          vigencia_desde: str(d.vigencia_desde),
          vigencia_hasta: str(d.vigencia_hasta),
          activo: d.activo,
          condiciones: str(d.condiciones),
          no_incluye: str(d.no_incluye),
          modalidad_alojamiento: d.modalidad_alojamiento ?? "sin",
          modalidad_vuelo: d.modalidad_vuelo ?? "sin",
          unidad_precio: d.unidad_precio ?? "por_persona",
          precio_base: str(d.precio_base),
          precio_nino: str(d.precio_nino),
          precio_infante: str(d.precio_infante),
          min_viajeros: str(d.min_viajeros),
          max_viajeros: str(d.max_viajeros),
          hoteles: d.hoteles.map((h) => ({ id_hotel: h.id_hotel, noches_incluidas: str(h.noches_incluidas) })),
          servicios: d.servicios.map((s) => ({ id_servicio: s.id_servicio, dia_actividad: str(s.dia_actividad), incluido: s.incluido })),
          itinerario: (d.itinerario ?? []).map((x) => ({ ...x, dia: String(x.dia) })),
          inclusiones: (d.inclusiones ?? []).map(({ tipo, categoria, descripcion }) => ({ tipo, categoria, descripcion })),
          salidas: (d.salidas ?? []).map((s: SalidaPaquete) => ({
            id_salida: s.id_salida, fecha_salida: s.fecha_salida, fecha_regreso: str(s.fecha_regreso), cupos: str(s.cupos),
            estado: s.estado, notas: str(s.notas), cupos_usados: s.cupos_usados,
          })),
          vuelos: (d.vuelos ?? []).map((v) => v.id_oferta),
        };
        setF(estado);
        setInicial(JSON.stringify(estado));
      })
      .catch((e: any) => setError(e?.message || "No se pudo cargar el paquete"))
      .finally(() => setCargando(false));
  }, [paquete]);

  const sucio = JSON.stringify(f) !== inicial || !!imagenFile;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const txt = (k: keyof FormState) => ({
    value: String(f[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never),
  });

  const noches = f.noches !== "" ? Number(f.noches) : f.duracion_dias !== "" ? Math.max(Number(f.duracion_dias) - 1, 0) : null;

  // Validación en vivo (las mismas reglas que el backend).
  const pendientes = useMemo(() => {
    const p: Record<string, string | null> = {};
    p.general = !f.nombre_paquete.trim()
      ? "Falta el nombre"
      : f.noches !== "" && f.duracion_dias !== "" && Number(f.noches) > Number(f.duracion_dias)
        ? "Las noches no pueden ser más que los días"
        : f.vigencia_desde && f.vigencia_hasta && f.vigencia_hasta < f.vigencia_desde
          ? "La vigencia termina antes de empezar"
          : null;
    const dias = f.itinerario.map((d) => d.dia);
    p.itinerario = f.itinerario.some((d) => !d.titulo.trim() || !d.dia)
      ? "Cada día necesita número y título"
      : new Set(dias).size !== dias.length
        ? "Hay días repetidos"
        : null;
    p.incluye = null;
    p.alojamiento =
      f.modalidad_alojamiento === "opcional" && f.hoteles.length === 0
        ? "Elige al menos un hotel para el alojamiento opcional"
        : null;
    p.vuelo =
      f.modalidad_vuelo === "opcional" && f.vuelos.length === 0
        ? "Asocia al menos una oferta aérea para el vuelo opcional"
        : null;
    p.precio = f.precio_base.trim() === ""
      ? "Falta el precio"
      : f.min_viajeros && f.max_viajeros && Number(f.max_viajeros) < Number(f.min_viajeros)
        ? "El máximo de viajeros es menor que el mínimo"
        : f.salidas.some((s) => !s.fecha_salida)
          ? "Cada salida necesita fecha"
          : f.salidas.some((s) => s.fecha_regreso && noches !== null && sumarDias(s.fecha_salida, noches) !== s.fecha_regreso)
            ? `Las salidas deben regresar ${noches} noche(s) después`
            : null;
    p.condiciones = null;
    return p;
  }, [f, noches]);

  const pasos = [
    { id: "general", titulo: "General", pendiente: pendientes.general },
    { id: "itinerario", titulo: "Itinerario", pendiente: pendientes.itinerario },
    { id: "incluye", titulo: "Qué incluye", pendiente: null },
    { id: "alojamiento", titulo: "Alojamiento", pendiente: pendientes.alojamiento },
    { id: "vuelo", titulo: "Vuelo", pendiente: pendientes.vuelo },
    { id: "precio", titulo: "Precio y salidas", pendiente: pendientes.precio },
    { id: "condiciones", titulo: "Condiciones", pendiente: null },
    { id: "revision", titulo: "Revisión", pendiente: null },
  ];

  async function guardar() {
    const faltante = pasos.find((p) => p.pendiente);
    if (faltante) {
      setPaso(pasos.indexOf(faltante));
      setError(faltante.pendiente ?? "");
      return;
    }
    setError("");
    const datos = {
      nombre_paquete: f.nombre_paquete.trim(),
      descripcion: f.descripcion.trim() || null,
      categoria: f.categoria.trim() || null,
      destino_ciudad: f.destino_ciudad.trim() || null,
      destino_pais: f.destino_pais.trim() || null,
      destinos_secundarios: f.destinos_secundarios.trim() || null,
      ciudad_salida: f.ciudad_salida.trim() || null,
      duracion_dias: num(f.duracion_dias),
      noches: num(f.noches),
      vigencia_desde: f.vigencia_desde || null,
      vigencia_hasta: f.vigencia_hasta || null,
      activo: f.activo,
      condiciones: f.condiciones.trim() || null,
      no_incluye: f.no_incluye.trim() || null,
      modalidad_alojamiento: f.modalidad_alojamiento,
      modalidad_vuelo: f.modalidad_vuelo,
      unidad_precio: f.unidad_precio,
      precio_base: Number(f.precio_base),
      precio_nino: f.unidad_precio === "por_persona" ? num(f.precio_nino) : null,
      precio_infante: f.unidad_precio === "por_persona" ? num(f.precio_infante) : null,
      min_viajeros: num(f.min_viajeros),
      max_viajeros: num(f.max_viajeros),
      hoteles: f.modalidad_alojamiento === "sin" ? [] : f.hoteles.map((h) => ({ id_hotel: h.id_hotel, noches_incluidas: num(h.noches_incluidas) })),
      servicios: f.servicios.map((s) => ({ id_servicio: s.id_servicio, dia_actividad: num(s.dia_actividad), incluido: s.incluido })),
      itinerario: f.itinerario.map((d) => ({
        dia: Number(d.dia), titulo: d.titulo.trim(), descripcion: d.descripcion?.trim() || null,
        actividades: d.actividades?.trim() || null, horario: d.horario?.trim() || null, lugar: d.lugar?.trim() || null,
        informacion_adicional: d.informacion_adicional?.trim() || null,
      })),
      inclusiones: f.inclusiones,
      salidas: f.salidas.map((s) => ({
        ...(s.id_salida ? { id_salida: s.id_salida } : {}),
        fecha_salida: s.fecha_salida, fecha_regreso: s.fecha_regreso || null, cupos: num(s.cupos), estado: s.estado, notas: s.notas.trim() || null,
      })),
      vuelos: f.modalidad_vuelo === "incluido" || f.modalidad_vuelo === "opcional" ? f.vuelos : [],
      imagenFile,
    };
    try {
      await onSubmit(datos, paquete?.id_paquete);
      onCerrar();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el paquete");
    }
  }

  const cerrar = () => (sucio ? setConfirmarSalida(true) : onCerrar());
  const preview = imagenFile ? URL.createObjectURL(imagenFile) : resolveFotoUrl(paquete?.imagen_url);

  // ---- helpers de listas ----
  const setDia = (i: number, campo: keyof DiaForm, v: string) =>
    set("itinerario", f.itinerario.map((d, j) => (j === i ? { ...d, [campo]: v } : d)));
  const moverDia = (i: number, delta: number) => {
    const arr = [...f.itinerario];
    const j = i + delta;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set("itinerario", arr.map((d, k) => ({ ...d, dia: String(k + 1) })));
  };
  const setSalida = (i: number, campo: keyof SalidaForm, v: string) =>
    set("salidas", f.salidas.map((s, j) => {
      if (j !== i) return s;
      const nueva = { ...s, [campo]: v };
      if (campo === "fecha_salida" && v && noches !== null) nueva.fecha_regreso = sumarDias(v, noches);
      return nueva;
    }));

  return (
    <>
      <AdminModal
        open
        onOpenChange={(o) => !o && cerrar()}
        title={paquete ? `Editar: ${paquete.nombre_paquete}` : "Nuevo paquete turístico"}
        description="Los campos con * son obligatorios. Los pasos en naranja tienen algo pendiente."
        maxWidth="sm:max-w-3xl"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <button type="button" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)} className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-40">← Anterior</button>
            <div className="flex gap-2">
              {paso < pasos.length - 1 && (
                <button type="button" onClick={() => setPaso((p) => p + 1)} className="rounded-xl border border-border px-4 py-2 text-sm">Siguiente →</button>
              )}
              <button type="button" onClick={guardar} disabled={loading || cargando} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} {paquete ? "Guardar cambios" : "Crear paquete"}
              </button>
            </div>
          </div>
        }
      >
        {cargando ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <PasosFormulario pasos={pasos} actual={paso} onIr={setPaso} />
            {error && <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {paso === 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <L t="Nombre del paquete" req className="sm:col-span-2"><input {...txt("nombre_paquete")} maxLength={100} className={inputCls} placeholder="Ej: Cartagena 4 días / 3 noches" /></L>
                <L t="Categoría" ayuda="Ej: Playa, Aventura, Cultural"><input {...txt("categoria")} maxLength={60} className={inputCls} /></L>
                <L t="Ciudad de salida" ayuda="Desde dónde sale el viaje"><input {...txt("ciudad_salida")} maxLength={100} className={inputCls} /></L>
                <L t="Destino principal (ciudad)"><input {...txt("destino_ciudad")} maxLength={100} className={inputCls} /></L>
                <L t="País de destino"><input {...txt("destino_pais")} maxLength={100} className={inputCls} /></L>
                <L t="Destinos secundarios" className="sm:col-span-2" ayuda="Separados por coma"><input {...txt("destinos_secundarios")} maxLength={255} className={inputCls} placeholder="Ej: Islas del Rosario, Barú" /></L>
                <L t="Duración (días)"><input type="number" min={1} {...txt("duracion_dias")} className={inputCls} /></L>
                <L t="Noches" ayuda={f.duracion_dias && f.noches === "" ? `Si lo dejas vacío: ${Math.max(Number(f.duracion_dias) - 1, 0)}` : undefined}><input type="number" min={0} {...txt("noches")} className={inputCls} /></L>
                <L t="Vigente desde"><input type="date" {...txt("vigencia_desde")} className={inputCls} /></L>
                <L t="Vigente hasta"><input type="date" {...txt("vigencia_hasta")} className={inputCls} /></L>
                <L t="Descripción comercial" className="sm:col-span-2"><textarea {...txt("descripcion")} rows={4} className={inputCls} /></L>
                <L t="Foto de portada" className="sm:col-span-2">
                  <label className="flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 hover:border-primary/40">
                    {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : (
                      <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground"><ImageIcon className="h-5 w-5" /> Elegir foto (las demás se suben en el detalle del paquete)</span>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setImagenFile(e.target.files?.[0] ?? null)} />
                  </label>
                </L>
                <div className="flex items-center justify-between sm:col-span-2">
                  <div><p className="text-sm font-medium">Paquete publicado</p><p className="text-xs text-muted-foreground">Visible y reservable en el sitio</p></div>
                  <Switch checked={f.activo} onCheckedChange={(v) => set("activo", v)} />
                </div>
              </div>
            )}

            {paso === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Escribe el itinerario real del paquete, día por día. No se genera nada automáticamente.</p>
                {f.itinerario.map((d, i) => (
                  <fieldset key={i} className="space-y-2 rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Día {d.dia}</span>
                      <input value={d.titulo} onChange={(e) => setDia(i, "titulo", e.target.value)} maxLength={150} className={inputCls} placeholder="Título del día *" aria-label={`Título del día ${d.dia}`} />
                      <button type="button" onClick={() => moverDia(i, -1)} aria-label="Subir" className="rounded p-1 hover:bg-muted"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => moverDia(i, 1)} aria-label="Bajar" className="rounded p-1 hover:bg-muted"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => set("itinerario", f.itinerario.filter((_, j) => j !== i).map((x, k) => ({ ...x, dia: String(k + 1) })))} aria-label="Quitar día" className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={d.lugar ?? ""} onChange={(e) => setDia(i, "lugar", e.target.value)} maxLength={150} className={inputCls} placeholder="Lugar" />
                      <input value={d.horario ?? ""} onChange={(e) => setDia(i, "horario", e.target.value)} maxLength={120} className={inputCls} placeholder="Horario (si está definido)" />
                    </div>
                    <textarea value={d.descripcion ?? ""} onChange={(e) => setDia(i, "descripcion", e.target.value)} rows={2} className={inputCls} placeholder="Descripción del día" />
                    <textarea value={d.actividades ?? ""} onChange={(e) => setDia(i, "actividades", e.target.value)} rows={2} className={inputCls} placeholder="Actividades, una por línea" />
                    <input value={d.informacion_adicional ?? ""} onChange={(e) => setDia(i, "informacion_adicional", e.target.value)} className={inputCls} placeholder="Información adicional" />
                  </fieldset>
                ))}
                <button type="button" onClick={() => set("itinerario", [...f.itinerario, { dia: String(f.itinerario.length + 1), titulo: "" }])} className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2 text-sm hover:border-primary/40">
                  <Plus className="h-4 w-4" /> Agregar día
                </button>
              </div>
            )}

            {paso === 2 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["incluye", "no_incluye"] as const).map((tipo) => (
                    <section key={tipo} className="rounded-xl border border-border p-3">
                      <h4 className={`mb-2 text-sm font-semibold ${tipo === "incluye" ? "text-success" : "text-destructive"}`}>{tipo === "incluye" ? "Incluye" : "No incluye"}</h4>
                      <ul className="space-y-1.5">
                        {f.inclusiones.map((inc, i) => inc.tipo === tipo && (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{ETIQUETA_CATEGORIA_INCLUSION[inc.categoria]}</span>
                            <span className="flex-1">{inc.descripcion}</span>
                            <button type="button" onClick={() => set("inclusiones", f.inclusiones.filter((_, j) => j !== i))} aria-label="Quitar" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </li>
                        ))}
                      </ul>
                      {!f.inclusiones.some((x) => x.tipo === tipo) && <p className="text-xs text-muted-foreground">Nada todavía.</p>}
                    </section>
                  ))}
                </div>
                <div className="grid gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-[auto_auto_1fr_auto]">
                  <select value={nuevaInclusion.tipo} onChange={(e) => setNuevaInclusion({ ...nuevaInclusion, tipo: e.target.value as "incluye" | "no_incluye" })} className={inputCls} aria-label="Tipo">
                    <option value="incluye">Incluye</option><option value="no_incluye">No incluye</option>
                  </select>
                  <select value={nuevaInclusion.categoria} onChange={(e) => setNuevaInclusion({ ...nuevaInclusion, categoria: e.target.value as CategoriaInclusion })} className={inputCls} aria-label="Categoría">
                    {Object.entries(ETIQUETA_CATEGORIA_INCLUSION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input value={nuevaInclusion.descripcion} onChange={(e) => setNuevaInclusion({ ...nuevaInclusion, descripcion: e.target.value })} maxLength={500} className={inputCls} placeholder="Descríbelo con precisión (ej: Traslado aeropuerto - hotel - aeropuerto)" aria-label="Descripción" />
                  <button
                    type="button"
                    disabled={nuevaInclusion.descripcion.trim().length < 2}
                    onClick={() => {
                      set("inclusiones", [...f.inclusiones, { ...nuevaInclusion, descripcion: nuevaInclusion.descripcion.trim() }]);
                      setNuevaInclusion({ ...nuevaInclusion, descripcion: "" });
                    }}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                  >Agregar</button>
                </div>
                {f.no_incluye && (
                  <L t="Texto anterior de 'no incluye'" ayuda="Se muestra mientras no agregues ítems de 'No incluye'. Puedes pasarlos arriba y borrarlo.">
                    <textarea {...txt("no_incluye")} rows={3} className={inputCls} />
                  </L>
                )}
                <section>
                  <h4 className="mb-1 text-sm font-semibold">Actividades y servicios del catálogo</h4>
                  <p className="mb-2 text-xs text-muted-foreground">Marca los que tiene el paquete y si están incluidos en el precio o son opcionales (se cobran aparte, por persona).</p>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2.5">
                    {catalogo.length === 0 && <p className="text-xs text-muted-foreground">No hay servicios en el catálogo.</p>}
                    {catalogo.map((s) => {
                      const sel = f.servicios.find((x) => x.id_servicio === s.id_servicio);
                      return (
                        <div key={s.id_servicio} className="flex flex-wrap items-center gap-2">
                          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs">
                            <input type="checkbox" checked={!!sel} onChange={() => set("servicios", sel ? f.servicios.filter((x) => x.id_servicio !== s.id_servicio) : [...f.servicios, { id_servicio: s.id_servicio, dia_actividad: "", incluido: true }])} />
                            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{s.nombre_servicio} <span className="text-muted-foreground">· ${Number(s.precio_base).toLocaleString("es-CO")} p/p · hasta {s.capacidad_maxima}</span></span>
                          </label>
                          {sel && (
                            <>
                              <select value={sel.incluido ? "si" : "no"} onChange={(e) => set("servicios", f.servicios.map((x) => x.id_servicio === s.id_servicio ? { ...x, incluido: e.target.value === "si" } : x))} className="rounded-lg border border-border bg-card px-2 py-1 text-xs" aria-label="Incluido u opcional">
                                <option value="si">Incluido</option><option value="no">Opcional (se cobra)</option>
                              </select>
                              <input type="number" min={1} value={sel.dia_actividad} onChange={(e) => set("servicios", f.servicios.map((x) => x.id_servicio === s.id_servicio ? { ...x, dia_actividad: e.target.value } : x))} placeholder="día" className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-xs" aria-label="Día" />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {paso === 3 && (
              <div className="space-y-4">
                <Opciones valor={f.modalidad_alojamiento} opciones={ETIQUETA_MODALIDAD_ALOJAMIENTO} descripciones={DESCRIPCION_ALOJAMIENTO} onChange={(v) => set("modalidad_alojamiento", v)} />
                {f.modalidad_alojamiento !== "sin" && (
                  <section>
                    <h4 className="mb-1 text-sm font-semibold">Hoteles {f.modalidad_alojamiento === "opcional" && <span className="text-destructive">*</span>}</h4>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {f.modalidad_alojamiento === "incluido" ? "Hotel(es) incluidos y cuántas noches en cada uno." : "Hoteles cuyas habitaciones el cliente puede agregar."}
                    </p>
                    <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2.5">
                      {hoteles.map((h) => {
                        const sel = f.hoteles.find((x) => x.id_hotel === h.id_hotel);
                        const sinHab = !(h.habitaciones && h.habitaciones.length);
                        return (
                          <div key={h.id_hotel} className="flex items-center gap-2">
                            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs">
                              <input type="checkbox" checked={!!sel} onChange={() => set("hoteles", sel ? f.hoteles.filter((x) => x.id_hotel !== h.id_hotel) : [...f.hoteles, { id_hotel: h.id_hotel, noches_incluidas: "" }])} />
                              <Hotel className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate">{h.nombre_hotel} <span className="text-muted-foreground">· {h.ciudad}{sinHab ? " · sin habitaciones" : ""}</span></span>
                            </label>
                            {sel && f.modalidad_alojamiento === "incluido" && (
                              <input type="number" min={1} value={sel.noches_incluidas} onChange={(e) => set("hoteles", f.hoteles.map((x) => x.id_hotel === h.id_hotel ? { ...x, noches_incluidas: e.target.value } : x))} placeholder="noches" className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-xs" aria-label="Noches" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

            {paso === 4 && (
              <div className="space-y-4">
                <Opciones valor={f.modalidad_vuelo} opciones={ETIQUETA_MODALIDAD_VUELO} descripciones={DESCRIPCION_VUELO} onChange={(v) => set("modalidad_vuelo", v)} />
                {(f.modalidad_vuelo === "incluido" || f.modalidad_vuelo === "opcional") && (
                  <section>
                    <h4 className="mb-1 text-sm font-semibold">Ofertas aéreas {f.modalidad_vuelo === "opcional" && <span className="text-destructive">*</span>}</h4>
                    <p className="mb-2 text-xs text-muted-foreground">Las ofertas se crean en el módulo <b>Vuelos</b>. Si asocias varias, el cliente elige con cuál viajar.</p>
                    <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2.5">
                      {ofertas.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay ofertas aéreas. Créalas en el módulo Vuelos.</p>}
                      {ofertas.map((o) => {
                        const sel = f.vuelos.includes(o.id_oferta);
                        return (
                          <label key={o.id_oferta} className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={sel} onChange={() => set("vuelos", sel ? f.vuelos.filter((x) => x !== o.id_oferta) : [...f.vuelos, o.id_oferta])} />
                            <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{o.titulo} <span className="text-muted-foreground">· {rutaOferta(o)} · {o.fecha_salida} · ${Number(o.precio_adulto).toLocaleString("es-CO")} · {o.estado}</span></span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

            {paso === 5 && (
              <div className="space-y-4">
                <Opciones
                  valor={f.unidad_precio}
                  opciones={{ por_persona: "Precio por persona", por_paquete: "Precio por paquete" }}
                  descripciones={{
                    por_persona: "Cada viajero paga: adulto el precio base, niño e infante su tarifa.",
                    por_paquete: "Un solo valor por todo el paquete, sin importar cuántos viajen (hasta el máximo).",
                  }}
                  onChange={(v) => set("unidad_precio", v)}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <L t={f.unidad_precio === "por_persona" ? "Precio por adulto (COP)" : "Precio del paquete (COP)"} req><input type="number" min={0} step={1000} {...txt("precio_base")} className={inputCls} /></L>
                  {f.unidad_precio === "por_persona" && (
                    <>
                      <L t="Precio por niño" ayuda="Vacío = paga como adulto"><input type="number" min={0} step={1000} {...txt("precio_nino")} className={inputCls} /></L>
                      <L t="Precio por infante" ayuda="Vacío = no se aceptan infantes"><input type="number" min={0} step={1000} {...txt("precio_infante")} className={inputCls} /></L>
                    </>
                  )}
                  <L t="Mínimo de viajeros"><input type="number" min={1} {...txt("min_viajeros")} className={inputCls} /></L>
                  <L t="Máximo de viajeros"><input type="number" min={1} {...txt("max_viajeros")} className={inputCls} /></L>
                </div>
                <section>
                  <h4 className="mb-1 text-sm font-semibold">Salidas programadas</h4>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Si agregas salidas, el cliente solo puede viajar en esas fechas y se controlan los cupos. Sin salidas, elige la fecha que quiera (dentro de la vigencia).
                  </p>
                  {f.salidas.map((s, i) => (
                    <div key={i} className="mb-2 grid grid-cols-2 items-end gap-2 rounded-xl border border-border p-2.5 sm:grid-cols-[1fr_1fr_90px_110px_1fr_auto]">
                      <L t="Salida" req><input type="date" value={s.fecha_salida} onChange={(e) => setSalida(i, "fecha_salida", e.target.value)} className={inputCls} /></L>
                      <L t="Regreso"><input type="date" value={s.fecha_regreso} onChange={(e) => setSalida(i, "fecha_regreso", e.target.value)} className={inputCls} /></L>
                      <L t="Cupos"><input type="number" min={s.cupos_usados ?? 0} value={s.cupos} onChange={(e) => setSalida(i, "cupos", e.target.value)} className={inputCls} /></L>
                      <L t="Estado">
                        <select value={s.estado} onChange={(e) => setSalida(i, "estado", e.target.value)} className={inputCls}>
                          <option value="abierta">Abierta</option><option value="cerrada">Cerrada</option>
                        </select>
                      </L>
                      <L t="Notas"><input value={s.notas} onChange={(e) => setSalida(i, "notas", e.target.value)} maxLength={255} className={inputCls} /></L>
                      <button type="button" onClick={() => set("salidas", f.salidas.filter((_, j) => j !== i))} aria-label="Quitar salida" className="mb-1 rounded p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      {!!s.cupos_usados && <p className="col-span-full text-[11px] text-muted-foreground">Ya vendidos: {s.cupos_usados}. Si la quitas, se cierra en lugar de borrarse.</p>}
                    </div>
                  ))}
                  <button type="button" onClick={() => set("salidas", [...f.salidas, { fecha_salida: "", fecha_regreso: "", cupos: "", estado: "abierta", notas: "" }])} className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2 text-sm hover:border-primary/40">
                    <Plus className="h-4 w-4" /> Agregar salida
                  </button>
                </section>
              </div>
            )}

            {paso === 6 && (
              <L t="Condiciones comerciales" ayuda="Requisitos, documentos, cambios, cancelaciones, servicios no reembolsables...">
                <textarea {...txt("condiciones")} rows={8} maxLength={5000} className={inputCls} />
              </L>
            )}

            {paso === 7 && (
              <div className="space-y-3 text-sm">
                {pasos.some((p) => p.pendiente) ? (
                  <ul className="rounded-xl bg-warning/10 p-3 text-warning">
                    {pasos.filter((p) => p.pendiente).map((p) => <li key={p.id}>• {p.titulo}: {p.pendiente}</li>)}
                  </ul>
                ) : (
                  <p className="rounded-xl bg-success/10 p-3 text-success">Todo listo para guardar.</p>
                )}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Dato t="Paquete" v={f.nombre_paquete || "—"} />
                  <Dato t="Destino" v={[f.destino_ciudad, f.destino_pais].filter(Boolean).join(", ") || "—"} />
                  <Dato t="Duración" v={f.duracion_dias ? `${f.duracion_dias} días${noches !== null ? ` / ${noches} noches` : ""}` : "—"} />
                  <Dato t="Precio" v={f.precio_base ? `$${Number(f.precio_base).toLocaleString("es-CO")} ${f.unidad_precio === "por_persona" ? "por adulto" : "por paquete"}` : "—"} />
                  <Dato t="Alojamiento" v={`${ETIQUETA_MODALIDAD_ALOJAMIENTO[f.modalidad_alojamiento]}${f.hoteles.length ? ` (${f.hoteles.length} hotel/es)` : ""}`} />
                  <Dato t="Vuelo" v={`${ETIQUETA_MODALIDAD_VUELO[f.modalidad_vuelo]}${f.vuelos.length ? ` (${f.vuelos.length} oferta/s)` : ""}`} />
                  <Dato t="Itinerario" v={`${f.itinerario.length} día(s)`} />
                  <Dato t="Incluye / No incluye" v={`${f.inclusiones.filter((x) => x.tipo === "incluye").length} / ${f.inclusiones.filter((x) => x.tipo === "no_incluye").length}`} />
                  <Dato t="Opcionales con cobro" v={`${f.servicios.filter((s) => !s.incluido).length}`} />
                  <Dato t="Salidas" v={f.salidas.length ? `${f.salidas.length}` : "Fecha libre"} />
                  <Dato t="Estado" v={f.activo ? "Publicado" : "Oculto"} />
                </dl>
              </div>
            )}
          </>
        )}
      </AdminModal>
      <ConfirmDialog
        open={confirmarSalida}
        onOpenChange={setConfirmarSalida}
        title="¿Salir sin guardar?"
        description="Tienes cambios sin guardar en este paquete. Si sales, se pierden."
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

function L({ t, req, ayuda, className = "", children }: { t: string; req?: boolean; ayuda?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{t} {req && <span className="text-destructive" aria-hidden>*</span>}</span>
      {children}
      {ayuda && <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{ayuda}</span>}
    </label>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{t}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function Opciones<T extends string>({ valor, opciones, descripciones, onChange }: { valor: T; opciones: Record<T, string>; descripciones: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
      {(Object.keys(opciones) as T[]).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={valor === k}
          onClick={() => onChange(k)}
          className={`rounded-xl border p-3 text-left transition-colors ${valor === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
        >
          <p className="text-sm font-semibold">{opciones[k]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{descripciones[k]}</p>
        </button>
      ))}
    </div>
  );
}
