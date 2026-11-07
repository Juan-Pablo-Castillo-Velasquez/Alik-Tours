import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Switch } from "../ui/switch";
import { inputCls, labelCls } from "./types";

export type EstadoServicio = "incluido" | "de_pago" | "no_disponible";
export interface ServicioHotelForm {
  nombre: string;
  estado: EstadoServicio;
  nota: string;
}

export const SERVICIOS_SUGERIDOS = [
  "Wi-Fi", "Piscina", "Restaurante", "Bar", "Gimnasio", "Spa", "Parqueadero", "Recepción 24 horas",
  "Aire acondicionado", "Accesibilidad", "Transporte / traslados", "Servicio a la habitación", "Desayuno",
];

export const FICHA_HOTEL_VACIA = {
  tipo_alojamiento: "", departamento: "", sitio_web: "", latitud: "", longitud: "", fuente_calificacion: "",
  publicado: true,
  hora_checkin: "", hora_checkout: "", politica_entrada_anticipada: "", politica_salida_tardia: "", edad_minima: "",
  politica_ninos: "", politica_mascotas: "", politica_cancelacion: "", condiciones_reserva: "", impuestos_cargos: "",
  restricciones: "", informacion_adicional: "",
  servicios: [] as ServicioHotelForm[],
  /** Servicios guardados antes de existir el estado: solo se sabe que "existen". */
  legado: [] as string[],
  /** Solo se mandan los servicios si el admin los tocó (no se pierde lo anterior). */
  serviciosTocados: false,
};
export type FichaHotel = typeof FICHA_HOTEL_VACIA;

const TEXTOS: [keyof FichaHotel, string, string][] = [
  ["politica_cancelacion", "Política de cancelación", "Plazos y penalidades del hotel"],
  ["condiciones_reserva", "Condiciones de reserva", "Garantías, documentos, depósitos..."],
  ["politica_entrada_anticipada", "Entrada anticipada", "Si se permite y con qué costo"],
  ["politica_salida_tardia", "Salida tardía", "Si se permite y con qué costo"],
  ["politica_ninos", "Niños", "Edades, camas adicionales, costos"],
  ["politica_mascotas", "Mascotas", "Si se admiten y condiciones"],
  ["impuestos_cargos", "Impuestos y cargos", "Ej: IVA para residentes, seguro hotelero"],
  ["restricciones", "Restricciones", ""],
  ["informacion_adicional", "Información adicional", ""],
];

const ESTADOS: { v: EstadoServicio | ""; t: string }[] = [
  { v: "", t: "No informado" },
  { v: "incluido", t: "Incluido" },
  { v: "de_pago", t: "De pago" },
  { v: "no_disponible", t: "No hay" },
];

function Seccion({ titulo, children, abierta = false }: { titulo: string; children: React.ReactNode; abierta?: boolean }) {
  const [open, setOpen] = useState(abierta);
  return (
    <section className="rounded-xl border border-border">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold">
        {titulo} <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-2.5 border-t border-border p-3">{children}</div>}
    </section>
  );
}

/** Secciones extra del formulario de hotel: clasificación y ubicación,
 * horarios y políticas, y servicios con su estado real. */
export default function FichaHotelCampos({ ficha, onChange }: { ficha: FichaHotel; onChange: (f: FichaHotel) => void }) {
  const [otro, setOtro] = useState("");
  const set = (k: keyof FichaHotel, v: unknown) => onChange({ ...ficha, [k]: v });
  const txt = (k: keyof FichaHotel) => ({ value: String(ficha[k] ?? ""), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value) });
  const estadoDe = (nombre: string) => ficha.servicios.find((s) => s.nombre.toLowerCase() === nombre.toLowerCase());
  const setServicio = (nombre: string, estado: EstadoServicio | "", nota?: string) => {
    const resto = ficha.servicios.filter((s) => s.nombre.toLowerCase() !== nombre.toLowerCase());
    const previo = estadoDe(nombre);
    const servicios = estado ? [...resto, { nombre: previo?.nombre ?? nombre, estado, nota: nota ?? previo?.nota ?? "" }] : resto;
    const legado = ficha.legado.filter((l) => l.toLowerCase() !== nombre.toLowerCase());
    onChange({ ...ficha, servicios, legado, serviciosTocados: true });
  };
  const extra = [...ficha.servicios.map((s) => s.nombre), ...ficha.legado];
  const nombres = [...SERVICIOS_SUGERIDOS, ...extra.filter((n, i) => !SERVICIOS_SUGERIDOS.some((x) => x.toLowerCase() === n.toLowerCase()) && extra.indexOf(n) === i)];
  const esLegado = (n: string) => ficha.legado.some((l) => l.toLowerCase() === n.toLowerCase());
  const webInvalida = ficha.sitio_web && !/^https?:\/\/\S+$/.test(ficha.sitio_web);

  return (
    <div className="space-y-2">
      <Seccion titulo="Clasificación, ubicación y publicación">
        <div className="grid grid-cols-2 gap-2.5">
          <label><span className={labelCls}>Tipo de alojamiento</span>
            <select {...txt("tipo_alojamiento")} className={inputCls}>
              <option value="">Sin especificar</option>
              {["Hotel", "Hostal", "Hotel boutique", "Cabaña", "Glamping", "Apartamento", "Finca", "Resort", "Posada"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label><span className={labelCls}>Departamento o región</span><input {...txt("departamento")} maxLength={100} className={inputCls} /></label>
          <label className="col-span-2"><span className={labelCls}>Sitio web</span><input {...txt("sitio_web")} maxLength={255} placeholder="https://..." className={inputCls} />
            {webInvalida && <span className="text-[11px] text-destructive">Debe empezar por http:// o https://</span>}
          </label>
          <label><span className={labelCls}>Latitud</span><input type="number" step="0.000001" min={-90} max={90} {...txt("latitud")} className={inputCls} /></label>
          <label><span className={labelCls}>Longitud</span><input type="number" step="0.000001" min={-180} max={180} {...txt("longitud")} className={inputCls} /></label>
          <label className="col-span-2"><span className={labelCls}>Fuente de la clasificación (estrellas)</span><input {...txt("fuente_calificacion")} maxLength={120} placeholder="Ej: Registro Nacional de Turismo" className={inputCls} /></label>
        </div>
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-medium">Publicado en el sitio</p><p className="text-xs text-muted-foreground">Si lo ocultas, sigue en el panel pero el público no lo ve</p></div>
          <Switch checked={ficha.publicado} onCheckedChange={(v) => set("publicado", v)} />
        </div>
      </Seccion>

      <Seccion titulo="Check-in, check-out y políticas">
        <div className="grid grid-cols-3 gap-2.5">
          <label><span className={labelCls}>Check-in desde</span><input type="time" {...txt("hora_checkin")} className={inputCls} /></label>
          <label><span className={labelCls}>Check-out hasta</span><input type="time" {...txt("hora_checkout")} className={inputCls} /></label>
          <label><span className={labelCls}>Edad mínima</span><input type="number" min={0} max={99} {...txt("edad_minima")} className={inputCls} /></label>
        </div>
        {TEXTOS.map(([k, t, ph]) => (
          <label key={k} className="block"><span className={labelCls}>{t}</span><textarea {...txt(k)} rows={2} maxLength={3000} placeholder={ph} className={inputCls} /></label>
        ))}
      </Seccion>

      <Seccion titulo={`Servicios e instalaciones (${ficha.servicios.length} informados)`}>
        <p className="text-[11px] text-muted-foreground">"No informado" no se le muestra al cliente. Marca "Incluido" solo si está confirmado.</p>
        {ficha.legado.length > 0 && ficha.serviciosTocados && (
          <p className="text-[11px] text-warning">Al guardar, los servicios "disponible" que no confirmes quedan como no informados.</p>
        )}
        <ul className="space-y-1.5">
          {nombres.map((n) => {
            const s = estadoDe(n);
            return (
              <li key={n} className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[150px_1fr]">
                <span className="text-sm">{n}{esLegado(n) && <span className="block text-[10px] text-warning">Registrado como "disponible": confirma si es incluido o de pago</span>}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex overflow-hidden rounded-lg border border-border text-[11px]" role="radiogroup" aria-label={n}>
                    {ESTADOS.map((e) => (
                      <button key={e.v} type="button" role="radio" aria-checked={(s?.estado ?? "") === e.v} onClick={() => setServicio(n, e.v)}
                        className={`px-2 py-1 ${(s?.estado ?? "") === e.v ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"}`}>
                        {e.t}
                      </button>
                    ))}
                  </div>
                  {s && s.estado !== "no_disponible" && (
                    <input value={s.nota} onChange={(e) => setServicio(n, s.estado, e.target.value)} maxLength={150} placeholder={s.estado === "de_pago" ? "Precio o condición" : "Nota (opcional)"} aria-label={`Nota de ${n}`} className="min-w-0 flex-1 rounded-lg border border-border bg-input-background px-2 py-1 text-xs" />
                  )}
                  {s && !SERVICIOS_SUGERIDOS.includes(n) && (
                    <button type="button" onClick={() => setServicio(n, "")} aria-label={`Quitar ${n}`} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <input value={otro} onChange={(e) => setOtro(e.target.value)} maxLength={100} placeholder="Otro servicio (ej: Lavandería)" className={inputCls} />
          <button type="button" disabled={otro.trim().length < 2} onClick={() => { setServicio(otro.trim(), "incluido"); setOtro(""); }} className="flex items-center gap-1 rounded-xl border border-border px-3 text-sm disabled:opacity-40">
            <Plus className="h-4 w-4" /> Agregar
          </button>
        </div>
      </Seccion>
    </div>
  );
}

/** Ficha del formulario → cuerpo para el API (vacíos = null). */
export function fichaAPayload(f: FichaHotel) {
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const t = (v: string) => v.trim() || null;
  return {
    tipo_alojamiento: t(f.tipo_alojamiento), departamento: t(f.departamento), sitio_web: t(f.sitio_web),
    latitud: n(f.latitud), longitud: n(f.longitud), fuente_calificacion: t(f.fuente_calificacion), publicado: f.publicado,
    hora_checkin: f.hora_checkin || null, hora_checkout: f.hora_checkout || null,
    politica_entrada_anticipada: t(f.politica_entrada_anticipada), politica_salida_tardia: t(f.politica_salida_tardia),
    edad_minima: n(f.edad_minima), politica_ninos: t(f.politica_ninos), politica_mascotas: t(f.politica_mascotas),
    politica_cancelacion: t(f.politica_cancelacion), condiciones_reserva: t(f.condiciones_reserva),
    impuestos_cargos: t(f.impuestos_cargos), restricciones: t(f.restricciones), informacion_adicional: t(f.informacion_adicional),
    ...(f.serviciosTocados
      ? { servicios: f.servicios.map((s) => ({ nombre: s.nombre, estado: s.estado, nota: s.nota.trim() || null })) }
      : {}),
  };
}

/** Hotel del API → ficha del formulario. */
export function fichaDesdeHotel(h: Record<string, any>): FichaHotel {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    tipo_alojamiento: s(h.tipo_alojamiento), departamento: s(h.departamento), sitio_web: s(h.sitio_web),
    latitud: s(h.latitud), longitud: s(h.longitud), fuente_calificacion: s(h.fuente_calificacion), publicado: h.publicado !== false,
    hora_checkin: s(h.hora_checkin).slice(0, 5), hora_checkout: s(h.hora_checkout).slice(0, 5),
    politica_entrada_anticipada: s(h.politica_entrada_anticipada), politica_salida_tardia: s(h.politica_salida_tardia),
    edad_minima: s(h.edad_minima), politica_ninos: s(h.politica_ninos), politica_mascotas: s(h.politica_mascotas),
    politica_cancelacion: s(h.politica_cancelacion), condiciones_reserva: s(h.condiciones_reserva),
    impuestos_cargos: s(h.impuestos_cargos), restricciones: s(h.restricciones), informacion_adicional: s(h.informacion_adicional),
    servicios: (h.hotel_caracteristicas ?? [])
      .filter((hc: any) => hc.caracteristica && (hc.estado || hc.disponible === false))
      .map((hc: any) => ({
        nombre: hc.caracteristica.nombre_caracteristica,
        estado: (hc.estado ?? "no_disponible") as EstadoServicio,
        nota: hc.nota ?? "",
      })),
    legado: (h.hotel_caracteristicas ?? [])
      .filter((hc: any) => hc.caracteristica && !hc.estado && hc.disponible !== false)
      .map((hc: any) => hc.caracteristica.nombre_caracteristica),
    serviciosTocados: false,
  };
}
