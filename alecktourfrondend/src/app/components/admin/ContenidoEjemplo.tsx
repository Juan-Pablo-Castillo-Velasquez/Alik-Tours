import { FlaskConical, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { comunidadService } from "../../services/comunidad.service";

/** Carga o quita el contenido de ejemplo (50 publicaciones y 18 reseñas) para
 * una demostración. Solo lo ve un admin: para los demás el estado responde 403
 * y el bloque no se muestra. Todo sale con la etiqueta "Ejemplo" y no cuenta
 * en la calificación. */
export default function ContenidoEjemplo() {
  const [estado, setEstado] = useState<{ publicaciones: number; resenas: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const refrescar = () =>
    comunidadService
      .estadoContenidoEjemplo()
      .then(setEstado)
      .catch(() => setEstado(null));

  useEffect(() => {
    refrescar();
  }, []);

  if (!estado) return null;
  const cargado = estado.publicaciones + estado.resenas > 0;

  const ejecutar = async (accion: "cargar" | "quitar") => {
    if (accion === "quitar" && !window.confirm("¿Quitar todo el contenido de ejemplo del sitio?")) return;
    setOcupado(true);
    try {
      if (accion === "cargar") {
        const r = await comunidadService.cargarContenidoEjemplo();
        toast.success(`Listo: ${r.publicaciones} publicaciones y ${r.resenas} reseñas de ejemplo`);
      } else {
        await comunidadService.quitarContenidoEjemplo();
        toast.success("Contenido de ejemplo eliminado");
      }
      await refrescar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <FlaskConical className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-foreground">Contenido de ejemplo para demostraciones</p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {cargado
            ? `En el sitio hay ${estado.publicaciones} publicaciones y ${estado.resenas} reseñas de ejemplo. Se ven con la etiqueta "Ejemplo" y no cuentan en la calificación.`
            : 'Carga 50 publicaciones con fotos y conversaciones y 18 reseñas, todas con la etiqueta "Ejemplo". No cuentan en la calificación.'}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => ejecutar("cargar")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
        >
          {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {cargado ? "Recargar ejemplos" : "Cargar ejemplos"}
        </button>
        {cargado && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => ejecutar("quitar")}
            className="px-3 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted disabled:opacity-60"
          >
            Quitar ejemplos
          </button>
        )}
      </div>
    </section>
  );
}
