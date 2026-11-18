import { Ban, CheckCircle, Clock, TrendingUp } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { FiltroEstado } from "./constants";

interface Props {
  counts: Record<FiltroEstado, number>;
}

export default function MetricasResumen({ counts }: Props) {
  const items = [
    {
      label: "Reservas",
      value: counts.todas,
      color: "text-primary border-primary/20 bg-primary/5",
      icon: TrendingUp,
    },
    {
      label: "Confirmadas",
      value: counts.confirmada,
      color:
        "text-success border-success/20 bg-success/5",
      icon: CheckCircle,
    },
    {
      label: "Por confirmar",
      value: counts.pendiente,
      color:
        "text-warning border-warning/20 bg-warning/5",
      icon: Clock,
    },
    {
      label: "Canceladas",
      value: counts.cancelada,
      color: "text-destructive border-destructive/20 bg-destructive/5",
      icon: Ban,
    },
  ];

  return (
    <section>
      <SectionHeader
        title="Tus reservas en números"
        subtitle="Cómo van tus viajes con nosotros"
        icon={TrendingUp}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((s) => (
          <div
            key={s.label}
            className={`border rounded-xl p-4 text-center transition-all ${s.color}`}
          >
            <s.icon className="w-4 h-4 mx-auto mb-1 opacity-75" />
            <p className="text-2xl font-extrabold tracking-tight leading-none">
              {s.value}
            </p>
            <p className="text-[10px] font-medium opacity-80 uppercase tracking-wider mt-1.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}