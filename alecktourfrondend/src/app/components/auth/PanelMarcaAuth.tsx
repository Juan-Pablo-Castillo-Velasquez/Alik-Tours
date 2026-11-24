import { CalendarCheck, FileText, Heart, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { useT } from "../../i18n";

/**
 * Columna izquierda de los modales de acceso (login y registro) en
 * pantallas medianas y grandes: la marca y, en concreto, lo que se puede
 * hacer con la cuenta. Solo funciones que existen en la plataforma.
 */
export default function PanelMarcaAuth({ variante }: { variante: "login" | "registro" }) {
  const t = useT();
  const items =
    variante === "login"
      ? [
          { icono: CalendarCheck, texto: t("auth.panel.reservas") },
          { icono: FileText, texto: t("auth.panel.comprobantes") },
          { icono: MessageSquareText, texto: t("auth.panel.pqr") },
          { icono: Heart, texto: t("auth.panel.favoritos") },
        ]
      : [
          { icono: CalendarCheck, texto: t("auth.panel.reservasRegistro") },
          { icono: Users, texto: t("auth.panel.comunidad") },
          { icono: Heart, texto: t("auth.panel.favoritos") },
          { icono: MessageSquareText, texto: t("auth.panel.pqr") },
        ];
  return (
    <aside
      aria-hidden="true"
      className="relative hidden overflow-hidden bg-primary p-9 text-primary-foreground md:flex md:flex-col"
    >
      {/* Brillo y trazo de ruta: solo decoración. */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[color:var(--gold,#b8912e)]/25 blur-3xl" />
      <svg className="pointer-events-none absolute inset-x-0 bottom-24 h-40 w-full opacity-25" viewBox="0 0 400 160" fill="none">
        <path d="M-10 140 C 80 40, 180 150, 260 70 S 380 20, 420 40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 7" />
        <circle cx="260" cy="70" r="4" fill="currentColor" />
      </svg>

      <div className="relative flex items-center gap-3">
        <img src="/logo-alik-tours-160.png" alt="" className="h-10 w-10 rounded-xl bg-white/95 object-contain p-1" onError={(e) => (e.currentTarget.style.display = "none")} />
        <div>
          <p className="font-serif text-xl font-bold leading-none">Alik Tours</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            {t("marca.lema")}
          </p>
        </div>
      </div>

      <div className="relative mt-auto">
        <h2 className="font-serif text-3xl font-bold leading-tight">
          {variante === "login" ? t("auth.panel.tituloLogin") : t("auth.panel.tituloRegistro")}
        </h2>
        <ul className="mt-6 space-y-3.5">
          {items.map(({ icono: Icono, texto }) => (
            <li key={texto} className="flex items-center gap-3 text-sm text-primary-foreground/90">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icono className="h-4 w-4" />
              </span>
              {texto}
            </li>
          ))}
        </ul>
        <p className="mt-8 flex items-center gap-2 text-xs text-primary-foreground/70">
          <ShieldCheck className="h-4 w-4" />
          {t("auth.panel.datos")}
        </p>
      </div>
    </aside>
  );
}
