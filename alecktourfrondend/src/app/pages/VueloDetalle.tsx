import { ArrowLeft, Baby, Briefcase, CalendarDays, Clock, FileText, Info, Loader2, Luggage, Minus, Plane, Plus, ShieldAlert, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { resolveFotoUrl } from "../components/admin/types";
import ResumenCotizacion from "../components/reserva/ResumenCotizacion";
import type { SeleccionProducto } from "../data/reservaTypes";
import { useCotizacion } from "../hooks/useCotizacion";
import { useSeoMeta } from "../hooks/useSeoMeta";
import { ETIQUETA_CLASE, ETIQUETA_TIPO_SERVICIO, ETIQUETA_TRAYECTO, hora, OfertaVuelo, rutaOferta, vueloService } from "../services/vuelo.service";
import { fechaVuelo, pesosVuelo } from "./Vuelos";

function Tramo({ titulo, fecha, horaSalida, fechaLlegada, horaLlegada, desde, hasta }: {
  titulo: string; fecha: string; horaSalida?: string | null; fechaLlegada?: string | null; horaLlegada?: string | null;
  desde: string; hasta: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{titulo}</p>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="text-lg font-bold">{hora(horaSalida) ?? "Hora por confirmar"}</p>
          <p className="text-sm">{desde}</p>
          <p className="text-xs text-muted-foreground">{fechaVuelo(fecha)}</p>
        </div>
        <Plane className="h-5 w-5 text-primary" />
        <div className="text-right">
          <p className="text-lg font-bold">{hora(horaLlegada) ?? "—"}</p>
          <p className="text-sm">{hasta}</p>
          {fechaLlegada && <p className="text-xs text-muted-foreground">{fechaVuelo(fechaLlegada)}</p>}
        </div>
      </div>
    </div>
  );
}

function Contador({ label, ayuda, valor, min, max, onChange, icono: Icono }: { label: string; ayuda?: string; valor: number; min: number; max: number; onChange: (n: number) => void; icono: typeof User }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2">
        <Icono className="h-4 w-4 text-primary" />
        <div><p className="text-sm font-semibold">{label}</p>{ayuda && <p className="text-[11px] text-muted-foreground">{ayuda}</p>}</div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(valor - 1)} disabled={valor <= min} aria-label={`Quitar ${label.toLowerCase()}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"><Minus className="h-4 w-4" /></button>
        <span className="w-5 text-center font-bold">{valor}</span>
        <button type="button" onClick={() => onChange(valor + 1)} disabled={valor >= max} aria-label={`Agregar ${label.toLowerCase()}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function VueloDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [o, setO] = useState<OfertaVuelo | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [adultos, setAdultos] = useState(1);
  const [ninos, setNinos] = useState(0);
  const [infantes, setInfantes] = useState(0);

  useEffect(() => {
    vueloService.obtener(Number(id)).then(setO).catch(() => setNoEncontrado(true));
  }, [id]);

  useSeoMeta({
    title: o ? `Vuelo ${o.origen_ciudad} - ${o.destino_ciudad}` : "Vuelo",
    description: o ? `${o.titulo}: ${rutaOferta(o)} desde ${pesosVuelo(o.precio_adulto)} por adulto.` : "Oferta aérea de Alik Tours",
    path: `/vuelos/${id}`,
  });

  const sillas = o?.cupos_disponibles ?? 9;
  const seleccion: SeleccionProducto | null = useMemo(
    () => (o && o.venta_independiente ? { tipo_producto: "vuelo", id_oferta_vuelo: o.id_oferta, adultos, ninos, infantes } : null),
    [o, adultos, ninos, infantes],
  );
  const { cotizacion, cargando, error } = useCotizacion(seleccion);

  if (noEncontrado) {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Vuelo no encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Puede que la oferta ya no esté publicada.</p>
          <Link to="/vuelos" className="mt-4 inline-block font-semibold text-primary underline">← Ver vuelos disponibles</Link>
        </main>
      </div>
    );
  }
  if (!o) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></div>;
  }

  const agotado = o.cupos_disponibles === 0;
  const origen = `${o.origen_ciudad}${o.origen_iata ? ` (${o.origen_iata})` : ""}`;
  const destino = `${o.destino_ciudad}${o.destino_iata ? ` (${o.destino_iata})` : ""}`;
  const datos: [typeof Plane, string, string | null | undefined][] = [
    [Plane, "Aerolínea", [o.aerolinea, o.numero_vuelo].filter(Boolean).join(" ") || "Por confirmar"],
    [Briefcase, "Clase", o.clase ? ETIQUETA_CLASE[o.clase] : null],
    [Info, "Tipo de servicio", o.tipo_servicio ? ETIQUETA_TIPO_SERVICIO[o.tipo_servicio] : null],
    [Clock, "Duración", o.duracion_estimada],
    [Plane, "Escalas", o.escalas == null ? null : o.escalas === 0 ? "Vuelo directo" : `${o.escalas}${o.aeropuertos_conexion ? ` (${o.aeropuertos_conexion})` : ""}`],
    [Luggage, "Equipaje de mano", o.equipaje_mano],
    [Luggage, "Equipaje de bodega", o.equipaje_bodega],
    [FileText, "Documentos", o.documentos_requeridos],
  ];
  const condiciones: [string, string | null | undefined][] = [
    ["Cambios", o.condiciones_cambio],
    ["Cancelación", o.condiciones_cancelacion],
    ["Restricciones", o.restricciones],
    ["Condiciones comerciales", o.condiciones_comerciales],
    ["Horarios de conexión", o.horarios_conexion],
    ["Información adicional", o.informacion_adicional],
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/vuelos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Todos los vuelos</Link>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {o.imagen_url && <img src={resolveFotoUrl(o.imagen_url)} alt="" className="h-56 w-full rounded-2xl object-cover" />}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{ETIQUETA_TRAYECTO[o.tipo_trayecto]}</p>
              <h1 className="text-3xl font-bold">{o.titulo}</h1>
              <p className="mt-1 text-muted-foreground">{rutaOferta(o)}</p>
            </div>
            {o.descripcion && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{o.descripcion}</p>}

            <section className="space-y-3">
              <h2 className="text-lg font-bold">Itinerario</h2>
              <Tramo titulo="Ida" fecha={o.fecha_salida} horaSalida={o.hora_salida} fechaLlegada={o.fecha_llegada} horaLlegada={o.hora_llegada} desde={origen} hasta={destino} />
              {o.fecha_regreso && (
                <Tramo titulo="Regreso" fecha={o.fecha_regreso} horaSalida={o.hora_regreso} fechaLlegada={o.fecha_llegada_regreso} horaLlegada={o.hora_llegada_regreso} desde={destino} hasta={origen} />
              )}
              {(o.origen_aeropuerto || o.destino_aeropuerto) && (
                <p className="text-xs text-muted-foreground">
                  {o.origen_aeropuerto && `Sale de ${o.origen_aeropuerto}`}{o.origen_aeropuerto && o.destino_aeropuerto ? " · " : ""}{o.destino_aeropuerto && `Llega a ${o.destino_aeropuerto}`}
                </p>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">Detalles del vuelo</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                {datos.filter(([, , v]) => v).map(([Icono, t, v]) => (
                  <div key={t} className="flex items-start gap-2.5 rounded-xl border border-border p-3">
                    <Icono className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t}</dt><dd className="text-sm font-semibold">{v}</dd></div>
                  </div>
                ))}
              </dl>
            </section>

            {condiciones.some(([, v]) => v) && (
              <section>
                <h2 className="mb-3 text-lg font-bold">Condiciones</h2>
                <dl className="space-y-3">
                  {condiciones.filter(([, v]) => v).map(([t, v]) => (
                    <div key={t}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}</dt><dd className="mt-0.5 whitespace-pre-line text-sm">{v}</dd></div>
                  ))}
                </dl>
              </section>
            )}

            <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Oferta gestionada por Alik Tours con lo que confirmó la aerolínea; no es disponibilidad en tiempo real. Los requisitos de viaje (documentos, visas) dependen de tu destino: confírmalos con las autoridades correspondientes.
            </p>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Por adulto</p>
              <p className="text-3xl font-bold text-primary">{pesosVuelo(o.precio_adulto)}</p>
              <p className="text-[11px] text-muted-foreground">
                {o.precio_nino != null ? `Niño ${pesosVuelo(o.precio_nino)}` : "Niños pagan tarifa de adulto"}
                {o.precio_infante != null ? ` · Infante ${o.precio_infante === 0 ? "sin costo" : pesosVuelo(o.precio_infante)}` : ""}
                {o.cargos_adicionales > 0 ? ` · + ${pesosVuelo(o.cargos_adicionales)} de cargos por pasajero` : ""}
              </p>
              {o.vigencia_hasta && <p className="mt-1 text-[11px] text-muted-foreground">Tarifa vigente hasta {fechaVuelo(o.vigencia_hasta)}</p>}
              {o.venta_independiente && !agotado ? (
                <>
                  <div className="mt-3 divide-y divide-border border-t border-border">
                    <Contador label="Adultos" valor={adultos} min={1} max={Math.max(1, Math.min(9, sillas - ninos))} onChange={setAdultos} icono={User} />
                    <Contador label="Niños" ayuda="2 a 11 años" valor={ninos} min={0} max={Math.max(0, Math.min(8, sillas - adultos))} onChange={setNinos} icono={User} />
                    {o.precio_infante != null ? (
                      <Contador label="Infantes" ayuda="Menores de 2, en brazos" valor={infantes} min={0} max={adultos} onChange={setInfantes} icono={Baby} />
                    ) : (
                      <p className="py-2 text-[11px] text-muted-foreground">Para viajar con bebés, consulta con un asesor.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!!error || cargando}
                    onClick={() => navigate(`/vuelos/${o.id_oferta}/reservar?adultos=${adultos}&ninos=${ninos}&infantes=${infantes}`)}
                    className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Reservar este vuelo
                  </button>
                </>
              ) : (
                <p className="mt-3 rounded-xl bg-muted p-3 text-sm font-semibold text-muted-foreground">
                  {agotado ? "Agotado" : "Este vuelo se vende dentro de un paquete"}
                </p>
              )}
              {o.cupos_disponibles != null && o.cupos_disponibles > 0 && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarDays className="h-3 w-3" /> {o.cupos_disponibles} silla(s) disponibles</p>
              )}
            </section>
            {o.venta_independiente && !agotado && <ResumenCotizacion cotizacion={cotizacion} cargando={cargando} error={error} titulo="Precio para tu grupo" compacto />}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
