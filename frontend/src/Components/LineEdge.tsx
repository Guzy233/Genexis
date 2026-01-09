import React from "react";
import { Anchor, Vec2, Obj, Node, Edge, Coms } from "../Globals";
import { atom, useAtom } from "jotai";
import { registerSerializer } from "../Serialization";
import {
  ContextMenuFactories,
} from "../Controllers/ContextMenu";
import { ObjectFactories } from "../Controllers/Creator";
import { ToolItems, CATEGORY_EDGES } from "./ToolBar";

// ==================== 类型定义 ====================

interface ResolvedPoint {
  x: number;
  y: number;
  dir: Vec2;
}

export interface LineEdge extends Edge {
  // LineEdge 特有的属性可以在这里添加
}

export const newLineEdge = (
  source: Node,
  target: Node,
  label: string = ""
): LineEdge => {
  const id = crypto.randomUUID();
  return {
    id,
    type: "edge/line",
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
    if (t > 0 && t < 1 && y >= top && y <= bottom) {
      candidates.push({ t, x: left, y, dx: -1, dy: 0 });
    }
  }

  // 右边 x = right
  if (dx !== 0) {
    const t = (right - lineStart.x) / dx;
    const y = lineStart.y + t * dy;
    if (t > 0 && t < 1 && y >= top && y <= bottom) {
      candidates.push({ t, x: right, y, dx: 1, dy: 0 });
    }
  }

  // 上边 y = top
  if (dy !== 0) {
    const t = (top - lineStart.y) / dy;
    const x = lineStart.x + t * dx;
    if (t > 0 && t < 1 && x >= left && x <= right) {
      candidates.push({ t, x, y: top, dx: 0, dy: -1 });
    }
  }

  // 下边 y = bottom
  if (dy !== 0) {
    const t = (bottom - lineStart.y) / dy;
    const x = lineStart.x + t * dx;
    if (t > 0 && t < 1 && x >= left && x <= right) {
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

  // 对于 center 锚点，计算与源节点边缘的交点
  if (anchorSourceType === "center") {
    const sourceIntersection = intersectRect(
      { x: targetNode.pos.x + targetNode.size.x / 2, y: targetNode.pos.y + targetNode.size.y / 2 },
      { x: sourceNode.pos.x + sourceNode.size.x / 2, y: sourceNode.pos.y + sourceNode.size.y / 2 },
      sourceNode.pos,
      sourceNode.size
    );
    start = sourceIntersection.pos;
  }

  // 对于 center 锚点，计算与目标节点边缘的交点并回退
  if (anchorTargetType === "center") {
    const targetIntersection = intersectRect(
      start,
      { x: targetNode.pos.x + targetNode.size.x / 2, y: targetNode.pos.y + targetNode.size.y / 2 },
      targetNode.pos,
      targetNode.size
    );
    end = targetIntersection.pos;
    targetDir = targetIntersection.dir;

    // 沿直线方向回退，给箭头留位置
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len > ARROW_GAP) {
      end = {
        x: end.x - (dx / len) * ARROW_GAP,
        y: end.y - (dy / len) * ARROW_GAP,
      };
    }
  } else {
    // 对于 absPos 和固定锚点（posDir 或 auto），沿直线方向回退
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len > ARROW_GAP) {
      end = {
        x: end.x - (dx / len) * ARROW_GAP,
        y: end.y - (dy / len) * ARROW_GAP,
      };
    }
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

const LineEdgeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  const edge = obj as LineEdge;
  useAtom(obj.updater);
  useAtom(edge.source.updater);
  useAtom(edge.target.updater);

  const resolvedPoints = resolvePoints(
    edge.source,
    edge.target,
    edge.anchorSource,
    edge.anchorTarget
  );

  const { start, end, targetDir } = calculateLineEndpoints(
    resolvedPoints.source,
    resolvedPoints.target,
    edge.source,
    edge.target,
    edge.anchorSource.type,
    edge.anchorTarget.type
  );

  const midPoint = calculateMidPoint(start, end, edge.label);

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
      <line
        className="visual-line"
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={edge.isSelected ? "#f472b6" : "#6366f1"}
        strokeWidth="2"
        mask={`url(#${maskId})`}
        markerEnd={"url(#arrowhead1)"}
      />

      {/* 点击区域：不加 Mask，确保整条线都能响应点击 */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        className="hit-area"
        stroke="transparent"
        strokeWidth="14"
        onMouseDown={() => {}}
      />

      {/* 起点/终点小圆点 */}
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

      {/* 标签文字：放在挖空的位置 */}
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

Coms["edge/line"] = LineEdgeComponent;

// ==================== 序列化与右键菜单 ====================

registerSerializer(
  "edge/line",
  (obj: Obj) => {
    const edge = obj as LineEdge;
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

// 注册对象工厂（边工厂需要参数，暂时设为 null）
ObjectFactories["edge/line"] = (source?: Node, target?: Node, label: string = "") => {
  return newLineEdge(source || null as any, target || null as any, label);
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
