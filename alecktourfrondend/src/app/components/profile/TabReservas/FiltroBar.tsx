import FilterChip from "../../shared/FilterChip";
import SearchInput from "../../shared/SearchInput";
import { FiltroEstado, filtroOpciones } from "./constants";

interface Props {
  filtro: FiltroEstado;
  setFiltro: (f: FiltroEstado) => void;
  busqueda: string;
  setBusqueda: (s: string) => void;
  counts: Record<FiltroEstado, number>;
}

export default function FiltroBar({ filtro, setFiltro, busqueda, setBusqueda, counts }: Props) {
  return (
    <div className="space-y-3 mb-5">
      <SearchInput
        value={busqueda}
        onChange={setBusqueda}
        placeholder="Buscar por código de paquete, reserva o fechas..."
      />
      <div className="flex gap-2 flex-wrap">
        {filtroOpciones.map((op) => (
          <FilterChip
            key={op.value}
            selected={filtro === op.value}
            onClick={() => setFiltro(op.value)}
            icon={<op.icon className="w-3.5 h-3.5" />}
            count={counts[op.value]}
          >
            {op.label}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}
