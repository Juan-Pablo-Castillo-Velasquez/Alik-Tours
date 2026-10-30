// En producción, VITE_API_BASE_URL debe apuntar al backend real (variable de
// entorno en Vercel/hosting). Sin la variable definida (dev local), usa
// localhost como siempre — mismo criterio que src/app/api/v1/api.ts.
import { BASE_URL } from '../api/v1/api';

export interface UsuarioCreate {
  username: string;
  correo_electronico: string;
  password: string;
  /** Versión de los términos aceptada de forma expresa en el registro. */
  terminos_version?: string;
}

export interface UsuarioLogin {
  username: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  user_id: number;
  email: string;
  // El backend NUNCA devuelve el token de verificación acá a propósito
  // (ver /auth/resend-verification en auth_route.py): si lo hiciera, el
  // frontend podría "auto-verificar" la cuenta sin que el usuario abriera
  // su correo, que es justo lo que este flujo existe para exigir. Antes
  // este campo se declaraba como si sí llegara (nunca llegó) y RegisterModal
  // lo usaba para un botón que en realidad siempre fallaba en producción.
  access_token?: string;
  token_type?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id?: number;
  username?: string;
  id_cliente?: number;
  roles?: string[];
  // El backend ya lo devuelve (ver login_user en auth_service.py) — faltaba
  // declararlo aquí, así que LoginModal.tsx/Login.tsx nunca lo leían y la
  // foto de perfil desaparecía de la sesión con cada login nuevo, aunque
  // siguiera guardada en la base de datos.
  foto_perfil?: string | null;
  // Un login exitoso siempre implica verificado=true y activo=true (ver
  // login_user, auth_service.py — bloquea el login si alguno es false),
  // así que el backend los devuelve explícitos.
  verificado?: boolean;
  activo?: boolean;
}

async function authFetch<T>(endpoint: string, body: object): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = Array.isArray(err.detail)
      ? err.detail.map((d: any) => d.msg).join(', ')
      : err.detail || 'Error en la autenticación';
    throw new Error(msg);
  }

  return response.json();
}

export const authService = {
  register: (data: UsuarioCreate) =>
    authFetch<RegisterResponse>('/auth/register', data),

  login: (data: UsuarioLogin) =>
    authFetch<AuthResponse>('/auth/login', data),

  verifyEmail: async (token: string) => {
    const response = await fetch(
      `${BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: 'POST', headers: { 'accept': 'application/json' } }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al verificar email');
    }
    return response.json();
  },

  // ✅ Estos van DENTRO del objeto
  forgotPassword: (correo_electronico: string) =>
    authFetch<{ message: string }>('/auth/forgot-password', { correo_electronico }),

  resetPassword: (token: string, new_password: string) =>
    authFetch<{ message: string }>('/auth/reset-password', { token, new_password }),

  resendVerification: (correo_electronico: string) =>
    authFetch<{ message: string }>('/auth/resend-verification', { correo_electronico }),

  // Verifica la cuenta con el código de 6 dígitos que llega en el mismo
  // correo que el enlace (ver /auth/verify-email-code en auth_route.py).
  // A diferencia de verifyEmail (por token), esta sí devuelve tokens de
  // sesión completos -- RegisterModal.tsx usa esto para loguear a la
  // persona de inmediato apenas confirma el código, sin pedirle que
  // además inicie sesión a mano.
  verifyEmailCode: (correo_electronico: string, codigo: string) =>
    authFetch<AuthResponse>('/auth/verify-email-code', { correo_electronico, codigo }),
};