// Trineo con renos que cruza el cielo de la portada cada cierto tiempo,
// dejando una estela de destellos. Silueta dibujada a mano (trazos
// propios), aria-hidden y sin eventos de puntero. Se anima solo con
// transform/opacity (ver .temporada-trineo en temporada.css).
function Reno({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {/* cuerpo */}
      <path d="M2 22c3-4 12-5 20-3 2 .5 4-1 6-3l2-1 1 2c-1 2-2 4-4 5 1 2 1 4 0 6l-2 6h-2l1-6c-4 1-10 1-14 0l-2 6H6l1-7c-3-1-5-3-5-5Z" />
      {/* astas */}
      <path d="M28 15c0-3 1-5 3-7m-3 7c-1-3-3-4-5-5m8 2 3-2m-3-3 2-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* patas en carrera */}
      <path d="M7 29l-4 6M21 29l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

export default function TrineoNavidad() {
  return (
    <div className="temporada-trineo pointer-events-none absolute left-0 top-[14%] z-[5] w-full" aria-hidden="true" data-testid="trineo">
      <div className="temporada-trineo__vuelo w-48 sm:w-72">
        <svg viewBox="0 0 260 60" className="block h-auto w-full text-white/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" fill="currentColor">
          {/* riendas */}
          <path d="M78 34C110 30 140 26 170 24M78 34c40-2 70-4 104-10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7" />
          {/* trineo */}
          <path d="M14 30h44c6 0 10-4 12-9l2-4h6l-3 8c-3 8-9 13-18 13H20c-4 0-7-3-6-8Z" />
          <path d="M8 44h60c6 0 9-3 10-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M20 38v6M56 38v6" stroke="currentColor" strokeWidth="2" />
          {/* bolsa de regalos */}
          <path d="M22 30c-2-8 2-15 10-16 8 0 12 7 10 16Z" opacity="0.9" />
          <Reno x={168} />
          <Reno x={208} />
        </svg>
        <span className="temporada-trineo__estela" />
      </div>
    </div>
  );
}
