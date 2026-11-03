## ¿Qué prueba este PR?

<!-- Describe el comportamiento que verifican los tests, no el código. -->

## Capas

- **Capa del autor esta semana**: <!-- Front / API / BD / E2E -->
- **Capa del revisor esta semana**: <!-- debe ser distinta a la del autor -->

## Checklist

- [ ] Los tests siguen el patrón AAA (Arrange, Act, Assert)
- [ ] Los nombres de los tests describen el comportamiento esperado
- [ ] Hice fallar cada test al menos una vez para comprobar que detecta el error
- [ ] Los tests pasan en local
- [ ] No hay credenciales ni datos reales en los tests

## ¿Cómo lo ejecuto?

```bash
# Frontend (Vitest + cobertura):   cd alecktourfrondend && pnpm test
# Backend (pytest + cobertura):    cd backend && pytest
# E2E (Playwright, backend arriba): cd e2e && pnpm test
```

## Mutante (desde la semana 2)

<!-- Qué cambié en el código para comprobar que el test detecta el error, y qué test falló. -->
