// Ilustración temática de educación (escuela, birrete, libros, estudiantes).
// Es una imagen vectorial: no depende de archivos externos ni de internet.
export default function EducationArt({ className = '' }) {
  return (
    <svg viewBox="0 0 420 320" className={className} role="img" aria-label="Ilustración de una escuela">
      {/* Piso / jardín */}
      <ellipse cx="210" cy="278" rx="200" ry="34" fill="#2E9E6B" opacity="0.18" />

      {/* Sol */}
      <g>
        <circle cx="356" cy="62" r="22" fill="#E5A33D" />
        {[...Array(8)].map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={356 + Math.cos(a) * 28}
              y1={62 + Math.sin(a) * 28}
              x2={356 + Math.cos(a) * 36}
              y2={62 + Math.sin(a) * 36}
              stroke="#E5A33D"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* Árboles */}
      <g>
        <rect x="52" y="212" width="8" height="40" rx="3" fill="#8B5E3C" />
        <circle cx="56" cy="200" r="26" fill="#2E9E6B" />
        <rect x="372" y="220" width="7" height="34" rx="3" fill="#8B5E3C" />
        <circle cx="375" cy="210" r="20" fill="#2E9E6B" opacity="0.9" />
      </g>

      {/* Escalones */}
      <rect x="132" y="246" width="176" height="10" rx="2" fill="#C9D6E8" />
      <rect x="146" y="236" width="148" height="10" rx="2" fill="#DCE6F4" />

      {/* Cuerpo del edificio */}
      <rect x="150" y="150" width="140" height="86" fill="#FFFFFF" stroke="#1E5AA8" strokeWidth="3" />

      {/* Columnas */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={165 + i * 32} y="166" width="10" height="60" fill="#E8F0FB" stroke="#1E5AA8" strokeWidth="1.5" />
      ))}

      {/* Frontón (techo) */}
      <path d="M133 150 L220 98 L307 150 Z" fill="#1E5AA8" />
      <path d="M133 150 L220 98 L307 150 Z" fill="none" stroke="#15457F" strokeWidth="2" />

      {/* Reloj */}
      <circle cx="220" cy="127" r="10" fill="#E8F0FB" />
      <line x1="220" y1="127" x2="220" y2="121" stroke="#15457F" strokeWidth="2" strokeLinecap="round" />
      <line x1="220" y1="127" x2="225" y2="129" stroke="#15457F" strokeWidth="2" strokeLinecap="round" />

      {/* Asta y bandera */}
      <line x1="220" y1="98" x2="220" y2="74" stroke="#15457F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M220 76 L240 82 L220 88 Z" fill="#D14545" />

      {/* Puerta */}
      <rect x="206" y="196" width="28" height="40" rx="2" fill="#15457F" />
      <circle cx="229" cy="216" r="1.6" fill="#E8F0FB" />

      {/* Estudiantes */}
      <g>
        <circle cx="180" cy="214" r="7" fill="#E5A33D" />
        <path d="M170 236 q10 -16 20 0 Z" fill="#1E5AA8" />
      </g>
      <g>
        <circle cx="260" cy="214" r="7" fill="#2E9E6B" />
        <path d="M250 236 q10 -16 20 0 Z" fill="#D14545" />
      </g>

      {/* Birrete de graduación flotante */}
      <g>
        <path d="M108 66 L150 82 L108 98 L66 82 Z" fill="#1B2733" />
        <path d="M92 89 q16 12 32 0 v10 q-16 11 -32 0 Z" fill="#1B2733" />
        <circle cx="108" cy="82" r="3" fill="#E5A33D" />
        <line x1="150" y1="82" x2="150" y2="104" stroke="#E5A33D" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="150" cy="106" r="3.5" fill="#E5A33D" />
      </g>

      {/* Pila de libros */}
      <g>
        <rect x="300" y="224" width="76" height="13" rx="2.5" fill="#D14545" />
        <rect x="305" y="211" width="76" height="13" rx="2.5" fill="#E5A33D" />
        <rect x="298" y="198" width="76" height="13" rx="2.5" fill="#2E9E6B" />
      </g>
    </svg>
  );
}
