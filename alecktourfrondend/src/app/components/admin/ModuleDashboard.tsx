import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { limpiarCacheApi } from "../../api/v1/api";
import { useAuth } from "../../context/AuthContext";
import { dashboardService, type DashboardResumen, type ResumenEmpleado } from "../../services/dashboard.service";
import { reservaDetailService, type ActividadRecienteItem } from "../../services/reserva.service";
import DashboardAdmin from "./DashboardAdmin";
import DashboardEmpleado from "./DashboardEmpleado";
import type { Module } from "./types";

interface Props {
  setActiveModule: (m: Module) => void;
  /** Abre directamente el detalle de esa reserva dentro del módulo Reservas. */
  onVerReserva: (id: number) => void;
  /** Navega a un módulo con un filtro de estado ya aplicado (p. ej. Pagos
   * filtrado por "pendiente"), ver ModuleReservas/ModulePagos.estadoInicial. */
  onFiltrarModulo: (m: Module, estado?: string) => void;
  /** true = quien entra es un asesor (rol "empleado" sin "admin"): ve su
   * escritorio de trabajo (DashboardEmpleado) en vez del comercial. */
  soloEmpleado?: boolean;
}

// Carga los datos del dashboard y decide qué vista mostrar: la comercial
// del administrador (DashboardAdmin) o el escritorio del asesor
// (DashboardEmpleado). Ambas cifras salen de /api/dashboard/*.
export default function ModuleDashboard({ setActiveModule, onVerReserva, onFiltrarModulo, soloEmpleado = false }: Props) {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [resumenEmpleado, setResumenEmpleado] = useState<ResumenEmpleado | null>(null);
  const [actividad, setActividad] = useState<ActividadRecienteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  const cargar = (forzar = false) => {
    if (forzar) {
      limpiarCacheApi();
      setActualizando(true);
    }
    dashboardService
      .getResumen()
      .then((r) => {
        setResumen(r);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false);
        setActualizando(false);
      });
    reservaDetailService.getActividadReciente(soloEmpleado ? 15 : 12).then(setActividad).catch(() => {});
    // No crítico: si falla, el escritorio del asesor muestra lo general.
    if (soloEmpleado) dashboardService.getResumenEmpleado().then(setResumenEmpleado).catch(() => {});
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloEmpleado]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando el dashboard">
        <div className="h-48 animate-pulse rounded-3xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (error || !resumen) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">No se pudo cargar el resumen. Revisa tu conexión e intenta de nuevo.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            cargar(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" /> Reintentar
        </button>
      </div>
    );
  }

  const nombreUsuario = usuario?.username?.split("@")[0];
  const comunes = {
    resumen,
    actividad,
    nombreUsuario,
    actualizando,
    onActualizar: () => cargar(true),
    setActiveModule,
    onVerReserva,
    onFiltrarModulo,
  };

  return soloEmpleado ? <DashboardEmpleado {...comunes} resumenEmpleado={resumenEmpleado} /> : <DashboardAdmin {...comunes} />;
}
