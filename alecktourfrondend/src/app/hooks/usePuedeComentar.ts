import { useAuth } from "../context/AuthContext";

/** Comentan en la comunidad los clientes con sesión y el equipo de la
 *  agencia (admin/asesor), que responde con el nombre de la agencia. */
export function usePuedeComentar(): boolean {
  const { isAuthenticated, usuario, isAdmin, isEmpleado } = useAuth();
  return isAuthenticated && (usuario?.id_cliente != null || isAdmin || isEmpleado);
}
