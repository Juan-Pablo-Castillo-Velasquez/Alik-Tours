import { ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import ProfileHero from "../components/profile/ProfileHero";
import ProfileSidebar, { PerfilTabsMovil } from "../components/profile/ProfileSidebar";
import TabInicio from "../components/profile/TabInicio";
import TabCuenta from "../components/profile/TabCuenta";
import TabFacturas from "../components/profile/TabFacturas";
import TabFavoritos from "../components/profile/TabFavoritos";
import TabMensajes from "../components/profile/TabMensajes";
import TabMetodosPago from "../components/profile/TabMetodosPago";
import TabPreferencias from "../components/profile/TabPreferencias";
import TabReservas from "../components/profile/TabReservas";
import { useAuth } from "../context/AuthContext";
import { ClienteResponse, clienteService } from "../services/cliente.service";
import { mensajeChatService } from "../services/mensajeChat.service";
import {
  MetodoPagoGuardado,
  metodoPagoGuardadoService,
} from "../services/metodoPagoGuardado.service";
import {
  PreferenciaResponse,
  preferenciasService,
} from "../services/preferencias.service";
import { ReservaResponse, reservaService } from "../services/reserva.service";
import { usuarioService } from "../services/usuario.service";

// Corte de "método de pago obligatorio": SOLO las cuentas cuyo
// Cliente.fecha_registro sea posterior a este momento (cuando se
// desplegó esta funcionalidad) quedan obligadas a guardar un método de
// pago antes de poder usar su perfil. Las cuentas que ya existían antes
// de este corte siguen exactamente igual que antes -- nunca se les exige
// nada retroactivo. Ver el useMemo `esCuentaNueva` más abajo.
const REQUIERE_METODO_PAGO_DESDE = new Date("2026-09-25T03:40:00Z").getTime();

export default function Profile() {
  const { usuario, logout, isAuthenticated, updateUsuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Permite que otras pantallas (p.ej. el wizard de /preferences al
  // terminar) vuelvan directo a una pestaña específica en vez de caer
  // siempre en "reservas" — ver PreferencesForm.tsx handleFinish.
  const [activeTab, setActiveTab] = useState(
    () => (location.state as { tab?: string } | null)?.tab ?? "inicio",
  );
  // Deep-link desde la campana de notificaciones (NotificacionesBell) a una
  // reserva puntual — se resincroniza en el efecto de abajo porque, si ya
  // estábamos en /profile, react-router no vuelve a montar el componente y
  // el useState inicial de arriba no se re-ejecutaría solo.
  const [reservaIdInicial, setReservaIdInicial] = useState<number | null>(
    () => (location.state as { reservaId?: number } | null)?.reservaId ?? null,
  );
  // "Hablar de esta reserva" (ReservaCard, dentro de TabReservas) -- lleva
  // al cliente a la pestaña Mensajes con esa reserva ya preseleccionada en
  // el composer. Separado de `reservaIdInicial` (que abre el detalle EN
  // TabReservas) para que no se pisen si el cliente vuelve a esa pestaña.
  const [reservaIdParaMensaje, setReservaIdParaMensaje] = useState<number | null>(null);
  const hablarDeReserva = (idReserva: number) => {
    setReservaIdParaMensaje(idReserva);
    setActiveTab("mensajes");
  };
  const [reservas, setReservas] = useState<ReservaResponse[]>([]);
  const [preferencias, setPreferencias] = useState<PreferenciaResponse | null>(
    null,
  );
  const [clienteData, setClienteData] = useState<ClienteResponse | null>(null);
  const [metodosGuardados, setMetodosGuardados] = useState<MetodoPagoGuardado[]>([]);
  const [loading, setLoading] = useState(true);

  // Cuenta "nueva" = creada después del corte de arriba -- ver el comentario
  // en REQUIERE_METODO_PAGO_DESDE. Solo esas quedan sujetas al bloqueo.
  const esCuentaNueva =
    !loading &&
    !!clienteData?.fecha_registro &&
    new Date(clienteData.fecha_registro).getTime() >= REQUIERE_METODO_PAGO_DESDE;
  // Bloqueo real: cuenta nueva + todavía sin ningún método de pago guardado.
  // Se recalcula solo -- apenas metodosGuardados pase a tener 1+ elemento
  // (ver onMetodosChange en TabMetodosPago más abajo) esto se vuelve false
  // y el perfil se desbloquea sin necesidad de recargar la página.
  const requiereMetodoPago = esCuentaNueva && metodosGuardados.length === 0;
  // Pestaña que se renderiza de verdad: mientras esté bloqueado, siempre es
  // "metodos-pago" sin importar qué diga activeTab -- así no hay ni un
  // frame donde se llegue a ver otra pestaña antes de redirigir.
  const tabEfectiva = requiereMetodoPago ? "metodos-pago" : activeTab;
  // Filtro para los clics del sidebar: mientras esté bloqueado, cualquier
  // intento de ir a otra pestaña simplemente no hace nada (los botones ya
  // se ven deshabilitados en ProfileSidebar). Un deep-link real que llegue
  // por location.state (campana de notificaciones, etc.) NO pasa por acá,
  // así que sigue funcionando apenas la cuenta se desbloquee.
  const cambiarTabDesdeSidebar = (tab: string) => {
    if (requiereMetodoPago && tab !== "metodos-pago") return;
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
  }, [isAuthenticated]);

  // AuthContext.usuario solo se actualiza al hacer login o al editar algo
  // puntual (ver updateUsuario en TabCuenta.tsx) -- nunca se resincroniza
  // con el backend después de eso. Si un admin cambia verificado/activo
  // (ModuleUsuarios.tsx) mientras el cliente ya tiene sesión abierta, el
  // perfil seguía mostrando el estado viejo indefinidamente. Se refresca
  // una vez al entrar a /profile; si la cuenta fue desactivada mientras
  // tanto, el backend responde 403 (get_current_usuario, deps.py) y eso ya
  // dispara auth:session-expired (api.ts), que cierra la sesión sola.
  useEffect(() => {
    if (!isAuthenticated) return;
    usuarioService
      .getMe()
      .then((datos) => {
        updateUsuario({
          foto_perfil: datos.foto_perfil,
          verificado: datos.verificado,
          activo: datos.activo,
        });
      })
      .catch(() => {
        // Si fue 401/403 por sesión invalidada, auth:session-expired ya se
        // encargó de limpiar el estado -- no hay nada más que hacer aquí.
      });
  }, [isAuthenticated]);

  useEffect(() => {
    const state = location.state as { tab?: string; reservaId?: number } | null;
    if (state?.tab) setActiveTab(state.tab);
    if (state?.reservaId != null) setReservaIdInicial(state.reservaId);
  }, [location.state]);

  useEffect(() => {
    if (!isAuthenticated || !usuario?.id_cliente) {
      setLoading(false);
      return;
    }
    Promise.all([
      reservaService.getByCliente(usuario.id_cliente),
      clienteService.getById(usuario.id_cliente),
      preferenciasService.getByCliente(usuario.id_cliente).catch(() => null),
      metodoPagoGuardadoService.getAll().catch(() => []),
    ])
      .then(([res, cliente, prefs, metodos]) => {
        setReservas(res);
        setClienteData(cliente);
        setPreferencias(prefs);
        setMetodosGuardados(metodos);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [usuario]);

  // Mensajes sin leer: lo muestran el menú (escritorio y celular) y la
  // pestaña Inicio. Un solo sondeo cada 18 s para todo el perfil.
  const [noLeidosMensajes, setNoLeidosMensajes] = useState(0);
  const noLeidosRef = useRef(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    const cargar = () =>
      mensajeChatService
        .getNoLeidos()
        .then(({ no_leidos }) => {
          if (no_leidos !== noLeidosRef.current) {
            noLeidosRef.current = no_leidos;
            setNoLeidosMensajes(no_leidos);
          }
        })
        .catch(() => {});
    cargar();
    const intervalo = setInterval(cargar, 18000);
    return () => clearInterval(intervalo);
  }, [isAuthenticated]);

  const irATab = (tab: string) => {
    cambiarTabDesdeSidebar(tab);
    if (!requiereMetodoPago || tab === "metodos-pago") {
      document.getElementById("contenido-perfil")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const verReserva = (id: number) => {
    if (requiereMetodoPago) return;
    setReservaIdInicial(id);
    setActiveTab("reservas");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />

      <ProfileHero
        usuario={usuario}
        clienteData={clienteData}
        reservas={reservas}
        bloqueado={requiereMetodoPago}
        onIr={irATab}
      />

      {/* ── Contenido: menú lateral en escritorio, pestañas deslizables en celular ── */}
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 lg:pt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <ProfileSidebar
              clienteData={clienteData}
              activeTab={tabEfectiva}
              setActiveTab={cambiarTabDesdeSidebar}
              onLogout={handleLogout}
              bloqueado={requiereMetodoPago}
              noLeidosMensajes={noLeidosMensajes}
            />
          </aside>

          {/* Área de Contenido Dinámico */}
          <main id="contenido-perfil" className="min-w-0 scroll-mt-24">
            <PerfilTabsMovil
              activeTab={tabEfectiva}
              setActiveTab={cambiarTabDesdeSidebar}
              bloqueado={requiereMetodoPago}
              noLeidosMensajes={noLeidosMensajes}
            />
            <AnimatePresence mode="wait">
              {tabEfectiva === "inicio" && (
                <motion.div
                  key="inicio"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {loading ? (
                    <div className="space-y-4" aria-label="Cargando tu perfil">
                      <div className="h-72 animate-pulse rounded-3xl bg-muted" />
                      <div className="h-40 animate-pulse rounded-3xl bg-muted" />
                    </div>
                  ) : (
                  <TabInicio
                    reservas={reservas}
                    clienteData={clienteData}
                    tienePreferencias={!!preferencias}
                    idCliente={usuario?.id_cliente}
                    noLeidosMensajes={noLeidosMensajes}
                    onIr={irATab}
                    onVerReserva={verReserva}
                    onHablarDeReserva={hablarDeReserva}
                  />
                  )}
                </motion.div>
              )}
              {tabEfectiva === "reservas" && (
                <motion.div
                  key="reservas"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabReservas
                    reservas={reservas}
                    loading={loading}
                    clienteData={clienteData}
                    reservaIdInicial={reservaIdInicial}
                    onHablarDeReserva={hablarDeReserva}
                  />
                </motion.div>
              )}
              {tabEfectiva === "favoritos" && (
                <motion.div
                  key="favoritos"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabFavoritos />
                </motion.div>
              )}
              {tabEfectiva === "mensajes" && (
                <motion.div
                  key="mensajes"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabMensajes reservas={reservas} reservaIdInicial={reservaIdParaMensaje} />
                </motion.div>
              )}
              {tabEfectiva === "facturas" && (
                <motion.div
                  key="facturas"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabFacturas reservas={reservas} clienteData={clienteData} />
                </motion.div>
              )}
              {tabEfectiva === "metodos-pago" && (
                <motion.div
                  key="metodos-pago"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {requiereMetodoPago && (
                    <div className="mb-6 flex items-start gap-3 bg-primary/10 border border-primary/25 rounded-2xl p-4 max-w-4xl">
                      <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Un último paso antes de continuar
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Para gestionar tu perfil necesitamos que guardes al menos un método de
                          pago. Es rápido y nunca almacenamos el número completo de tu tarjeta o
                          cuenta -- solo un alias, los últimos 4 dígitos y tu propia clave de
                          confirmación.
                        </p>
                      </div>
                    </div>
                  )}
                  <TabMetodosPago
                    obligatorio={requiereMetodoPago}
                    onMetodosChange={setMetodosGuardados}
                  />
                </motion.div>
              )}
              {tabEfectiva === "preferencias" && (
                <motion.div
                  key="preferencias"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabPreferencias
                    preferencias={preferencias}
                    idCliente={usuario?.id_cliente}
                  />
                </motion.div>
              )}
              {tabEfectiva === "cuenta" && (
                <motion.div
                  key="cuenta"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabCuenta
                    clienteData={clienteData}
                    onClienteActualizado={setClienteData}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
