import { AlertCircle, Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useId,
  useState,
  type ElementType,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useT } from "../../i18n";
import ContadorCaracteres from "../ui/ContadorCaracteres";

/**
 * Campos de formulario del sitio. Todos comparten:
 * - etiqueta visible unida al control (htmlFor/id automáticos),
 * - texto de ayuda y error conectados con aria-describedby,
 * - aria-invalid cuando hay error y el error se anuncia (role="alert"),
 * - límite de caracteres obligatorio en los de texto (maxLength), con
 *   contador visible en las áreas de texto,
 * - el mismo estilo (borde, radio, foco con el color de marca).
 */

export const claseControl =
  "w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60";
const normal = "border-border focus:border-primary focus:ring-primary/15";
const conError = "border-destructive focus:border-destructive focus:ring-destructive/15";

interface Base {
  label: ReactNode;
  ayuda?: ReactNode;
  error?: string | null;
  opcional?: boolean;
  /** Elemento a la derecha de la etiqueta (p. ej. «¿Olvidaste tu contraseña?»). */
  extraEtiqueta?: ReactNode;
  className?: string;
}

function Marco({
  id,
  label,
  ayuda,
  error,
  opcional,
  extraEtiqueta,
  className = "",
  children,
  pie,
}: Base & { id: string; children: ReactNode; pie?: ReactNode }) {
  const t = useT();
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {opcional && <span className="ml-1 font-normal text-muted-foreground">({t("registro.opcional").toLowerCase()})</span>}
        </label>
        {extraEtiqueta}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className="mt-1.5 text-xs text-muted-foreground">
            {ayuda}
          </p>
        )
      )}
      {pie}
    </div>
  );
}

const describedBy = (id: string, error?: string | null, ayuda?: ReactNode) =>
  error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;

type CampoTextoProps = Base &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "maxLength"> & {
    maxLength: number;
    icono?: ElementType;
    claseInput?: string;
  };

export const CampoTexto = forwardRef<HTMLInputElement, CampoTextoProps>(function CampoTexto(
  { label, ayuda, error, opcional, extraEtiqueta, className, icono: Icono, claseInput = "", id: idProp, type = "text", ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const t = useT();
  const [ver, setVer] = useState(false);
  const esPassword = type === "password";
  return (
    <Marco id={id} label={label} ayuda={ayuda} error={error} opcional={opcional} extraEtiqueta={extraEtiqueta} className={className}>
      <div className="group relative">
        {Icono && (
          <Icono
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
            aria-hidden
          />
        )}
        <input
          ref={ref}
          id={id}
          type={esPassword && ver ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, ayuda)}
          className={`${claseControl} ${error ? conError : normal} ${Icono ? "pl-10" : ""} ${esPassword ? "pr-11" : ""} ${claseInput}`}
          {...rest}
        />
        {esPassword && (
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? t("login.ocultar") : t("login.mostrar")}
            aria-pressed={ver}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {ver ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
          </button>
        )}
      </div>
    </Marco>
  );
});

type CampoAreaProps = Base &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "maxLength" | "value"> & {
    maxLength: number;
    value: string;
    /** Mínimo de caracteres: se muestra junto al contador. */
    minimo?: number;
  };

export const CampoArea = forwardRef<HTMLTextAreaElement, CampoAreaProps>(function CampoArea(
  { label, ayuda, error, opcional, extraEtiqueta, className, id: idProp, maxLength, value, minimo, rows = 4, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const faltan = minimo ? minimo - value.trim().length : 0;
  return (
    <Marco
      id={id}
      label={label}
      ayuda={ayuda}
      error={error}
      opcional={opcional}
      extraEtiqueta={extraEtiqueta}
      className={className}
      pie={
        <div className="flex items-start justify-between gap-2">
          {minimo && faltan > 0 ? <span className="mt-1 text-xs text-muted-foreground">Mínimo {minimo} · faltan {faltan}</span> : <span />}
          <ContadorCaracteres valor={value} max={maxLength} />
        </div>
      }
    >
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, ayuda)}
        className={`${claseControl} ${error ? conError : normal} resize-y`}
        {...rest}
      />
    </Marco>
  );
});

type CampoSelectProps = Base & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & { children: ReactNode };

export const CampoSelect = forwardRef<HTMLSelectElement, CampoSelectProps>(function CampoSelect(
  { label, ayuda, error, opcional, extraEtiqueta, className, id: idProp, children, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Marco id={id} label={label} ayuda={ayuda} error={error} opcional={opcional} extraEtiqueta={extraEtiqueta} className={className}>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, ayuda)}
        className={`${claseControl} ${error ? conError : normal}`}
        {...rest}
      >
        {children}
      </select>
    </Marco>
  );
});

/** Mensaje de error general de un formulario (arriba del botón). */
export function ErrorFormulario({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Botón principal de formulario, con estado de carga anunciado. */
export function BotonPrincipal({
  cargando,
  textoCargando,
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { cargando?: boolean; textoCargando?: string }) {
  return (
    <button
      aria-busy={cargando || undefined}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none ${className}`}
      {...rest}
    >
      {cargando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {cargando && textoCargando ? textoCargando : children}
    </button>
  );
}
