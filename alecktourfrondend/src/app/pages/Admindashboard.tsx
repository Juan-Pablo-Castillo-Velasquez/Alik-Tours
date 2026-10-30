import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  PlusCircle, Hotel, Package, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/v1/api";
import { Reserva, HotelData, Paquete, Cliente, Empleado, Pago, Usuario, Rol, Module } from "../components/admin/types";
import ModuleDashboard from "../components/admin/ModuleDashboard";
import ModuleReservas from "../components/admin/ModuleReservas";
import ModuleCancelaciones from "../components/admin/ModuleCancelaciones";
import ModuleCrearReserva from "../components/admin/ModuleCrearReserva";
import { getLocalCache, setLocalCache } from "../utils/localCache";
import ModuleHoteles from "../components/admin/ModuleHoteles";
import ModulePaquetes from "../components/admin/ModulePaquetes";
import ModuleClientes from "../components/admin/ModuleClientes";
import ModuleUsuarios from "../components/admin/ModuleUsuarios";
import ModuleRoles from "../components/admin/ModuleRoles";
import ModulePagos, { type MetodoPago } from "../components/admin/ModulePagos";
import ModuleActividad from "../components/admin/ModuleActividad";
import ModuleConfiguracion from "../components/admin/ModuleConfiguracion";
import ModuleMiCuenta from "../components/admin/ModuleMiCuenta";
import AdminSidebar, { MODULOS_EMPLEADO } from "../components/admin/AdminSidebar";
import AdminHeader from "../components/admin/AdminHeader";
import AdminFooter from "../components/admin/AdminFooter";
import ConfirmDialog from "../components/admin/ui/ConfirmDialog";
import type { QuickAction } from "../components/admin/ui/QuickActions";
import { usuarioAdminService, type PermisoResponse, type RolConPermisosResponse } from "../services/usuarioAdmin.service";
import { solicitudCancelacionService, type SolicitudCancelacionResponse } from "../services/solicitudCancelacion.service";
import { reservaDetailService, type ActividadRecienteItem } from "../services/reserva.service";
import ModuleNotificaciones from "../components/admin/ModuleNotificaciones";
import { notificacionService, type NotificacionItem } from "../services/notificacion.service";
import ModuleEmpresas from "../components/admin/ModuleEmpresas";
import { empresaService, type SolicitudCorporativa } from "../services/empresa.service";
import ModuleBanners from "../components/admin/ModuleBanners";
import ModuleComunidad from "../components/admin/ModuleComunidad";
import { bannerService, type Banner, type BannerFormData } from "../services/banner.service";
import ModuleTemas from "../components/admin/ModuleTemas";
import ModuleMensajes from "../components/admin/ModuleMensajes";
import { temaService, type Tema, type TemaFormData } from "../services/tema.service";
import { useTema } from "../context/TemaContext";
import { hotelService } from "../services/hotel.service";
import { paqueteService } from "../services/paquete.service";

type PendingDelete =
  | { kind: "reserva"; id: number; label: string }
  | { kind: "hotel"; id: number; label: string }
  | { kind: "paquete"; id: number; label: string }
  | { kind: "cliente"; id: number; label: string }
  | { kind: "usuario"; id: number; label: string }
  | { kind: "rol"; id: number; label: string }
  | { kind: "pago"; id: number; label: string }
  | { kind: "empresa"; id: number; label: string }
  | { kind: "banner"; id: number; label: string }
  | { kind: "tema"; id: number; label: string };

export default function AdminDashboard() {
  const { usuario, logout, isAdmin, isEmpleado, updateUsuario } = useAuth();
  const { refrescarTemaActivo } = useTema();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("admin-theme") === "dark");

  const [reservas,  setReservas]  = useState<Reserva[]>([]);
  const [hoteles,   setHoteles]   = useState<HotelData[]>([]);
  const [paquetes,  setPaquetes]  = useState<Paquete[]>([]);
  const [clientes,  setClientes]  = useState<Cliente[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [pagos,     setPagos]     = useState<Pago[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [usuarios,  setUsuarios]  = useState<Usuario[]>([]);
  const [roles,     setRoles]     = useState<Rol[]>([]);
  // Catálogo fijo de permisos que el backend conoce (ver Permiso en
  // auth_model.py / GET /api/permisos) -- se carga una sola vez, igual que
  // el resto de listados de referencia del panel.
  const [permisos,  setPermisos]  = useState<PermisoResponse[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudCancelacionResponse[]>([]);
  const [actividadReciente, setActividadReciente] = useState<ActividadRecienteItem[]>([]);
  const [actividadLimit, setActividadLimit] = useState(50);
  const [actividadLoading, setActividadLoading] = useState(false);
  const [actividadLoadingMore, setActividadLoadingMore] = useState(false);
  // true cuando la última carga trajo menos ítems que el límite pedido —
  // ya no queda más historial real por traer, no tiene sentido seguir
  // ofreciendo "Cargar más".
  const [actividadAgotado, setActividadAgotado] = useState(false);
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [notificacionesLoading, setNotificacionesLoading] = useState(false);
  const [solicitudesCorporativas, setSolicitudesCorporativas] = useState<SolicitudCorporativa[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);

  // Conteo real de notificaciones no leídas (cancelaciones, contacto,
  // corporativo, pagos — ver Notificacion en notificacion_model.py),
  // derivado del mismo arreglo que alimenta el módulo — igual criterio que
  // pendingCancelaciones, una sola fuente de verdad.
  const notificacionesNoLeidas = notificaciones.filter(n => !n.leido).length;

  // Derivado del listado completo de solicitudes (una sola fuente de
  // verdad) en vez de un fetch aparte solo para el contador — la campana
  // de notificaciones y el módulo de Cancelaciones ya no pueden desincronizarse.
  const pendingCancelaciones = solicitudes.filter(s => s.estado === "pendiente").length;

  // "Panel recortado solo para empleado" (brief) -- true únicamente para
  // quien tiene el rol "empleado" pero NO "admin". Un usuario con ambos
  // roles sigue viendo el panel completo de admin, sin recortar nada.
  const soloEmpleado = isEmpleado && !isAdmin;

  // Red de seguridad: si por cualquier camino (deep-link interno, estado
  // viejo en memoria) un empleado recortado terminara con un módulo fuera
  // de su allowlist activo, lo manda de vuelta al Dashboard en vez de
  // dejarlo en un módulo que ni siquiera está en su menú.
  useEffect(() => {
    if (soloEmpleado && !MODULOS_EMPLEADO.includes(activeModule)) {
      setActiveModule("dashboard");
    }
  }, [soloEmpleado, activeModule]);

  const [confirmDelete, setConfirmDelete] = useState<PendingDelete | null>(null);

  // Deep-link desde el Dashboard ("Reservas próximas" / "Actividad
  // reciente") hacia el detalle real de una reserva dentro del módulo
  // Reservas — ver ModuleReservas.reservaIdInicial.
  const [reservaParaAbrir, setReservaParaAbrir] = useState<number | null>(null);
  const verReserva = (id: number) => {
    setReservaParaAbrir(id);
    setActiveModule("reservas");
  };

  // Mismo mecanismo, para las tarjetas de KPI del Dashboard (sección 3 del
  // plan de mejora): clic navega al módulo real con el filtro de estado ya
  // aplicado, en vez de solo cambiar de pestaña y dejar que el admin lo
  // vuelva a elegir manualmente.
  const [estadoReservaInicial, setEstadoReservaInicial] = useState<string | null>(null);
  const [estadoPagoInicial, setEstadoPagoInicial] = useState<string | null>(null);
  const irAModuloConFiltro = (mod: Module, estado?: string) => {
    if (mod === "reservas") setEstadoReservaInicial(estado ?? null);
    if (mod === "pagos") setEstadoPagoInicial(estado ?? null);
    setActiveModule(mod);
  };

  // Deep-links entre módulos relacionados (brief: "en las reservas ver
  // pagos que lleve, ver reserva, cosas asi") -- mismo mecanismo que
  // `verReserva`/`irAModuloConFiltro` arriba, uno por cada botón real que
  // ModuleReservas.tsx / ModulePagos.tsx / ModuleClientes.tsx exponen.
  const [clienteIdFiltroReservas, setClienteIdFiltroReservas] = useState<number | null>(null);
  const verReservasDeCliente = (idCliente: number) => {
    setClienteIdFiltroReservas(idCliente);
    setActiveModule("reservas");
  };

  const [clienteIdFiltroPagos, setClienteIdFiltroPagos] = useState<number | null>(null);
  const verPagosDeCliente = (idCliente: number) => {
    setClienteIdFiltroPagos(idCliente);
    setActiveModule("pagos");
  };

  const [reservaIdFiltroPagos, setReservaIdFiltroPagos] = useState<number | null>(null);
  const verPagosDeReserva = (idReserva: number) => {
    setReservaIdFiltroPagos(idReserva);
    setActiveModule("pagos");
  };

  const [clienteIdParaMensajes, setClienteIdParaMensajes] = useState<number | null>(null);
  const verMensajesDeCliente = (idCliente: number) => {
    setClienteIdParaMensajes(idCliente);
    setActiveModule("mensajes");
  };

  // ─── Dark mode via clase en <html> ───────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("admin-theme", dark ? "dark" : "light");
  }, [dark]);

  // Deja entrar tanto a admin como a empleado (asesor) -- el panel de
  // adentro (soloEmpleado más abajo) decide qué tanto ve cada uno.
  useEffect(() => { if (!isAdmin && !isEmpleado) navigate("/"); }, [isAdmin, isEmpleado]);

  // Antes cada dataset se pedía solo al entrar a su pestaña (ej. "clientes"
  // y "paquetes" no se cargaban al abrir el Dashboard), así que el
  // Dashboard podía mostrar "0 clientes" / "0 paquetes" en la primera
  // visita hasta pasar por esas pestañas. Ahora se cargan todos una sola
  // vez al entrar al panel: el Dashboard queda correcto desde el primer
  // render y el buscador global del header tiene datos reales desde ya.
  useEffect(() => {
    if (!isAdmin && !isEmpleado) return;
    fetchReservas();
    fetchHoteles();
    fetchPaquetes();
    fetchClientes();
    fetchEmpleados();
    fetchPagos();
    fetchMetodosPago();
    fetchUsuarios();
    fetchPermisos();
    fetchSolicitudes();
    fetchActividad(actividadLimit);
    fetchNotificaciones();
    fetchEmpresas();
    fetchBanners();
    fetchTemas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isEmpleado]);

  const fetchReservas  = async () => { try { setReservas(await apiFetch<Reserva[]>("/reservas?limit=100"));      } catch { /* no crítico */ } };
  // TTL de 120s: mismo valor que usa el backend para cachear estas listas en
  // Redis (GET /hoteles, /clientes) — no tiene sentido que el navegador
  // guarde una copia "más fresca" que la que el propio backend serviría.
  const ADMIN_CACHE_TTL = 120;
  const fetchHoteles   = async () => {
    const cached = getLocalCache<HotelData[]>("admin_cache_hoteles");
    if (cached) setHoteles(cached);
    try {
      const fresh = await apiFetch<HotelData[]>("/hoteles/?limit=300");
      setHoteles(fresh);
      setLocalCache("admin_cache_hoteles", fresh, ADMIN_CACHE_TTL);
    } catch { /* no crítico */ }
  };
  // incluir_inactivos=true: el admin necesita ver y poder reactivar los
  // paquetes desactivados (ver PaqueteRepository.get_all), a diferencia del
  // sitio público que solo debe listar los activos.
  const fetchPaquetes  = async () => {
    const cached = getLocalCache<Paquete[]>("admin_cache_paquetes");
    if (cached) setPaquetes(cached);
    try {
      const fresh = await apiFetch<Paquete[]>("/paquetes?limit=300&incluir_inactivos=true");
      setPaquetes(fresh);
      setLocalCache("admin_cache_paquetes", fresh, ADMIN_CACHE_TTL);
    } catch { /* no crítico */ }
  };
  const fetchClientes  = async () => {
    const cached = getLocalCache<Cliente[]>("admin_cache_clientes");
    if (cached) setClientes(cached);
    try {
      const fresh = await apiFetch<Cliente[]>("/clientes?limit=300");
      setClientes(fresh);
      setLocalCache("admin_cache_clientes", fresh, ADMIN_CACHE_TTL);
    } catch { /* no crítico */ }
  };
  const fetchEmpleados = async () => { try { setEmpleados(await apiFetch<Empleado[]>("/empleados?limit=100"));   } catch { /* no crítico */ } };
  const fetchPagos     = async () => { try { setPagos(await apiFetch<Pago[]>("/pagos?limit=300"));               } catch { /* no crítico */ } };
  const fetchMetodosPago = async () => { try { setMetodosPago(await apiFetch<MetodoPago[]>("/metodos-pago"));    } catch { /* no crítico */ } };
  const fetchUsuarios  = async () => {
    try {
      const [u, r] = await Promise.all([usuarioAdminService.getAll(), usuarioAdminService.getRoles()]);
      setUsuarios(u); setRoles(r);
    } catch { /* no crítico */ }
  };
  // Catálogo de permisos para el módulo "Roles y permisos" -- fijo (no
  // cambia por acción del admin, solo agregando una fila al catálogo en el
  // backend), se pide una sola vez igual que roles/metodosPago.
  const fetchPermisos = async () => {
    try { setPermisos(await usuarioAdminService.getPermisos()); } catch { /* no crítico */ }
  };

  const createRol = async (nombre: string) => {
    setLoading(true);
    try {
      await usuarioAdminService.createRol(nombre);
      await fetchUsuarios(); // el mismo fetch ya trae usuarios + roles juntos
      toast.success("Rol creado correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear el rol");
      throw e;
    } finally { setLoading(false); }
  };

  const deleteRol = (id: number) => setConfirmDelete({ kind: "rol", id, label: "este rol" });

  // Los permisos de UN rol se piden recién al abrir su modal en
  // ModuleRoles.tsx (no de entrada para todos los roles) -- por eso esto
  // no guarda el resultado en un estado acá, solo reenvía la llamada.
  const cargarPermisosDeRol = (id: number): Promise<RolConPermisosResponse> =>
    usuarioAdminService.getPermisosDeRol(id);

  const submitPermisosDeRol = async (id: number, permisosSeleccionados: string[]) => {
    try {
      await usuarioAdminService.setPermisosDeRol(id, permisosSeleccionados);
      toast.success("Permisos actualizados correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron actualizar los permisos");
      throw e;
    }
  };

  // Todas las solicitudes de cancelación (no solo pendientes) — el módulo
  // de Cancelaciones necesita ver también las ya resueltas, y de acá se
  // deriva `pendingCancelaciones` para la campana del header.
  const fetchSolicitudes = async () => {
    try { setSolicitudes(await solicitudCancelacionService.getAll()); } catch { /* no crítico */ }
  };

  // Feed real de actividad (historial_reservas de TODAS las reservas, ver
  // GET /historial-reservas/recientes) — alimenta tanto el widget chico del
  // Dashboard como el módulo completo de "Actividad del sistema".
  const fetchActividad = async (limit: number, esCargarMas = false) => {
    esCargarMas ? setActividadLoadingMore(true) : setActividadLoading(true);
    try {
      const data = await reservaDetailService.getActividadReciente(limit);
      setActividadReciente(data);
      setActividadAgotado(data.length < limit);
    } catch {
      // deja el feed como estaba (o vacío) — no es un dato crítico para
      // bloquear el resto del panel de admin.
    } finally {
      esCargarMas ? setActividadLoadingMore(false) : setActividadLoading(false);
    }
  };

  const cargarMasActividad = () => {
    const nuevoLimite = actividadLimit + 50;
    setActividadLimit(nuevoLimite);
    fetchActividad(nuevoLimite, true);
  };

  // Notificaciones reales (cancelaciones, contacto, solicitudes
  // corporativas, pagos aprobados) — ver notificacion_route.py.
  const fetchNotificaciones = async () => {
    setNotificacionesLoading(true);
    try { setNotificaciones(await notificacionService.getAll()); } catch { /* no crítico */ } finally { setNotificacionesLoading(false); }
  };

  const marcarNotificacionLeida = async (id: number) => {
    try {
      await notificacionService.marcarLeida(id);
      setNotificaciones(prev => prev.map(n => n.id_notificacion === id ? { ...n, leido: true } : n));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo marcar como leída");
    }
  };

  const marcarTodasNotificacionesLeidas = async () => {
    try {
      await notificacionService.marcarTodasLeidas();
      setNotificaciones(prev => prev.map(n => ({ ...n, leido: true })));
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron marcar todas como leídas");
    }
  };

  const deleteNotificacion = async (id: number) => {
    try {
      await notificacionService.delete(id);
      setNotificaciones(prev => prev.filter(n => n.id_notificacion !== id));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar la notificación");
    }
  };

  // Solicitudes corporativas reales — cada una llegó desde el formulario
  // público de /corporate (ver empresa_model.py / Corporate.tsx).
  const fetchEmpresas = async () => {
    try { setSolicitudesCorporativas(await empresaService.getAll()); } catch { /* no crítico */ }
  };

  // Banners publicitarios (sección 7 del plan de mejora) — listado completo
  // (incluye inactivos/fuera de vigencia) para ModuleBanners.tsx; el sitio
  // público usa GET /banners/activos directo (BannersPromocionales.tsx),
  // sin pasar por este estado del admin.
  const fetchBanners = async () => {
    try { setBanners(await bannerService.getAll()); } catch { /* no crítico */ }
  };

  const submitBanner = async (data: BannerFormData, id?: number) => {
    setLoading(true);
    try {
      if (id) await bannerService.update(id, data);
      else await bannerService.create(data);
      await fetchBanners();
      toast.success(id ? "Banner actualizado correctamente" : "Banner creado correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el banner");
      throw e;
    } finally { setLoading(false); }
  };

  const toggleActivoBanner = async (banner: Banner) => {
    try {
      const actualizado = await bannerService.toggleActivo(banner.id_banner, !banner.activo);
      setBanners(prev => prev.map(b => b.id_banner === actualizado.id_banner ? actualizado : b));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el estado del banner");
    }
  };

  const reordenarBanners = async (items: { id_banner: number; orden: number }[]) => {
    try {
      setBanners(await bannerService.reordenar(items));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo reordenar los banners");
    }
  };

  const deleteBanner = (id: number) => setConfirmDelete({ kind: "banner", id, label: "este banner" });

  // Temas de color de temporada -- ver ModuleTemas.tsx / TemaContext.tsx.
  const fetchTemas = async () => {
    try { setTemas(await temaService.getAll()); } catch { /* no crítico */ }
  };

  const submitTema = async (data: TemaFormData, id?: number) => {
    setLoading(true);
    try {
      if (id) await temaService.update(id, data);
      else await temaService.create(data);
      await fetchTemas();
      await refrescarTemaActivo();
      toast.success(id ? "Tema actualizado correctamente" : "Tema creado correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el tema");
      throw e;
    } finally { setLoading(false); }
  };

  const activarTema = async (tema: Tema) => {
    try {
      await temaService.activar(tema.id_tema);
      await fetchTemas();
      await refrescarTemaActivo();
      toast.success(`Tema "${tema.nombre}" activado`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo activar el tema");
    }
  };

  const deleteTema = (tema: Tema) => setConfirmDelete({ kind: "tema", id: tema.id_tema, label: `el tema "${tema.nombre}"` });

  // Imagen decorativa real del tema (opcional, ver tema_route.py) -- se
  // sube/borra aparte del resto de campos porque requiere que el tema ya
  // exista (necesita su id_tema).
  const subirImagenTema = async (id: number, imagen: File) => {
    try {
      await temaService.subirImagen(id, imagen);
      await fetchTemas();
      await refrescarTemaActivo();
      toast.success("Imagen del tema actualizada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo subir la imagen del tema");
      throw e;
    }
  };

  const borrarImagenTema = async (id: number) => {
    try {
      await temaService.borrarImagen(id);
      await fetchTemas();
      await refrescarTemaActivo();
      toast.success("Imagen del tema eliminada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo quitar la imagen del tema");
    }
  };

  // Video decorativo del fondo del Hero (opcional, ver tema_route.py) --
  // mismo criterio que la imagen de arriba.
  const subirVideoTema = async (id: number, video: File) => {
    try {
      await temaService.subirVideo(id, video);
      await fetchTemas();
      await refrescarTemaActivo();
      toast.success("Video del tema actualizado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo subir el video del tema");
      throw e;
    }
  };

  const borrarVideoTema = async (id: number) => {
    try {
      await temaService.borrarVideo(id);
      await fetchTemas();
      await refrescarTemaActivo();
      toast.success("Video del tema eliminado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo quitar el video del tema");
    }
  };

  const updateEstadoEmpresa = async (id: number, estado: SolicitudCorporativa["estado"]) => {
    try {
      const actualizado = await empresaService.actualizarEstado(id, estado);
      setSolicitudesCorporativas(prev => prev.map(s => s.id_solicitud === id ? actualizado : s));
      toast.success("Estado actualizado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el estado");
      throw e;
    }
  };

  const deleteEmpresa = (id: number) => setConfirmDelete({ kind: "empresa", id, label: "esta solicitud corporativa" });

  // ─── Eliminar (ahora vía ConfirmDialog centrado, no window.confirm) ──────
  const deleteReserva = (id: number) => setConfirmDelete({ kind: "reserva", id, label: `la reserva #${id}` });
  const deleteHotel   = (id: number) => setConfirmDelete({ kind: "hotel", id, label: "este hotel" });
  const deletePaquete = (id: number) => setConfirmDelete({ kind: "paquete", id, label: "este paquete" });
  const deleteCliente = (id: number) => setConfirmDelete({ kind: "cliente", id, label: "este cliente" });
  const deleteUsuario = (id: number) => setConfirmDelete({ kind: "usuario", id, label: "este usuario" });
  const deletePago    = (id: number) => setConfirmDelete({ kind: "pago", id, label: `el pago #${id}` });

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { kind, id } = confirmDelete;
    try {
      if (kind === "reserva") {
        await apiFetch(`/reservas/${id}`, { method: "DELETE" });
        await fetchReservas();
        toast.success("Reserva eliminada correctamente");
      } else if (kind === "hotel") {
        await apiFetch(`/hoteles/${id}`, { method: "DELETE" });
        await fetchHoteles();
        toast.success("Hotel eliminado correctamente");
      } else if (kind === "paquete") {
        await apiFetch(`/paquetes/${id}`, { method: "DELETE" });
        await fetchPaquetes();
        toast.success("Paquete desactivado correctamente");
      } else if (kind === "cliente") {
        await apiFetch(`/clientes/${id}`, { method: "DELETE" });
        await fetchClientes();
        toast.success("Cliente eliminado correctamente");
      } else if (kind === "usuario") {
        await usuarioAdminService.delete(id);
        await fetchUsuarios();
        toast.success("Usuario eliminado correctamente");
      } else if (kind === "rol") {
        await usuarioAdminService.deleteRol(id);
        await fetchUsuarios(); // refresca la lista de roles también
        toast.success("Rol eliminado correctamente");
      } else if (kind === "pago") {
        await apiFetch(`/pagos/${id}`, { method: "DELETE" });
        await fetchPagos();
        toast.success("Pago eliminado correctamente");
      } else if (kind === "empresa") {
        await empresaService.delete(id);
        await fetchEmpresas();
        toast.success("Solicitud eliminada correctamente");
      } else if (kind === "banner") {
        await bannerService.delete(id);
        await fetchBanners();
        toast.success("Banner eliminado correctamente");
      } else if (kind === "tema") {
        await temaService.delete(id);
        await fetchTemas();
        toast.success("Tema eliminado correctamente");
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudo completar la eliminación");
      throw e;
    }
  };

  const updateEstadoReserva = async (id: number, estado: string) => {
    try {
      await apiFetch(`/reservas/${id}`, { method: "PUT", body: { estado } });
      setReservas(prev => prev.map(r => r.id_reserva === id ? { ...r, estado } : r));
      toast.success("Estado de la reserva actualizado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el estado de la reserva");
      throw e;
    }
  };

  const updatePagoEstado = async (id: number, estado: string) => {
    try {
      // Se guarda la respuesta completa (no solo el estado local) porque el
      // backend puede asignar numero_factura automáticamente en este mismo
      // PUT (ver pago_estado_service.py en el backend) — con un merge
      // parcial esa factura nueva no aparecería hasta refrescar la página.
      const actualizado = await apiFetch<Pago>(`/pagos/${id}`, { method: "PUT", body: { estado } });
      setPagos(prev => prev.map(p => p.id_pago === id ? { ...p, ...actualizado } : p));
      toast.success("Estado del pago actualizado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el estado del pago");
      throw e;
    }
  };

  // Comprobante externo (voucher de transferencia/consignación) adjunto a
  // un pago — sube/borra el archivo real en el backend, sin inventar nada.
  const uploadComprobantePago = async (id: number, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const actualizado = await apiFetch<Pago>(`/pagos/${id}/comprobante`, { method: "POST", body: formData });
      setPagos(prev => prev.map(p => p.id_pago === id ? { ...p, ...actualizado } : p));
      toast.success("Comprobante adjuntado correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo subir el comprobante");
      throw e;
    }
  };

  const deleteComprobantePago = async (id: number) => {
    try {
      const actualizado = await apiFetch<Pago>(`/pagos/${id}/comprobante`, { method: "DELETE" });
      setPagos(prev => prev.map(p => p.id_pago === id ? { ...p, ...actualizado } : p));
      toast.success("Comprobante eliminado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar el comprobante");
      throw e;
    }
  };

  const resolverSolicitud = async (id: number, data: { estado: "aprobada" | "rechazada"; comentario_resolucion: string }) => {
    try {
      await solicitudCancelacionService.resolver(id, data);
      await fetchSolicitudes();
      // Aprobar cancela de verdad la reserva vinculada (ver
      // solicitud_cancelacion_route.py) — refrescamos Reservas para que no
      // quede con el estado viejo en caché en otras pestañas del panel.
      if (data.estado === "aprobada") await fetchReservas();
      toast.success(
        data.estado === "aprobada"
          ? "Solicitud aprobada — la reserva quedó cancelada"
          : "Solicitud rechazada"
      );
    } catch (e: any) {
      toast.error(e?.message || "No se pudo resolver la solicitud");
      throw e;
    }
  };

  // El asesor (o el admin) registra una solicitud en nombre de un cliente
  // que llamó por teléfono -- queda "pendiente" igual que si la hubiera
  // mandado el cliente desde su perfil; la decisión de aprobar/rechazar
  // sigue siendo exclusiva de admin (ver ModuleCancelaciones/soloEmpleado).
  const crearSolicitudCancelacion = async (reservaId: number, data: { motivo: string; motivo_detalle?: string }) => {
    try {
      await solicitudCancelacionService.crear(reservaId, data);
      await fetchSolicitudes();
      toast.success("Solicitud de cancelación registrada — queda pendiente de revisión del admin");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar la solicitud");
      throw e;
    }
  };

  const submitReserva = async (data: any) => {
    setLoading(true);
    try {
      // Si quien crea tiene perfil de Empleado vinculado (admin o
      // empleado, ver Usuario.id_empleado), se le asigna la reserva
      // automaticamente -- antes id_empleado siempre quedaba en null sin
      // importar quien la creara, y ni el KPI "reservas gestionadas" del
      // dashboard de empleado ni su filtro de "mis reservas" tenian de
      // donde sacar el dato.
      const payload = usuario?.id_empleado != null ? { ...data, id_empleado: usuario.id_empleado } : data;
      await apiFetch("/reservas", { method: "POST", body: payload });
      await fetchReservas();
      toast.success("Reserva creada correctamente");
      // Tras crear, llevar al admin al listado para que la vea de una vez
      // en vez de dejarlo parado en el formulario de "Crear reserva".
      setActiveModule("reservas");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear la reserva");
      throw e;
    } finally { setLoading(false); }
  };
  const submitHotel = async (data: any, id?: number) => {
    setLoading(true);
    try {
      // imagenFile viaja aparte del body JSON de creación/edición (el
      // endpoint de imagen es multipart, ver hotel_route.py) — se sube
      // después, ya con un id_hotel real en ambos casos (crear o editar).
      const { imagenFile, ...hotelData } = data;
      let hotelId = id;
      if (id) {
        await apiFetch(`/hoteles/${id}`, { method: "PUT", body: hotelData });
      } else {
        const creado = await apiFetch<{ id_hotel: number }>("/hoteles/", { method: "POST", body: hotelData });
        hotelId = creado.id_hotel;
      }
      if (imagenFile && hotelId) {
        await hotelService.subirImagen(hotelId, imagenFile);
      }
      await fetchHoteles();
      toast.success(id ? "Hotel actualizado correctamente" : "Hotel creado correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el hotel");
      throw e;
    } finally { setLoading(false); }
  };
  const submitPaquete = async (data: any, id?: number) => {
    setLoading(true);
    try {
      // imagenFile viaja aparte del body JSON de creación/edición (el
      // endpoint de imagen es multipart, ver reserva_route.py) -- se sube
      // después, ya con un id_paquete real -- mismo patrón que submitHotel.
      const { imagenFile, ...paqueteData } = data;
      let paqueteId = id;
      if (id) {
        await apiFetch(`/paquetes/${id}`, { method: "PUT", body: paqueteData });
      } else {
        const creado = await apiFetch<{ id_paquete: number }>("/paquetes", { method: "POST", body: paqueteData });
        paqueteId = creado.id_paquete;
      }
      if (imagenFile && paqueteId) {
        await paqueteService.subirImagen(paqueteId, imagenFile);
      }
      await fetchPaquetes();
      toast.success(id ? "Paquete actualizado correctamente" : "Paquete creado correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el paquete");
      throw e;
    } finally { setLoading(false); }
  };
  const submitCliente = async (data: any, id?: number) => {
    setLoading(true);
    try {
      if (id) await apiFetch(`/clientes/${id}`, { method: "PUT", body: data });
      else await apiFetch("/clientes", { method: "POST", body: data });
      await fetchClientes();
      toast.success(id ? "Cliente actualizado correctamente" : "Cliente creado correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el cliente");
      throw e;
    } finally { setLoading(false); }
  };

  const submitUsuario = async (data: any) => {
    setLoading(true);
    try {
      await usuarioAdminService.create(data);
      await fetchUsuarios();
      toast.success("Usuario creado correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear el usuario");
      throw e;
    } finally { setLoading(false); }
  };
  const toggleActivoUsuario = async (usuarioObj: Usuario) => {
    try {
      await usuarioAdminService.update(usuarioObj.id_usuario, { activo: !usuarioObj.activo });
      setUsuarios(prev => prev.map(u => u.id_usuario === usuarioObj.id_usuario ? { ...u, activo: !u.activo } : u));
      toast.success(usuarioObj.activo ? "Usuario desactivado" : "Usuario activado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el usuario");
      throw e;
    }
  };

  // Override manual: cuando el correo de verificación nunca llegó (ej.
  // falla de SMTP en producción), el admin puede marcar la cuenta como
  // verificada a mano en vez de dejar al usuario bloqueado indefinidamente
  // esperando un correo que quizás nunca llegue.
  const toggleVerificadoUsuario = async (usuarioObj: Usuario) => {
    try {
      await usuarioAdminService.update(usuarioObj.id_usuario, { verificado: !usuarioObj.verificado });
      setUsuarios(prev => prev.map(u => u.id_usuario === usuarioObj.id_usuario ? { ...u, verificado: !u.verificado } : u));
      toast.success(usuarioObj.verificado ? "Verificación retirada" : "Cuenta verificada manualmente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el usuario");
      throw e;
    }
  };

  // Antes los roles de un usuario ya existente eran de solo lectura en su
  // perfil (ModuleUsuarios.tsx) -- solo se podian elegir al crear la
  // cuenta. Reusa el mismo usuarioAdminService.update({roles}) que el
  // backend ya soporta (ver UsuarioAdminUpdate en usuario_schema.py).
  const updateRolesUsuario = async (usuarioObj: Usuario, roles: string[]) => {
    try {
      await usuarioAdminService.update(usuarioObj.id_usuario, { roles });
      setUsuarios(prev => prev.map(u => u.id_usuario === usuarioObj.id_usuario ? { ...u, roles } : u));
      toast.success("Roles actualizados correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron actualizar los roles");
      throw e;
    }
  };

  const handleLogout = () => { logout(); navigate("/"); };

  // Accesos rápidos globales, visibles desde cualquier módulo (header) —
  // ver AdminHeader.tsx / ui/QuickActions.tsx.
  const quickActions: QuickAction[] = soloEmpleado
    ? [
        { label: "Nueva reserva",    icon: PlusCircle, onClick: () => setActiveModule("crear-reserva") },
      ]
    : [
        { label: "Nueva reserva",    icon: PlusCircle, onClick: () => setActiveModule("crear-reserva") },
        { label: "Registrar hotel",  icon: Hotel,      onClick: () => setActiveModule("hoteles") },
        { label: "Crear paquete",    icon: Package,    onClick: () => setActiveModule("paquetes") },
        { label: "Ver clientes",     icon: Users,      onClick: () => setActiveModule("clientes") },
      ];

  // Un empleado solo ve las reservas que gestiona el mismo -- comparar
  // contra usuario.id_empleado (vinculo real Usuario -> Empleado, ver
  // login_user en auth_service.py), nunca contra usuario.user_id.
  const reservasVisibles = soloEmpleado
    ? reservas.filter(r => r.id_empleado != null && r.id_empleado === usuario?.id_empleado)
    : reservas;

  const MODULES: Record<Module, React.ReactNode> = {
    dashboard: (
      <ModuleDashboard
        setActiveModule={setActiveModule}
        onVerReserva={verReserva}
        onFiltrarModulo={irAModuloConFiltro}
        soloEmpleado={soloEmpleado}
      />
    ),
    reservas: (
      <ModuleReservas
        reservas={reservasVisibles} clientes={clientes} empleados={empleados}
        paquetes={paquetes} pagos={pagos} solicitudes={solicitudes}
        onDelete={deleteReserva}
        onNueva={() => setActiveModule("crear-reserva")}
        onUpdateEstado={updateEstadoReserva}
        reservaIdInicial={reservaParaAbrir}
        estadoInicial={estadoReservaInicial}
        clienteIdFiltro={clienteIdFiltroReservas}
        onVerPagos={verPagosDeReserva}
      />
    ),
    "crear-reserva": (
      <ModuleCrearReserva clientes={clientes} paquetes={paquetes} hoteles={hoteles} onSubmit={submitReserva} loading={loading} />
    ),
    hoteles: (
      <ModuleHoteles hoteles={hoteles} onDelete={deleteHotel} onSubmit={submitHotel} loading={loading} onHabitacionesChanged={fetchHoteles} />
    ),
    paquetes: (
      <ModulePaquetes paquetes={paquetes} reservas={reservas} hoteles={hoteles} onDelete={deletePaquete} onSubmit={submitPaquete} loading={loading} />
    ),
    clientes: (
      <ModuleClientes
        clientes={clientes} onDelete={deleteCliente} onSubmit={submitCliente} loading={loading}
        reservas={reservas} solicitudes={solicitudes}
        onVerReservas={verReservasDeCliente}
        onVerPagos={verPagosDeCliente}
        onVerMensajes={verMensajesDeCliente}
      />
    ),
    usuarios: (
      <ModuleUsuarios
        usuarios={usuarios} roles={roles}
        onDelete={deleteUsuario} onSubmit={submitUsuario}
        onToggleActivo={toggleActivoUsuario} onToggleVerificado={toggleVerificadoUsuario}
        onUpdateRoles={updateRolesUsuario} currentUsuarioId={usuario?.user_id}
        loading={loading}
      />
    ),
    cancelaciones: (
      <ModuleCancelaciones
        solicitudes={solicitudes}
        clientes={clientes}
        empleados={empleados}
        reservas={reservas}
        onResolve={resolverSolicitud}
        onVerReserva={verReserva}
        onCrearSolicitud={crearSolicitudCancelacion}
        soloEmpleado={soloEmpleado}
      />
    ),
    empresas: (
      <ModuleEmpresas
        solicitudes={solicitudesCorporativas}
        clientes={clientes}
        onUpdateEstado={updateEstadoEmpresa}
        onDelete={deleteEmpresa}
      />
    ),
    pagos: (
      <ModulePagos
        pagos={pagos} reservas={reservas} clientes={clientes} metodos={metodosPago}
        onUpdateEstado={updatePagoEstado} onDelete={deletePago}
        onUploadComprobante={uploadComprobantePago} onDeleteComprobante={deleteComprobantePago}
        onVerReserva={verReserva}
        estadoInicial={estadoPagoInicial}
        clienteIdFiltro={clienteIdFiltroPagos}
        reservaIdFiltro={reservaIdFiltroPagos}
      />
    ),
    notificaciones: (
      <ModuleNotificaciones
        notificaciones={notificaciones}
        loading={notificacionesLoading}
        onMarcarLeida={marcarNotificacionLeida}
        onMarcarTodasLeidas={marcarTodasNotificacionesLeidas}
        onDelete={deleteNotificacion}
        soloEmpleado={soloEmpleado}
      />
    ),
    roles: (
      <ModuleRoles
        roles={roles}
        permisos={permisos}
        onCreateRol={createRol}
        onDeleteRol={deleteRol}
        onCargarPermisosDeRol={cargarPermisosDeRol}
        onSubmitPermisosDeRol={submitPermisosDeRol}
        loading={loading}
      />
    ),
    actividad: (
      <ModuleActividad
        actividad={actividadReciente}
        loading={actividadLoading}
        loadingMore={actividadLoadingMore}
        agotado={actividadAgotado}
        onCargarMas={cargarMasActividad}
      />
    ),
    configuracion: <ModuleConfiguracion />,
    comunidad: <ModuleComunidad />,
    banners: (
      <ModuleBanners
        banners={banners}
        onSubmit={submitBanner}
        onDelete={deleteBanner}
        onToggleActivo={toggleActivoBanner}
        onReordenar={reordenarBanners}
        loading={loading}
      />
    ),
    temas: (
      <ModuleTemas
        temas={temas}
        onSubmit={submitTema}
        onDelete={deleteTema}
        onActivar={activarTema}
        onSubirImagen={subirImagenTema}
        onBorrarImagen={borrarImagenTema}
        onSubirVideo={subirVideoTema}
        onBorrarVideo={borrarVideoTema}
        loading={loading}
      />
    ),
    "mi-cuenta": (
      <ModuleMiCuenta
        usuario={usuario}
        onFotoActualizada={(foto_perfil) => updateUsuario({ foto_perfil })}
      />
    ),
    // Autosuficiente (fetch + polling propios, ver ModuleMensajes.tsx) --
    // mismo criterio que ModuleConfiguracion, no necesita estado de este
    // componente padre.
    mensajes: (
      <ModuleMensajes
        reservas={reservas} clientes={clientes} pagos={pagos}
        clienteIdInicial={clienteIdParaMensajes}
        onVerReserva={verReserva}
      />
    ),
  };

  const usuarioInicial = usuario?.username?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <AdminHeader
        soloEmpleado={soloEmpleado}
        activeModule={activeModule}
        onToggleSidebar={() => setSidebarOpen(s => !s)}
        sidebarOpen={sidebarOpen}
        dark={dark}
        onToggleDark={() => setDark(d => !d)}
        usuarioNombre={usuario?.username}
        usuarioFoto={usuario?.foto_perfil}
        onLogout={handleLogout}
        pendingCancelaciones={pendingCancelaciones}
        notificacionesNoLeidas={notificacionesNoLeidas}
        quickActions={quickActions}
        onNavigate={setActiveModule}
        searchData={{ reservas, hoteles, paquetes, clientes, usuarios }}
      />

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          open={sidebarOpen}
          usuarioInicial={usuarioInicial}
          usuarioNombre={usuario?.username}
          soloEmpleado={soloEmpleado}
        />

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6 transition-colors duration-300 bg-background">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="max-w-screen-2xl mx-auto"
            >
              {MODULES[activeModule]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AdminFooter />

      {/* DELETE /paquetes/{id} nunca borra de verdad — solo pone activo=false
          (ver PaqueteRepository.delete), así que para ese caso el diálogo
          usa un texto honesto ("desactivar", reversible) en vez del genérico
          "eliminar" que sí aplica a reserva/hotel/cliente/usuario. */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={confirmDelete?.kind === "paquete" ? "Confirmar desactivación" : "Confirmar eliminación"}
        description={
          confirmDelete
            ? confirmDelete.kind === "paquete"
              ? `¿Seguro que quieres desactivar ${confirmDelete.label}? Dejará de verse en el sitio público, pero podrás reactivarlo cuando quieras.`
              : `¿Seguro que quieres eliminar ${confirmDelete.label}? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel={confirmDelete?.kind === "paquete" ? "Desactivar" : "Eliminar"}
        destructive
        onConfirm={executeDelete}
      />
    </div>
  );
}
