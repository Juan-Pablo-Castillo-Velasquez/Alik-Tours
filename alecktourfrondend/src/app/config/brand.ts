// Fuente única de la identidad comercial de la agencia. Antes el nombre
// aparecía escrito de cuatro formas distintas (AlekTours, AlecTours,
// Alik tours, Alik Tours) y cada componente dibujaba su propio "logo"
// con un ícono de avión -- todo lo visible ahora sale de aquí.
export const BRAND = {
  name: "Alik Tours",
  slogan: "Viajar Para Vivir",
  // Registro Nacional de Turismo (publicado por la agencia en su perfil
  // oficial de Instagram).
  rnt: "224224",
  siteUrl: "https://alik-tours.vercel.app",
  // Teléfono publicado en el JSON-LD del sitio (index.html).
  telefono: "+57 322 812 7104",
  instagram: "https://www.instagram.com/aliktours/",
  // Logo oficial (círculo "ALIK TOURS - Viajar Para Vivir"), ver public/.
  logo: "/logo-alik-tours-160.png",
  logoLarge: "/logo-alik-tours.png",
} as const;
