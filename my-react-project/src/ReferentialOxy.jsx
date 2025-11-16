  import React from "react";

  const ReferentialOxy = ({ min, max, points = [], bluePoint }) => {
    const size = 600;
    const center = size / 2;

    const coordToPixel = (val) => center + (val * (size / 2) / max);

    return (
      <svg width={size} height={size} style={{ background: "transparent" }}>
        {/* Axes */}
        <line x1={0} y1={center} x2={size} y2={center} stroke="white" strokeWidth="2" />
        <line x1={center} y1={0} x2={center} y2={size} stroke="white" strokeWidth="2" />

        {/* Tick marks */}
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((tick) => {
          const pos = coordToPixel(tick);
          return (
            <g key={tick}>
              <line x1={pos} y1={center - 5} x2={pos} y2={center + 5} stroke="white" />
              <line x1={center - 5} y1={pos} x2={center + 5} y2={pos} stroke="white" />
            </g>
          );
        })}

        {/* Red points */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={coordToPixel(parseFloat(p.x))}
            cy={coordToPixel(-(parseFloat(p.y)))}
            r={5}
            fill="red"
          />
        ))}

        {/* Blue point */}
        {bluePoint && (
          <circle
            cx={coordToPixel(parseFloat(bluePoint.x))}
            cy={coordToPixel(-parseFloat(bluePoint.y))}
            r={5}
            fill="blue"
          />
        )}
      </svg>
    );
  };

  export default ReferentialOxy;