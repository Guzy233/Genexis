import { atom, useAtom } from "jotai";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ObjectFactories } from "../Controllers/Creator";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";
import { activedId } from "../Controllers/Selector";

// ============ 化学品类型配置 ============
type ChemicalType = 'gas' | 'slurry' | 'infuse' | 'pigment';

const CHEMICAL_TYPE_CONFIG: Record<ChemicalType, { icon: string; defaultColor: string; label: string }> = {
  gas: { icon: '◯', defaultColor: '#88ccff', label: '气体' },
  slurry: { icon: '◈', defaultColor: '#a08060', label: '矿浆' },
  infuse: { icon: '✦', defaultColor: '#ff88ff', label: '灌注物' },
  pigment: { icon: '◆', defaultColor: '#ffcc00', label: '颜料' },
};

// 化学品颜色映射
const CHEMICAL_COLORS: Record<string, Record<string, string>> = {
  gas: {
    'mekanism:hydrogen': '#a0d8ef',
    'mekanism:oxygen': '#ff9999',
    'mekanism:chlorine': '#c8e6b0',
    'mekanism:steam': '#e8e8e8',
    'mekanism:ethene': '#f0f0a0',
  },
  slurry: {
    'iron': '#c8c8c8',
    'gold': '#ffd700',
    'copper': '#e07050',
  },
  infuse: {
    'mekanism:redstone': '#ff4444',
    'mekanism:diamond': '#55ffff',
    'mekanism:carbon': '#444444',
    'mekanism:gold': '#ffd700',
  },
  pigment: {
    'mekanism:red': '#ff4444',
    'mekanism:green': '#44ff44',
    'mekanism:blue': '#4444ff',
  },
};

const getChemicalColor = (chemicalType: ChemicalType, chemicalId: string): string => {
  const typeColors = CHEMICAL_COLORS[chemicalType] || {};
  if (typeColors[chemicalId]) return typeColors[chemicalId];

  // 尝试提取资源名称匹配
  const resourceName = chemicalId.split(':').pop() || '';
  for (const [key, color] of Object.entries(typeColors)) {
    if (key.endsWith(':' + resourceName) || key === resourceName) {
      return color;
    }
  }

  return CHEMICAL_TYPE_CONFIG[chemicalType]?.defaultColor || '#888888';
};

// ============ 化学品节点接口 ============
export interface MCChemicalNode extends Node {
  type: 'node/mc/chemical';
  chemicalId: string;                // 化学品ID
  chemicalType: ChemicalType; // 化学品类型
  amount: number;            // 数量 (mb)
}

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 工厂函数
export const createMCChemicalNode = (info?: any): MCChemicalNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/mc/chemical",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 72, y: 100 },
    selected: false,
    eAncs: anchors_default,
    aAncs: anchors_rect,
    // 化学品特有属性
    chemicalType: info?.chemicaltype || "gas",
    chemicalId: info?.id || "",
    amount: 1000,
  } as MCChemicalNode;
};

// 注册工厂
ObjectFactories["node/mc/chemical"] = createMCChemicalNode;

// 注册序列化
registerSerializer(
  "node/mc/chemical",
  (obj: Obj) => {
    const node = obj as MCChemicalNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      aAncs: serializeAnchors(node.aAncs, "rect"),
      eAncs: serializeAnchors(node.eAncs, null),
      selected: node.selected,
      chemicalId: (node as any).id,
      chemicalType: node.chemicalType,
      amount: node.amount,
    };
  },
  (data: any) => {
    const node: MCChemicalNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      selected: data.selected ?? false,
      updater: atom(0),
      chemicalType: data.chemicalType ?? 'gas',
      amount: data.amount ?? 1000,
      chemicalId: ""
    } as MCChemicalNode;
    (node as any).chemicalId = data.chemicalId;
    return node;
  }
);

// 化学品节点组件
Coms["node/mc/chemical"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as MCChemicalNode;
  const chemicalId = node.chemicalId || "mekanism:hydrogen";
  const chemicalType = node.chemicalType || 'gas';
  const amount = node.amount || 1000;

  const isActived = node.id === activedId;
  const isSelected = node.selected;
  const strokeColor = isActived ? "#8b5cf6" : isSelected ? "#6366f1" : "transparent";
  const strokeWidth = (isSelected || isActived) ? 2 : 0;

  const color = getChemicalColor(chemicalType, chemicalId);
  const config = CHEMICAL_TYPE_CONFIG[chemicalType] || CHEMICAL_TYPE_CONFIG.gas;

  const nodeWidth = 72;
  const nodeHeight = 100;
  const tankHeight = 64;
  const tankWidth = 64;
  const fillPercent = Math.min(1, Math.max(0.1, amount / 10000));
  const fillHeight = tankHeight * fillPercent;

  // 获取显示名称
  const displayName = chemicalId.split(':').pop()?.replace(/_/g, ' ') || chemicalId;

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

      {/* 化学品容器 */}
      <g transform={`translate(${(nodeWidth - tankWidth) / 2}, 4)`}
        data-type="chemical"
        data-amount={amount}
        data-id={chemicalId}
        data-chemicaltype={chemicalType}
      >
        {/* 背景 (带虚线边框表示化学品) */}
        <rect
          x={0}
          y={0}
          width={tankWidth}
          height={tankHeight}
          fill="rgba(30, 30, 35, 0.9)"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="4,2"
          rx="4"

        />
        {/* 化学品填充 */}
        <rect
          x={2}
          y={tankHeight - fillHeight + 2}
          width={tankWidth - 4}
          height={Math.max(0, fillHeight - 4)}
          fill={color}
          opacity={0.6}
          rx="2"
        />
        {/* 类型图标 */}
        <text
          x={tankWidth / 2}
          y={tankHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize="16"
        >
          {config.icon}
        </text>
      </g>

      {/* 类型标签 */}
      <text
        x={nodeWidth / 2}
        y={tankHeight + 12}
        textAnchor="middle"
        fill="#71717a"
        fontSize="9"
        style={{ pointerEvents: "none" }}
      >
        {config.label}
      </text>

      {/* 名称标签 */}
      <text
        x={nodeWidth / 2}
        y={tankHeight + 24}
        textAnchor="middle"
        fill={isActived ? "#c4b5fd" : isSelected ? "#a5b4fc" : "#e4e4e7"}
        fontSize="10"
        style={{ pointerEvents: "none" }}
      >
        {displayName.length > 8 ? displayName.slice(0, 8) + '...' : displayName}
      </text>

      {/* 数量标签 */}
      <text
        x={nodeWidth / 2}
        y={tankHeight + 36}
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
