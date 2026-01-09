import React from "react";
import { viewport } from "../Controllers/Camera";

export const CoordinateSystem: React.FC = () => {
  const zoom = viewport.zoom;

  // 坐标轴颜色
  const axisColor = "rgba(255, 255, 255, 0.2)";
  const textColor = "rgba(255, 255, 255, 0.4)";
  const gridSize = 100; // 大网格间距
  const smallGridSize = 25; // 小网格间距

  // 生成刻度标记
  const generateTicks = (isX: boolean) => {
    const ticks: React.ReactNode[] = [];
    const range = 5000; // 显示范围
    const step = gridSize;

    for (let i = -range; i <= range; i += step) {
      if (i === 0) continue; // 跳过原点

      const pos = isX ? i : -i;
      ticks.push(
        <g key={i}>
          {/* 刻度线 */}
          <line
            x1={isX ? pos : 0}
            y1={isX ? 0 : pos}
            x2={isX ? pos : 0}
            y2={isX ? 0 : pos}
            stroke={axisColor}
            strokeWidth={isX ? 0 : 0}
          />
          {/* 刻度数字 */}
          <text
            x={isX ? pos : 8}
            y={isX ? -8 : pos}
            fill={textColor}
            fontSize={12 / zoom}
            fontFamily="Arial, sans-serif"
            style={{ userSelect: "none" }}
          >
            {i}
          </text>
        </g>
      );
    }

    return ticks;
  };

  return (
    <g className="coordinate-system" style={{ pointerEvents: "none" }}>
      {/* X 轴 */}
      <line
        x1={-50000}
        y1={0}
        x2={50000}
        y2={0}
        stroke={axisColor}
        strokeWidth={2 / zoom}
      />

      {/* Y 轴 */}
      <line
        x1={0}
        y1={-50000}
        x2={0}
        y2={50000}
        stroke={axisColor}
        strokeWidth={2 / zoom}
      />

      {/* 原点 */}
      <circle
        cx={0}
        cy={0}
        r={4 / zoom}
        fill="rgba(99, 102, 241, 0.8)"
      />

      {/* X 轴刻度 */}
      {generateTicks(true)}

      {/* Y 轴刻度 */}
      {generateTicks(false)}

      {/* 轴标签 */}
      <text
        x={50000 / zoom - 50}
        y={-15 / zoom}
        fill="rgba(99, 102, 241, 0.8)"
        fontSize={16 / zoom}
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        style={{ userSelect: "none" }}
      >
        X
      </text>
      <text
        x={15 / zoom}
        y={-50000 / zoom + 50}
        fill="rgba(99, 102, 241, 0.8)"
        fontSize={16 / zoom}
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        style={{ userSelect: "none" }}
      >
        Y
      </text>
    </g>
  );
};

export default CoordinateSystem;
