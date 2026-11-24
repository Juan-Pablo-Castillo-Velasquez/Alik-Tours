import { useEffect } from "react";
import { toast } from "sonner";
import { EVENTO_LIMITE } from "../../api/v1/api";
import { useT } from "../../i18n";

/** Cuando el servidor corta por exceso de envíos (429), un solo aviso claro
 * con el tiempo de espera, sin importar qué formulario lo provocó. */
export default function AvisoLimiteEnvios() {
  const t = useT();
  useEffect(() => {
    const alLimite = (e: Event) => {
      const { segundos } = (e as CustomEvent<{ mensaje: string; segundos: number }>).detail;
      const minutos = Math.ceil(segundos / 60);
      toast.warning(t("limite.titulo"), {
        id: "limite-envios",
        description:
          segundos < 60 ? t("limite.segundos", { n: segundos }) : t(minutos === 1 ? "limite.minuto" : "limite.minutos", { n: minutos }),
        duration: 8000,
      });
    };
    window.addEventListener(EVENTO_LIMITE, alLimite);
    return () => window.removeEventListener(EVENTO_LIMITE, alLimite);
  }, [t]);
  return null;
}
