import React from "react";

export const CoordinateSystem: React.FC = () => {
  const axisColor = "rgba(255, 255, 255, 0.2)";

  return (
    <g className="coordinate-system" style={{ pointerEvents: "none" }}>
      {/* X 轴 - 使用 vectorEffect 保持线条宽度一致，避免每帧重新计算 */}
      <line
        x1={-50000}
        y1={0}
        x2={50000}
        y2={0}
        stroke={axisColor}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />

      {/* Y 轴 */}
      <line
        x1={0}
        y1={-50000}
        x2={0}
        y2={50000}
        stroke={axisColor}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />

      {/* 原点 */}
      <circle
        cx={0}
        cy={0}
        r={4}
        fill="rgba(99, 102, 241, 0.8)"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
};

export default CoordinateSystem;
