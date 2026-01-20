import React from "react";
import { Anchor, Vec2, Obj, Node, Edge, Coms } from "../Globals";
import { atom, useAtom } from "jotai";
import { registerSerializer } from "../Serialization";
import {
  ContextMenuFactories,
} from "../Controllers/ContextMenu";
import { ObjectFactories } from "../Controllers/Creator";
import { ToolItems, CATEGORY_EDGES } from "../TopLayer/ToolBar";

// ==================== 类型定义 ====================

interface ResolvedPoint {
  x: number;
  y: number;
  dir: Vec2;
}

export interface LineEdge extends Edge {

}

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
    case "center":
      return {
        x: node.pos.x + node.size.x / 2,
        y: node.pos.y + node.size.y / 2,
        dir: { x: 0, y: 0 },
      };
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
 * 计算直线与矩形边框的交点
 * @param lineStart 直线起点
 * @param lineEnd 直线终点
 * @param rectPos 矩形位置（左上角）
 * @param rectSize 矩形尺寸
 * @returns 交点坐标和方向向量
 */
const intersectRect = (
  lineStart: Vec2,
  lineEnd: Vec2,
  rectPos: Vec2,
  rectSize: Vec2
): { pos: Vec2; dir: Vec2 } => {
  const left = rectPos.x;
  const right = rectPos.x + rectSize.x;
  const top = rectPos.y;
  const bottom = rectPos.y + rectSize.y;

  // 直线参数方程: P = lineStart + t * (lineEnd - lineStart)
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  let tMin = Infinity;
  let intersection: Vec2 = { x: 0, y: 0 };
  let dir: Vec2 = { x: 0, y: 0 };

  // 计算与四条边的交点
  const candidates: { t: number; x: number; y: number; dx: number; dy: number }[] = [];

  // 左边 x = left
  if (dx !== 0) {
    const t = (left - lineStart.x) / dx;
    const y = lineStart.y + t * dy;
    if (t >= 0 && t <= 1 && y >= top && y <= bottom) {
      candidates.push({ t, x: left, y, dx: -1, dy: 0 });
    }
  }

  // 右边 x = right
  if (dx !== 0) {
    const t = (right - lineStart.x) / dx;
    const y = lineStart.y + t * dy;
    if (t >= 0 && t <= 1 && y >= top && y <= bottom) {
      candidates.push({ t, x: right, y, dx: 1, dy: 0 });
    }
  }

  // 上边 y = top
  if (dy !== 0) {
    const t = (top - lineStart.y) / dy;
    const x = lineStart.x + t * dx;
    if (t >= 0 && t <= 1 && x >= left && x <= right) {
      candidates.push({ t, x, y: top, dx: 0, dy: -1 });
    }
  }

  // 下边 y = bottom
  if (dy !== 0) {
    const t = (bottom - lineStart.y) / dy;
    const x = lineStart.x + t * dx;
    if (t >= 0 && t <= 1 && x >= left && x <= right) {
      candidates.push({ t, x, y: bottom, dx: 0, dy: 1 });
    }
  }

  // 选择 t 最小的交点（最接近起点）
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.t - b.t);
    const best = candidates[0];
    intersection = { x: best.x, y: best.y };
    dir = { x: best.dx, y: best.dy };
  } else {
    // 如果没有交点，返回目标点
    intersection = lineEnd;
    dir = { x: dx, y: dy };
    // 归一化方向
    const len = Math.hypot(dir.x, dir.y);
    if (len > 0) {
      dir.x /= len;
      dir.y /= len;
    }
  }

  return { pos: intersection, dir };
};

/**
 * 计算直线的起点和终点（考虑箭头间隙和节点边缘）
 */
const calculateLineEndpoints = (
  source: ResolvedPoint,
  target: ResolvedPoint,
  sourceNode: Node,
  targetNode: Node,
  anchorSourceType: Anchor["type"],
  anchorTargetType: Anchor["type"]
): { start: Vec2; end: Vec2; targetDir: Vec2 } => {
  const ARROW_GAP = 20;

  let start = { x: source.x, y: source.y };
  let end = { x: target.x, y: target.y };
  let targetDir = target.dir;

  // 1. 如果源是 center，尝试寻找源节点边缘的交点
  // 应该从目标中心 (或锚点) 看向源中心
  if (anchorSourceType === "center") {
    const sourceIntersection = intersectRect(
      { x: target.x, y: target.y },
      { x: source.x, y: source.y },
      sourceNode.pos,
      sourceNode.size
    );
    start = sourceIntersection.pos;
  }

  // 2. 如果目标是 center，尝试寻找目标节点边缘的交点
  // 应该从起点 (已经算好的 start) 看向目标中心
  if (anchorTargetType === "center") {
    const targetIntersection = intersectRect(
      start,
      { x: target.x, y: target.y },
      targetNode.pos,
      targetNode.size
    );
    end = targetIntersection.pos;
    targetDir = targetIntersection.dir;
  }

  // 3. 无论锚点是什么类型，结尾通常都需要沿直线回退，给箭头留位置
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len > ARROW_GAP) {
    end = {
      x: end.x - (dx / len) * ARROW_GAP,
      y: end.y - (dy / len) * ARROW_GAP,
    };
  }

  return { start, end, targetDir };
};

/**
 * 计算中点位置和角度（用于标签）
 */
const calculateMidPoint = (
  start: Vec2,
  end: Vec2,
  label?: string
) => {
  if (!label) return null;

  const x = (start.x + end.x) / 2;
  const y = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  // 保持文字水平易读
  if (angle > 90 || angle < -90) {
    angle += 180;
  }

  return {
    x,
    y,
    angle,
    labelWidth: label.length * 10 + 25,
  };
};

// ==================== 组件渲染 ====================

import { objects } from "../Manager";

// Dummy atom for missing nodes to satisfy unconditional hook rules
const dummyAtom = atom(0);

Coms["edge/line"] = ({ obj }) => {
  const edge = obj as LineEdge;
  // Retrieve nodes from global objects using IDs
  const sourceNode = objects[edge.sourceId] as Node;
  const targetNode = objects[edge.targetId] as Node;

  useAtom(obj.updater);
  // Use dummy atom if node is missing
  useAtom(sourceNode ? sourceNode.updater : dummyAtom);
  useAtom(targetNode ? targetNode.updater : dummyAtom);

  // If source or target is missing (e.g. hidden in folder), do not render the edge
  if (!sourceNode || !targetNode) return null;

  // 计算边的路径
  const resolvedPoints = resolvePoints(
    sourceNode,
    targetNode,
    edge.anchorSource,
    edge.anchorTarget
  );

  const { start, end } = calculateLineEndpoints(
    resolvedPoints.source,
    resolvedPoints.target,
    sourceNode,
    targetNode,
    edge.anchorSource.type,
    edge.anchorTarget.type
  );

  const midPoint = calculateMidPoint(start, end, edge.label);
  const maskId = `mask-${edge.id}`;

  return (
    <g className="edge-group" data-id={edge.id}>

      {edge.label && (
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse">

            <rect
              x="-10000"
              y="-10000"
              width="20000"
              height="20000"
              fill="white"
            />

            <g
              transform={`translate(${midPoint!.x}, ${midPoint!.y}) rotate(${midPoint!.angle
                })`}
            >
              <rect
                x={-midPoint!.labelWidth / 2}
                y="-12"
                width={midPoint!.labelWidth}
                height="24"
                fill="black"
              />
            </g>
          </mask>
        </defs>
      )}

      <line
        className="visual-line"
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={edge.isSelected ? "#f472b6" : "#6366f1"}
        strokeWidth="2"
        mask={edge.label ? `url(#${maskId})` : undefined}
        markerEnd={"url(#arrowhead1)"}
      />

      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        className="hit-area"
        stroke="transparent"
        strokeWidth="14"
        onMouseDown={() => { }}
      />

      <circle
        cx={resolvedPoints.source.x}
        cy={resolvedPoints.source.y}
        r="4"
        fill="#1e1e2e"
        stroke="#6366f1"
      />

      <circle
        cx={resolvedPoints.target.x}
        cy={resolvedPoints.target.y}
        r="4"
        fill="#1e1e2e"
        stroke="#6366f1"
      />

      {midPoint && (
        <g
          transform={`translate(${midPoint.x}, ${midPoint.y}) rotate(${midPoint.angle})`}
        >
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#a1a1aa"
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


registerSerializer(
  "edge/line",
  (obj: Obj) => {
    const edge = obj as LineEdge;
    return {
      id: edge.id,
      type: edge.type,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      anchorSource: { ...edge.anchorSource },
      anchorTarget: { ...edge.anchorTarget },
      isSelected: edge.isSelected,
      label: edge.label,
    };
  },
  (data: any) => ({
    id: data.id,
    type: data.type,
    anchorSource: data.anchorSource ?? { type: "auto" },
    anchorTarget: data.anchorTarget ?? { type: "auto" },
    isSelected: data.isSelected ?? false,
    label: data.label,
    updater: atom(0),
    sourceId: data.sourceId,
    targetId: data.targetId,
  })
);

ContextMenuFactories["edge"] = () => [];

export const newLineEdge = (
  source: Node | null,
  target: Node | null,
  label: string = ""
): LineEdge => {
  const id = crypto.randomUUID();
  return {
    id,
    type: "edge/line",
    updater: atom<number>(0),
    sourceId: source ? source.id : "",
    targetId: target ? target.id : "",
    anchorSource: { type: "auto" },
    anchorTarget: { type: "auto" },
    isSelected: false,
    label,
  };
};

ObjectFactories["edge/line"] = (source?: Node, target?: Node, label: string = "") => {
  return newLineEdge(source || null, target || null, label);
};

// 注册工具项
ToolItems.push({
  id: "edge/line",
  type: "edge",
  category: CATEGORY_EDGES,
  icon: (
    <svg viewBox="0 0 60 60" style={{ width: "100%", height: "100%" }}>
      <rect
        x="4"
        y="4"
        width="52"
        height="52"
        rx="12"
        fill="rgba(255, 255, 255, 0.03)"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth="1"
      />
      {/* 直线预览 */}
      <line
        x1="15"
        y1="42"
        x2="45"
        y2="18"
        stroke="#6366f1"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* 左端小圆点 */}
      <circle
        cx="15"
        cy="42"
        r="3"
        fill="#1e1e2e"
        stroke="#6366f1"
        strokeWidth="2"
      />
      {/* 右端小圆点 */}
      <circle
        cx="45"
        cy="18"
        r="3"
        fill="#1e1e2e"
        stroke="#6366f1"
        strokeWidth="2"
      />
    </svg>
  ),
});
