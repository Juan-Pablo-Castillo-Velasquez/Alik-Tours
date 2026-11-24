import { Check, Loader2, Search, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "../../../api/v1/api";

export interface ClienteBusqueda {
  id_cliente: number;
  nombre: string;
  apellido: string;
  cedula: string;
  correo: string | null;
  celular: string | null;
  tiene_cuenta: boolean;
}

/**
 * Buscador de clientes: se escribe el nombre, la cédula o el correo y las
 * coincidencias llegan del servidor (GET /api/clientes/buscar), sin cargar
 * el listado completo. Sigue el patrón ARIA "combobox" con lista: flechas
 * para moverse, Enter para elegir, Escape para cerrar, y anuncia cuántos
 * resultados hay a los lectores de pantalla.
 */
export default function ClienteCombobox({
  value,
  onChange,
  label = "Cliente",
  ayuda,
  autoFocus = false,
}: {
  value: ClienteBusqueda | null;
  onChange: (c: ClienteBusqueda | null) => void;
  label?: string;
  ayuda?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ClienteBusqueda[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setResultados([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const t = setTimeout(async () => {
      try {
        setError(null);
        const r = await apiFetch<ClienteBusqueda[]>(`/clientes/buscar?q=${encodeURIComponent(q)}`);
        setResultados(r);
        setActivo(r.length ? 0 : -1);
        setAbierto(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo buscar");
      } finally {
        setCargando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [texto]);

  const elegir = (c: ClienteBusqueda) => {
    onChange(c);
    setTexto("");
    setResultados([]);
    setAbierto(false);
  };

  if (value) {
    return (
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">{label}</p>
        <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {value.nombre[0]}
            {value.apellido[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {value.nombre} {value.apellido}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              CC {value.cedula}
              {value.correo ? ` · ${value.correo}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setTimeout(() => input.current?.focus(), 0);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            aria-label={`Cambiar cliente (${value.nombre} ${value.apellido})`}
          >
            <X className="h-3.5 w-3.5" /> Cambiar
          </button>
        </div>
      </div>
    );
  }

  const listaId = `${id}-lista`;
  const mostrarLista = abierto && texto.trim().length >= 2;
  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={input}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={mostrarLista && activo >= 0 ? `${id}-op-${activo}` : undefined}
          aria-describedby={`${id}-ayuda`}
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={80}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => resultados.length && setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAbierto(true);
              setActivo((a) => Math.min(resultados.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && mostrarLista && activo >= 0 && resultados[activo]) {
              e.preventDefault();
              elegir(resultados[activo]);
            } else if (e.key === "Escape") {
              setAbierto(false);
            }
          }}
          placeholder="Escribe el nombre, la cédula o el correo"
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {cargando && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>
      <p id={`${id}-ayuda`} className="mt-1 text-xs text-muted-foreground">
        {ayuda ?? "Escribe al menos 2 letras y elige de la lista."}
      </p>
      <p className="sr-only" aria-live="polite">
        {mostrarLista && !cargando
          ? resultados.length
            ? `${resultados.length} ${resultados.length === 1 ? "cliente encontrado" : "clientes encontrados"}. Usa las flechas para elegir.`
            : "No hay clientes con ese dato."
          : ""}
      </p>

      {mostrarLista && (
        <ul
          id={listaId}
          role="listbox"
          aria-label="Clientes encontrados"
          className="absolute z-[120] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl"
        >
          {error ? (
            <li className="px-3 py-3 text-sm text-destructive">{error}</li>
          ) : resultados.length === 0 && !cargando ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">No hay clientes con «{texto.trim()}».</li>
          ) : (
            resultados.map((c, i) => (
              <li
                key={c.id_cliente}
                id={`${id}-op-${i}`}
                role="option"
                aria-selected={i === activo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(c)}
                onMouseEnter={() => setActivo(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${i === activo ? "bg-primary/10" : ""}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {c.nombre} {c.apellido}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    CC {c.cedula}
                    {c.correo ? ` · ${c.correo}` : ""}
                    {!c.tiene_cuenta ? " · sin cuenta web" : ""}
                  </span>
                </span>
                {i === activo && <Check className="h-4 w-4 text-primary" aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
