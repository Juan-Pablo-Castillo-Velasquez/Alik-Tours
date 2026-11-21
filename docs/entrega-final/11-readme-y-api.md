# 11. README con sección de pruebas y API documentada

| Qué pide el criterio | Dónde está |
|---|---|
| README actualizado | [`README.md`](../../README.md): stack, características (incluye IoT), arquitectura, instalación, variables, Docker, migraciones, desarrollo local, **pruebas**, API, servicios, contribución, seguridad, documentación y autores |
| Sección de pruebas | [`README.md` › Pruebas](../../README.md#pruebas): tabla con el resultado de la última ejecución por suite (566 backend, 356 frontend, 33 E2E), cobertura y umbrales, comandos por capa, integración con PostgreSQL y enlaces al plan, al informe de unitarias y al reporte de defectos |
| Guía de pruebas por semana | [`docs/testing/README.md`](../testing/README.md): qué se probó en cada semana del bootcamp, quién lo hizo y el comando exacto |
| API del backend documentada | [`api-referencia-completa.md`](../referencia-tecnica/api-referencia-completa.md): **221 operaciones** en todos los módulos (método, ruta, descripción, acceso, parámetros, cuerpo y códigos de respuesta), generada desde el OpenAPI real por `backend/scripts/generar_referencia_api.py` para que nunca quede desactualizada |
| Esquema OpenAPI | [`openapi.json`](../referencia-tecnica/openapi.json) (importable en Postman o Insomnia) y Swagger UI en `/docs`, ReDoc en `/redoc` |
| Ejemplos de autenticación y uso | [`api-endpoints.md`](../referencia-tecnica/api-endpoints.md) (login, refresh, cabeceras, rate limiting) |
| Contrato de errores | [`03-arranque-del-backend.md` §3.4](03-arranque-del-backend.md#34-mensajes-de-error-de-la-api-contrato) |
| Protocolo del dispositivo IoT | [`06-iot.md` §6.2](06-iot.md#62-protocolo-de-comunicación) |

El backend documentado es el cuarto backend del programa (FastAPI, ver la
comparación en [`14-reflexion-backends-y-deuda-tecnica.md`](14-reflexion-backends-y-deuda-tecnica.md)).
