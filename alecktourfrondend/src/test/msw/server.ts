// Servidor de MSW para Node (Vitest). Cada archivo de test que lo use hace:
//   beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
//   afterEach(() => server.resetHandlers());
//   afterAll(() => server.close());
// onUnhandledRequest: "error" hace fallar el test si la app llama a un
// endpoint que ningún handler cubre (en vez de salir a la red real).
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
