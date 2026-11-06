import { apiFetch } from "../api/v1/api";

/** Tope de seguridad: más registros que esto ya pide paginación en el servidor. */
export const MAX_REGISTROS = 5000;

/**
 * Trae TODAS las páginas de un listado del backend (skip/limit) hasta que
 * una página llegue incompleta.
 *
 * Por qué: el panel pedía una sola página (/reservas?limit=100,
 * /clientes?limit=300, /pagos?limit=300). Con más registros que eso, el
 * resto simplemente no aparecía en las tablas, en los filtros ni en las
 * cifras que el panel calcula, sin ningún aviso. En clientes era peor:
 * el backend ordena del más antiguo al más nuevo, así que los clientes
 * NUEVOS eran los que desaparecían.
 *
 * `ruta` sin skip/limit (ej. "/reservas" o "/paquetes?incluir_inactivos=true").
 * `porPagina` debe ser <= el máximo que acepta ese endpoint.
 */
export async function cargarTodo<T>(ruta: string, porPagina: number): Promise<T[]> {
  const sep = ruta.includes("?") ? "&" : "?";
  const todo: T[] = [];
  for (let skip = 0; skip < MAX_REGISTROS; skip += porPagina) {
    const pagina = await apiFetch<T[]>(`${ruta}${sep}skip=${skip}&limit=${porPagina}`);
    todo.push(...pagina);
    if (pagina.length < porPagina) break;
  }
  return todo;
}
