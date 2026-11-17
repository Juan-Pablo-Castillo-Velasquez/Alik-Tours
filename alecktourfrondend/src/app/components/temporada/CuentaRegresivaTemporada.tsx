import { PartyPopper, TreePine } from "lucide-react";
import { useEffect, useState } from "react";
import { useTema } from "../../context/TemaContext";

// Cuenta regresiva de la temporada en la portada: días, horas, minutos y
// segundos para Navidad (25 de diciembre) o para Año Nuevo. Solo aparece
// con el tema de esa temporada activo y mientras falte tiempo; el día de
// la fiesta muestra un saludo en vez de ceros.

interface Objetivo {
  fecha: Date;
  falta: string;
  saludo: string;
  Icono: typeof TreePine;
}

export function objetivoTemporada(clave: string | undefined, ahora: Date): Objetivo | null {
  const anio = ahora.getFullYear();
  if (clave === "navidad") {
    const navidad = new Date(anio, 11, 25);
    return { fecha: navidad, falta: "para Navidad", saludo: "¡Feliz Navidad!", Icono: TreePine };
  }
  if (clave === "fin-de-anio") {
    // En enero el objetivo es el 1 de enero recién pasado (muestra el saludo).
    const anioNuevo = ahora.getMonth() === 0 ? new Date(anio, 0, 1) : new Date(anio + 1, 0, 1);
    return { fecha: anioNuevo, falta: "para Año Nuevo", saludo: "¡Feliz Año Nuevo!", Icono: PartyPopper };
  }
  return null;
}

export function partesRestantes(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
  };
}

const UN_DIA = 86_400_000;

export default function CuentaRegresivaTemporada() {
  const { temaActivo } = useTema();
  const [ahora, setAhora] = useState(() => new Date());

  const objetivo = temaActivo && !temaActivo.es_predeterminado ? objetivoTemporada(temaActivo.clave, ahora) : null;

  useEffect(() => {
    if (!objetivo) return;
    const id = window.setInterval(() => setAhora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [Boolean(objetivo)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!objetivo) return null;
  const restante = objetivo.fecha.getTime() - ahora.getTime();
  // Pasado el día de la fiesta (y sin que el admin cambie de tema) no se
  // muestra nada: una cuenta en negativo se vería rota.
  if (restante < -UN_DIA) return null;
  // Más de 60 días es una temporada mal programada (p. ej. Navidad activa
  // en marzo): no se muestra una cuenta de meses.
  if (restante > 60 * UN_DIA) return null;

  const { Icono } = objetivo;

  if (restante <= 0) {
    return (
      <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-4 py-1.5 text-sm font-bold text-[var(--gold-foreground)] shadow-lg">
        <Icono className="h-4 w-4" aria-hidden="true" />
        {objetivo.saludo}
      </div>
    );
  }

  const p = partesRestantes(restante);
  const bloques: [number, string][] = [
    [p.dias, p.dias === 1 ? "día" : "días"],
    [p.horas, "horas"],
    [p.minutos, "min"],
    [p.segundos, "seg"],
  ];

  return (
    <div className="mb-6" data-testid="cuenta-regresiva">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
        <Icono className="h-3.5 w-3.5 text-[var(--gold)]" aria-hidden="true" />
        Faltan {objetivo.falta}
      </p>
      {/* El lector de pantalla recibe una frase; los bloques son visuales. */}
      <p className="sr-only">
        Faltan {p.dias} días y {p.horas} horas {objetivo.falta}.
      </p>
      <div className="flex gap-2" aria-hidden="true">
        {bloques.map(([valor, etiqueta]) => (
          <div
            key={etiqueta}
            className="min-w-[3.6rem] rounded-xl border border-white/20 bg-white/10 px-2 py-1.5 text-center backdrop-blur-md"
          >
            <span key={valor} className="temporada-tic block text-xl font-bold tabular-nums text-white sm:text-2xl">
              {String(valor).padStart(2, "0")}
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-white/70">{etiqueta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
