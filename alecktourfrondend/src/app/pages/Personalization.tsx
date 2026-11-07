import { CalendarDays, Info, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import {
  PaqueteDetalleResponse,
  PaqueteServicioDetalle,
  paqueteService,
} from "../services/paquete.service";

// Antes esta página leía de data/packages.ts (datos de ejemplo: hoteles,
// vuelos y "clases de entretenimiento" Premium/Confort/Esencial que NO
// existen en la base de datos real) usando un id de tipo string ("1",
// "2", "3"). PackageDetail.tsx en cambio ya enlaza aquí con el id_paquete
// numérico real -- así que un cliente podía ver contenido totalmente
// fabricado, de un destino distinto, para un paquete real. Ahora se
// consume GET /paquetes/{id}/detalle igual que PackageDetail.tsx.
//
// La base de datos no tiene ningún concepto de "clase de entretenimiento":
// lo único real es la lista de servicios vinculados al paquete
// (paquete_servicios), cada uno con una categoría real y una bandera
// incluido/opcional. Por eso esta página deja de simular una selección
// que en realidad no se guarda en ningún lado (no existe ningún endpoint
// para eso hoy) y en su lugar muestra, de verdad, las actividades
// opcionales del paquete agrupadas por su categoría real -- el
// itinerario completo (incluido + opcional) ya vive en PackageDetail.tsx.
function agruparPorCategoria(servicios: PaqueteServicioDetalle[]) {
  const grupos = new Map<string, PaqueteServicioDetalle[]>();
  for (const s of servicios) {
    const key = s.categoria ?? "Otras actividades";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(s);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default function Personalization() {
  const { id } = useParams();
  const [pkg, setPkg] = useState<PaqueteDetalleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    paqueteService
      .getDetalle(parseInt(id))
      .then(setPkg)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
          <div className="h-10 w-2/3 bg-muted rounded-lg mb-4" />
          <div className="h-5 w-1/2 bg-muted rounded-lg mb-10" />
          <div className="h-64 bg-card border border-border rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound || !pkg) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Paquete no encontrado
          </h1>
          <Link to="/packages" className="text-primary hover:underline font-medium">
            ← Volver a explorar paquetes
          </Link>
        </div>
      </div>
    );
  }

  const destino = pkg.destinos[0] ?? pkg.hoteles[0]?.ciudad ?? pkg.nombre_paquete;
  const opcionales = pkg.servicios.filter((s) => !s.incluido);
  const grupos = agruparPorCategoria(opcionales);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-gold" />
            <h1 className="text-4xl font-bold text-foreground">
              Personaliza tu experiencia
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Actividades opcionales para tu viaje a{" "}
            <span className="font-semibold text-primary">{destino}</span>
          </p>
        </div>

        {/* Actividades opcionales reales del paquete */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
          <div className="flex items-start gap-3 mb-6">
            <Info className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Actividades opcionales de {pkg.nombre_paquete}
              </h2>
              <p className="text-muted-foreground">
                No vienen incluidas en el precio base del paquete: las eliges al reservar
                y se suman al total, por persona.
              </p>
            </div>
          </div>

          {grupos.length > 0 ? (
            <div className="space-y-8">
              {grupos.map(([categoria, servicios]) => (
                <div key={categoria}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-primary mb-3">
                    {categoria}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {servicios.map((s) => (
                      <div
                        key={s.id_servicio}
                        className="flex items-start gap-4 p-5 rounded-xl border-2 border-border"
                      >
                        <CalendarDays className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">
                              {s.nombre_servicio}
                            </p>
                            {s.dia_actividad != null && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                Día {s.dia_actividad}
                              </span>
                            )}
                          </div>
                          {s.descripcion && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {s.descripcion}
                            </p>
                          )}
                          {s.capacidad_maxima != null && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Hasta {s.capacidad_maxima}{" "}
                              {s.capacidad_maxima === 1 ? "persona" : "personas"}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Este paquete ya incluye todas sus actividades en el precio base -- no tiene
              actividades opcionales configuradas por ahora.
            </p>
          )}
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-primary/5 rounded-2xl p-6 border border-primary/15">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">¿Cómo funciona?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Estas actividades se coordinan directamente con tu asesor al reservar.</li>
                <li>• El precio final puede variar según temporada y disponibilidad real.</li>
                <li>
                  • El itinerario completo del paquete (incluido y opcional) está en la
                  ficha del paquete.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA real: no existe un checkout a nivel de paquete (ver
            PackageDetail.tsx), así que se lleva al cliente a la ficha
            completa del paquete, donde sí están los enlaces reales de
            reserva por hotel. */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            to={`/package/${pkg.id_paquete}/reservar`}
            className="flex-1 text-center py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:shadow-xl hover:brightness-110 transition-all duration-300"
          >
            Reservar y elegir opcionales
          </Link>
          <Link
            to="/packages"
            className="px-8 py-4 border-2 border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
          >
            Explorar otros paquetes
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
