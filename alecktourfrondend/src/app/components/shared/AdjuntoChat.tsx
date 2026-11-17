import { Loader2 } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { abrirArchivoProtegido, obtenerArchivoProtegido } from "../../api/v1/api";
import { resolveFotoUrl } from "../admin/types";

// Adjuntos del chat. Los nuevos son privados: la API devuelve una ruta
// "/mensajes/{id}/adjunto" que exige sesión, así que no se pueden poner
// tal cual en un <img src> o <a href>. Aquí se piden con el token y se
// muestran como blob. Los mensajes viejos traen una URL pública y se usan
// directo, como antes.

export function esAdjuntoProtegido(url: string | null | undefined): url is string {
  return !!url && url.startsWith("/mensajes/");
}

function useUrlAdjunto(url: string): string | null | undefined {
  const protegido = esAdjuntoProtegido(url);
  // undefined = cargando, null = error
  const [blobUrl, setBlobUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!protegido) return;
    let vigente = true;
    let creada: string | null = null;
    setBlobUrl(undefined);
    obtenerArchivoProtegido(url)
      .then((blob) => {
        if (!vigente) return;
        creada = URL.createObjectURL(blob);
        setBlobUrl(creada);
      })
      .catch(() => vigente && setBlobUrl(null));
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [url, protegido]);

  return protegido ? blobUrl : (resolveFotoUrl(url) ?? null);
}

export function ImagenAdjunto({
  url,
  className,
  onAmpliar,
}: {
  url: string;
  className?: string;
  onAmpliar?: (src: string) => void;
}) {
  const src = useUrlAdjunto(url);
  if (src === undefined) {
    return (
      <div className="mb-1.5 flex h-32 w-44 items-center justify-center rounded-lg bg-black/5" aria-label="Cargando imagen">
        <Loader2 className="h-5 w-5 animate-spin opacity-60" />
      </div>
    );
  }
  if (src === null) {
    return <p className="mb-1.5 text-xs italic opacity-80">No se pudo cargar la imagen.</p>;
  }
  return (
    <img
      src={src}
      alt="Captura enviada"
      className={className}
      onClick={onAmpliar ? () => onAmpliar(src) : undefined}
    />
  );
}

export function EnlaceAdjunto({
  url,
  nombre,
  className,
  children,
}: {
  url: string;
  nombre?: string | null;
  className?: string;
  children: ReactNode;
}) {
  if (!esAdjuntoProtegido(url)) {
    return (
      <a
        href={resolveFotoUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        download={nombre ?? undefined}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={`w-full text-left ${className ?? ""}`}
      onClick={() =>
        abrirArchivoProtegido(url).catch((e: unknown) =>
          toast.error(e instanceof Error ? e.message : "No se pudo abrir el archivo"),
        )
      }
    >
      {children}
    </button>
  );
}
