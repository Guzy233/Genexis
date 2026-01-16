import React from "react";
import { atom, useAtom } from "jotai";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ObjectFactories } from "../Controllers/Creator";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";
import { activedId } from "../Controllers/Selector";

// ============ 流体颜色映射 ============
const FLUID_COLORS: Record<string, string> = {
  'minecraft:water': '#3b82f6',
  'minecraft:lava': '#f97316',
  'minecraft:milk': '#f5f5f4',
  'c:water': '#3b82f6',
  'c:experience': '#7cfc00',
  'justdirethings:time_fluid': '#90ee90',
  'justdirethings:time_fluid_source': '#90ee90',
};

const getFluidColor = (fluidId: string): string => {
  if (FLUID_COLORS[fluidId]) return FLUID_COLORS[fluidId];
  // 根据ID生成稳定的颜色
  let hash = 0;
  for (let i = 0; i < fluidId.length; i++) {
    hash = fluidId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 50%)`;
};

// ============ 流体节点接口 ============
export interface MCFluidNode extends Node {
  type: 'node/mc/fluid';
  fliudId: string;       // 流体ID
  amount: number;   // 流体数量 (mb)
}

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 工厂函数
export const createMCFluidNode = (info?: any): MCFluidNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/mc/fluid",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 72, y: 100 },
    selected: false,
    eAncs: anchors_default,
    aAncs: anchors_rect,
    // 流体特有属性
    amount: info?.amount || 1000,
    fliudId: info?.id || "minecraft:water"
  } as MCFluidNode;
};

// 注册工厂
ObjectFactories["node/mc/fluid"] = createMCFluidNode;

// 注册序列化
registerSerializer(
  "node/mc/fluid",
  (obj: Obj) => {
    const node = obj as MCFluidNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      aAncs: serializeAnchors(node.aAncs, "rect"),
      eAncs: serializeAnchors(node.eAncs, null),
      selected: node.selected,
      fluidId: (node as any).id,
      amount: node.amount,
    };
  },
  (data: any) => {
    const node: MCFluidNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      selected: data.selected ?? false,
      updater: atom(0),
      amount: data.amount ?? 1000,
      fliudId: ""
    } as MCFluidNode;
    (node as any).fluidId = data.fluidId;
    return node;
  }
);

// 流体节点组件
Coms["node/mc/fluid"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as MCFluidNode;
  const fluidId = node.fliudId || "minecraft:water";
  const amount = node.amount || 1000;

  const isActived = node.id === activedId;
  const isSelected = node.selected;
  const strokeColor = isActived ? "#8b5cf6" : isSelected ? "#6366f1" : "transparent";
  const strokeWidth = (isSelected || isActived) ? 2 : 0;

  const color = getFluidColor(fluidId);
  const nodeWidth = 72;
  const nodeHeight = 100;
  const tankHeight = 64;
  const tankWidth = 64;
  const fillPercent = Math.min(1, amount / 10000);
  const fillHeight = tankHeight * fillPercent;

  // 获取显示名称
  const displayName = fluidId.split(':').pop()?.replace(/_/g, ' ') || fluidId;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 选中边框 */}
      {(isSelected || isActived) && (
        <rect
          x={0}
          y={0}
          width={nodeWidth}
          height={nodeHeight}
          rx="6"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}

      {/* 流体容器 */}
      <g transform={`translate(${(nodeWidth - tankWidth) / 2}, 4)`}
        data-type="fluid"
        data-amount={amount}
        data-id={fluidId}
      >
        {/* 背景 */}
        <rect
          x={0}
          y={0}
          width={tankWidth}
          height={tankHeight}
          fill="rgba(30, 30, 35, 0.9)"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
          rx="4"
        />
        {/* 流体填充 */}
        <rect
          x={2}
          y={tankHeight - fillHeight + 2}
          width={tankWidth - 4}
          height={Math.max(0, fillHeight - 4)}
          fill={color}
          opacity={0.8}
          rx="2"
        />
        {/* 水滴图标 */}
        <text
          x={tankWidth / 2}
          y={tankHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.5)"
          fontSize="20"
        >
          💧
        </text>
      </g>

      {/* 名称标签 */}
      <text
        x={nodeWidth / 2}
        y={tankHeight + 16}
        textAnchor="middle"
        fill={isActived ? "#c4b5fd" : isSelected ? "#a5b4fc" : "#e4e4e7"}
        fontSize="10"
        style={{ pointerEvents: "none" }}
      >
        {displayName}
      </text>

      {/* 数量标签 */}
      <text
        x={nodeWidth / 2}
        y={tankHeight + 28}
        textAnchor="middle"
        fill="#71717a"
        fontSize="9"
        style={{ pointerEvents: "none" }}
      >
        {amount >= 1000 ? `${(amount / 1000).toFixed(1)}B` : `${amount}mb`}
      </text>
    </g>
  );
};
