// Se carga antes de cada archivo de test (vite.config.ts > test.setupFiles).
// Agrega los matchers de jest-dom: toBeInTheDocument, toBeDisabled, etc.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Desmonta lo renderizado y limpia el almacenamiento entre tests: cada
// test arranca desde cero (FIRST: Independent).
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
