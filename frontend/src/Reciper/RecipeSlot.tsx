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
export type SlotDisplay = ItemSlotDisplay | FluidSlotDisplay | EnergySlotDisplay | (SlotDisplayBase & Record<string, any>);

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
export const registerRender = (type: string, render: SlotRenderer<any>) => {
  SlotRenderers[type] = render
}
// 获取槽位渲染器
export const getSlotRenderer = (slotType: string): SlotRenderer<any> => {
  return SlotRenderers[slotType] || SlotRenderers['_fallback'];
};
