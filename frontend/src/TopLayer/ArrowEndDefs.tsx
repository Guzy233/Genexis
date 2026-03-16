import { topLayer } from "../Globals";

topLayer.push(() => {
  return (
    <svg>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" style={{ fill: "var(--edge-stroke)" }} />
        </marker>
        <marker
          id="arrowhead1"
          markerWidth="10"
          markerHeight="7"
          refX="0"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" style={{ fill: "var(--color-secondary)" }} />
        </marker>
      </defs>
    </svg>
  );
})