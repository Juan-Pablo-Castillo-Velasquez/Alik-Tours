"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./utils";

interface PaginationProps {
  /** Página actual (base 0). */
  page: number;
  /** Total de páginas (>= 1). */
  pageCount: number;
  /** Se llama con la nueva página (base 0). */
  onPageChange: (page: number) => void;
  className?: string;
  /** Máximo de botones numéricos visibles a la vez (el resto se colapsa con …). */
  siblingCount?: number;
  /** Si se pasan, muestra "Mostrando 1–6 de 14" y la palabra de lo que se cuenta. */
  total?: number;
  pageSize?: number;
  etiqueta?: string;
}

function rangoPaginado(total: number, actual: number, hermanos: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const izquierda = Math.max(0, actual - hermanos);
  const derecha = Math.min(total - 1, actual + hermanos);
  const items: (number | "…")[] = [];
  const agregar = (v: number) => {
    if (items[items.length - 1] !== v) items.push(v);
  };
  for (let i = izquierda; i <= derecha; i++) agregar(i);
  if (izquierda > 1) {
    if (izquierda > 2) items.unshift("…");
    items.unshift(0);
  } else {
    while (items[0] !== 0) items.unshift(items[0] === 1 ? 0 : "…");
  }
  if (derecha < total - 2) {
    items.push("…");
  }
  if (items[items.length - 1] !== total - 1) items.push(total - 1);
  return items;
}

/**
 * Paginación numérica reutilizable (1-2-3-4… con anterior/siguiente).
 * Se usa al pie de las tablas/listas largas del admin y del perfil para
 * distribuir la información en páginas en vez de mostrar todo en una sola
 * lista interminable.
 */
export default function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
  siblingCount = 1,
  total,
  pageSize,
  etiqueta,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const resumen =
    total != null && pageSize
      ? `Mostrando ${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} de ${total}${etiqueta ? ` ${etiqueta}` : ""}`
      : null;

  const paginas = rangoPaginado(pageCount, page, siblingCount);

  const btn =
    "min-w-8 h-8 px-1.5 inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <nav
      aria-label="Paginación"
      className={cn(
        "flex flex-wrap items-center gap-2",
        resumen ? "justify-between" : "justify-center",
        className,
      )}
    >
      {resumen && <p className="text-xs text-muted-foreground tabular-nums">{resumen}</p>}
      <div className="flex flex-wrap items-center justify-center gap-1">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
        className={cn(btn, "text-muted-foreground hover:bg-muted hover:text-foreground")}
        aria-label="Página anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {paginas.map((p, i) =>
        p === "…" ? (
          <span key={`d-${i}`} className="min-w-5 h-8 inline-flex items-center justify-center text-xs text-muted-foreground select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              btn,
              p === page
                ? "bg-gradient-to-r from-primary to-[#A13B55] text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={p === page ? "page" : undefined}
          >
            {p + 1}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
        className={cn(btn, "text-muted-foreground hover:bg-muted hover:text-foreground")}
        aria-label="Página siguiente"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      </div>
    </nav>
  );
}
