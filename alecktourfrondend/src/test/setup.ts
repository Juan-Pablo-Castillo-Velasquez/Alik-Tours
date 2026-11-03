// Se carga antes de cada archivo de test (vite.config.ts > test.setupFiles).
// Agrega los matchers de jest-dom: toBeInTheDocument, toBeDisabled, etc.
import "@testing-library/jest-dom/vitest";

// La app la usan personas en Colombia: las fechas se prueban en esa zona
// horaria, sin importar si el test corre en un PC en Bogotá o en el CI
// (que está en UTC y escondería errores de "un día antes").
process.env.TZ = "America/Bogota";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Desmonta lo renderizado y limpia el almacenamiento entre tests: cada
// test arranca desde cero (FIRST: Independent).
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
