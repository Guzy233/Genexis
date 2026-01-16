import React from "react";
import { SVGItemSlot } from "./MCItemNode";


// ============================================================================
// 类型定义
// ============================================================================

export type ItemOrTag =
  | { item?: string; tag?: string; id?: string; count?: number }
  | string;

export interface Recipe {
  type: string;
  ingredients?: ItemOrTag[];
  pattern?: string[];
  key?: Record<string, ItemOrTag>;
  ingredient?: ItemOrTag;
  input?: ItemOrTag;
  result?: { id?: string; item?: string; count?: number };
  output?: { id?: string; item?: string; count?: number };
  experience?: number;
  cookingtime?: number;
  time?: number;
  duration?: number;
  energy?: number | { amount?: number; energy?: number; value?: number };
  temperature?: number;
  [key: string]: any;
}

// ==================== 槽位路径定义 ====================

// 槽位路径类型 - 描述如何访问和修改配方中的某个槽位
export type SlotPath =
  | { type: 'direct'; path: string }                                    // 直接路径，如 "ingredient", "input", "result"
  | { type: 'array'; path: string; index: number }                      // 数组索引，如 "ingredients[0]"
  | { type: 'shaped'; row: number; col: number }                        // 有序合成特殊处理
  | { type: 'custom'; writer: (recipe: Recipe, newItem: any) => void }; // 自定义写入器

// 输入项信息（解析阶段使用）
export interface ItemInputInfo {
  itemId: string;
  count?: number;
  slotPath: SlotPath;
}

// ==================== 通用槽位系统 ====================

// 槽位基础接口 - 所有槽位必须实现
export interface SlotDisplayBase {
  slotType: string;        // 槽位类型标识符
  x: number;
  y: number;
  role: 'input' | 'output';
  slotPath: SlotPath;
  label?: string;
}

// 物品槽位
export interface ItemSlotDisplay extends SlotDisplayBase {
  slotType: 'item';
  itemId: string;
  count?: number;
  size: number;
  index: number;
}

// 流体槽位
export interface FluidSlotDisplay extends SlotDisplayBase {
  slotType: 'fluid';
  fluidId: string;
  amount: number;         // mb
  width: number;
  height: number;
}

// 化学品槽位 (Mekanism风格)
export interface ChemicalSlotDisplay extends SlotDisplayBase {
  slotType: 'chemical';
  chemicalType: 'gas' | 'slurry' | 'infuse' | 'pigment';
  chemicalId: string;
  amount: number;         // mb
  width: number;
  height: number;
}

// 能源槽位
export interface EnergySlotDisplay extends SlotDisplayBase {
  slotType: 'energy';
  energyType: 'fe' | 'eu' | 'mana' | 'vis' | 'custom';
  amount: number;
  maxAmount?: number;
  width: number;
  height: number;
}

// 通用槽位联合类型
export type SlotDisplay = ItemSlotDisplay | FluidSlotDisplay | ChemicalSlotDisplay | EnergySlotDisplay | (SlotDisplayBase & Record<string, any>);

// ==================== 槽位渲染器注册系统 ====================

export interface SlotRendererProps<T extends SlotDisplayBase = SlotDisplayBase> {
  slot: T;
}

export type SlotRenderer<T extends SlotDisplayBase = SlotDisplayBase> = React.FC<SlotRendererProps<T>>;

// ==================== 内置槽位渲染器 ====================

// 流体颜色映射
const FLUID_COLORS: Record<string, string> = {
  'minecraft:water': '#5b9bd5',
  'water': '#5b9bd5',
  'c:water': '#5b9bd5',
  'justdirethings:time_fluid_source': '#90ee90',
  'justdirethings:time_fluid': '#90ee90',
  'c:experience': '#7cfc00',
  'ae2:f': '#90ee90',
};

const getFluidColor = (fluidId: string): string => {
  return FLUID_COLORS[fluidId] || '#888888';
};

// 化学品颜色映射 (Mekanism)
const CHEMICAL_COLORS: Record<string, Record<string, string>> = {
  gas: {
    'mekanism:hydrogen': '#a0d8ef',
    'mekanism:oxygen': '#ff9999',
    'mekanism:chlorine': '#c8e6b0',
    'mekanism:steam': '#e8e8e8',
    'mekanism:ethene': '#f0f0a0',
    'mekanism:sulfur_dioxide': '#e0d080',
    'mekanism:uranium_hexafluoride': '#80ff80',
    '_default': '#88ccff',
  },
  slurry: {
    'iron': '#c8c8c8',
    'gold': '#ffd700',
    'copper': '#e07050',
    'tin': '#d8d8e0',
    'lead': '#607090',
    'osmium': '#a0d0e0',
    'uranium': '#80ff80',
    '_default': '#a08060',
  },
  infuse: {
    // 精确匹配
    'mekanism:redstone': '#ff4444',
    'mekanism:diamond': '#55ffff',
    'mekanism:carbon': '#444444',
    'mekanism:gold': '#ffd700',
    'mekanism:tin': '#d8d8e0',
    'mekanism:fungi': '#8b4513',
    'mekanism:bio': '#7cfc00',
    'mekanism:refined_obsidian': '#4a0080',
    // tag 格式匹配 (带 # 前缀)
    '#mekanism:redstone': '#ff4444',
    '#mekanism:diamond': '#55ffff',
    '#mekanism:carbon': '#444444',
    '#mekanism:gold': '#ffd700',
    '#mekanism:tin': '#d8d8e0',
    '#mekanism:fungi': '#8b4513',
    '#mekanism:bio': '#7cfc00',
    '#mekanism:refined_obsidian': '#4a0080',
    '_default': '#ff88ff',
  },
  pigment: {
    'mekanism:black': '#222222',
    'mekanism:white': '#f0f0f0',
    'mekanism:red': '#ff4444',
    'mekanism:green': '#44ff44',
    'mekanism:blue': '#4444ff',
    'mekanism:yellow': '#ffff44',
    '_default': '#ffcc00',
  },
};

const getChemicalColor = (chemicalType: string, chemicalId: string): string => {
  const typeColors = CHEMICAL_COLORS[chemicalType] || {};

  // 先尝试精确匹配
  if (typeColors[chemicalId]) {
    return typeColors[chemicalId];
  }

  // 尝试提取资源名称进行匹配 (如 "mekanism:gold" -> "gold")
  const resourceName = chemicalId.replace(/^#/, '').split(':').pop() || '';
  for (const [key, color] of Object.entries(typeColors)) {
    if (key !== '_default' && (key.endsWith(':' + resourceName) || key === resourceName)) {
      return color;
    }
  }

  // 尝试通过资源名称匹配常见颜色
  const commonColors: Record<string, string> = {
    'gold': '#ffd700',
    'iron': '#c8c8c8',
    'copper': '#e07050',
    'tin': '#d8d8e0',
    'redstone': '#ff4444',
    'diamond': '#55ffff',
    'carbon': '#444444',
    'fungi': '#8b4513',
    'bio': '#7cfc00',
  };
  if (commonColors[resourceName]) {
    return commonColors[resourceName];
  }

  return typeColors['_default'] || '#888888';
};

// 能源颜色映射
const ENERGY_COLORS: Record<string, string> = {
  'fe': '#ef4444',
  'eu': '#ffcc00',
  'mana': '#00ffff',
  'vis': '#8855ff',
  'custom': '#888888',
};

// 槽位渲染器注册表
const SlotRenderers: Record<string, SlotRenderer<any>> = {
  'item': ({ slot }: SlotRendererProps<ItemSlotDisplay>) => {
    return (
      <g>
        <SVGItemSlot
          itemIdorTag={slot.itemId}
          count={slot.count}
          size={slot.size}
        />
        {slot.label && (
          <text
            x={slot.size / 2}
            y={slot.size + 4}
            textAnchor="middle"
            fill="#71717a"
            fontSize="11"
            dominantBaseline="hanging"
            pointerEvents="none"
          >
            {slot.label}
          </text>
        )}
      </g>
    );
  },
  'fluid': ({ slot }: SlotRendererProps<FluidSlotDisplay>) => {
    const color = getFluidColor(slot.fluidId);
    const fillPercent = Math.min(1, slot.amount / 10000);
    const fillHeight = slot.height * fillPercent;
    const emptyHeight = slot.height - fillHeight;

    return (
      <g
        style={{ cursor: 'pointer' }}
        data-type="fluid"
        data-id={slot.fluidId}
        data-amount={slot.amount}
      >
        <rect
          x={0}
          y={0}
          width={slot.width}
          height={slot.height}
          fill="rgba(30,30,35,0.9)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
          rx="3"
        />
        <rect
          x={1}
          y={emptyHeight + 1}
          width={slot.width - 2}
          height={fillHeight - 2}
          fill={color}
          opacity={0.8}
          rx="2"
        />
        <text
          x={slot.width / 2}
          y={slot.height + 12}
          textAnchor="middle"
          fill="#a1a1aa"
          fontSize="9"
          dominantBaseline="hanging"
        >
          {slot.amount >= 1000 ? `${(slot.amount / 1000).toFixed(1)}B` : `${slot.amount}mb`}
        </text>
        <title>{slot.fluidId} - {slot.amount}mb</title>
      </g>
    );
  },
  'chemical': ({ slot }: SlotRendererProps<ChemicalSlotDisplay>) => {
    const color = getChemicalColor(slot.chemicalType, slot.chemicalId);
    // 对于小量化学品使用固定比例，避免负数高度
    const maxAmount = slot.amount < 1000 ? 1000 : 10000;
    const fillPercent = Math.min(1, Math.max(0.1, slot.amount / maxAmount));  // 至少显示10%
    const fillHeight = Math.max(4, slot.height * fillPercent);  // 至少4px高度
    const emptyHeight = slot.height - fillHeight;

    // 化学品类型图标
    const typeIcons: Record<string, string> = {
      gas: '◯',
      slurry: '◈',
      infuse: '✦',
      pigment: '◆',
    };

    return (
      <g
        style={{ cursor: 'pointer' }}
        data-type="chemical"
        data-id={slot.chemicalId}
        data-amount={slot.amount}
        data-chemicaltype={slot.chemicalType}
      >
        <rect
          x={0}
          y={0}
          width={slot.width}
          height={slot.height}
          fill="rgba(30,30,35,0.9)"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3,2"
          rx="3"
        />
        <rect
          x={1}
          y={Math.max(1, emptyHeight)}
          width={slot.width - 2}
          height={Math.max(2, fillHeight - 2)}
          fill={color}
          opacity={0.6}
          rx="2"
        />
        {/* 类型标识 */}
        <text
          x={slot.width / 2}
          y={slot.height / 2}
          textAnchor="middle"
          fill={color}
          fontSize="10"
          dominantBaseline="middle"
        >
          {typeIcons[slot.chemicalType] || '?'}
        </text>
        <text
          x={slot.width / 2}
          y={slot.height + 12}
          textAnchor="middle"
          fill="#a1a1aa"
          fontSize="9"
          dominantBaseline="hanging"
        >
          {slot.amount >= 1000 ? `${(slot.amount / 1000).toFixed(1)}B` : `${slot.amount}mb`}
        </text>
        <title>{slot.chemicalType}: {slot.chemicalId} - {slot.amount}mb</title>
      </g>
    );
  },
  'energy': ({ slot }: SlotRendererProps<EnergySlotDisplay>) => {
    const color = ENERGY_COLORS[slot.energyType] || ENERGY_COLORS['custom'];
    const maxAmount = slot.maxAmount || slot.amount;
    const fillPercent = Math.min(1, slot.amount / maxAmount);
    const fillHeight = slot.height * fillPercent;
    const emptyHeight = slot.height - fillHeight;

    const unitLabels: Record<string, string> = {
      fe: 'FE',
      eu: 'EU',
      mana: 'Mana',
      vis: 'Vis',
      custom: '',
    };

    return (
      <g style={{ cursor: 'pointer' }}>
        <rect
          x={0}
          y={0}
          width={slot.width}
          height={slot.height}
          fill="rgba(30,30,35,0.9)"
          stroke={color}
          strokeWidth="1"
          rx="3"
        />
        {/* 能量条纹填充 */}
        <defs>
          <pattern id={`energy-pattern-${slot.energyType}`} patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="4" fill={color} opacity="0.6" />
            <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect
          x={1}
          y={emptyHeight + 1}
          width={slot.width - 2}
          height={fillHeight - 2}
          fill={`url(#energy-pattern-${slot.energyType})`}
          rx="2"
        />
        {/* 闪电图标 */}
        <text
          x={slot.width / 2}
          y={slot.height / 2}
          textAnchor="middle"
          fill="rgba(255,255,255,0.5)"
          fontSize="14"
          dominantBaseline="middle"
        >
          ⚡
        </text>
        <text
          x={slot.width / 2}
          y={slot.height + 12}
          textAnchor="middle"
          fill="#a1a1aa"
          fontSize="9"
          dominantBaseline="hanging"
        >
          {slot.amount >= 1000 ? `${(slot.amount / 1000).toFixed(1)}k` : slot.amount} {unitLabels[slot.energyType]}
        </text>
        <title>{slot.amount} / {maxAmount} {unitLabels[slot.energyType]}</title>
      </g>
    );
  },
  '_fallback': ({ slot }: SlotRendererProps<SlotDisplayBase>) => {
    return (
      <g>
        <rect
          x={0}
          y={0}
          width={40}
          height={40}
          fill="rgba(60,60,65,0.8)"
          stroke="rgba(255,100,100,0.5)"
          strokeWidth="1"
          strokeDasharray="2,2"
          rx="4"
        />
        <text
          x={20}
          y={20}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#888"
          fontSize="10"
        >
          ?
        </text>
        <title>未知槽位类型: {slot.slotType}</title>
      </g>
    );
  }
};

// 获取槽位渲染器
export const getSlotRenderer = (slotType: string): SlotRenderer<any> => {
  return SlotRenderers[slotType] || SlotRenderers['_fallback'];
};
