import { BadgeCheck, Headset, LockKeyhole, MessageCircle } from "lucide-react";
import { enlaceWhatsAppAgencia } from "../../utils/whatsapp";

/**
 * Bloque de confianza bajo el resumen de cada reserva: solo afirma lo que el
 * sistema hace de verdad (precio calculado en el servidor, datos visibles
 * solo para la agencia, asesor humano por WhatsApp).
 */
export default function AyudaReserva({ producto }: { producto: string }) {
  const garantias = [
    { icono: BadgeCheck, texto: "El precio lo calcula el sistema con las tarifas vigentes" },
    { icono: LockKeyhole, texto: "Tus datos solo los ve el equipo de la agencia" },
    { icono: Headset, texto: "Un asesor te acompaña hasta el viaje" },
  ];
  return (
    <div className="mt-3 space-y-3">
      <ul className="space-y-2 rounded-2xl border border-border bg-card p-4">
        {garantias.map(({ icono: Icono, texto }) => (
          <li key={texto} className="flex items-start gap-2.5 text-xs text-muted-foreground">
            <Icono className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {texto}
          </li>
        ))}
      </ul>
      <a
        href={enlaceWhatsAppAgencia(`Hola, tengo una pregunta sobre la reserva de ${producto}.`)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-3 text-sm transition hover:bg-[#25D366]/15"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
          <MessageCircle className="h-4 w-4" />
        </span>
        <span>
          <span className="block font-semibold text-foreground">¿Dudas con tu reserva?</span>
          <span className="block text-xs text-muted-foreground">Escríbenos por WhatsApp</span>
        </span>
      </a>
    </div>
  );
}
