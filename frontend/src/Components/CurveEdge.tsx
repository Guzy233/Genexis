import React, { useMemo } from "react";
import {
  Anchor,
  Vec2,
  Obj,
  Node,
  Coms,
} from "../Globals";
// import { actionBus } from "./ActionServer";
import { atom, Atom, PrimitiveAtom, useAtom } from "jotai";
import { screen2Viewport } from "../Controllers/Camera";

// import "./Edge.css";
import { objects } from "../Manager";
import {
  registerSerializer,
} from "../Serialization";

// 类型定义
interface ResolvedPoint {
  x: number;
  y: number;
  dir: Vec2;
}
export interface CurveEdge extends Obj {
  source: Node; //需要拉取的信息源，定义为原子
  target: Node;
  anchorSource: Anchor;
  anchorTarget: Anchor;
  isSelected: boolean;
}

export const newCurveEdge = (source: Node, target: Node): CurveEdge => {
  const id = crypto.randomUUID();
  const edge: CurveEdge = {
    id: id,
    type: "edge/curve",
    updater: atom<number>(0),
    source: source,
    target: target,
    anchorSource: { type: "auto" }, // 默认自动
    anchorTarget: { type: "auto" }, // 默认自动
    isSelected: false,
  };

  return edge;
};

// export const defaultCurveEdge: CurveEdge = {
//   id: "base",
//   type: "edge",
//   tags: new Set(["edge"]),
//   source: objects[0],
//   target: objects[1],
//   anchorSource: { type: "auto" }, // 默认自动
//   anchorTarget: { type: "auto" }, // 默认自动
//   isSelected: false,
// }

const CurveEdgeComponent: React.FC<{
  obj: Obj;
}> = ({ obj }) => {
  const edge = obj as CurveEdge;
  useAtom(obj.updater);
  useAtom(edge.source.updater);
  useAtom(edge.target.updater);

  const source = edge.source;
  const target = edge.target;

  // 辅助函数：获取节点上所有预设的固定锚点坐标
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

  // 核心计算：解析出起点和终点的绝对位置
  const resolvedPoints = (() => {
    const { anchorSource, anchorTarget } = edge;

    // 处理显式定义的固定点
    const resolveSingle = (
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

    const sCandidates = resolveSingle(source, anchorSource);
    const tCandidates = resolveSingle(target, anchorTarget);

    // 自动匹配最近点逻辑
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
  })();

  // 计算 SVG 路径
  const pathData = useMemo(() => {
    if (!resolvedPoints) return "";
    const { source, target } = resolvedPoints;

    // 终点修正逻辑 (针对箭头)
    const ARROW_GAP = 20;
    const finalTargetX = target.x + target.dir.x * ARROW_GAP;
    const finalTargetY = target.y + target.dir.y * ARROW_GAP;

    // 曲线类型判定
    const isSourceFree = edge.anchorSource.type === "absPos";
    const isTargetFree = edge.anchorTarget.type === "absPos";

    const dist = Math.hypot(source.x - target.x, source.y - target.y);
    const curvature = Math.min(dist / 4, 100);

    // 情况 A: 至少一端是自由无向点 -> 使用二次贝塞尔 (Q)
    if (isSourceFree || isTargetFree) {
      let cpX, cpY;
      if (isTargetFree && !isSourceFree) {
        cpX = source.x + source.dir.x * curvature * 2;
        cpY = source.y + source.dir.y * curvature * 2;
      } else if (isSourceFree && !isTargetFree) {
        cpX = finalTargetX + target.dir.x * curvature * 2;
        cpY = finalTargetY + target.dir.y * curvature * 2;
      } else {
        return `M ${source.x} ${source.y} L ${finalTargetX} ${finalTargetY}`;
      }

      return `M ${source.x} ${source.y} Q ${cpX} ${cpY} ${finalTargetX} ${finalTargetY}`;
    }

    // 情况 B: 两端都有向 -> 使用三次贝塞尔 (C)
    const cp1 = {
      x: source.x + source.dir.x * curvature,
      y: source.y + source.dir.y * curvature,
    };
    const cp2 = {
      x: finalTargetX + target.dir.x * curvature,
      y: finalTargetY + target.dir.y * curvature,
    };

    return `M ${source.x} ${source.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${finalTargetX} ${finalTargetY}`;
  }, [resolvedPoints, edge]);


  if (!resolvedPoints) return null;

  return (
    <g className={`edge-group`} data-id={edge.id}>
      {/* 可视连线 */}
      <path
        className="visual-line"
        d={pathData}
        fill="none"
        stroke={edge.isSelected ? "#f56c6c" : "#409eff"}
        strokeWidth="2"
        markerEnd={
          edge.anchorTarget.type === "absPos"
            ? "url(#arrowhead)"
            : "url(#arrowhead1)"
        }
      />
      {/* 点击区域 */}
      <path
        d={pathData}
        className="hit-area"
        fill="none"
        stroke="transparent"
        strokeWidth="14"
        onMouseDown={(e) => {

        }}
        onDoubleClick={(e) => {

        }}
      />

      {/* 起点圆点 */}
      <circle
        cx={resolvedPoints.source.x}
        cy={resolvedPoints.source.y}
        r="4"
        fill="white"
        stroke="#409eff"
      />

      {/* 起点重连触发器 */}
      <circle
        cx={resolvedPoints.source.x}
        cy={resolvedPoints.source.y}
        r="12"
        className="reconnect-trigger"
        onMouseDown={(e) => {}}
      />

      {/* 终点圆点 */}
      <circle
        cx={resolvedPoints.target.x}
        cy={resolvedPoints.target.y}
        r="4"
        fill="white"
        stroke="#409eff"
      />

      {/* 终点重连触发器 */}
      <circle
        cx={resolvedPoints.target.x}
        cy={resolvedPoints.target.y}
        r="12"
        className="reconnect-trigger"
        onMouseDown={(e) => {}}
      />
    </g>
  );
};
Coms["edge/curve"] = CurveEdgeComponent;

// 注册序列化函数
registerSerializer(
  "edge/curve",
  (obj: Obj) => {
    const edge = obj as CurveEdge;
    return {
      id: edge.id,
      type: edge.type,
      sourceId: edge.source.id,
      targetId: edge.target.id,
      anchorSource: { ...edge.anchorSource },
      anchorTarget: { ...edge.anchorTarget },
      isSelected: edge.isSelected,
    };
  },
  (data) => {
    const edge: CurveEdge = {
      id: data.id,
      type: data.type,
      anchorSource: { ...data.anchorSource },
      anchorTarget: { ...data.anchorTarget },
      isSelected: data.isSelected ?? false,
      updater: atom(0),
      source: null as unknown as Node,
      target: null as unknown as Node,
    };
    return edge;
  }
);