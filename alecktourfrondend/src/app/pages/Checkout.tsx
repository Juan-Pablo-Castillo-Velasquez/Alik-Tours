import { TERMINOS_VERSION } from "../content/terminos";
import { esCelularValido } from "../utils/validaciones";
import { Bed, Calendar, CheckCircle2, CreditCard, Eye, EyeOff, IdCard, Lock, Mail, MapPin, Phone, Shield, ShieldCheck, Smartphone, Sparkles, User, Users, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast, Toaster } from "sonner";
import HalloweenAccentDiscreto from "../components/HalloweenAccentDiscreto";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useTema } from "../context/TemaContext";
import { clienteService } from "../services/cliente.service";
import { HabitacionResponse, HotelDetailResponse, hotelService, RangoOcupado } from "../services/hotel.service";
import CalendarioOcupacion from "../components/hotel/CalendarioOcupacion";
import { MetodoPago, pagoService, reservaService } from "../services/reserva.service";
import { MetodoPagoGuardado, metodoPagoGuardadoService } from "../services/metodoPagoGuardado.service";
import CardPayment from "../components/payment/CardPayment";
import PSEPayment from "../components/payment/PSEPayment";
import NequiPayment from "../components/payment/NequiPayment";
import NequiConfirmar from "../components/payment/NequiConfirmar";
import PayPalPayment from "../components/payment/PayPalPayment";
import PaymentSelector from "../components/payment/PaymentSelector";
import PaymentStatus from "../components/payment/PaymentStatus";
import ReservationLoader from "../components/checkout/ReservationLoader";
import {
  CardPaymentValue, NequiPaymentValue, PSEPaymentValue, PaymentOutcome,
  cardLast4, emptyCardValue, emptyNequiValue, emptyPSEValue,
  isCardValueValid, isNequiValueValid, isPSEValueValid,
} from "../components/payment/types";

const STEPS = [
  { n: 1, label: "Datos del viajero" },
  { n: 2, label: "Fechas y huéspedes" },
  { n: 3, label: "Revisar reserva" },
  { n: 4, label: "Pago" },
];

function formatFechaCorta(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fechaISO;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

export default function Checkout() {
  const { id } = useParams(); // id_hotel
  const [searchParams] = useSearchParams();
  const idHabitacion = searchParams.get("habitacion");
  const navigate = useNavigate();
  const { usuario, isAuthenticated } = useAuth();
  // Acento de temporada SOLO en el encabezado del resumen (ver más abajo)
  // -- nunca cerca del precio total ni del botón de pago, esa zona se deja
  // siempre limpia (mismo criterio que HotelDetail.tsx/PackageDetail.tsx).
  const { temaActivo } = useTema();
  const esHalloween = temaActivo?.clave === "halloween";

  const [hotel, setHotel] = useState<HotelDetailResponse | null>(null);
  const [habitacion, setHabitacion] = useState<HabitacionResponse | null>(null);
  // Rangos ya reservados de ESTA habitación (GET /hoteles/{id}/fechas-ocupadas,
  // el mismo endpoint que ya usa HotelDetail.tsx) -- antes el checkout dejaba
  // elegir fechas completamente a ciegas, sin ninguna pista de qué días ya
  // estaban ocupados, así que un cliente podía llegar hasta el paso de pago
  // con fechas que el backend iba a rechazar igual al crear la reserva.
  const [fechasOcupadas, setFechasOcupadas] = useState<RangoOcupado[]>([]);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  // Métodos de pago guardados por el cliente (billetera real, ver
  // MetodoPagoGuardado en el backend) — se usan solo para preseleccionar
  // el método marcado como predeterminado en el paso de pago, nunca para
  // saltarse la elección: el cliente sigue pudiendo cambiarlo.
  const [metodosGuardados, setMetodosGuardados] = useState<MetodoPagoGuardado[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  // Nequi ya no se auto-confirma solo tras una espera fija (como PSE) --
  // se le pide al cliente que confirme que YA transfirió a NEQUI_DESTINO
  // (ver NequiConfirmar.tsx). Este id es el Pago que quedó 'procesando'
  // esperando que un asesor/admin lo revise y confirme de verdad (ver
  // confirmar_pago, ahora exclusivo de staff para este método).
  const [pagoPendienteId, setPagoPendienteId] = useState<number | null>(null);
  const [comprobanteSubiendo, setComprobanteSubiendo] = useState(false);
  const [comprobanteSubido, setComprobanteSubido] = useState(false);
  const [comprobanteError, setComprobanteError] = useState<string | null>(null);
  // Paso real (1-3) y error del overlay de checkout (ver ReservationLoader) —
  // solo cubre crear reserva + iniciar pago; el resto del flujo (espera PSE,
  // aprobado/rechazado) lo sigue manejando <PaymentStatus /> como antes.
  const [loaderStep, setLoaderStep] = useState<1 | 2 | 3>(1);
  const [loaderError, setLoaderError] = useState<string | null>(null);

  // ── Wizard ──
  const [step, setStep] = useState(1);

  // ── Datos del viajero (prellenados desde el cliente real, editables, solo visual) ──
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [celular, setCelular] = useState('');
  const [cedula, setCedula] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');

  const [people, setPeople] = useState(2);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [metodoPago, setMetodoPago] = useState<number>(1);

  // Prellena fechas/huéspedes si vienen del buscador (SearchBar → HotelCard
  // → HotelDetail → acá, ver esos archivos). Antes se perdían por completo:
  // el cliente elegía sus fechas en el buscador y tenía que volver a
  // escribirlas desde cero en el checkout. Sigue siendo editable — es solo
  // un valor inicial, igual que el resto de datos prellenados del cliente.
  useEffect(() => {
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const ppl = searchParams.get('people');
    if (start) setFechaInicio(start);
    if (end) setFechaFin(end);
    if (ppl && !Number.isNaN(parseInt(ppl, 10))) setPeople(parseInt(ppl, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [paymentOption, setPaymentOption] = useState<'full' | 'partial'>('full');
  // Aceptación expresa de los términos antes de pagar (casilla nunca
  // marcada por defecto; la versión aceptada se guarda con la reserva).
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // ── Datos por método de pago (nunca se envía el número completo de
  //    tarjeta al backend, solo los últimos 4 — ver construirDatosMetodo) ──
  const [cardValue, setCardValue] = useState<CardPaymentValue>(emptyCardValue);
  const [pseValue, setPseValue] = useState<PSEPaymentValue>(emptyPSEValue);
  const [nequiValue, setNequiValue] = useState<NequiPaymentValue>(emptyNequiValue);
  const [securityPin, setSecurityPin] = useState('');
  // Mejora de UX: antes el PIN se creaba con un solo campo, sin poder verlo
  // ni repetirlo -- un typo al crear un PIN nuevo dejaba al cliente sin
  // saber cuál PIN quedó guardado. `securityPinConfirm` solo se exige
  // cuando es la PRIMERA vez que paga con este tipo (ver metodoGuardadoDelTipo
  // más abajo); para verificar un PIN ya existente basta con escribirlo una vez.
  const [securityPinConfirm, setSecurityPinConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);

  // ── Estado visual del pago: idle mientras se llena el formulario,
  //    processing/approved/rejected una vez enviado (ver PaymentStatus) ──
  const [paymentStatus, setPaymentStatus] = useState<PaymentOutcome>('idle');
  const [reservaActual, setReservaActual] = useState<any>(null);

  // Precio real de la habitación elegida (viene de la BD, no inventado)
  const precioPorNoche = habitacion?.precio_noche ?? 0;
  const nights = fechaInicio && fechaFin
    ? Math.max(1, Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;
  const totalPrice = precioPorNoche * nights;
  const paymentAmount = paymentOption === 'full' ? totalPrice : totalPrice * 0.5;

  // Restricción pedida por el negocio: en el checkout de autoservicio del
  // cliente solo se acepta Nequi o PayPal (nunca tarjeta/PSE/otro). El
  // catálogo completo (GET /metodos-pago) no cambia -- ModuleCrearReserva.tsx
  // (reservas creadas por un asesor) sigue pudiendo usar cualquier método;
  // esta restricción es solo para este flujo.
  const metodosPermitidos = metodos.filter((m) => m.codigo === 'nequi' || m.codigo === 'paypal');
  const sinMetodosPermitidos = !loading && metodos.length > 0 && metodosPermitidos.length === 0;

  const metodoSeleccionado = metodosPermitidos.find((m) => m.id_metodo === metodoPago);
  const codigoMetodo = metodoSeleccionado?.codigo ?? 'otro';
  const esTarjeta = codigoMetodo === 'tarjeta_credito' || codigoMetodo === 'tarjeta_debito';
  const esPSE = codigoMetodo === 'pse';
  const esNequi = codigoMetodo === 'nequi';
  const esPayPal = codigoMetodo === 'paypal';

  // Método guardado (billetera real del cliente, ver MetodoPagoGuardado en
  // el backend) para el TIPO de pago actualmente elegido. Si existe, su
  // PIN ya está hasheado en el backend y hay que verificarlo contra ese;
  // si no, es el primer pago del cliente con este tipo y el PIN que
  // ingrese ahora se guarda como el suyo real para la próxima vez.
  const metodoGuardadoDelTipo = metodosGuardados.find((g) => g.tipo === codigoMetodo);

  // Precargar del método guardado (preferencia del cliente): si ya tiene un
  // método de este tipo en su billetera, NO hace falta que rellene todos los
  // campos del formulario (número de tarjeta/PSE/Nequi) — solo confirma con
  // su PIN y el backend usa la info REAL guardada. El número completo de la
  // tarjeta nunca se guardó ni se muestra (solo los últimos 4).
  const usandoMetodoGuardado = !!metodoGuardadoDelTipo;

  // Antes el último OR (!esTarjeta && !esPSE && !esNequi) daba por válido
  // CUALQUIER método sin datos extra, incluido el caso "no hay ningún
  // método seleccionado" (metodoSeleccionado undefined => los 4 son
  // false) -- con tarjeta/PSE ya fuera de este flujo eso se había vuelto
  // un hueco real: dejaba enviar el formulario sin Nequi/PayPal
  // realmente elegidos. Ahora exige explícitamente esNequi o esPayPal.
  const metodoValido =
    usandoMetodoGuardado ||
    (esNequi && isNequiValueValid(nequiValue)) ||
    esPayPal; // PayPal no pide datos adicionales en este entorno simulado

  // Fase 2 del plan de mejora: antes esto comparaba contra un PIN fijo
  // ('1234', visible en la propia pantalla) — cero seguridad real. Acá
  // solo se valida el formato; la verificación real (o su creación, si es
  // la primera vez que el cliente paga con este tipo de método) pasa por
  // el backend dentro de handleSubmit, contra metodoGuardadoDelTipo.
  // Si es un método guardado ya existente, basta con escribir el PIN una
  // vez (se verifica contra el hash en el backend); si es la primera vez,
  // exige que las dos casillas coincidan antes de dejar avanzar.
  const pinCompletado = usandoMetodoGuardado
    ? securityPin.length >= 4
    : securityPin.length >= 4 && securityPin === securityPinConfirm;

  // Datos del viajero (Paso 1) — antes no había ninguna validación acá:
  // se podía pasar a "Fechas y huéspedes" con nombre, correo, celular o
  // cédula vacíos. Validación básica de formato, no exhaustiva.
  const paso1Valido =
    nombres.trim().length > 1 &&
    apellidos.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) &&
    esCelularValido(celular) &&
    cedula.trim().length >= 5;

  const construirDatosMetodo = () => {
    if (esTarjeta) return { ultimos4: cardLast4(cardValue) };
    if (esPSE) return { banco: pseValue.banco, documento: pseValue.documento };
    // BUG real corregido: antes esto solo mandaba `celular` y nunca
    // `ultimos4`, así que el método guardado que se crea más abajo (ver
    // handleSubmit, metodoPagoGuardadoService.create) quedaba con
    // ultimos4=null para Nequi -- el número nunca quedaba realmente
    // identificable en la billetera del cliente para su próxima reserva.
    // Igual que con la tarjeta, nunca se guarda el número completo: solo
    // los últimos 4 dígitos del celular.
    if (esNequi) return { celular: nequiValue.celular, ultimos4: nequiValue.celular.slice(-4) };
    return {};
  };

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!id) return;

    Promise.all([
      hotelService.getById(parseInt(id)), // trae hotel + sus habitaciones reales
      pagoService.getMetodos(),
      hotelService.getFechasOcupadas(parseInt(id)),
    ]).then(([h, m, ocupadas]) => {
      setHotel(h);
      setMetodos(m);
      // La preselección real (predeterminado del cliente si tiene uno, si no
      // el primero de los permitidos) la resuelve el useEffect de más abajo
      // una vez también cargan metodosGuardados — acá solo evitamos dejar
      // seleccionado, aunque sea un instante, un id que no sea Nequi/PayPal
      // (ver metodosPermitidos más arriba).
      const permitidosIniciales = m.filter((mp) => mp.codigo === 'nequi' || mp.codigo === 'paypal');
      if (permitidosIniciales.length > 0) setMetodoPago(permitidosIniciales[0].id_metodo);

      // Buscamos la habitación exacta que el usuario eligió en HotelDetail
      const hab = h.habitaciones?.find(
        (hb: HabitacionResponse) => hb.id_habitacion === Number(idHabitacion)
      );
      if (!hab) {
        toast.error('No se encontró la habitación seleccionada. Vuelve a elegirla.');
        navigate(`/hotel/${id}`);
        return;
      }
      if (hab.estado !== 'disponible') {
        toast.error('Esa habitación ya no está disponible.');
        navigate(`/hotel/${id}`);
        return;
      }
      setHabitacion(hab);

      const rangosDeEstaHabitacion = ocupadas.find(
        (o) => o.id_habitacion === Number(idHabitacion)
      );
      setFechasOcupadas(rangosDeEstaHabitacion?.rangos ?? []);
    }).catch((err) => {
      // Si `id` no corresponde a ningún hotel real (por ejemplo, un enlace
      // viejo o mal construido que mandaba aquí un id de paquete en vez de
      // un id de hotel), antes esto solo se registraba en consola y la
      // página se quedaba cargando en blanco para siempre. Ahora se avisa
      // y se manda a un lugar siempre válido.
      console.error(err);
      toast.error('No pudimos encontrar ese alojamiento para reservar.');
      navigate('/search');
    })
      .finally(() => setLoading(false));
  }, [id, idHabitacion, isAuthenticated]);

  // Prellenar datos del viajero desde el cliente autenticado (tabla `clientes`: correo, celular, cedula)
  useEffect(() => {
    if (isAuthenticated && usuario?.id_cliente) {
      clienteService.getById(usuario.id_cliente)
        .then((c) => {
          setNombres(c.nombre ?? '');
          setApellidos(c.apellido ?? '');
          setCorreo(c.correo ?? '');
          setCelular(c.celular ?? '');
          setCedula(c.cedula ?? '');
          setDireccion(c.direccion ?? '');
          setCiudad(c.ciudad ?? '');

          // BUG real corregido: el cliente ya tenía estos datos registrados
          // (celular, cédula, nombre) y aun así tenía que volver a
          // escribirlos en el paso de pago para Nequi/PSE/Tarjeta. Solo se
          // prellenan campos que el cliente puede seguir editando — nunca
          // el número de tarjeta ni el CVV, que nunca se guardan completos
          // (MetodoPagoGuardado solo persiste los últimos 4).
          if (c.celular) setNequiValue((prev) => (prev.celular ? prev : { celular: c.celular! }));
          if (c.cedula) setPseValue((prev) => (prev.documento ? prev : { ...prev, documento: c.cedula! }));
          if (c.nombre || c.apellido) {
            const nombreCompleto = `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim();
            setCardValue((prev) => (prev.name ? prev : { ...prev, name: nombreCompleto }));
          }
        })
        .catch(() => {
          // Sin perfil de cliente cargado, los campos del viajero se
          // quedan como estaban (vacíos o lo que el usuario ya haya
          // escrito) — el envío del formulario igual exige
          // usuario?.id_cliente más abajo, así que no se puede pagar sin
          // un cliente real de todas formas.
        });
    }
  }, [isAuthenticated, usuario?.id_cliente]);

  // Trae la billetera real del cliente (métodos de pago que ya registró) —
  // en checkout solo nos interesa para preseleccionar el que marcó como
  // predeterminado; si falla o no tiene ninguno guardado, no rompe nada,
  // el flujo sigue igual que antes (elige él manualmente).
  useEffect(() => {
    if (!isAuthenticated) return;
    metodoPagoGuardadoService.getAll()
      .then(setMetodosGuardados)
      .catch(() => setMetodosGuardados([]));
  }, [isAuthenticated]);

  // Une los métodos de pago reales (GET /metodos-pago) con la billetera del
  // cliente: si tiene un método guardado marcado como predeterminado, y su
  // `tipo` coincide con el `codigo` de alguno de los métodos reales, ese
  // queda preseleccionado en vez del primero de la lista — así el checkout
  // usa de verdad la información que el cliente ya registró.
  useEffect(() => {
    // Filtra acá adentro (no usa el `metodosPermitidos` derivado del
    // render) para no depender de un arreglo que cambia de referencia en
    // cada render -- este efecto solo debe reaccionar cuando `metodos` o
    // `metodosGuardados` (estado real) cambian, igual que antes.
    const permitidos = metodos.filter((m) => m.codigo === 'nequi' || m.codigo === 'paypal');
    if (permitidos.length === 0) return;
    const predeterminado = metodosGuardados.find((g) => g.predeterminado && (g.tipo === 'nequi' || g.tipo === 'paypal'));
    const match = predeterminado ? permitidos.find((m) => m.codigo === predeterminado.tipo) : undefined;
    setMetodoPago(match ? match.id_metodo : permitidos[0].id_metodo);
  }, [metodos, metodosGuardados]);

  // Limpia el PIN al cambiar entre Nequi y PayPal -- cada tipo tiene su
  // propio método guardado (y por tanto su propio PIN); sin esto, un PIN
  // escrito para Nequi quedaba visible/reutilizable si el cliente cambiaba
  // a PayPal a mitad del formulario.
  useEffect(() => {
    setSecurityPin('');
    setSecurityPinConfirm('');
  }, [codigoMetodo]);

  // Aplica el resultado final del pago (ya sea inmediato -tarjeta/PayPal- o
  // tras confirmar uno asíncrono -PSE/Nequi-): navega a la confirmación si
  // fue aprobado, o muestra el estado de rechazo si no.
  const finalizarPago = (estadoPago: string, reservaFinal: any, pago: any) => {
    if (estadoPago === 'pagado') {
      setPaymentStatus('approved');
      toast.success('¡Reserva confirmada!', { id: 'checkout' });
      setTimeout(() => {
        navigate('/confirmation', {
          state: {
            reserva: reservaFinal,
            hotel,
            habitacion,
            people,
            totalPrice,
            paymentAmount: pago.monto,
            paymentOption,
            referencia: pago.referencia,
          },
        });
      }, 900);
    } else {
      setPaymentStatus('rejected');
      toast.error('El pago fue rechazado. Revisa los datos o elige otro método.', { id: 'checkout' });
    }
  };

  // Inicia el pago sobre una reserva ya creada. PSE/Nequi quedan
  // 'procesando' y se confirman aparte (simula la respuesta asíncrona del
  // banco/app); tarjeta/PayPal/otros resuelven al instante, como antes.
  const ejecutarPago = async (reservaId: number) => {
    // Si el cliente ya tiene un método guardado de este tipo, se paga con él:
    // el backend (pagar_reserva) carga su info real y NO confía en los campos
    // de pago que se manden desde el navegador (ver PagarRequest.id_metodo_guardado).
    const pagoConGuardado = metodoGuardadoDelTipo ? metodoGuardadoDelTipo.id_metodo_guardado : undefined;
    const { pago, reserva: reservaActualizada } = await reservaService.pagar(reservaId, {
      id_metodo_pago: metodoPago,
      tipo_pago: paymentOption === 'full' ? 'completo' : 'parcial',
      ...(pagoConGuardado ? { id_metodo_guardado: pagoConGuardado } : construirDatosMetodo()),
    });

    if (pago.estado === 'procesando') {
      setPaymentStatus('processing');
      if (esNequi) {
        // A diferencia de PSE, Nequi espera a que el cliente confirme de
        // verdad que ya transfirió (ver NequiConfirmar.tsx / handleConfirmarNequi)
        // en vez de auto-confirmarse solo tras una espera fija.
        setPagoPendienteId(pago.id_pago);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2200));
      const confirmado = await pagoService.confirmar(pago.id_pago);
      finalizarPago(confirmado.pago.estado, confirmado.reserva, confirmado.pago);
      return;
    }

    setLoaderStep(3);
    finalizarPago(pago.estado, reservaActualizada, pago);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Los 4 pasos viven dentro de un único <form> (ver más abajo) -- sin
    // esto, presionar Enter con el foco en cualquier campo de un paso
    // anterior (ej. escribiendo el correo en el Paso 1) disparaba este
    // mismo submit antes de tiempo, con datos de pago todavía vacíos o
    // desactualizados. e.preventDefault() ya evita que la página navegue,
    // pero sin este corte el resto de la función seguía ejecutándose igual.
    if (step !== 4) return;

    if (!fechaInicio || !fechaFin) {
      toast.error('Selecciona las fechas de tu estadía');
      setStep(2);
      return;
    }
    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      toast.error('La fecha de salida debe ser después de la entrada');
      setStep(2);
      return;
    }
    if (!usuario?.id_cliente) {
      toast.error('No se encontró tu perfil de cliente. Contacta soporte.');
      return;
    }
    if (!habitacion) {
      toast.error('No hay una habitación válida seleccionada.');
      return;
    }
    if (sinMetodosPermitidos) {
      toast.error('Nequi y PayPal no están disponibles como método de pago en este momento.');
      return;
    }
    if (!metodoValido) {
      toast.error('Revisa los datos del método de pago elegido.');
      return;
    }
    if (!aceptaTerminos) {
      toast.error('Debes aceptar los términos y condiciones para confirmar la reserva.');
      return;
    }
    if (securityPin.length < 4) {
      toast.error('Ingresa tu PIN de seguridad (mínimo 4 dígitos).');
      return;
    }
    if (!usandoMetodoGuardado && securityPin !== securityPinConfirm) {
      toast.error('Los dos PIN que escribiste no coinciden.');
      return;
    }

    // Verificación real del PIN (Fase 2 del plan de mejora): si el cliente
    // ya tiene un método guardado de este tipo, se valida contra su PIN
    // hasheado en el backend; si es la primera vez que paga con este tipo
    // de método, el PIN que acaba de escribir se guarda ahora como su
    // método real — ya no hay ningún valor fijo con qué comparar.
    try {
      if (metodoGuardadoDelTipo) {
        const { valido } = await metodoPagoGuardadoService.verificarClave(
          metodoGuardadoDelTipo.id_metodo_guardado,
          securityPin,
        );
        if (!valido) {
          toast.error('El PIN de seguridad no es correcto.');
          return;
        }
      } else {
        const nuevoMetodoGuardado = await metodoPagoGuardadoService.create({
          alias: metodoSeleccionado?.nombre_metodo ?? 'Método de pago',
          tipo: codigoMetodo,
          ultimos4: (construirDatosMetodo() as any).ultimos4,
          clave: securityPin,
        });
        setMetodosGuardados((prev) => [...prev, nuevoMetodoGuardado]);
      }
    } catch (err: any) {
      toast.error(err.message || 'No se pudo confirmar tu PIN de seguridad. Intenta de nuevo.');
      return;
    }

    setIsProcessing(true);
    setPaymentStatus('idle');
    setLoaderError(null);
    setLoaderStep(1);

    try {
      // Si ya existe una reserva de un intento anterior (p. ej. un pago
      // rechazado), se reutiliza en vez de crear una segunda — en ese caso
      // el overlay salta directo al paso 2 (no vuelve a mostrar el 1).
      let reservaId: number | undefined = reservaActual?.id_reserva;
      if (!reservaId) {
        // El precio NO se manda: el backend lo calcula con precio_noche de
        // la BD y valida que la habitación siga disponible (409 si no).
        const reserva = await reservaService.create({
          id_cliente: usuario.id_cliente,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          numero_personas: people,
          terminos_version: TERMINOS_VERSION,
          habitaciones: [
            {
              id_habitacion: habitacion.id_habitacion,
              fecha_checkin: fechaInicio,
              fecha_checkout: fechaFin,
            },
          ],
        });
        setReservaActual(reserva);
        reservaId = reserva.id_reserva;
      }

      setLoaderStep(2);
      await ejecutarPago(reservaId);
    } catch (err: any) {
      // El backend devuelve 409 con mensaje claro si alguien más reservó la
      // habitación primero. El overlay se queda abierto mostrando el error
      // (en vez de un simple toast) hasta que el usuario lo cierre.
      setLoaderError(err.message || 'Error al procesar la reserva');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryPago = () => {
    setPaymentStatus('idle');
    setPagoPendienteId(null);
    setComprobanteSubiendo(false);
    setComprobanteSubido(false);
    setComprobanteError(null);
  };

  // Adjunta el comprobante de la transferencia (opcional) al Pago que
  // quedó 'procesando' -- el backend valida que el cliente sea dueño de
  // la reserva ligada a ese pago (ver subir_comprobante_pago).
  const handleSubirComprobanteNequi = async (file: File) => {
    if (!pagoPendienteId) return;
    setComprobanteSubiendo(true);
    setComprobanteError(null);
    try {
      await pagoService.subirComprobante(pagoPendienteId, file);
      setComprobanteSubido(true);
    } catch (err: any) {
      setComprobanteError(err.message || 'No se pudo subir el comprobante.');
    } finally {
      setComprobanteSubiendo(false);
    }
  };

  // El cliente ya transfirió (con o sin comprobante adjunto) -- esto ya NO
  // confirma el pago de una vez: solo cierra este paso y deja la reserva
  // pendiente hasta que un asesor/admin revise y confirme de verdad (ver
  // confirmar_pago, ahora exclusivo de staff para Nequi).
  const handleConfirmarNequi = () => {
    setPaymentStatus('pendiente_verificacion');
  };

  const goNext = () => {
    if (step === 1 && !paso1Valido) {
      toast.error('Completa tu nombre, correo, celular y cédula antes de continuar');
      return;
    }
    if (step === 2 && (!fechaInicio || !fechaFin)) {
      toast.error('Selecciona las fechas de tu estadía');
      return;
    }
    if (step === 2 && new Date(fechaFin) <= new Date(fechaInicio)) {
      toast.error('La fecha de salida debe ser después de la entrada');
      return;
    }
    // Antes esto solo lo detectaba el backend al crear la reserva (ya al
    // final del paso 4, con todo lo demás lleno) -- ahora se avisa apenas
    // el cliente elige fechas que chocan con un rango ya ocupado, con el
    // mismo calendario visual que se muestra arriba (ver CalendarioOcupacion).
    if (step === 2 && fechasOcupadas.some(
      (r) => fechaInicio < r.fecha_checkout && r.fecha_checkin < fechaFin
    )) {
      toast.error('Esas fechas se cruzan con una reserva ya existente para esta habitación');
      return;
    }
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="text-muted-foreground text-sm mt-4 font-medium animate-pulse">Sincronizando pasarela de pagos...</p>
      </div>
    </div>
  );

  if (!hotel || !habitacion) return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-medium text-foreground">El complejo, hotel o habitación no se encuentra disponible</h1>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-medium hover:underline">← Regresar</button>
      </div>
    </div>
  );

  const caracteristicasHotel = (hotel.hotel_caracteristicas ?? [])
    .filter((hc) => hc.disponible && hc.caracteristica)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />
      <Toaster position="top-center" richColors />
      <ReservationLoader
        step={loaderStep}
        isVisible={(isProcessing && paymentStatus === 'idle') || !!loaderError}
        error={loaderError}
        onDismiss={() => setLoaderError(null)}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Encabezado */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Completa tu reserva</h1>
                <p className="text-muted-foreground text-sm">Tu viaje está casi listo. Revisa cada paso antes de confirmar.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-green-500 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              Proceso seguro y protegido
            </div>
          </div>
        </motion.div>

        {/* Stepper */}
        <div className="relative grid grid-cols-4 mb-8">
          <div className="absolute h-0.5 bg-border top-[15px] left-[12.5%] right-[12.5%]" />
          <motion.div
            className="absolute h-0.5 bg-primary top-[15px] left-[12.5%]"
            initial={false}
            animate={{ width: `${((step - 1) / (STEPS.length - 1)) * 75}%` }}
            transition={{ duration: 0.35 }}
          />
          {STEPS.map((s) => {
            // Antes el indicador de progreso se veía clickeable pero no lo
            // era -- solo se podía retroceder de a un paso con "← Volver".
            // Ahora un paso ya completado se puede reabrir directo desde
            // acá; nunca se permite saltar HACIA ADELANTE a un paso que
            // todavía no se validó.
            const completado = step > s.n;
            return (
              <button
                key={s.n}
                type="button"
                disabled={!completado}
                onClick={() => { setStep(s.n); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`relative z-10 text-center bg-transparent border-0 p-0 focus:outline-none ${completado ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg" : "cursor-default"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-extrabold transition-colors ${completado
                    ? "bg-green-500 text-white"
                    : step === s.n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                    }`}
                >
                  {completado ? <CheckCircle2 className="w-4 h-4" /> : s.n}
                </div>
                <span className={`text-[10px] font-bold ${step === s.n ? "text-primary" : completado ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Columna principal */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">

              {/* PASO 1: Datos del viajero */}
              {step === 1 && (
                <motion.section
                  key="step1"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.25 }}
                  className="bg-card rounded-xl border border-border shadow-xs overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-input-background/40">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Datos de tu cuenta</p>
                        <p className="text-xs text-muted-foreground">Ya tienes una cuenta. No necesitas registrarte de nuevo.</p>
                      </div>
                    </div>
                    <span className="hidden sm:flex items-center gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-green-500/20">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Cuenta verificada
                    </span>
                  </div>

                  <div className="p-6 md:p-8">
                    <h2 className="text-xl font-medium text-foreground mb-1">Información del viajero</h2>
                    <p className="text-xs text-muted-foreground mb-5">Estos datos vienen de tu perfil registrado en Alik Tours.</p>

                    <div className="flex items-start gap-3 bg-input-background border border-border/60 rounded-xl p-4 mb-5">
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Los datos principales ya están asociados a tu cuenta.</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Confirma que la información sea correcta antes de continuar.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="checkout-nombres" className="block text-xs font-semibold text-muted-foreground mb-1.5">Nombres</label>
                        <input
                          id="checkout-nombres"
                          value={nombres}
                          onChange={(e) => setNombres(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="checkout-apellidos" className="block text-xs font-semibold text-muted-foreground mb-1.5">Apellidos</label>
                        <input
                          id="checkout-apellidos"
                          value={apellidos}
                          onChange={(e) => setApellidos(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="checkout-correo" className="block text-xs font-semibold text-muted-foreground mb-1.5">Correo electrónico</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-input-background">
                          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                          <input
                            id="checkout-correo"
                            value={correo}
                            onChange={(e) => setCorreo(e.target.value)}
                            className="w-full bg-transparent text-foreground text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="checkout-celular" className="block text-xs font-semibold text-muted-foreground mb-1.5">Celular</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-input-background">
                          <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                          <input
                            id="checkout-celular"
                            value={celular}
                            onChange={(e) => setCelular(e.target.value)}
                            className="w-full bg-transparent text-foreground text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="checkout-cedula" className="block text-xs font-semibold text-muted-foreground mb-1.5">Cédula</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-input-background">
                          <IdCard className="w-4 h-4 text-muted-foreground shrink-0" />
                          <input
                            id="checkout-cedula"
                            value={cedula}
                            onChange={(e) => setCedula(e.target.value)}
                            className="w-full bg-transparent text-foreground text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="checkout-ciudad" className="block text-xs font-semibold text-muted-foreground mb-1.5">Ciudad</label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-input-background">
                          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                          <input
                            id="checkout-ciudad"
                            value={ciudad}
                            onChange={(e) => setCiudad(e.target.value)}
                            className="w-full bg-transparent text-foreground text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="checkout-direccion" className="block text-xs font-semibold text-muted-foreground mb-1.5">Dirección</label>
                        <input
                          id="checkout-direccion"
                          value={direccion}
                          onChange={(e) => setDireccion(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                      <div className="border border-border rounded-xl p-3.5">
                        <ShieldCheck className="w-4 h-4 text-[#C9A227] mb-1.5" />
                        <b className="block text-xs text-foreground">Datos protegidos</b>
                        <span className="text-[11px] text-muted-foreground">Tratamiento seguro</span>
                      </div>
                      <div className="border border-border rounded-xl p-3.5">
                        <Mail className="w-4 h-4 text-[#C9A227] mb-1.5" />
                        <b className="block text-xs text-foreground">Confirmación por correo</b>
                        <span className="text-[11px] text-muted-foreground">Recibirás el comprobante</span>
                      </div>
                      <div className="border border-border rounded-xl p-3.5">
                        <Shield className="w-4 h-4 text-[#C9A227] mb-1.5" />
                        <b className="block text-xs text-foreground">Soporte 24/7</b>
                        <span className="text-[11px] text-muted-foreground">Asistencia durante el viaje</span>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* PASO 2: Fechas y huéspedes */}
              {step === 2 && (
                <motion.section
                  key="step2"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.25 }}
                  className="bg-card rounded-xl border border-border p-6 md:p-8 shadow-xs"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-foreground">Fechas y huéspedes</h2>
                      <p className="text-xs text-muted-foreground">Revisa el calendario de abajo: los días en rojo ya están ocupados.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="checkout-checkin" className="block text-xs font-medium text-muted-foreground mb-1.5">Check-in</label>
                      <input id="checkout-checkin" type="date"
                max="2100-12-31" required value={fechaInicio}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                    </div>
                    <div>
                      <label htmlFor="checkout-checkout" className="block text-xs font-medium text-muted-foreground mb-1.5">Check-out</label>
                      <input id="checkout-checkout" type="date"
                max="2100-12-31" required value={fechaFin}
                        min={fechaInicio || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-foreground text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                    </div>
                    <div>
                      <label htmlFor="checkout-huespedes" className="block text-xs font-medium text-muted-foreground mb-1.5">Huéspedes</label>
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-input-background">
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input id="checkout-huespedes" type="number" min={1} max={habitacion.tipo_habitacion?.capacidad_personas ?? 10}
                          value={people}
                          onChange={(e) => setPeople(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-transparent text-foreground text-sm focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Disponibilidad real de esta habitación -- mismo componente
                      que ya usa HotelDetail.tsx, para que el cliente vea qué
                      días están ocupados ANTES de elegir, en vez de enterarse
                      recién al intentar pagar. */}
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-foreground mb-2">Disponibilidad de esta habitación</p>
                    <CalendarioOcupacion
                      rangos={fechasOcupadas}
                      rangoSeleccionado={{ fechaInicio, fechaFin }}
                    />
                  </div>

                  {/* Info real de la habitación */}
                  <div className="mt-6 p-4 bg-input-background border border-border/60 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Bed className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {habitacion.tipo_habitacion?.nombre_tipo ?? "Habitación"} · #{habitacion.numero_habitacion}
                        </p>
                        {habitacion.tipo_habitacion?.descripcion && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{habitacion.tipo_habitacion.descripcion}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Capacidad: {habitacion.tipo_habitacion?.capacidad_personas ?? "?"} personas · ${precioPorNoche.toLocaleString('es-CO')} / noche
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Amenidades reales del hotel */}
                  {caracteristicasHotel.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-foreground mb-2">Amenidades del hotel</p>
                      <div className="flex flex-wrap gap-2">
                        {caracteristicasHotel.map((hc) => (
                          <span
                            key={hc.id_caracteristica}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary"
                          >
                            {hc.caracteristica?.nombre_caracteristica}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.section>
              )}

              {/* PASO 3: Revisar reserva */}
              {step === 3 && (
                <motion.section
                  key="step3"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.25 }}
                  className="bg-card rounded-xl border border-border p-6 md:p-8 shadow-xs"
                >
                  <h2 className="text-xl font-medium text-foreground mb-1">Revisa tu reserva</h2>
                  <p className="text-xs text-muted-foreground mb-5">Comprueba los datos antes de pasar al pago.</p>

                  <div className="space-y-3">
                    <div className="border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <b className="text-xs flex items-center gap-1.5 text-foreground">
                          <Bed className="w-3.5 h-3.5 text-primary" /> Alojamiento
                        </b>
                        <button type="button" onClick={() => setStep(2)} className="text-primary text-[11px] font-bold hover:underline">
                          Editar
                        </button>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Hotel</span>
                        <strong className="text-foreground">{hotel.nombre_hotel}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Ubicación</span>
                        <strong className="text-foreground">{hotel.ciudad}, {hotel.pais}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Fechas</span>
                        <strong className="text-foreground">
                          {new Date(`${fechaInicio}T00:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                          {" → "}
                          {new Date(`${fechaFin}T00:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                        </strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Noches</span>
                        <strong className="text-foreground">{nights}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Huéspedes</span>
                        <strong className="text-foreground">{people}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Habitación</span>
                        <strong className="text-foreground">{habitacion.tipo_habitacion?.nombre_tipo ?? "Habitación"} #{habitacion.numero_habitacion}</strong>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <b className="text-xs flex items-center gap-1.5 text-foreground">
                          <User className="w-3.5 h-3.5 text-primary" /> Viajero principal
                        </b>
                        <button type="button" onClick={() => setStep(1)} className="text-primary text-[11px] font-bold hover:underline">
                          Editar
                        </button>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Nombre</span>
                        <strong className="text-foreground">{nombres} {apellidos}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Cédula</span>
                        <strong className="text-foreground">{cedula}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Correo</span>
                        <strong className="text-foreground">{correo}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Celular</span>
                        <strong className="text-foreground">{celular}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Ciudad</span>
                        <strong className="text-foreground">{ciudad}</strong>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <b className="text-xs flex items-center gap-1.5 text-foreground mb-2.5">
                        <Phone className="w-3.5 h-3.5 text-primary" /> Contacto del hotel
                      </b>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Dirección</span>
                        <strong className="text-foreground text-right">{hotel.direccion ?? "—"}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Teléfono</span>
                        <strong className="text-foreground">{hotel.telefono ?? "—"}</strong>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Correo</span>
                        <strong className="text-foreground">{hotel.correo_electronico ?? "—"}</strong>
                      </div>
                    </div>

                    {/* Antes el precio y el método de pago solo aparecían ya
                        adentro del Paso 4 -- el cliente llegaba a "revisar" su
                        reserva sin ver cuánto iba a pagar ni con qué. */}
                    <div className="border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <b className="text-xs flex items-center gap-1.5 text-foreground">
                          <CreditCard className="w-3.5 h-3.5 text-primary" /> Pago
                        </b>
                        <button type="button" onClick={() => setStep(4)} className="text-primary text-[11px] font-bold hover:underline">
                          Editar
                        </button>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Modalidad</span>
                        <strong className="text-foreground">{paymentOption === 'full' ? 'Pago completo' : 'Anticipo (50%)'}</strong>
                      </div>
                      {metodoSeleccionado && (
                        <div className="flex justify-between text-xs py-1">
                          <span className="text-muted-foreground">Método</span>
                          <strong className="text-foreground">{metodoSeleccionado.nombre_metodo}</strong>
                        </div>
                      )}
                      <div className="flex justify-between text-xs py-1.5 mt-1 border-t border-border/60">
                        <span className="text-muted-foreground">Total a pagar</span>
                        <strong className="text-primary text-sm">${paymentAmount.toLocaleString('es-CO')}</strong>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* PASO 4: Pago */}
              {step === 4 && (
                <motion.section
                  key="step4"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {paymentStatus !== 'idle' ? (
                    paymentStatus === 'processing' && pagoPendienteId ? (
                      <NequiConfirmar
                        amount={paymentAmount}
                        comprobanteSubiendo={comprobanteSubiendo}
                        comprobanteSubido={comprobanteSubido}
                        comprobanteError={comprobanteError}
                        onSubirComprobante={handleSubirComprobanteNequi}
                        onConfirmar={handleConfirmarNequi}
                      />
                    ) : (
                    <PaymentStatus
                      state={paymentStatus}
                      amount={paymentAmount}
                      onRetry={paymentStatus === 'rejected' ? handleRetryPago : undefined}
                    />
                    )
                  ) : (
                  <>
                  {/* Paso 1: Fraccionamiento de Pago */}
                  <div className="bg-card rounded-xl border border-border p-6 shadow-xs">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-9 h-9 bg-chart-2/10 rounded-lg flex items-center justify-center border border-chart-2/20">
                        <Zap className="w-4 h-4 text-chart-2" />
                      </div>
                      <div>
                        <h2 className="text-lg font-medium text-foreground">1. Elige cuánto pagar hoy</h2>
                        <p className="text-xs text-muted-foreground">Define el monto antes de asignar tu método de pago.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <motion.label whileHover={{ y: -1 }}
                        className={`flex items-start gap-4 p-5 rounded-xl cursor-pointer border transition-all ${paymentOption === 'full' ? 'border-primary bg-primary/5 shadow-xs' : 'border-border bg-card'
                          }`}>
                        <input type="radio" name="payment" checked={paymentOption === 'full'}
                          onChange={() => setPaymentOption('full')}
                          className="mt-1 w-4 h-4 text-primary focus:ring-primary border-border bg-input-background" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm md:text-base text-foreground">Pago de contado</span>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </div>
                            <span className="text-base md:text-lg font-bold text-foreground">
                              ${totalPrice.toLocaleString('es-CO')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">Liquida el 100% del monto hoy y olvídate de cargos posteriores.</p>
                        </div>
                      </motion.label>

                      <motion.label whileHover={{ y: -1 }}
                        className={`flex items-start gap-4 p-5 rounded-xl cursor-pointer border transition-all ${paymentOption === 'partial' ? 'border-primary bg-primary/5 shadow-xs' : 'border-border bg-card'
                          }`}>
                        <input type="radio" name="payment" checked={paymentOption === 'partial'}
                          onChange={() => setPaymentOption('partial')}
                          className="mt-1 w-4 h-4 text-primary focus:ring-primary border-border bg-input-background" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm md:text-base text-foreground">Pago diferido (50% anticipo)</span>
                              <Sparkles className="w-4 h-4 text-chart-2" />
                            </div>
                            <span className="text-base md:text-lg font-bold text-primary">
                              ${(totalPrice * 0.5).toLocaleString('es-CO')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">Asegura tu cupo con la mitad y cubre el saldo restante 15 días antes de tu viaje.</p>
                        </div>
                      </motion.label>
                    </div>
                  </div>

                  {/* Paso 2: Métodos de pago */}
                  <div className="bg-card rounded-xl border border-border p-6 shadow-xs">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-9 h-9 bg-green-500/10 rounded-lg flex items-center justify-center border border-green-500/20">
                        <CreditCard className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <h2 className="text-lg font-medium text-foreground">2. Elige tu método de pago</h2>
                        <p className="text-xs text-muted-foreground">Selecciona cómo quieres pagar {paymentOption === 'partial' ? 'el anticipo' : 'tu reserva'}.</p>
                      </div>
                    </div>
                    {sinMetodosPermitidos ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        Nequi y PayPal no están disponibles como método de pago en este momento. Contáctanos para completar tu reserva.
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1.5">
                          {metodosGuardados.some((g) => g.predeterminado && (g.tipo === 'nequi' || g.tipo === 'paypal')) ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              Preseleccionamos tu método de pago predeterminado — puedes cambiarlo si prefieres usar otro.
                            </>
                          ) : (
                            'Por ahora aceptamos pagos con Nequi o PayPal.'
                          )}
                        </p>
                        <PaymentSelector metodos={metodosPermitidos} selectedId={metodoPago} onSelect={setMetodoPago} />
                      </>
                    )}
                  </div>

                  {/* Datos específicos del método elegido — cada uno vive en su propio
                      componente aislado dentro de components/payment/ */}
                  <AnimatePresence>
                    {(esTarjeta || esPSE || esNequi || esPayPal) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-card rounded-xl border border-border p-6 shadow-xs">
                          <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                              <CreditCard className="w-4 h-4 text-primary" />
                            </div>
                            <h2 className="text-lg font-medium text-foreground">
                              {esTarjeta ? 'Datos de la tarjeta' : esPSE ? 'Datos de PSE' : esNequi ? 'Datos de Nequi' : 'PayPal'}
                            </h2>
                          </div>

                          {esTarjeta && usandoMetodoGuardado && metodoGuardadoDelTipo?.ultimos4 && (
                            <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                <CreditCard className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{metodoGuardadoDelTipo.alias}</p>
                                <p className="text-xs text-muted-foreground">
                                  {metodoSeleccionado?.nombre_metodo ?? 'Tarjeta'} ·•••• •••• {metodoGuardadoDelTipo.ultimos4}
                                </p>
                              </div>
                              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0">
                                Tarjeta guardada
                              </span>
                            </div>
                          )}
                          {esTarjeta && (!usandoMetodoGuardado || !metodoGuardadoDelTipo?.ultimos4) && (
                            <CardPayment value={cardValue} onChange={setCardValue} brand={metodoSeleccionado?.nombre_metodo} />
                          )}
                          {esPSE && <PSEPayment value={pseValue} onChange={setPseValue} />}
                          {/* Mismo tratamiento que la tarjeta guardada de arriba: si el
                              cliente ya tiene un Nequi guardado CON últimos4 (ver el
                              fix de construirDatosMetodo más arriba), se muestra ese
                              número en vez de pedirle que lo vuelva a escribir -- esto
                              es justo lo pedido: que al hacer la reserva, el número de
                              Nequi ya esté ahí. */}
                          {esNequi && usandoMetodoGuardado && metodoGuardadoDelTipo?.ultimos4 && (
                            <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                <Smartphone className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{metodoGuardadoDelTipo.alias}</p>
                                <p className="text-xs text-muted-foreground">Nequi ·•••• {metodoGuardadoDelTipo.ultimos4}</p>
                              </div>
                              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0">
                                Número guardado
                              </span>
                            </div>
                          )}
                          {esNequi && (!usandoMetodoGuardado || !metodoGuardadoDelTipo?.ultimos4) && (
                            <NequiPayment value={nequiValue} onChange={setNequiValue} />
                          )}
                          {esPayPal && <PayPalPayment amount={paymentAmount} />}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Paso 3: PIN de seguridad */}
                  <div className="bg-card rounded-xl border border-border p-6 shadow-xs">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                        <Lock className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-medium text-foreground">3. Confirma con tu PIN de seguridad</h2>
                        <p className="text-xs text-muted-foreground">
                          {metodoGuardadoDelTipo
                            ? <>Ingresa el PIN que configuraste para <span className="font-medium text-foreground">{metodoGuardadoDelTipo.alias}</span>.</>
                            : 'Es tu primer pago con este método: crea un PIN de 4 a 6 dígitos, lo usarás también en tus próximos pagos.'}
                        </p>
                      </div>
                    </div>
                    <div className="relative w-full max-w-[160px]">
                      <input
                        type={showPin ? 'text' : 'password'} inputMode="numeric" placeholder="••••"
                        value={securityPin}
                        onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-border bg-input-background text-foreground text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-primary/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Repetir PIN: solo al crear uno nuevo (primer pago con este
                        método) -- si ya hay un método guardado, el PIN ya existe y
                        solo se está re-verificando, no hace falta confirmarlo dos
                        veces. */}
                    {!usandoMetodoGuardado && (
                      <div className="mt-3">
                        <input
                          type={showPin ? 'text' : 'password'} inputMode="numeric" placeholder="Repite el PIN"
                          value={securityPinConfirm}
                          onChange={(e) => setSecurityPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                          className={`w-full max-w-[160px] px-4 py-3 rounded-xl border bg-input-background text-foreground text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-primary/40 focus:outline-none ${
                            securityPinConfirm && securityPin !== securityPinConfirm
                              ? 'border-destructive'
                              : 'border-border'
                          }`}
                        />
                        {securityPinConfirm && securityPin !== securityPinConfirm && (
                          <p className="text-[11px] text-destructive mt-1.5">Los PIN no coinciden.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Badge SSL */}
                  <div className="flex items-center gap-3 p-4 bg-green-500/5 rounded-xl border border-green-500/10 transition-colors">
                    <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground font-medium">Transacción protegida mediante encriptación SSL de 256 bits</span>
                  </div>

                  {/* Qué pasa después de pagar -- antes el cliente llegaba a
                      este último paso sin ninguna idea de qué sigue (¿le
                      llega algo? ¿puede cancelar?), lo cual generaba dudas
                      justo antes del momento más sensible del flujo. */}
                  <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl border border-border/60">
                    <Mail className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      <p className="font-semibold text-foreground mb-1">¿Qué pasa después de pagar?</p>
                      <p>Te confirmamos por correo de inmediato y tu reserva queda disponible en tu perfil, en "Mis reservas". Puedes solicitar la cancelación desde ahí cuando quieras, sujeta a la política de cada alojamiento.</p>
                    </div>
                  </div>
                  </>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {/* Navegación del wizard */}
            <div className="flex items-center justify-between mt-6">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="text-muted-foreground hover:text-foreground text-sm font-semibold"
                >
                  ← Volver
                </button>
              ) : <span />}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-6 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-95 transition-all shadow-sm"
                >
                  {step === 3 ? "Ir al pago" : "Continuar"} →
                </button>
              ) : (
                <div className="flex flex-col items-end gap-1.5">
                  <label className="flex items-start gap-2 text-xs text-muted-foreground max-w-[340px] text-left cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aceptaTerminos}
                      onChange={(e) => setAceptaTerminos(e.target.checked)}
                      className="mt-0.5 accent-[var(--primary)]"
                    />
                    <span>
                      He leído y acepto los{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                        términos y condiciones
                      </a>{' '}
                      (versión {TERMINOS_VERSION}) y la{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                        política de privacidad
                      </a>.
                    </span>
                  </label>
                  {(!metodoValido || !pinCompletado) && (
                    <p className="text-[11px] text-muted-foreground">
                      {!metodoValido
                        ? 'Completa los datos del método de pago para continuar.'
                        : 'Ingresa tu PIN de seguridad para continuar.'}
                    </p>
                  )}
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    type="submit" disabled={!aceptaTerminos || isProcessing || paymentStatus === 'processing' || paymentStatus === 'approved' || paymentStatus === 'pendiente_verificacion'}
                    className="min-w-[220px] py-3.5 px-6 bg-primary text-primary-foreground text-sm font-semibold rounded-xl border border-transparent shadow-md hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden">
                    <span className="relative flex items-center justify-center gap-2.5">
                      {isProcessing ? 'Garantizando transacciones...' : (
                        <><Lock className="w-4 h-4" />Confirmar y autorizar ${paymentAmount.toLocaleString('es-CO')}</>
                      )}
                    </span>
                  </motion.button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Resumen Desglose */}
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="relative overflow-hidden bg-card rounded-xl border border-border p-6 sticky top-24 shadow-xs">
              {esHalloween && (
                <HalloweenAccentDiscreto variante="murcielago" posicion="top-right" tamano="sm" />
              )}
              <h2 className="text-lg font-medium text-foreground mb-4">Resumen de itinerario</h2>

              {/* Mini card del hotel + habitación seleccionada */}
              <div className="mb-6 p-4 bg-muted/60 border border-border rounded-xl">
                <p className="font-bold text-foreground text-base leading-tight">{hotel.nombre_hotel}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {hotel.ciudad}, {hotel.pais}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-primary font-medium">
                  <Bed className="w-3.5 h-3.5" />
                  {habitacion.tipo_habitacion?.nombre_tipo ?? "Habitación"} · #{habitacion.numero_habitacion}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="flex gap-0.5">
                    {Array.from({ length: hotel.calificacion || 5 }, (_, i) => (
                      <span key={i} className="text-chart-2 text-xs">★</span>
                    ))}
                  </div>
                  {hotel.calificacion_promedio != null && hotel.total_resenas > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {hotel.calificacion_promedio.toFixed(1)} · {hotel.total_resenas} reseña{hotel.total_resenas === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {fechaInicio && fechaFin && (
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/60 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-foreground font-medium">{formatFechaCorta(fechaInicio)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-foreground font-medium">{formatFechaCorta(fechaFin)}</span>
                    <span className="text-muted-foreground">· {nights} noche{nights === 1 ? "" : "s"}</span>
                  </div>
                )}

                {caracteristicasHotel.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/60">
                    {caracteristicasHotel.map((hc) => (
                      <span
                        key={hc.id_caracteristica}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border text-[10px] font-medium text-muted-foreground"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 text-primary" />
                        {hc.caracteristica?.nombre_caracteristica}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Desglose matemático — con precio REAL de la habitación */}
              <div className="space-y-3 pb-4 border-b border-border text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarifa por noche</span>
                  <span className="font-medium text-foreground">${precioPorNoche.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pasajeros inscritos</span>
                  <span className="font-medium text-foreground">{people}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Noches de hospedaje</span>
                  <span className="font-medium text-foreground">{nights}</span>
                </div>
                <div className="flex justify-between text-sm md:text-base pt-2 border-t border-dashed border-border mt-2">
                  <span className="font-semibold text-foreground">Total bruto</span>
                  <span className="font-bold text-foreground">${totalPrice.toLocaleString('es-CO')}</span>
                </div>
              </div>

              {/* Total final a pagar ahora */}
              <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-xs md:text-sm text-foreground">Cargos actuales</span>
                  <span className="text-xl md:text-2xl font-bold text-primary tracking-tight">
                    ${paymentAmount.toLocaleString('es-CO')}
                  </span>
                </div>
                {paymentOption === 'partial' && (
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    Un saldo de ${(totalPrice * 0.5).toLocaleString('es-CO')} quedará pendiente en tu panel para liquidarse previo al arribo.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </form>
      </div>
    </div>
  );
}