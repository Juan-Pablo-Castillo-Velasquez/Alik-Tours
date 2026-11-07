import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Plus, Star, X } from "lucide-react";
import { hotelService, type CondicionHabitacion, type TipoHabitacionResponse } from "../../services/hotel.service";
import { CATALOGO_SERVICIOS, CONDICIONES_HABITACION } from "../hotel/serviciosHabitacion";
import { HabitacionAdmin, inputCls, resolveFotoUrl } from "./types";

const MAX_FOTOS = 12;

type Condiciones = Record<CondicionHabitacion, boolean | null>;

const SIN_CONDICIONES: Condiciones = {
  desayuno_incluido: null,
  permite_fumar: null,
  admite_mascotas: null,
  accesible: null,
  cama_extra: null,
};

function formDesde(h: HabitacionAdmin | null) {
  return {
    id_tipo_habitacion: String(h?.id_tipo_habitacion ?? h?.tipo_habitacion?.id_tipo_habitacion ?? ""),
    numero_habitacion: h?.numero_habitacion ?? "",
    precio_noche: h ? String(h.precio_noche) : "",
    estado: h?.estado ?? "disponible",
    descripcion: h?.descripcion ?? "",
    tamano_m2: h?.tamano_m2 ? String(h.tamano_m2) : "",
    tipo_cama: h?.tipo_cama ?? "",
    piso: h?.piso != null ? String(h.piso) : "",
    vista: h?.vista ?? "",
    tipo_bano: h?.tipo_bano ?? "",
    comodidades: h?.comodidades ?? "",
    nombre: h?.nombre ?? "",
    capacidad_adultos: h?.capacidad_adultos != null ? String(h.capacidad_adultos) : "",
    capacidad_ninos: h?.capacidad_ninos != null ? String(h.capacidad_ninos) : "",
    cantidad_camas: h?.cantidad_camas != null ? String(h.cantidad_camas) : "",
    politica_cancelacion: h?.politica_cancelacion ?? "",
  };
}

interface Props {
  idHotel: number;
  /** null = crear una habitación nueva. */
  habitacion: HabitacionAdmin | null;
  tipos: TipoHabitacionResponse[];
  /** Recarga el hotel (fotos/datos ya guardados en la BD). */
  onCambio: () => Promise<void>;
  /** Guardado completo: el padre vuelve al modo "Agregar" (con un aviso opcional). */
  onGuardada: (aviso?: string) => Promise<void>;
  onCancelar: () => void;
}

const subtitulo = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wide";

/**
 * Formulario completo de una habitación: datos básicos, ficha (m², camas,
 * piso, vista, baño), qué incluye (catálogo por categorías), condiciones y
 * fotos. Al crear, las fotos elegidas se suben apenas se crea la habitación.
 */
export default function FormHabitacion({ idHotel, habitacion, tipos, onCambio, onGuardada, onCancelar }: Props) {
  const editando = habitacion !== null;
  const idHab = habitacion?.id_habitacion ?? 0;
  const [form, setForm] = useState(() => formDesde(habitacion));
  const [servicios, setServicios] = useState<Set<string>>(() => new Set(habitacion?.servicios ?? []));
  const [condiciones, setCondiciones] = useState<Condiciones>(() => ({
    ...SIN_CONDICIONES,
    ...Object.fromEntries(CONDICIONES_HABITACION.map((c) => [c.clave, habitacion?.[c.clave] ?? null])),
  }));
  const [pendientes, setPendientes] = useState<{ file: File; preview: string }[]>([]);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [pies, setPies] = useState<Record<number, string>>({});
  const [publicada, setPublicada] = useState(habitacion?.publicada !== false);

  const fotos = habitacion?.imagenes ?? [];
  const cupo = MAX_FOTOS - (editando ? fotos.length : pendientes.length);

  // Libera las vistas previas locales al desmontar (las que se quitan a
  // mano se liberan en el momento).
  const pendientesRef = useRef(pendientes);
  useEffect(() => {
    pendientesRef.current = pendientes;
  }, [pendientes]);
  useEffect(() => () => pendientesRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const set = (campo: keyof ReturnType<typeof formDesde>, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  function toggleServicio(clave: string) {
    setServicios((prev) => {
      const n = new Set(prev);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });
  }

  async function subirArchivos(idHabitacion: number, archivos: File[]) {
    const errores: string[] = [];
    for (let i = 0; i < archivos.length; i++) {
      setProgreso(`Subiendo foto ${i + 1} de ${archivos.length}...`);
      try {
        await hotelService.subirFotoHabitacion(idHabitacion, archivos[i]);
      } catch (err: any) {
        errores.push(`${archivos[i].name}: ${err?.message || "no se pudo subir"}`);
      }
    }
    setProgreso(null);
    return errores;
  }

  async function elegirFotos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setMsg("");
    const archivos = Array.from(lista).slice(0, Math.max(cupo, 0));
    if (archivos.length < lista.length) setMsg(`Máximo ${MAX_FOTOS} fotos por habitación: se tomaron solo ${archivos.length}.`);
    if (!editando) {
      setPendientes((prev) => [...prev, ...archivos.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
      return;
    }
    const errores = await subirArchivos(idHab, archivos);
    await onCambio();
    if (errores.length) setMsg(errores.join(" · "));
  }

  async function accionFoto(fn: () => Promise<unknown>, error: string) {
    setMsg("");
    try {
      await fn();
      await onCambio();
    } catch (err: any) {
      setMsg(err?.message || error);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setGuardando(true);
    const payload = {
      id_tipo_habitacion: parseInt(form.id_tipo_habitacion, 10),
      numero_habitacion: form.numero_habitacion.trim(),
      precio_noche: parseFloat(form.precio_noche),
      estado: form.estado,
      descripcion: form.descripcion.trim() || null,
      tamano_m2: form.tamano_m2 ? parseInt(form.tamano_m2, 10) : null,
      tipo_cama: form.tipo_cama.trim() || null,
      piso: form.piso !== "" ? parseInt(form.piso, 10) : null,
      vista: form.vista.trim() || null,
      tipo_bano: form.tipo_bano.trim() || null,
      comodidades: form.comodidades.trim() || null,
      nombre: form.nombre.trim() || null,
      capacidad_adultos: form.capacidad_adultos !== "" ? parseInt(form.capacidad_adultos, 10) : null,
      capacidad_ninos: form.capacidad_ninos !== "" ? parseInt(form.capacidad_ninos, 10) : null,
      cantidad_camas: form.cantidad_camas !== "" ? parseInt(form.cantidad_camas, 10) : null,
      politica_cancelacion: form.politica_cancelacion.trim() || null,
      publicada,
      // En el orden del catálogo, para que la ficha salga siempre igual.
      servicios: CATALOGO_SERVICIOS.flatMap((c) => c.servicios.map((s) => s.clave)).filter((k) => servicios.has(k)),
      ...condiciones,
    };
    try {
      if (habitacion) {
        await hotelService.updateHabitacion(habitacion.id_habitacion, payload);
      } else {
        const nueva = await hotelService.createHabitacion(idHotel, payload);
        if (pendientes.length) {
          const errores = await subirArchivos(nueva.id_habitacion, pendientes.map((p) => p.file));
          if (errores.length) {
            // La habitación quedó creada; se avisa qué fotos fallaron.
            await onGuardada(`Habitación creada, pero algunas fotos no se subieron: ${errores.join(" · ")}`);
            return;
          }
        }
      }
      await onGuardada();
    } catch (err: any) {
      setMsg(err?.message || "No se pudo guardar la habitación");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <p className={subtitulo}>{habitacion ? `Editar habitación ${habitacion.numero_habitacion}` : "Agregar habitación"}</p>
        {editando && (
          <button type="button" onClick={onCancelar} className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="w-3 h-3" /> Cancelar edición
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-destructive" role="alert">{msg}</p>}

      {/* Datos básicos */}
      <div className="grid grid-cols-2 gap-2.5">
        <select value={form.id_tipo_habitacion} onChange={(e) => set("id_tipo_habitacion", e.target.value)} className={inputCls} required aria-label="Tipo de habitación">
          <option value="">Tipo de habitación...</option>
          {tipos.map((t) => (
            <option key={t.id_tipo_habitacion} value={t.id_tipo_habitacion}>
              {t.nombre_tipo} (hasta {t.capacidad_personas})
            </option>
          ))}
        </select>
        <input value={form.numero_habitacion} onChange={(e) => set("numero_habitacion", e.target.value)} className={inputCls} required placeholder="Número (ej: 204)" aria-label="Número de habitación" />
        <input type="number" min="0" step="1000" value={form.precio_noche} onChange={(e) => set("precio_noche", e.target.value)} className={inputCls} required placeholder="Precio/noche" aria-label="Precio por noche" />
        <select value={form.estado} onChange={(e) => set("estado", e.target.value)} className={inputCls} aria-label="Estado">
          <option value="disponible">Disponible</option>
          <option value="ocupada">Ocupada</option>
          <option value="mantenimiento">Mantenimiento</option>
        </select>
      </div>

      {/* Ficha */}
      <div className="space-y-2">
        <p className={subtitulo}>Ficha de la habitación</p>
        <div className="grid grid-cols-2 gap-2.5">
          <input value={form.nombre} maxLength={100} onChange={(e) => set("nombre", e.target.value)} className={inputCls + " col-span-2"} placeholder='Nombre comercial (ej: "Suite vista al mar")' aria-label="Nombre de la habitación" />
          <input type="number" min="0" max="50" value={form.capacidad_adultos} onChange={(e) => set("capacidad_adultos", e.target.value)} className={inputCls} placeholder="Máx. adultos" aria-label="Capacidad de adultos" />
          <input type="number" min="0" max="50" value={form.capacidad_ninos} onChange={(e) => set("capacidad_ninos", e.target.value)} className={inputCls} placeholder="Máx. niños" aria-label="Capacidad de niños" />
          <input type="number" min="0" max="20" value={form.cantidad_camas} onChange={(e) => set("cantidad_camas", e.target.value)} className={inputCls} placeholder="Cantidad de camas" aria-label="Cantidad de camas" />
          <input type="number" min="1" value={form.tamano_m2} onChange={(e) => set("tamano_m2", e.target.value)} className={inputCls} placeholder="Tamaño en m²" aria-label="Tamaño en metros cuadrados" />
          <input type="number" min="-5" max="200" value={form.piso} onChange={(e) => set("piso", e.target.value)} className={inputCls} placeholder="Piso (ej: 4)" aria-label="Piso" />
          <input value={form.tipo_cama} maxLength={80} onChange={(e) => set("tipo_cama", e.target.value)} className={inputCls} placeholder="Camas (ej: 1 king + 1 sofá cama)" aria-label="Camas" />
          <input value={form.vista} maxLength={80} onChange={(e) => set("vista", e.target.value)} className={inputCls} placeholder="Vista (ej: al mar)" aria-label="Vista" />
          <input value={form.tipo_bano} maxLength={120} onChange={(e) => set("tipo_bano", e.target.value)} className={inputCls + " col-span-2"} placeholder="Baño (ej: privado con ducha)" aria-label="Baño" />
        </div>
        <textarea value={form.descripcion} maxLength={2000} rows={3} onChange={(e) => set("descripcion", e.target.value)} className={inputCls + " resize-y"} placeholder="Descripción para el cliente: cómo es la habitación, qué la hace especial..." aria-label="Descripción de la habitación" />
      </div>

      {/* Qué incluye */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={subtitulo}>¿Qué incluye?</p>
          <span className="text-[11px] text-muted-foreground">{servicios.size} marcados</span>
        </div>
        {CATALOGO_SERVICIOS.map((cat) => (
          <div key={cat.titulo}>
            <p className="text-[11px] font-medium text-foreground/80 mb-1">{cat.titulo}</p>
            <div className="flex flex-wrap gap-1.5">
              {cat.servicios.map((s) => {
                const activo = servicios.has(s.clave);
                const Icono = s.icono;
                return (
                  <button
                    key={s.clave}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => toggleServicio(s.clave)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      activo ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {activo ? <Check className="w-3 h-3" /> : <Icono className="w-3 h-3" />}
                    {s.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <textarea value={form.comodidades} maxLength={2000} rows={2} onChange={(e) => set("comodidades", e.target.value)} className={inputCls + " resize-y"} placeholder={"Otras cosas que incluye, una por línea:\nKit de playa\nHamaca en el balcón"} aria-label="Otras comodidades" />
      </div>

      {/* Condiciones */}
      <div className="space-y-1.5">
        <p className={subtitulo}>Condiciones</p>
        <textarea value={form.politica_cancelacion} maxLength={3000} rows={2} onChange={(e) => set("politica_cancelacion", e.target.value)} className={inputCls + " resize-y"} placeholder="Política de cancelación propia de esta habitación (si difiere de la del hotel)" aria-label="Política de cancelación de la habitación" />
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Visible y reservable en el sitio</span>
          <input type="checkbox" checked={publicada} onChange={(e) => setPublicada(e.target.checked)} aria-label="Habitación publicada" />
        </label>
        {CONDICIONES_HABITACION.map((c) => (
          <div key={c.clave} className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground">{c.etiqueta}</span>
            <div className="flex rounded-lg border border-border overflow-hidden text-[11px]" role="radiogroup" aria-label={c.etiqueta}>
              {([[true, "Sí"], [false, "No"], [null, "Sin definir"]] as const).map(([valor, texto]) => (
                <button
                  key={texto}
                  type="button"
                  role="radio"
                  aria-checked={condiciones[c.clave] === valor}
                  onClick={() => setCondiciones((prev) => ({ ...prev, [c.clave]: valor }))}
                  className={`px-2.5 py-1 ${condiciones[c.clave] === valor ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground/70">"Sin definir" no se muestra al cliente.</p>
      </div>

      {/* Fotos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={subtitulo}>Fotos de la habitación</p>
          <span className="text-[11px] text-muted-foreground">
            {editando ? fotos.length : pendientes.length}/{MAX_FOTOS}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {editando &&
            fotos.map((img, i) => (
              <div key={img.id_imagen} className="space-y-1">
                <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={resolveFotoUrl(img.url)} alt={img.descripcion ?? ""} className="w-full h-full object-cover" />
                  {i === 0 ? (
                    <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">Portada</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => accionFoto(() => hotelService.editarFotoHabitacion(idHab, img.id_imagen, { portada: true }), "No se pudo cambiar la portada")}
                      className="absolute top-1 left-1 p-1 rounded-full bg-black/60 text-white"
                      aria-label="Usar como portada"
                      title="Usar como portada"
                    >
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => accionFoto(() => hotelService.borrarFotoHabitacion(idHab, img.id_imagen), "No se pudo eliminar la foto")}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                    aria-label="Eliminar foto"
                    title="Eliminar foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <input
                  value={pies[img.id_imagen] ?? img.descripcion ?? ""}
                  maxLength={120}
                  onChange={(e) => setPies((p) => ({ ...p, [img.id_imagen]: e.target.value }))}
                  onBlur={(e) => {
                    const nuevo = e.target.value.trim();
                    if (nuevo !== (img.descripcion ?? "")) {
                      accionFoto(() => hotelService.editarFotoHabitacion(idHab, img.id_imagen, { descripcion: nuevo || null }), "No se pudo guardar el pie de foto");
                    }
                  }}
                  className="w-full rounded-md border border-border bg-input-background px-1.5 py-1 text-[10px]"
                  placeholder="Pie de foto (ej: Baño)"
                  aria-label={`Pie de la foto ${i + 1}`}
                />
              </div>
            ))}
          {!editando &&
            pendientes.map((p, i) => (
              <div key={p.preview} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                <img src={p.preview} alt="" className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">Portada</span>}
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(p.preview);
                    setPendientes((prev) => prev.filter((x) => x !== p));
                  }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                  aria-label="Quitar foto"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          {cupo > 0 && (
            <label className="flex flex-col items-center justify-center gap-1 aspect-square rounded-lg border-2 border-dashed border-border bg-muted/40 cursor-pointer hover:border-primary/40 transition-colors text-muted-foreground text-center px-1">
              {progreso ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-[10px]">Agregar fotos</span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={!!progreso}
                onChange={(e) => {
                  elegirFotos(e.target.files);
                  e.target.value = "";
                }}
                aria-label="Subir fotos de la habitación"
              />
            </label>
          )}
        </div>
        {progreso && <p className="text-[11px] text-muted-foreground">{progreso}</p>}
        <p className="text-[10px] text-muted-foreground/70">
          Puedes elegir varias a la vez (JPG, PNG o WEBP). Sugerencia: cama, baño, vista y zona de estar.
          {!editando && " Se suben al crear la habitación."}
        </p>
      </div>

      <button
        type="submit"
        disabled={guardando || !!progreso}
        className="w-full py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> {guardando ? progreso ?? "Guardando..." : editando ? "Guardar cambios" : "Agregar habitación"}
      </button>
      {tipos.length === 0 && <p className="text-[11px] text-muted-foreground/70">Todavía no hay ningún tipo de habitación registrado en el sistema.</p>}
    </form>
  );
}
