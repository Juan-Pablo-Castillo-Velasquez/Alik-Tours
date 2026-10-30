import { useEffect, useState } from "react";
import {
  Search, Trash2, Pencil, PlusCircle, Package, CheckCircle, CreditCard, Calendar, Hotel,
  Eye, MapPin, Plane, Sparkles, Users, ImageIcon, ImagePlus, X, Loader2,
} from "lucide-react";
import { Paquete, Reserva, HotelData, inputCls, labelCls, resolveFotoUrl } from "./types";
import { paqueteService, PaqueteDetalleResponse } from "../../services/paquete.service";
import { servicioService, ServicioResponse } from "../../services/servicio.service";
import AdminModal from "./ui/AdminModal";
import StatCard from "./ui/StatCard";
import SectionHeader from "./ui/SectionHeader";
import StatusBadge from "./ui/StatusBadge";
import EmptyState from "./ui/EmptyState";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import { Switch } from "../ui/switch";

interface HotelSeleccionado { id_hotel: number; noches_incluidas: string }
interface ServicioSeleccionado { id_servicio: number; dia_actividad: string }

const EMPTY_FORM = {
  nombre_paquete: "", descripcion: "", duracion_dias: "1", precio_base: "", activo: true,
  // Ciudad de SALIDA del viaje (vuelo/transporte incluido) — distinta de la
  // ciudad de destino, que ya se calculaba de los hoteles/servicios
  // vinculados. Sin esto no había forma de avisar que un paquete armado
  // para salir de Bogotá no le sirve tal cual a un cliente de Barranquilla.
  ciudad_salida: "",
  // Condiciones propias del paquete (requisitos, cambios, no reembolsables,
  // documentos). Opcional: la ficha pública omite la sección si está vacía.
  condiciones: "",
  // paquete_hotel ya existía en el modelo (lo usa la página pública de
  // detalle vía GET /paquetes/{id}/detalle) pero no había forma de
  // editarlo desde el admin — todo paquete nuevo quedaba sin ningún hotel
  // real asociado, lo que permitía combinaciones ilógicas en Crear Reserva
  // (un paquete de una ciudad con un hotel de otra, sin ninguna relación).
  hoteles: [] as HotelSeleccionado[],
  // Mismo hueco que tenían los hoteles: paquete_servicios ("qué incluye")
  // ya existía y ya se leía en la página pública, pero no había forma de
  // editarlo desde el admin.
  servicios: [] as ServicioSeleccionado[],
};

type EstadoFilter = "todos" | "activo" | "inactivo";
const ESTADOS: EstadoFilter[] = ["todos", "activo", "inactivo"];

interface Props {
  paquetes: Paquete[];
  // Opcional para no romper otros usos del componente — mismo patrón que
  // `clientes?` en ModuleEmpresas.tsx. Con esto se calcula un rendimiento
  // real por paquete sin pedir ningún endpoint nuevo.
  reservas?: Reserva[];
  // Opcional: lista real de hoteles para vincular al crear/editar un
  // paquete (ver EMPTY_FORM.hoteles arriba).
  hoteles?: HotelData[];
  onDelete: (id: number) => void;
  onSubmit: (data: any, id?: number) => Promise<void>;
  loading: boolean;
}

export default function ModulePaquetes({ paquetes, reservas = [], hoteles = [], onDelete, onSubmit, loading }: Props) {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [cargandoHoteles, setCargandoHoteles] = useState(false);
  // Portada del paquete (opcional) -- antes Paquete no tenía ningún campo
  // de imagen propio, ver POST /paquetes/{id}/imagen en reserva_route.py.
  // Mismo patrón que imagenFile/imagenPreview en ModuleHoteles.tsx.
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);

  // Catálogo completo de servicios reales (GET /servicios/, ya existía
  // para la página pública) — se carga una sola vez y de ahí se arma el
  // picker de "qué incluye" el paquete, mismo patrón que `hoteles`.
  const [catalogoServicios, setCatalogoServicios] = useState<ServicioResponse[]>([]);
  useEffect(() => {
    servicioService.getAll().then(setCatalogoServicios).catch(() => {});
  }, []);

  // Pop-up de detalle (mismo nivel que el de Reservas): ciudad de salida,
  // destino real, hoteles y servicios incluidos — toda la info comercial
  // de un paquete en un solo lugar en vez de repartida entre la tabla y el
  // formulario de edición.
  const [detailPaquete, setDetailPaquete] = useState<Paquete | null>(null);
  const [detalle, setDetalle] = useState<PaqueteDetalleResponse | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState("");
  // Galería de fotos (distinta de la portada, que se sube en el modal de
  // crear/editar) -- antes no existía ninguna forma de subir más de una
  // foto real por paquete, ver POST/DELETE /paquetes/{id}/galeria.
  const [subiendoFotoGaleria, setSubiendoFotoGaleria] = useState(false);
  const [galeriaMsg, setGaleriaMsg] = useState("");

  function abrirDetalle(p: Paquete) {
    setDetailPaquete(p);
    setDetalle(null);
    setDetalleError("");
    setGaleriaMsg("");
    setDetalleLoading(true);
    paqueteService.getDetalle(p.id_paquete)
      .then(setDetalle)
      .catch((e: any) => setDetalleError(e?.message || "No se pudo cargar el detalle del paquete"))
      .finally(() => setDetalleLoading(false));
  }

  async function handleSubirFotoGaleriaPaquete(file: File | undefined) {
    if (!file || !detailPaquete) return;
    setGaleriaMsg("");
    setSubiendoFotoGaleria(true);
    try {
      await paqueteService.subirFotoGaleria(detailPaquete.id_paquete, file);
      const actualizado = await paqueteService.getDetalle(detailPaquete.id_paquete);
      setDetalle(actualizado);
    } catch (err: any) {
      setGaleriaMsg(err?.message || "No se pudo subir la foto");
    } finally {
      setSubiendoFotoGaleria(false);
    }
  }

  async function handleBorrarFotoGaleriaPaquete(id_imagen: number) {
    if (!detailPaquete) return;
    try {
      await paqueteService.borrarFotoGaleria(detailPaquete.id_paquete, id_imagen);
      const actualizado = await paqueteService.getDetalle(detailPaquete.id_paquete);
      setDetalle(actualizado);
    } catch (err: any) {
      setGaleriaMsg(err?.message || "No se pudo eliminar la foto");
    }
  }

  // Rendimiento real por paquete (reservas y ventas, excluyendo canceladas)
  // calculado en el cliente a partir de `reservas`, que el dashboard ya
  // carga para otros módulos — no requiere ningún endpoint nuevo.
  // PaqueteRepository.delete ya calculaba un reservas_count parecido en el
  // backend, pero solo para bloquear el borrado; nunca se mostraba en la UI.
  const rendimientoPorPaquete = new Map<number, { total: number; activas: number; ingresos: number }>();
  for (const r of reservas) {
    const prev = rendimientoPorPaquete.get(r.id_paquete) ?? { total: 0, activas: 0, ingresos: 0 };
    prev.total += 1;
    if (r.estado !== "cancelada") {
      prev.activas += 1;
      prev.ingresos += r.precio_total ?? 0;
    }
    rendimientoPorPaquete.set(r.id_paquete, prev);
  }

  // KPIs reales — nada de porcentajes ni cifras inventadas, todo calculado
  // sobre el arreglo `paquetes` que ya llega del backend.
  const activos = paquetes.filter(p => p.activo);
  const precios = paquetes.map(p => p.precio_base).filter((n): n is number => n != null);
  const duraciones = paquetes.map(p => p.duracion_dias).filter((n): n is number => n != null);
  const precioPromedio = precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : 0;
  const duracionPromedio = duraciones.length ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length : 0;

  const filtered = paquetes.filter(p => {
    const matchEstado = estadoFilter === "todos" || (estadoFilter === "activo" ? p.activo : !p.activo);
    const matchSearch = p.nombre_paquete.toLowerCase().includes(search.toLowerCase());
    return matchEstado && matchSearch;
  });

  const { page, pageCount, slice, setPage } = usePagination(filtered, 8);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
    setImagenFile(null);
    setImagenPreview(null);
    setModalOpen(true);
  }

  const onSeleccionarImagenPaquete = (file: File | undefined) => {
    if (!file) return;
    setImagenFile(file);
    // Preview local vía createObjectURL -- nunca se sube nada hasta el
    // submit real del formulario (mismo patrón que ModuleHoteles.tsx).
    setImagenPreview(URL.createObjectURL(file));
  };

  function openEdit(p: Paquete) {
    setEditingId(p.id_paquete);
    setForm({
      nombre_paquete: p.nombre_paquete, descripcion: p.descripcion ?? "",
      duracion_dias: String(p.duracion_dias ?? 1), precio_base: String(p.precio_base ?? ""),
      activo: p.activo, ciudad_salida: p.ciudad_salida ?? "", condiciones: p.condiciones ?? "", hoteles: [], servicios: [],
    });
    setMsg(null);
    setImagenFile(null);
    setImagenPreview(resolveFotoUrl(p.imagen_url) ?? null);
    setModalOpen(true);

    // Carga los hoteles Y servicios YA vinculados a este paquete
    // (paquete_hotel / paquete_servicios) desde el endpoint que ya existía
    // para la página pública de detalle — evita pedir un endpoint nuevo
    // solo para leer lo mismo. El formulario se abre de inmediato (sin
    // bloquear en la carga) y los checkboxes se marcan en cuanto llega la
    // respuesta.
    setCargandoHoteles(true);
    paqueteService.getDetalle(p.id_paquete)
      .then((detalle) => {
        setForm((prev) => ({
          ...prev,
          hoteles: detalle.hoteles.map((h) => ({
            id_hotel: h.id_hotel,
            noches_incluidas: h.noches_incluidas != null ? String(h.noches_incluidas) : "",
          })),
          servicios: detalle.servicios.map((s) => ({
            id_servicio: s.id_servicio,
            dia_actividad: s.dia_actividad != null ? String(s.dia_actividad) : "",
          })),
        }));
      })
      .catch(() => { /* si falla, el admin igual puede editar el resto y volver a marcar hoteles/servicios */ })
      .finally(() => setCargandoHoteles(false));
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
    setImagenFile(null);
    setImagenPreview(null);
  }

  function toggleHotel(id_hotel: number) {
    setForm((prev) => {
      const yaEsta = prev.hoteles.some((h) => h.id_hotel === id_hotel);
      return {
        ...prev,
        hoteles: yaEsta
          ? prev.hoteles.filter((h) => h.id_hotel !== id_hotel)
          : [...prev.hoteles, { id_hotel, noches_incluidas: "" }],
      };
    });
  }

  function setNochesHotel(id_hotel: number, noches_incluidas: string) {
    setForm((prev) => ({
      ...prev,
      hoteles: prev.hoteles.map((h) => (h.id_hotel === id_hotel ? { ...h, noches_incluidas } : h)),
    }));
  }

  function toggleServicio(id_servicio: number) {
    setForm((prev) => {
      const yaEsta = prev.servicios.some((s) => s.id_servicio === id_servicio);
      return {
        ...prev,
        servicios: yaEsta
          ? prev.servicios.filter((s) => s.id_servicio !== id_servicio)
          : [...prev.servicios, { id_servicio, dia_actividad: "" }],
      };
    });
  }

  function setDiaServicio(id_servicio: number, dia_actividad: string) {
    setForm((prev) => ({
      ...prev,
      servicios: prev.servicios.map((s) => (s.id_servicio === id_servicio ? { ...s, dia_actividad } : s)),
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await onSubmit(
        {
          ...form,
          duracion_dias: parseInt(form.duracion_dias),
          precio_base: parseFloat(form.precio_base),
          ciudad_salida: form.ciudad_salida.trim() || null,
          condiciones: form.condiciones.trim() || null,
          hoteles: form.hoteles.map((h) => ({
            id_hotel: h.id_hotel,
            noches_incluidas: h.noches_incluidas ? parseInt(h.noches_incluidas, 10) : null,
          })),
          servicios: form.servicios.map((s) => ({
            id_servicio: s.id_servicio,
            dia_actividad: s.dia_actividad ? parseInt(s.dia_actividad, 10) : null,
            incluido: true,
          })),
          // imagenFile viaja aparte del body JSON (el endpoint de imagen es
          // multipart, ver reserva_route.py) -- Admindashboard.tsx lo separa
          // del resto antes de mandar el PUT/POST normal, mismo patrón que
          // submitHotel.
          imagenFile,
        },
        editingId ?? undefined
      );
      closeModal();
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Error al guardar paquete" });
    }
  };

  // Reactivación rápida desde la tabla: PUT /paquetes/{id} usa
  // exclude_unset (ver update_paquete en reserva_route.py), así que mandar
  // solo { activo: true } reactiva sin tocar el resto de campos y sin pasar
  // por el modal — a diferencia de desactivar, reactivar nunca choca con
  // ninguna dependencia, así que no hace falta confirmación.
  async function handleReactivar(p: Paquete) {
    try {
      await onSubmit({ activo: true }, p.id_paquete);
    } catch {
      // El toast de error ya lo muestra el handler en Admindashboard.tsx
    }
  }

  const thCls = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Paquetes"
        subtitle={`${paquetes.length} paquete${paquetes.length === 1 ? "" : "s"} · ${activos.length} activo${activos.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-[#A13B55] text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-primary/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Nuevo paquete
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total"              value={paquetes.length}                          icon={Package} />
        <StatCard label="Activos"            value={activos.length}                           icon={CheckCircle} gradient="from-emerald-500 to-emerald-600" />
        <StatCard label="Precio promedio"    value={`$${Math.round(precioPromedio).toLocaleString()}`} icon={CreditCard} gradient="from-[#C9A227] to-[#C9A227]" />
        <StatCard label="Duración promedio"  value={`${duracionPromedio.toFixed(1)} días`}     icon={Calendar}    gradient="from-[#A13B55] to-[#A13B55]" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm outline-none
              bg-card text-foreground placeholder:text-muted-foreground/60
              focus:ring-2 focus:ring-primary/40 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border">
          {ESTADOS.map(e => (
            <button
              key={e}
              onClick={() => setEstadoFilter(e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                estadoFilter === e ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className={thCls}>Paquete</th>
                <th className={thCls}>Salida</th>
                <th className={thCls}>Duración</th>
                <th className={thCls}>Precio</th>
                <th className={thCls}>Rendimiento</th>
                <th className={thCls}>Estado</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {slice.map(p => (
                <tr key={p.id_paquete} className="hover:bg-accent transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-foreground">{p.nombre_paquete}</p>
                    {p.descripcion && (
                      <p className="text-[11px] text-muted-foreground truncate max-w-[280px]">{p.descripcion}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {p.ciudad_salida ? (
                      <span className="flex items-center gap-1"><Plane className="w-3 h-3" /> {p.ciudad_salida}</span>
                    ) : (
                      <span className="text-muted-foreground/50">Sin definir</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {p.duracion_dias} día{p.duracion_dias === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-foreground whitespace-nowrap">
                    ${p.precio_base?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {(() => {
                      const r = rendimientoPorPaquete.get(p.id_paquete);
                      if (!r || r.activas === 0) {
                        return <span className="text-muted-foreground/60">Sin reservas</span>;
                      }
                      return (
                        <div>
                          <p className="font-medium text-foreground">{r.activas} reserva{r.activas === 1 ? "" : "s"}</p>
                          <p className="text-[11px] text-muted-foreground">${r.ingresos.toLocaleString()}</p>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {!p.activo && (
                        <button
                          onClick={() => handleReactivar(p)}
                          className="px-2.5 py-1 text-[11px] font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all"
                        >
                          Reactivar
                        </button>
                      )}
                      <button
                        onClick={() => abrirDetalle(p)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                        title="Ver detalle comercial"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {p.activo && (
                        <button
                          onClick={() => onDelete(p.id_paquete)}
                          className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                          title="Desactivar paquete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
        </>
      ) : (
        <EmptyState
          icon={Search}
          title="No se encontraron paquetes"
          description={paquetes.length === 0 ? "Crea el primer paquete para empezar." : "Prueba con otro término de búsqueda o filtro."}
        />
      )}

      <AdminModal
        open={modalOpen}
        onOpenChange={(o) => { if (!o) closeModal(); else setModalOpen(true); }}
        title={editingId ? "Editar paquete" : "Crear paquete"}
        maxWidth="sm:max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {msg && (
            <div className="p-3 rounded-xl text-sm font-medium bg-destructive/10 text-destructive">
              {msg.text}
            </div>
          )}
          <div>
            <label className={labelCls}>Nombre del paquete</label>
            <input value={form.nombre_paquete} onChange={e => setForm({ ...form, nombre_paquete: e.target.value })}
              className={inputCls} required placeholder="Magia del Caribe" />
          </div>

          {/* Portada del paquete (opcional) -- antes Paquete no tenía
              ningún campo de imagen propio, la ficha pública siempre usaba
              la foto del hotel incluido (ver POST /paquetes/{id}/imagen). */}
          <div>
            <label className={labelCls}>Foto de portada (opcional)</label>
            <label className="mt-1.5 flex items-center justify-center h-32 rounded-xl border-2 border-dashed border-border bg-muted/40 cursor-pointer overflow-hidden hover:border-primary/40 transition-colors">
              {imagenPreview ? (
                <img src={imagenPreview} alt="Vista previa" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-xs">Sin foto — se usa la del hotel incluido</span>
                </div>
              )}
              <input
                type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => onSeleccionarImagenPaquete(e.target.files?.[0])}
              />
            </label>
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
              className={inputCls + " resize-none"} rows={3} placeholder="Descripción del paquete..." />
          </div>
          <div>
            <label className={labelCls}>Condiciones (opcional)</label>
            <textarea value={form.condiciones} onChange={e => setForm({ ...form, condiciones: e.target.value })}
              className={inputCls + " resize-none"} rows={3} maxLength={5000}
              placeholder="Documentos requeridos, cambios, servicios no reembolsables..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Duración (días)</label>
              <input type="number" min="1" value={form.duracion_dias}
                onChange={e => setForm({ ...form, duracion_dias: e.target.value })}
                className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Precio base ($)</label>
              <input type="number" min="0" step="1000" value={form.precio_base}
                onChange={e => setForm({ ...form, precio_base: e.target.value })}
                className={inputCls} required placeholder="1200000" />
            </div>
          </div>

          {/* Ciudad de SALIDA del viaje (vuelo/transporte incluido) —
              distinta del destino, que se calcula solo de los hoteles y
              servicios vinculados. Sin esto no había forma de avisar que
              un paquete armado para salir de Bogotá no le sirve tal cual a
              un cliente que vive en Barranquilla. */}
          <div>
            <label className={labelCls}>Ciudad de salida del viaje</label>
            <div className="relative">
              <Plane className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={form.ciudad_salida} onChange={e => setForm({ ...form, ciudad_salida: e.target.value })}
                className={inputCls + " pl-9"} placeholder="Ej: Bogotá (opcional)" />
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Desde dónde sale el vuelo/transporte incluido. El destino se toma de los hoteles/servicios que agregues abajo.
            </p>
          </div>

          {/* Hoteles vinculados (paquete_hotel) — antes esta tabla no tenía
              ningún punto de escritura en el admin: un paquete nuevo quedaba
              siempre sin hotel real asociado, lo que permitía armar
              combinaciones ilógicas en Crear Reserva (un paquete de Bogotá
              con un hotel de Barranquilla, sin ninguna relación real entre
              los dos). */}
          <div>
            <label className={labelCls}>
              Hoteles incluidos {cargandoHoteles && <span className="text-muted-foreground font-normal">(cargando...)</span>}
            </label>
            {hoteles.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 mt-1">No hay hoteles registrados todavía.</p>
            ) : (
              <div className="mt-1.5 max-h-44 overflow-y-auto space-y-1.5 border border-border rounded-xl p-2.5">
                {hoteles.map((h) => {
                  const seleccionado = form.hoteles.find((fh) => fh.id_hotel === h.id_hotel);
                  return (
                    <div key={h.id_hotel} className="flex items-center gap-2.5">
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!seleccionado}
                          onChange={() => toggleHotel(h.id_hotel)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer flex-shrink-0"
                        />
                        <Hotel className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-foreground truncate">
                          {h.nombre_hotel} <span className="text-muted-foreground">· {h.ciudad}</span>
                        </span>
                      </label>
                      {seleccionado && (
                        <input
                          type="number"
                          min="1"
                          placeholder="noches"
                          value={seleccionado.noches_incluidas}
                          onChange={(e) => setNochesHotel(h.id_hotel, e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-border rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Servicios incluidos (paquete_servicios / "qué incluye") — mismo
              hueco que tenían los hoteles: la tabla ya existía y ya se
              mostraba en la página pública del paquete, pero no había
              forma de editarla desde el admin. Cada servicio ya trae su
              propia capacidad máxima ("para cuántas personas"), así que no
              hace falta pedir ese dato de nuevo acá. */}
          <div>
            <label className={labelCls}>
              Qué incluye (servicios) {cargandoHoteles && <span className="text-muted-foreground font-normal">(cargando...)</span>}
            </label>
            {catalogoServicios.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 mt-1">No hay servicios registrados todavía.</p>
            ) : (
              <div className="mt-1.5 max-h-44 overflow-y-auto space-y-1.5 border border-border rounded-xl p-2.5">
                {catalogoServicios.map((s) => {
                  const seleccionado = form.servicios.find((fs) => fs.id_servicio === s.id_servicio);
                  return (
                    <div key={s.id_servicio} className="flex items-center gap-2.5">
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!seleccionado}
                          onChange={() => toggleServicio(s.id_servicio)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer flex-shrink-0"
                        />
                        <Sparkles className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-foreground truncate">
                          {s.nombre_servicio}{" "}
                          <span className="text-muted-foreground">· hasta {s.capacidad_maxima} personas</span>
                        </span>
                      </label>
                      {seleccionado && (
                        <input
                          type="number"
                          min="1"
                          placeholder="día"
                          value={seleccionado.dia_actividad}
                          onChange={(e) => setDiaServicio(s.id_servicio, e.target.value)}
                          title="Día del itinerario (opcional)"
                          className="w-16 px-2 py-1 text-xs border border-border rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Toggle de estado — antes el form lo guardaba en memoria
              (EMPTY_FORM.activo) pero nunca se mostraba ningún control para
              cambiarlo; un admin no podía desactivar/reactivar un paquete
              desde el formulario, solo con el botón de eliminar. */}
          <div className="flex items-center justify-between px-1 py-1">
            <div>
              <p className="text-sm font-medium text-foreground">Paquete activo</p>
              <p className="text-xs text-muted-foreground">Visible y reservable en el sitio público</p>
            </div>
            <Switch checked={form.activo} onCheckedChange={v => setForm({ ...form, activo: v })} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-primary to-[#A13B55] text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 text-sm">
            {loading ? "Guardando..." : editingId ? "Guardar cambios" : "Crear paquete"}
          </button>
        </form>
      </AdminModal>

      {/* Pop-up de detalle comercial — mismo nivel que el de Reservas:
          ciudad de salida, destino real, hoteles y qué incluye, todo junto
          en vez de repartido entre la tabla y el formulario de edición. */}
      <AdminModal
        open={!!detailPaquete}
        onOpenChange={(o) => { if (!o) { setDetailPaquete(null); setDetalle(null); } }}
        title={detailPaquete?.nombre_paquete ?? "Detalle del paquete"}
        description="Información comercial completa del paquete."
        maxWidth="sm:max-w-lg"
      >
        {detalleLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
        ) : detalleError ? (
          <p className="text-sm text-destructive text-center py-8">{detalleError}</p>
        ) : detalle && detailPaquete ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Plane className="w-3 h-3" /> Salida
                </p>
                <p className="text-sm font-medium text-foreground">{detailPaquete.ciudad_salida || "Sin definir"}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Destino
                </p>
                <p className="text-sm font-medium text-foreground truncate">
                  {detalle.destinos.length > 0 ? detalle.destinos.join(", ") : (detalle.hoteles[0]?.ciudad ?? "Sin definir")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" /> {detailPaquete.duracion_dias} día{detailPaquete.duracion_dias === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="w-3.5 h-3.5" /> ${detailPaquete.precio_base?.toLocaleString()}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Hotel className="w-3.5 h-3.5" /> Hoteles incluidos
              </p>
              {detalle.hoteles.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">Este paquete todavía no tiene ningún hotel vinculado.</p>
              ) : (
                <div className="space-y-1.5">
                  {detalle.hoteles.map((h) => (
                    <div key={h.id_hotel} className="flex items-center gap-2.5 p-2 border border-border rounded-lg bg-card">
                      <Hotel className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{h.nombre_hotel}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[h.ciudad, h.pais].filter(Boolean).join(", ")}
                          {h.noches_incluidas ? ` · ${h.noches_incluidas} noche${h.noches_incluidas > 1 ? "s" : ""} incluidas` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Qué incluye
              </p>
              {detalle.servicios.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">Este paquete todavía no tiene ningún servicio vinculado.</p>
              ) : (
                <div className="space-y-1.5">
                  {detalle.servicios.map((s) => (
                    <div key={s.id_servicio} className="flex items-center gap-2.5 p-2 border border-border rounded-lg bg-card">
                      <Sparkles className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {s.nombre_servicio} {s.dia_actividad ? <span className="text-muted-foreground font-normal">· día {s.dia_actividad}</span> : null}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          {s.categoria && <span>{s.categoria} · </span>}
                          {s.capacidad_maxima != null && (
                            <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> hasta {s.capacidad_maxima} personas</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Galería de fotos -- distinta de la portada (que se sube en
                el modal de crear/editar): antes no existía ninguna forma
                de subir más de una foto real por paquete, ver
                POST/DELETE /paquetes/{id}/galeria en reserva_route.py. */}
            <div className="border-t border-border pt-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Galería de fotos
              </p>
              {galeriaMsg && <p className="text-xs text-destructive mb-1.5">{galeriaMsg}</p>}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {detalle.imagenes.map((img) => (
                  <div key={img.id_imagen} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                    <img src={resolveFotoUrl(img.url)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleBorrarFotoGaleriaPaquete(img.id_imagen)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="flex flex-col items-center justify-center gap-1 aspect-square rounded-lg border-2 border-dashed border-border bg-muted/40 cursor-pointer hover:border-primary/40 transition-colors text-muted-foreground">
                  {subiendoFotoGaleria ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="w-4 h-4" />
                      <span className="text-[10px]">Agregar</span>
                    </>
                  )}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={subiendoFotoGaleria}
                    onChange={(e) => handleSubirFotoGaleriaPaquete(e.target.files?.[0])}
                  />
                </label>
              </div>
              {detalle.imagenes.length === 0 && (
                <p className="text-[11px] text-muted-foreground/70">Este paquete todavía no tiene ninguna foto en su galería.</p>
              )}
            </div>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
