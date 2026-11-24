# Video de demostración de AlikTours

Un programa recorre la aplicación con un navegador, pone rótulos en pantalla, los narra con voz sintética y entrega el video con sus subtítulos. Si la aplicación cambia, el video se vuelve a grabar con un comando.

Basado en la guía *«Demos en video de tu aplicación, grabados con código»* (SENA · CGMLTI).

| Archivo | Qué hace |
|---|---|
| `sembrar.mjs` | Deja listos los datos de ejemplo por la API real: carga las historias y reseñas de ejemplo de la comunidad y el método de pago de la cliente. |
| `guion.mjs` | El recorrido: portada, escenas, rótulos, voz, video y subtítulos. |
| `voz-kokoro.py` | Voz natural en español, **gratis y sin internet al grabar** (Kokoro). Es la que se usó. |
| `voz-elevenlabs.mjs` | Opcional: voz natural con ElevenLabs (de pago por caracteres). |
| `.run/` | Resultados (no se sube a git): `voz/` (caché de audios) y `video/` (`aliktours.webm` y `aliktours.vtt`). |

## Qué muestra (≈ 2 min)

| Rol | Escena |
|---|---|
| Visitante | Explora el inicio, busca hoteles para tres noches, filtra por Cartagena y elige la habitación. |
| Cliente | Inicia sesión y **vuelve a la reserva que estaba haciendo**, revisa los 4 pasos hasta el pago, ve **Mis reservas** y la **comunidad** con «Reservar este viaje». |
| Administración | Panel de control y revisión de la comunidad. |

## Datos de ejemplo

Graba **siempre contra una base de datos de prueba**, nunca contra la de producción: el video se comparte y los datos de personas están protegidos (Ley 1581 de 2012). Las cuentas son de personas inventadas:

| Rol | Correo | Contraseña |
|---|---|---|
| Cliente | `valentina.rios@correo-demo.co` | `Demo2026!` |
| Administración | `admin@correo-demo.co` | `Demo2026!` |

Crea esas dos cuentas en tu base de prueba (o cambia los correos en `sembrar.mjs` y `guion.mjs`) y después:

```bash
node sembrar.mjs
```

Activa el tema de Navidad desde el panel (Temas de temporada) si quieres el video con la decoración de temporada.

## Grabar

Requisitos: Node.js 22+, pnpm, `ffmpeg`, `ffprobe` y, para la voz gratuita, `espeak-ng` (`sudo apt install ffmpeg espeak-ng`).

Graba contra el **build de producción** (`pnpm build && pnpm exec vite preview --port 5173`), no contra el servidor de desarrollo: en desarrollo los estilos cargan tarde y el primer cuadro sale sin diseño.

```bash
cd demo
pnpm install

# 1. Probar el recorrido: rápido, sin voz y viendo el navegador
VER=1 RITMO=0.5 node guion.mjs

# 2. Grabar con voz natural y gratuita (Kokoro). Instala el modelo una vez
#    (instrucciones al inicio de voz-kokoro.py) y graba DOS veces: la primera
#    genera y guarda los audios; la segunda ya los toma de la caché y el
#    recorrido no se queda quieto mientras se genera cada frase.
VOZ_CMD="python3 $PWD/voz-kokoro.py" node guion.mjs
VOZ_CMD="python3 $PWD/voz-kokoro.py" node guion.mjs

#    Voz femenina (ef_dora, la predeterminada) o masculina:
KOKORO_VOZ=em_alex VOZ_CMD="python3 $PWD/voz-kokoro.py" node guion.mjs

#    Voz básica, más robótica, sin instalar nada más:
VOZ_CMD="espeak-ng -v es-419 -s 150 --stdin -w" node guion.mjs

# 3. O con voz natural (ElevenLabs); la llave va en un archivo fuera del repo
set -a; source ~/.config/aliktours-demo/elevenlabs.env; set +a
VOZ_CMD="node $PWD/voz-elevenlabs.mjs" node guion.mjs
```

Si no tienes el Chromium de Playwright instalado, usa tu Chrome con `CANAL=chrome`.

Entre grabaciones no hace falta restaurar la base: el recorrido se detiene antes de confirmar el pago y `sembrar.mjs` se puede correr las veces que quieras.

## Lo que destapó el video

Grabar fue también una revisión funcional. Se corrigió en la aplicación, no se escondió en el guion:

- **Iniciar sesión para reservar hacía perder la reserva.** Quien elegía una habitación sin haber entrado terminaba en su perfil después de iniciar sesión. Ahora vuelve al paso en el que iba.
- **La ficha del hotel decía «1 Noche»** y mostraba la tarifa de una noche como «Total», aunque la búsqueda fuera de tres noches.
- **Las habitaciones solo se podían elegir con el mouse**: la tarjeta no era un botón (ni teclado ni lector de pantalla).
- **Fechas en formato 2026-12-20** en el buscador; ahora «20 dic 2026».
- **En el panel de administración**, al cambiar de sección la página quedaba abajo y la sección nueva se veía en blanco.
- **El detalle de una reserva** era una lista de datos sin un siguiente paso claro y mostraba textos internos («web», «(simulado)»). Ahora dice qué sigue (pagar, prepararse, contar el viaje), con fechas, dónde se queda, el pago y el historial en lenguaje claro.
