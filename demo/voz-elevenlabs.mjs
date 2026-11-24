// Lee el texto por stdin y escribe un WAV en la ruta del primer argumento.
// La llave va en un archivo FUERA del repositorio (ver README.md); nunca se
// sube a git ni se pega en un chat o una captura.
import { readFileSync, writeFileSync } from "node:fs";

const [destino] = process.argv.slice(2);
const {
  ELEVENLABS_API_KEY: llave,
  ELEVENLABS_VOICE_ID: voz,
  ELEVENLABS_MODEL: modelo = "eleven_multilingual_v2",
} = process.env;
if (!destino || !llave || !voz) {
  console.error("Faltan ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID o la ruta de salida");
  process.exit(2);
}
const HZ = 24000;
const res = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=pcm_${HZ}`,
  {
    method: "POST",
    headers: { "xi-api-key": llave, "Content-Type": "application/json" },
    body: JSON.stringify({ text: readFileSync(0, "utf8").trim(), model_id: modelo, language_code: "es" }),
  },
);
if (!res.ok) {
  console.error(`ElevenLabs respondió ${res.status}`);
  process.exit(1);
}

// La API entrega PCM crudo (16 bits, mono): se le antepone la cabecera WAV de 44 bytes.
const pcm = Buffer.from(await res.arrayBuffer());
const cab = Buffer.alloc(44);
cab.write("RIFF", 0);
cab.writeUInt32LE(36 + pcm.length, 4);
cab.write("WAVEfmt ", 8);
cab.writeUInt32LE(16, 16);
cab.writeUInt16LE(1, 20);
cab.writeUInt16LE(1, 22);
cab.writeUInt32LE(HZ, 24);
cab.writeUInt32LE(HZ * 2, 28);
cab.writeUInt16LE(2, 32);
cab.writeUInt16LE(16, 34);
cab.write("data", 36);
cab.writeUInt32LE(pcm.length, 40);
writeFileSync(destino, Buffer.concat([cab, pcm]));
