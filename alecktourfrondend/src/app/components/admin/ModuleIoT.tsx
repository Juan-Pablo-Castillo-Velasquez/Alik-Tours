import { AlertTriangle, BatteryMedium, Copy, Gauge, MapPin, Plus, Radio, RefreshCw, Thermometer, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { DispositivoIoT, EstadoDispositivo, iotService, LecturaIoT } from "../../services/iot.service";
import EmptyState from "./ui/EmptyState";
import SectionHeader from "./ui/SectionHeader";

const ESTADO: Record<EstadoDispositivo, { texto: string; clase: string }> = {
  en_linea: { texto: "En línea", clase: "bg-success/15 text-success" },
  inactivo: { texto: "Sin reportar", clase: "bg-warning/15 text-warning" },
  sin_datos: { texto: "Sin datos aún", clase: "bg-muted text-muted-foreground" },
};

/** Cada cuánto se vuelve a consultar el estado (el dispositivo reporta cada pocos segundos). */
export const REFRESCO_MS = 10_000;

function hace(iso: string | null) {
  if (!iso) return "nunca";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function Dato({ icono: Icono, etiqueta, valor }: { icono: typeof Gauge; etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icono className="h-3.5 w-3.5" /> {etiqueta}
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">{valor}</p>
    </div>
  );
}

function TarjetaDispositivo({ d, onCambio }: { d: DispositivoIoT; onCambio: () => void }) {
  const [historial, setHistorial] = useState<LecturaIoT[]>([]);
  const l = d.ultima_lectura;
  useEffect(() => {
    if (!l) return;
    iotService.lecturas(d.id_dispositivo, 30).then((x) => setHistorial([...x].reverse())).catch(() => {});
  }, [d.id_dispositivo, l?.id_lectura]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (v: number | null | undefined, unidad: string, dec = 1) => (v == null ? "—" : `${v.toFixed(dec)} ${unidad}`);
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Radio className="h-5 w-5 text-primary" /> {d.nombre}
          </h3>
          {d.descripcion && <p className="text-sm text-muted-foreground">{d.descripcion}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Último reporte {hace(d.ultima_conexion)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${d.activo ? ESTADO[d.estado].clase : "bg-destructive/10 text-destructive"}`}>
            {d.activo ? ESTADO[d.estado].texto : "Desactivado"}
          </span>
          <button
            type="button"
            onClick={() =>
              iotService
                .cambiarActivo(d.id_dispositivo, !d.activo)
                .then(onCambio)
                .catch((e) => toast.error(e?.message || "No se pudo cambiar"))
            }
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
          >
            {d.activo ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>

      {d.alertas.length > 0 && (
        <ul className="mt-3 space-y-1">
          {d.alertas.map((a) => (
            <li key={a} className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" /> {a}
            </li>
          ))}
        </ul>
      )}

      {l ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Dato icono={Thermometer} etiqueta="Cabina" valor={fmt(l.temperatura_c, "°C")} />
            <Dato icono={Gauge} etiqueta="Velocidad" valor={fmt(l.velocidad_kmh, "km/h", 0)} />
            <Dato icono={Users} etiqueta="Pasajeros" valor={l.pasajeros == null ? "—" : String(l.pasajeros)} />
            <Dato icono={BatteryMedium} etiqueta="Batería" valor={fmt(l.bateria_pct, "%", 0)} />
            <Dato icono={MapPin} etiqueta="Humedad" valor={fmt(l.humedad_pct, "%", 0)} />
          </div>
          {l.latitud != null && l.longitud != null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${l.latitud}&mlon=${l.longitud}#map=16/${l.latitud}/${l.longitud}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <MapPin className="h-4 w-4" /> Ver posición ({l.latitud.toFixed(4)}, {l.longitud.toFixed(4)})
            </a>
          )}
          {historial.length > 1 && (
            <div className="mt-4 h-40" aria-label="Temperatura de cabina en las últimas lecturas">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Temperatura de cabina (últimas {historial.length} lecturas)</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historial.map((h) => ({ hora: new Date(h.recibido_en).toLocaleTimeString("es-CO", { timeStyle: "short" }), t: h.temperatura_c }))}>
                  <XAxis dataKey="hora" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={32} unit="°" />
                  <Tooltip formatter={(v: number) => [`${v} °C`, "Cabina"]} />
                  <Line type="monotone" dataKey="t" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          Todavía no llegan lecturas. Configura la clave en el dispositivo o corre el simulador:{" "}
          <code className="rounded bg-muted px-1">python iot/simulador_traslado.py --clave …</code>
        </p>
      )}
    </article>
  );
}

/** Panel del prototipo IoT: estado y telemetría de los vehículos de traslado. */
export default function ModuleIoT() {
  const [dispositivos, setDispositivos] = useState<DispositivoIoT[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [claveNueva, setClaveNueva] = useState<string | null>(null);

  const cargar = useCallback(() => {
    iotService
      .dispositivos()
      .then(setDispositivos)
      .catch((e) => {
        setDispositivos([]);
        toast.error(e?.message || "No se pudo cargar la telemetría");
      });
  }, []);

  useEffect(() => {
    cargar();
    const t = window.setInterval(cargar, REFRESCO_MS);
    return () => window.clearInterval(t);
  }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2) return;
    try {
      const d = await iotService.crear({ nombre: nombre.trim(), descripcion: descripcion.trim() || undefined });
      setClaveNueva(d.clave);
      setNombre("");
      setDescripcion("");
      cargar();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo registrar el dispositivo");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Telemetría IoT"
        subtitle="Vehículos de traslado: posición, temperatura de cabina, pasajeros y batería, enviados por cada dispositivo."
        action={
          <button type="button" onClick={cargar} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        }
      />

      <form onSubmit={crear} className="grid gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_1.5fr_auto]">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Van 02)" aria-label="Nombre del dispositivo" maxLength={100} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (ruta o vehículo)" aria-label="Descripción del dispositivo" maxLength={255} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> Registrar dispositivo
        </button>
      </form>

      {claveNueva && (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Copia la clave del dispositivo ahora: no se vuelve a mostrar.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-card px-3 py-2 text-xs">{claveNueva}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(claveNueva).then(() => toast.success("Clave copiada"))}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
          </div>
        </div>
      )}

      {dispositivos === null ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted/40" />
      ) : dispositivos.length === 0 ? (
        <EmptyState icon={Radio} title="Sin dispositivos registrados" description="Registra el primer vehículo para recibir su telemetría." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {dispositivos.map((d) => (
            <TarjetaDispositivo key={d.id_dispositivo} d={d} onCambio={cargar} />
          ))}
        </div>
      )}
    </div>
  );
}
