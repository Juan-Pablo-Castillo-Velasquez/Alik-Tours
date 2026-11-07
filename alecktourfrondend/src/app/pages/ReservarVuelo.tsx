import { ArrowLeft, CheckCircle2, Loader2, Plane } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast, Toaster } from "sonner";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import PagoDeReserva from "../components/payment/PagoDeReserva";
import ResumenCotizacion from "../components/reserva/ResumenCotizacion";
import { TERMINOS_VERSION } from "../content/terminos";
import { useAuth } from "../context/AuthContext";
import type { SeleccionProducto, ViajeroInput } from "../data/reservaTypes";
import { useCotizacion } from "../hooks/useCotizacion";
import { clienteService } from "../services/cliente.service";
import { nuevoClientMsgId } from "../services/mensajeChat.service";
import { reservaService } from "../services/reserva.service";
import { hora, OfertaVuelo, rutaOferta, vueloService } from "../services/vuelo.service";
import { fechaVuelo } from "./Vuelos";

type Pasajero = ViajeroInput & { clave: string };
const HOY = new Date().toISOString().slice(0, 10);
const campo = "w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground";

function entero(v: string | null, min: number, max: number, defecto: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : defecto;
}

/** Reservar un vuelo independiente: pasajeros (datos completos, los pide la
 * aerolínea), revisión con el precio del backend y pago. */
export default function ReservarVuelo() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [o, setO] = useState<OfertaVuelo | null>(null);
  const adultos = entero(params.get("adultos"), 1, 9, 1);
  const ninos = entero(params.get("ninos"), 0, 8, 0);
  const infantes = Math.min(entero(params.get("infantes"), 0, 9, 0), adultos);
  const [pasajeros, setPasajeros] = useState<Pasajero[]>(() => [
    ...Array.from({ length: adultos }, (_, i) => ({ clave: `a${i}`, tipo: "adulto" as const, es_titular: i === 0 })),
    ...Array.from({ length: ninos }, (_, i) => ({ clave: `n${i}`, tipo: "nino" as const })),
    ...Array.from({ length: infantes }, (_, i) => ({ clave: `i${i}`, tipo: "infante" as const })),
  ].map((p) => ({ ...p, nombres: "", apellidos: "", fecha_nacimiento: "", tipo_documento: p.tipo === "adulto" ? "CC" : "TI", numero_documento: "", nacionalidad: "Colombiana" })));
  const [solicitudes, setSolicitudes] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [creando, setCreando] = useState(false);
  const [reserva, setReserva] = useState<{ id: number; total: number; pagado: number } | null>(null);
  const [celular, setCelular] = useState<string | null>(null);
  const clave = useRef(nuevoClientMsgId());

  useEffect(() => {
    vueloService.obtener(Number(id)).then((v) => {
      if (!v.venta_independiente) {
        toast.error("Este vuelo solo se vende dentro de un paquete.");
        navigate(`/vuelos/${id}`);
        return;
      }
      setO(v);
    }).catch(() => navigate("/vuelos"));
  }, [id, navigate]);

  useEffect(() => {
    if (!usuario?.id_cliente) return;
    clienteService.getById(usuario.id_cliente).then((c) => {
      setCelular(c.celular ?? null);
      setPasajeros((ps) => ps.map((p, i) => (i === 0 && !p.nombres ? { ...p, nombres: c.nombre ?? "", apellidos: c.apellido ?? "", numero_documento: c.cedula ?? "", fecha_nacimiento: (c as { fecha_nacimiento?: string }).fecha_nacimiento ?? "" } : p)));
    }).catch(() => {});
  }, [usuario?.id_cliente]);

  const seleccion: SeleccionProducto | null = useMemo(
    () => (o && !reserva ? { tipo_producto: "vuelo", id_oferta_vuelo: o.id_oferta, adultos, ninos, infantes } : null),
    [o, reserva, adultos, ninos, infantes],
  );
  const { cotizacion, cargando, error } = useCotizacion(seleccion);

  const incompleto = pasajeros.findIndex((p) => !p.nombres.trim() || !p.apellidos.trim() || !p.fecha_nacimiento || !String(p.numero_documento ?? "").trim());
  const setP = (i: number, k: keyof ViajeroInput, v: string) => setPasajeros((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  async function confirmar() {
    if (!usuario?.id_cliente || !o || !cotizacion) return;
    if (incompleto >= 0) {
      toast.error(`Completa los datos del pasajero ${incompleto + 1}`);
      return;
    }
    if (!acepta) {
      toast.error("Debes aceptar los términos y condiciones.");
      return;
    }
    setCreando(true);
    try {
      const r = await reservaService.create({
        id_cliente: usuario.id_cliente,
        tipo_producto: "vuelo",
        id_oferta_vuelo: o.id_oferta,
        adultos,
        ninos,
        infantes,
        viajeros: pasajeros.map(({ clave: _c, ...p }) => ({
          ...p,
          nombres: p.nombres.trim(),
          apellidos: p.apellidos.trim(),
          numero_documento: String(p.numero_documento ?? "").trim(),
          nacionalidad: p.nacionalidad?.trim() || null,
        })),
        solicitudes_especiales: solicitudes.trim() || null,
        terminos_version: TERMINOS_VERSION,
        clave_idempotencia: clave.current,
        precio_esperado: cotizacion.total,
      });
      setReserva({ id: r.id_reserva, total: r.precio_total ?? cotizacion.total, pagado: r.total_pagado ?? 0 });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear la reserva");
    } finally {
      setCreando(false);
    }
  }

  if (!o) return <div className="min-h-screen bg-background"><Navbar /><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Toaster position="top-center" richColors />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link to={`/vuelos/${o.id_oferta}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver al vuelo</Link>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Reservar vuelo</p>
          <h1 className="text-2xl font-bold">{rutaOferta(o)}</h1>
          <p className="text-sm text-muted-foreground">
            Ida {fechaVuelo(o.fecha_salida)}{hora(o.hora_salida) ? ` · ${hora(o.hora_salida)}` : ""}
            {o.fecha_regreso ? ` · Regreso ${fechaVuelo(o.fecha_regreso)}${hora(o.hora_regreso) ? ` · ${hora(o.hora_regreso)}` : ""}` : ""}
            {o.aerolinea ? ` · ${o.aerolinea}` : ""}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {reserva ? (
              <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <p className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-5 w-5" /> Tu reserva de vuelo #{reserva.id} quedó registrada (pendiente de pago).
                </p>
                <p className="text-xs text-muted-foreground">La agencia confirma los datos con la aerolínea y te envía el tiquete cuando esté emitido.</p>
                <PagoDeReserva idReserva={reserva.id} total={reserva.total} totalPagado={reserva.pagado} celularCliente={celular} />
                <button type="button" onClick={() => navigate("/profile", { state: { tab: "reservas" } })} className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">
                  Pagar después — ver mis reservas
                </button>
              </section>
            ) : (
              <>
                <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                  <h2 className="flex items-center gap-2 font-bold"><Plane className="h-5 w-5 text-primary" /> Pasajeros</h2>
                  <p className="text-xs text-muted-foreground">
                    Escribe los datos tal como aparecen en el documento con el que va a viajar cada pasajero.
                    {o.documentos_requeridos ? ` Documento que pide la aerolínea: ${o.documentos_requeridos}.` : ""} Solo los ve el equipo de la agencia.
                  </p>
                  {pasajeros.map((p, i) => (
                    <fieldset key={p.clave} className="rounded-xl border border-border p-3">
                      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pasajero {i + 1} · {p.tipo === "adulto" ? "Adulto" : p.tipo === "nino" ? "Niño" : "Infante"}{p.es_titular ? " (titular)" : ""}
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={p.nombres} onChange={(e) => setP(i, "nombres", e.target.value)} maxLength={100} placeholder="Nombres *" aria-label={`Nombres del pasajero ${i + 1}`} className={campo} />
                        <input value={p.apellidos} onChange={(e) => setP(i, "apellidos", e.target.value)} maxLength={100} placeholder="Apellidos *" aria-label={`Apellidos del pasajero ${i + 1}`} className={campo} />
                        <label className="text-xs text-muted-foreground">Fecha de nacimiento *
                          <input type="date" max={HOY} value={p.fecha_nacimiento ?? ""} onChange={(e) => setP(i, "fecha_nacimiento", e.target.value)} aria-label={`Fecha de nacimiento del pasajero ${i + 1}`} className={campo} />
                        </label>
                        <label className="text-xs text-muted-foreground">Nacionalidad
                          <input value={p.nacionalidad ?? ""} onChange={(e) => setP(i, "nacionalidad", e.target.value)} maxLength={60} className={campo} />
                        </label>
                        <select value={p.tipo_documento ?? "CC"} onChange={(e) => setP(i, "tipo_documento", e.target.value)} aria-label={`Tipo de documento del pasajero ${i + 1}`} className={campo}>
                          <option value="CC">Cédula de ciudadanía</option>
                          <option value="TI">Tarjeta de identidad</option>
                          <option value="RC">Registro civil</option>
                          <option value="CE">Cédula de extranjería</option>
                          <option value="PA">Pasaporte</option>
                        </select>
                        <input value={p.numero_documento ?? ""} onChange={(e) => setP(i, "numero_documento", e.target.value.replace(/[^A-Za-z0-9.\- ]/g, ""))} maxLength={30} placeholder="Número de documento *" aria-label={`Documento del pasajero ${i + 1}`} className={campo} />
                      </div>
                    </fieldset>
                  ))}
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Solicitudes especiales (opcional)</span>
                    <textarea value={solicitudes} onChange={(e) => setSolicitudes(e.target.value)} maxLength={2000} rows={2} placeholder="Ej: asistencia en aeropuerto, comida especial..." className={campo} />
                    <span className="text-[11px] text-muted-foreground">Las gestiona la agencia con la aerolínea; no se garantizan hasta que te las confirmen.</span>
                  </label>
                </section>

                {(o.condiciones_cambio || o.condiciones_cancelacion || o.restricciones) && (
                  <section className="rounded-2xl border border-border bg-card p-5 text-sm">
                    <h2 className="mb-2 font-bold">Condiciones de la tarifa</h2>
                    {o.condiciones_cambio && <p><b>Cambios:</b> {o.condiciones_cambio}</p>}
                    {o.condiciones_cancelacion && <p className="mt-1"><b>Cancelación:</b> {o.condiciones_cancelacion}</p>}
                    {o.restricciones && <p className="mt-1"><b>Restricciones:</b> {o.restricciones}</p>}
                  </section>
                )}

                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" />
                  <span>Acepto los <Link to="/terms" target="_blank" className="font-semibold text-primary underline">términos y condiciones</Link> y las condiciones de esta tarifa.</span>
                </label>
                <button type="button" onClick={confirmar} disabled={creando || !cotizacion || !!error || !acepta} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
                  {creando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar reserva
                </button>
              </>
            )}
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <ResumenCotizacion cotizacion={reserva ? null : cotizacion} cargando={cargando} error={reserva ? null : error} titulo={reserva ? `Reserva #${reserva.id}` : "Resumen de tu vuelo"} />
            {reserva && <p className="mt-2 rounded-xl bg-muted/50 p-3 text-sm">Total: <b>${Math.round(reserva.total).toLocaleString("es-CO")}</b></p>}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
