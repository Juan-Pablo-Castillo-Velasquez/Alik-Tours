import { useEffect, useRef, useState } from "react";
import type { Cotizacion, SeleccionProducto } from "../data/reservaTypes";
import { reservaService } from "../services/reserva.service";

/**
 * Pide al backend el desglose de la selección (con una pausa corta para no
 * consultar en cada clic). `null` como selección = todavía falta algo.
 * Ignora respuestas viejas si el cliente cambió algo entretanto.
 */
export function useCotizacion(seleccion: SeleccionProducto | null, espera = 350) {
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);
  const clave = seleccion ? JSON.stringify(seleccion) : "";

  useEffect(() => {
    if (!seleccion) {
      setCotizacion(null);
      setError(null);
      setCargando(false);
      return;
    }
    const mio = ++turno.current;
    setCargando(true);
    const t = setTimeout(() => {
      reservaService
        .cotizar(seleccion)
        .then((c) => {
          if (mio !== turno.current) return;
          setCotizacion(c);
          setError(null);
        })
        .catch((e: any) => {
          if (mio !== turno.current) return;
          setCotizacion(null);
          setError(e?.message || "No pudimos calcular el precio");
        })
        .finally(() => {
          if (mio === turno.current) setCargando(false);
        });
    }, espera);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, espera]);

  return { cotizacion, cargando, error };
}
