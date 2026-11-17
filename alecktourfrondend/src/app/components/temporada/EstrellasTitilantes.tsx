import { CSSProperties } from "react";

// Estrellas que titilan sobre la portada en temporada navideña.
const ESTRELLAS = [
  { x: "22%", y: "12%", t: 10, r: "0s" },
  { x: "38%", y: "6%", t: 7, r: "-1.2s" },
  { x: "47%", y: "18%", t: 12, r: "-2.1s" },
  { x: "61%", y: "8%", t: 8, r: "-0.6s" },
  { x: "74%", y: "22%", t: 9, r: "-1.8s" },
  { x: "88%", y: "30%", t: 7, r: "-2.6s" },
  { x: "14%", y: "40%", t: 6, r: "-0.3s" },
  { x: "55%", y: "34%", t: 6, r: "-1.5s" },
];

export default function EstrellasTitilantes() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[4]" aria-hidden="true">
      {ESTRELLAS.map((e, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="temporada-estrella absolute"
          style={{ left: e.x, top: e.y, width: e.t, height: e.t, "--retraso": e.r } as CSSProperties}
          fill="#fff6d6"
        >
          <path d="M12 1.5 14 10l8.5 2-8.5 2-2 8.5-2-8.5L1.5 12 10 10Z" />
        </svg>
      ))}
    </div>
  );
}
