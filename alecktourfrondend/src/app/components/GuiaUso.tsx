import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  BedDouble,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Heart,
  HelpCircle,
  MessageCircle,
  Receipt,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  UserPlus,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

// Guía de uso del sitio: un botón flotante abre un panel lateral con dos
// recorridos paso a paso -- cómo reservar y cómo usar el perfil de cliente.
// Los pasos describen las pantallas reales (Checkout, ReservarPaquete,
// PagarReserva, ProfileSidebar...) y cada uno trae un atajo para ir directo.

export interface PasoGuia {
  titulo: string;
  texto: string;
  icono: LucideIcon;
  enlace?: { to: string; texto: string; state?: unknown };
}

export const PASOS_RESERVA: PasoGuia[] = [
  {
    titulo: "Crea tu cuenta",
    texto:
      "Regístrate con tu correo y confírmalo con el código que te enviamos. Con la cuenta puedes reservar, pagar, " +
      "chatear con un asesor y seguir tus viajes. Puedes explorar el catálogo sin registrarte.",
    icono: UserPlus,
  },
  {
    titulo: "Elige qué reservar",
    texto:
      "Busca por destino y fechas en el buscador del inicio, o entra a Paquetes (plan completo con itinerario, " +
      "hotel y muchas veces vuelo) o a Vuelos. En cada ficha verás fotos, qué incluye y qué no, y condiciones.",
    icono: Search,
    enlace: { to: "/packages", texto: "Ver paquetes" },
  },
  {
    titulo: "Hotel: fechas y habitación",
    texto:
      "En la ficha del hotel elige la habitación. El checkout te lleva en 4 pasos: fechas y huéspedes, datos del " +
      "viajero, revisión y pago. Las fechas ya ocupadas aparecen bloqueadas en el calendario.",
    icono: BedDouble,
    enlace: { to: "/search", texto: "Buscar hoteles" },
  },
  {
    titulo: "Paquete o vuelo: salida y viajeros",
    texto:
      "Elige una fecha de salida (con los cupos que quedan), cuántos adultos, niños e infantes viajan y, si el " +
      "paquete lo permite, el vuelo o actividades opcionales. Llena los datos de cada viajero como salen en su documento.",
    icono: Users,
    enlace: { to: "/vuelos", texto: "Ver vuelos" },
  },
  {
    titulo: "Revisa el precio y confirma",
    texto:
      "Antes de confirmar ves el desglose completo: valor por persona, impuestos, extras y total. Debes aceptar " +
      "los términos y condiciones. Al confirmar, la reserva queda creada como Pendiente.",
    icono: CalendarCheck,
  },
  {
    titulo: "Paga tu reserva",
    texto:
      "Paga en línea con Nequi o PayPal, o elige pagar con un asesor: él te contacta y te indica cómo hacerlo. " +
      "Puedes abonar y completar el saldo después desde Mis Reservas › Pagar. Cuando el pago se confirma, la reserva pasa a Confirmada.",
    icono: CreditCard,
  },
  {
    titulo: "Después del viaje",
    texto:
      "Descarga tus comprobantes, cuéntanos cómo te fue con una reseña y comparte tus fotos en la Comunidad. " +
      "Si necesitas cancelar, solicítalo desde la reserva: un asesor la revisa según las condiciones.",
    icono: Star,
    enlace: { to: "/comunidad", texto: "Ir a la comunidad" },
  },
];

export const PASOS_PERFIL: PasoGuia[] = [
  {
    titulo: "Mis Reservas",
    texto:
      "Todas tus reservas con su estado (pendiente, confirmada, finalizada o cancelada), el detalle de lo que " +
      "compraste, lo pagado y el saldo. Desde aquí pagas, ves el calendario del viaje y dejas reseñas.",
    icono: Calendar,
    enlace: { to: "/profile", texto: "Abrir Mis Reservas", state: { tab: "reservas" } },
  },
  {
    titulo: "Cancelar una reserva",
    texto:
      "Abre la reserva y elige Solicitar cancelación, con el motivo. La agencia la revisa según las condiciones " +
      "del producto y te avisa por notificación y correo.",
    icono: XCircle,
  },
  {
    titulo: "Favoritos",
    texto: "Marca con el corazón los hoteles que te gustan para compararlos o reservarlos después.",
    icono: Heart,
    enlace: { to: "/profile", texto: "Ver favoritos", state: { tab: "favoritos" } },
  },
  {
    titulo: "Mensajes con tu asesor",
    texto:
      "Chat en vivo con el equipo de Alik Tours. Puedes adjuntar archivos y hablar de una reserva específica. " +
      "La campana del menú te avisa cuando hay respuestas.",
    icono: MessageCircle,
    enlace: { to: "/profile", texto: "Abrir mensajes", state: { tab: "mensajes" } },
  },
  {
    titulo: "Comprobantes",
    texto: "Descarga en PDF los comprobantes de tus pagos y reservas.",
    icono: Receipt,
    enlace: { to: "/profile", texto: "Ver comprobantes", state: { tab: "facturas" } },
  },
  {
    titulo: "Métodos de pago",
    texto:
      "Guarda tu tarjeta, Nequi o PayPal para pagar más rápido. Las cuentas nuevas deben registrar al menos un " +
      "método antes de usar el resto del perfil.",
    icono: Wallet,
    enlace: { to: "/profile", texto: "Métodos de pago", state: { tab: "metodos-pago" } },
  },
  {
    titulo: "Preferencias",
    texto: "Cuéntanos con quién viajas, tu presupuesto, el clima, el ritmo y el transporte que prefieres para recibir recomendaciones a tu medida.",
    icono: SlidersHorizontal,
    enlace: { to: "/profile", texto: "Mis preferencias", state: { tab: "preferencias" } },
  },
  {
    titulo: "Mi Cuenta",
    texto: "Actualiza tus datos personales, tu foto de perfil y tu contraseña.",
    icono: Settings,
    enlace: { to: "/profile", texto: "Mi cuenta", state: { tab: "cuenta" } },
  },
];

const RECORRIDOS = {
  reserva: { titulo: "Cómo reservar", pasos: PASOS_RESERVA },
  perfil: { titulo: "Tu perfil", pasos: PASOS_PERFIL },
} as const;
type Recorrido = keyof typeof RECORRIDOS;

const CLAVE_VISTA = "guia_uso_vista";

export function RecorridoGuia({ pasos, onIr }: { pasos: PasoGuia[]; onIr?: () => void }) {
  const [actual, setActual] = useState(0);
  const paso = pasos[actual];
  const Icono = paso.icono;
  const ultimo = actual === pasos.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex gap-1.5" aria-label="Progreso de la guía">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="flex-1">
            <button
              type="button"
              onClick={() => setActual(i)}
              aria-label={`Paso ${i + 1}: ${p.titulo}`}
              aria-current={i === actual ? "step" : undefined}
              className={`h-1.5 w-full rounded-full transition-colors ${i <= actual ? "bg-primary" : "bg-muted"}`}
            />
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-border bg-card p-5" aria-live="polite">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icono className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">
              Paso {actual + 1} de {pasos.length}
            </p>
            <h3 className="font-semibold leading-tight">{paso.titulo}</h3>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{paso.texto}</p>
        {paso.enlace && (
          <Link
            to={paso.enlace.to}
            state={paso.enlace.state}
            onClick={onIr}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {paso.enlace.texto} <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActual((a) => Math.max(a - 1, 0))}
          disabled={actual === 0}
          className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button
          type="button"
          onClick={() => setActual((a) => (ultimo ? 0 : a + 1))}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {ultimo ? "Volver a empezar" : "Siguiente"} {!ultimo && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function GuiaUso() {
  const { pathname } = useLocation();
  const [abierta, setAbierta] = useState(false);
  const [recorrido, setRecorrido] = useState<Recorrido>("reserva");
  const [primeraVez, setPrimeraVez] = useState(false);

  useEffect(() => {
    try {
      setPrimeraVez(!localStorage.getItem(CLAVE_VISTA));
    } catch {
      setPrimeraVez(false);
    }
    // Otros componentes (FAQ, perfil...) pueden abrir la guía con
    // window.dispatchEvent(new CustomEvent("guia:abrir", { detail: "perfil" })).
    const abrirDesdeEvento = (e: Event) => {
      const detalle = (e as CustomEvent<Recorrido | undefined>).detail;
      if (detalle && detalle in RECORRIDOS) setRecorrido(detalle);
      setAbierta(true);
    };
    window.addEventListener("guia:abrir", abrirDesdeEvento);
    return () => window.removeEventListener("guia:abrir", abrirDesdeEvento);
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/profile")) setRecorrido("perfil");
  }, [pathname]);

  const abrir = (valor: boolean) => {
    setAbierta(valor);
    if (valor && primeraVez) {
      setPrimeraVez(false);
      try {
        localStorage.setItem(CLAVE_VISTA, "1");
      } catch {
        /* sin almacenamiento: la guía funciona igual */
      }
    }
  };

  // El panel de administración tiene su propio flujo.
  if (pathname.startsWith("/admin")) return null;

  return (
    <Sheet open={abierta} onOpenChange={abrir}>
      <button
        type="button"
        onClick={() => abrir(true)}
        aria-label="Abrir guía: cómo reservar y usar tu perfil"
        className="fixed bottom-[5.5rem] right-5 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
      >
        <span className="relative flex">
          <HelpCircle className="h-5 w-5 text-primary" />
          {primeraVez && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-primary" aria-hidden />
          )}
        </span>
        <span className="hidden sm:inline">¿Cómo funciona?</span>
      </button>

      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Guía de Alik Tours</SheetTitle>
          <SheetDescription>Todo lo que necesitas para reservar tu viaje y sacarle provecho a tu perfil.</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {(Object.keys(RECORRIDOS) as Recorrido[]).map((clave) => (
              <button
                key={clave}
                type="button"
                role="tab"
                aria-selected={recorrido === clave}
                onClick={() => setRecorrido(clave)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  recorrido === clave ? "bg-card text-foreground shadow" : "text-muted-foreground"
                }`}
              >
                {RECORRIDOS[clave].titulo}
              </button>
            ))}
          </div>

          <RecorridoGuia key={recorrido} pasos={RECORRIDOS[recorrido].pasos} onIr={() => abrir(false)} />

          <div className="mt-6 rounded-2xl bg-muted/60 p-4 text-sm">
            <p className="font-medium">¿Aún tienes dudas?</p>
            <p className="mt-1 text-muted-foreground">
              Revisa las{" "}
              <Link to="/faq" onClick={() => abrir(false)} className="text-primary hover:underline">
                preguntas frecuentes
              </Link>{" "}
              o escríbenos con el botón de chat de la esquina.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
