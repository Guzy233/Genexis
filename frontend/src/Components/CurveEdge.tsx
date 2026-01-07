import React, { useMemo } from "react";
import { Anchor, Vec2, Obj, Node, Coms } from "../Globals";
import { atom, useAtom } from "jotai";
import { registerSerializer } from "../Serialization";
import {
  ContextMenuFactories,
  ContextMenuItem,
} from "../Controllers/ContextMenu";

// ==================== 类型定义 ====================

interface ResolvedPoint {
  x: number;
  y: number;
  dir: Vec2;
}

export interface CurveEdge extends Obj {
  source: Node;
  target: Node;
  anchorSource: Anchor;
  anchorTarget: Anchor;
  isSelected: boolean;
  label?: string;
}

export const newCurveEdge = (
  source: Node,
  target: Node,
  label: string = ""
): CurveEdge => {
  const id = crypto.randomUUID();
  return {
    id,
    type: "edge/curve",
    updater: atom<number>(0),
    source,
    target,
    anchorSource: { type: "auto" },
    anchorTarget: { type: "auto" },
    isSelected: false,
    label,
  };
};

// ==================== 几何计算逻辑 ====================

const getPresetAnchors = (node: Node): ResolvedPoint[] => {
  return node.eAncs
    .filter(
      (a): a is Extract<Anchor, { type: "posDir" }> => a.type === "posDir"
    )
    .map((a) => ({
      x: node.pos.x + a.pos.x * node.size.x,
      y: node.pos.y + a.pos.y * node.size.y,
      dir: a.dir,
    }));
};

const resolveAnchor = (
  node: Node,
  anchor: Anchor
): ResolvedPoint | ResolvedPoint[] => {
  switch (anchor.type) {
    case "posDir":
      return {
        x: node.pos.x + anchor.pos.x * node.size.x,
        y: node.pos.y + anchor.pos.y * node.size.y,
        dir: anchor.dir,
      };
    case "absPos":
      return { x: node.pos.x, y: node.pos.y, dir: { x: 0, y: 0 } };
    case "auto":
      return getPresetAnchors(node);
    default:
      return { x: node.pos.x, y: node.pos.y, dir: { x: 0, y: 0 } };
  }
};

const resolvePoints = (
  source: Node,
  target: Node,
  anchorSource: Anchor,
  anchorTarget: Anchor
): { source: ResolvedPoint; target: ResolvedPoint } => {
  const sCandidates = resolveAnchor(source, anchorSource);
  const tCandidates = resolveAnchor(target, anchorTarget);
  const sArr = Array.isArray(sCandidates) ? sCandidates : [sCandidates];
  const tArr = Array.isArray(tCandidates) ? tCandidates : [tCandidates];

  let minDistance = Infinity;
  let finalSource = sArr[0];
  let finalTarget = tArr[0];

  for (const s of sArr) {
    for (const t of tArr) {
      const dist = Math.hypot(s.x - t.x, s.y - t.y);
      if (dist < minDistance) {
        minDistance = dist;
        finalSource = s;
        finalTarget = t;
      }
    }
  }
  return { source: finalSource, target: finalTarget };
};

/**
 * 计算完整的 SVG 路径数据
 */
const calculatePath = (
  source: ResolvedPoint,
  target: ResolvedPoint,
  anchorSourceType: Anchor["type"],
  anchorTargetType: Anchor["type"]
): string => {
  const ARROW_GAP = 20;
  const finalTargetX = target.x + target.dir.x * ARROW_GAP;
  const finalTargetY = target.y + target.dir.y * ARROW_GAP;

  const isSourceFree = anchorSourceType === "absPos";
  const isTargetFree = anchorTargetType === "absPos";
  const dist = Math.hypot(source.x - target.x, source.y - target.y);
  const curvature = Math.min(dist / 4, 100);

  if (isSourceFree || isTargetFree) {
    if (isTargetFree && !isSourceFree) {
      const cpX = source.x + source.dir.x * curvature * 2;
      const cpY = source.y + source.dir.y * curvature * 2;
      return `M ${source.x} ${source.y} Q ${cpX} ${cpY} ${finalTargetX} ${finalTargetY}`;
    } else if (isSourceFree && !isTargetFree) {
      const cpX = finalTargetX + target.dir.x * curvature * 2;
      const cpY = finalTargetY + target.dir.y * curvature * 2;
      return `M ${source.x} ${source.y} Q ${cpX} ${cpY} ${finalTargetX} ${finalTargetY}`;
    }
    return `M ${source.x} ${source.y} L ${finalTargetX} ${finalTargetY}`;
  }

  const cp1 = {
    x: source.x + source.dir.x * curvature,
    y: source.y + source.dir.y * curvature,
  };
  const cp2 = {
    x: finalTargetX + target.dir.x * curvature,
    y: finalTargetY + target.dir.y * curvature,
  };
  return `M ${source.x} ${source.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${finalTargetX} ${finalTargetY}`;
};

/**
 * 计算中点位置、角度和标签预计宽度
 */
const calculateMidPoint = (
  edge: CurveEdge,
  source: ResolvedPoint,
  target: ResolvedPoint
) => {
  if (!edge.label) return null;

  const ARROW_GAP = 20;
  const finalTargetX = target.x + target.dir.x * ARROW_GAP;
  const finalTargetY = target.y + target.dir.y * ARROW_GAP;
  const dist = Math.hypot(source.x - target.x, source.y - target.y);
  const curvature = Math.min(dist / 4, 100);

  const t = 0.5;
  let x, y, dx, dy;

  const isSourceFree = edge.anchorSource.type === "absPos";
  const isTargetFree = edge.anchorTarget.type === "absPos";

  if (isSourceFree || isTargetFree) {
    if (isSourceFree && isTargetFree) {
      x = (source.x + finalTargetX) / 2;
      y = (source.y + finalTargetY) / 2;
      dx = finalTargetX - source.x;
      dy = finalTargetY - source.y;
    } else {
      const cpX = isTargetFree
        ? source.x + source.dir.x * curvature * 2
        : finalTargetX + target.dir.x * curvature * 2;
      const cpY = isTargetFree
        ? source.y + source.dir.y * curvature * 2
        : finalTargetY + target.dir.y * curvature * 2;
      x =
        (1 - t) * (1 - t) * source.x +
        2 * (1 - t) * t * cpX +
        t * t * finalTargetX;
      y =
        (1 - t) * (1 - t) * source.y +
        2 * (1 - t) * t * cpY +
        t * t * finalTargetY;
      dx = 2 * (1 - t) * (cpX - source.x) + 2 * t * (finalTargetX - cpX);
      dy = 2 * (1 - t) * (cpY - source.y) + 2 * t * (finalTargetY - cpY);
    }
  } else {
    const cp1 = {
      x: source.x + source.dir.x * curvature,
      y: source.y + source.dir.y * curvature,
    };
    const cp2 = {
      x: finalTargetX + target.dir.x * curvature,
      y: finalTargetY + target.dir.y * curvature,
    };
    const mt = 1 - t;
    x =
      mt ** 3 * source.x +
      3 * mt ** 2 * t * cp1.x +
      3 * mt * t ** 2 * cp2.x +
      t ** 3 * finalTargetX;
    y =
      mt ** 3 * source.y +
      3 * mt ** 2 * t * cp1.y +
      3 * mt * t ** 2 * cp2.y +
      t ** 3 * finalTargetY;
    dx =
      3 * mt ** 2 * (cp1.x - source.x) +
      6 * mt * t * (cp2.x - cp1.x) +
      3 * t ** 2 * (finalTargetX - cp2.x);
    dy =
      3 * mt ** 2 * (cp1.y - source.y) +
      6 * mt * t * (cp2.y - cp1.y) +
      3 * t ** 2 * (finalTargetY - cp2.y);
  }

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (angle > 90 || angle < -90) {
    angle += 180;
  }

  return {
    x,
    y,
    angle,
    labelWidth: edge.label.length * 10 + 25, // 预留一点间隙
  };
};

// ==================== 组件渲染 ====================

const CurveEdgeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  const edge = obj as CurveEdge;
  useAtom(obj.updater);
  useAtom(edge.source.updater);
  useAtom(edge.target.updater);

  const resolvedPoints = resolvePoints(
    edge.source,
    edge.target,
    edge.anchorSource,
    edge.anchorTarget
  );
  const pathData = calculatePath(
    resolvedPoints.source,
    resolvedPoints.target,
    edge.anchorSource.type,
    edge.anchorTarget.type
  );
  const midPoint = calculateMidPoint(
    edge,
    resolvedPoints.source,
    resolvedPoints.target
  );

  // 为每个 edge 创建唯一的 Mask ID
  const maskId = `mask-${edge.id}`;

  return (
    <g className="edge-group" data-id={edge.id}>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          {/* 全白背景表示全部可见 */}
          <rect
            x="-10000"
            y="-10000"
            width="20000"
            height="20000"
            fill="white"
          />
          {/* 在标签位置放置黑色矩形，表示该处不可见（即挖空） */}
          {midPoint && (
            <g
              transform={`translate(${midPoint.x}, ${midPoint.y}) rotate(${midPoint.angle})`}
            >
              <rect
                x={-midPoint.labelWidth / 2}
                y="-12"
                width={midPoint.labelWidth}
                height="24"
                fill="black"
              />
            </g>
          )}
        </mask>
      </defs>

      {/* 视觉线：应用 Mask */}
      <path
        className="visual-line"
        d={pathData}
        fill="none"
        stroke={edge.isSelected ? "#f56c6c" : "#409eff"}
        strokeWidth="2"
        mask={`url(#${maskId})`}
        markerEnd={
          edge.anchorTarget.type === "absPos"
            ? "url(#arrowhead)"
            : "url(#arrowhead1)"
        }
      />

      {/* 点击区域：不加 Mask，确保整条线都能响应点击 */}
      <path
        d={pathData}
        className="hit-area"
        fill="none"
        stroke="transparent"
        strokeWidth="14"
        onMouseDown={() => {}}
      />

      {/* 起点/终点小圆点 */}
      <circle
        cx={resolvedPoints.source.x}
        cy={resolvedPoints.source.y}
        r="4"
        fill="white"
        stroke="#409eff"
      />
      <circle
        cx={resolvedPoints.target.x}
        cy={resolvedPoints.target.y}
        r="4"
        fill="white"
        stroke="#409eff"
      />

      {/* 标签文字：放在挖空的位置 */}
      {midPoint && (
        <g
          transform={`translate(${midPoint.x}, ${midPoint.y}) rotate(${midPoint.angle})`}
        >
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#666"
            fontSize="16"
            fontWeight="500"
            style={{ pointerEvents: "none" }}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
};

Coms["edge/curve"] = CurveEdgeComponent;

// ==================== 序列化与右键菜单 ====================

registerSerializer(
  "edge/curve",
  (obj: Obj) => {
    const edge = obj as CurveEdge;
    return {
      id: edge.id,
      type: edge.type,
      source: {...edge.source},
      target: {...edge.target},
      anchorSource: { ...edge.anchorSource },
      anchorTarget: { ...edge.anchorTarget },
      isSelected: edge.isSelected,
      label: edge.label,
    };
  },
  (data) => ({
    id: data.id,
    type: data.type,
    anchorSource: { ...data.anchorSource },
    anchorTarget: { ...data.anchorTarget },
    isSelected: data.isSelected ?? false,
    label: data.label,
    updater: atom(0),
    source: null as any,
    target: null as any,
  })
);

ContextMenuFactories["edge"] = () => [];
