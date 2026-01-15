import React, { useState, useEffect, useRef } from "react";
import { atom, useAtom } from "jotai";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";
import { activedId } from "../Controllers/Selector";
import { SVGItemSlot, MCItemIcon } from "./MCItemNode";
import { translations } from "./Reciper";
import { PrimitiveAtom } from "jotai";
import Manager, { store } from "../Manager";

// ============================================================================
// 类型定义
// ============================================================================

type ItemOrTag =
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

// 配方修改模式
export type RecipeModifyMode = "override" | "delete" | "add";

// RecipeNode 接口：继承 Node，包含 recipe 和 onCanvas
export interface RecipeNode extends Node {
  recipe: Recipe;
  onCanvas: boolean;
  modifyMode?: RecipeModifyMode;
  //由于配方内部计算复杂，额外增加一个更新器专门用于更新内部布局，外层节点位置更新不影响内部布局计算
  contentUpdater: PrimitiveAtom<number>
}

// ============================================================================
// 工具函数
// ============================================================================

const extractItemInfo = (
  value: any
): { itemId: string; count?: number } | null => {
  if (!value) return null;
  if (typeof value === "string") {
    return { itemId: value };
  }
  if (typeof value === "object") {
    if (value.tag) return { itemId: value.tag.startsWith('#') ? value.tag : '#' + value.tag };

    const target = value.basePredicate || value;
    const id = target.id || target.item;
    const tag = target.tag;

    if (tag) return { itemId: tag.startsWith('#') ? tag : '#' + tag, count: value.count };
    if (id) {
      return {
        itemId: id,
        count: value.count,
      };
    }
  }
  return null;
};

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

// ==================== 配方布局定义 ====================

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

// 槽位渲染器注册表
export const SlotRenderers: Record<string, SlotRenderer<any>> = {};

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

// 物品槽位渲染器
SlotRenderers['item'] = ({ slot }: SlotRendererProps<ItemSlotDisplay>) => {
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
};

// 流体槽位渲染器
SlotRenderers['fluid'] = ({ slot }: SlotRendererProps<FluidSlotDisplay>) => {
  const color = getFluidColor(slot.fluidId);
  const fillPercent = Math.min(1, slot.amount / 10000);
  const fillHeight = slot.height * fillPercent;
  const emptyHeight = slot.height - fillHeight;

  return (
    <g style={{ cursor: 'pointer' }}>
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
};

// 化学品槽位渲染器 (Mekanism)
SlotRenderers['chemical'] = ({ slot }: SlotRendererProps<ChemicalSlotDisplay>) => {
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
    <g style={{ cursor: 'pointer' }}>
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
};

// 能源槽位渲染器
SlotRenderers['energy'] = ({ slot }: SlotRendererProps<EnergySlotDisplay>) => {
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
};

// 通用未知槽位渲染器（fallback）
SlotRenderers['_fallback'] = ({ slot }: SlotRendererProps<SlotDisplayBase>) => {
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
};

// 获取槽位渲染器
const getSlotRenderer = (slotType: string): SlotRenderer<any> => {
  return SlotRenderers[slotType] || SlotRenderers['_fallback'];
};

export interface ExtraInfoDisplay {
  icon: string;
  text: string;
  color: string;
  label: string;
  x: number;
  y: number;
}

export interface RecipeLayout {
  width: number;
  height: number;
  slots: SlotDisplay[];       // 统一的槽位数组
  // 保留旧字段以保持兼容性
  items?: ItemSlotDisplay[];
  fluids?: FluidSlotDisplay[];
  arrow?: { x: number; y: number; text: string; fontSize?: number };
  extraInfos: ExtraInfoDisplay[];
  actionButton?: { x: number; y: number; width: number; height: number };
  background?: {
    url?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}

export type RecipeParser = (recipe: Recipe) => RecipeLayout | null;

// ==================== 标准布局生成器 ====================

// 获取输出槽位路径
const getOutputSlotPath = (recipe: Recipe): SlotPath => {
  if (recipe.result) return { type: 'direct', path: 'result' };
  if (recipe.output) return { type: 'direct', path: 'output' };
  if (Array.isArray(recipe.results)) return { type: 'array', path: 'results', index: 0 };
  return { type: 'direct', path: 'result' }; // 默认
};

const createStandardLayout = (
  recipe: Recipe,
  inputs: Array<ItemInputInfo | null>,
  output: { itemId: string; count: number } | null,
  gridSize: { rows: number; cols: number } | "single" = "single"
): RecipeLayout | null => {
  if (!output) return null;

  const padding = 12;
  const slotSize = 40;
  const gap = 4;
  const arrowGap = 16;
  const arrowWidth = 20;
  const labelHeight = 16;
  const labelOffset = 4;
  const actionButtonHeight = 28;

  const extraInfoItems = getExtraInfoItems(recipe);

  // 计算输入部分尺寸
  let inputWidth = slotSize;
  let inputHeight = slotSize;
  if (gridSize !== "single") {
    inputWidth = slotSize * gridSize.cols + gap * (gridSize.cols - 1);
    inputHeight = slotSize * gridSize.rows + gap * (gridSize.rows - 1);
  }

  // 计算对齐
  const inputBaseHeight = gridSize === "single" ? slotSize : inputHeight;
  const centerY = inputBaseHeight / 2 + padding;
  const outputY = centerY - slotSize / 2;
  const outputTotalHeight = (outputY - padding) + slotSize + labelOffset + labelHeight;

  // 判定额外信息位置
  const spaceBelowOutput = (inputBaseHeight + padding) - (outputY + slotSize + labelOffset + labelHeight);
  const fitsBelowOutput = extraInfoItems.length > 0 && spaceBelowOutput >= (extraInfoItems.length * 18 + 12);
  const showAtBottom = extraInfoItems.length > 0 && !fitsBelowOutput;

  const contentWidth = inputWidth + arrowGap + arrowWidth + arrowGap + slotSize;
  const actionButtonX = padding + contentWidth + arrowGap;
  const totalWidth = actionButtonX + slotSize + padding;

  const extraHeight = showAtBottom ? 38 : (fitsBelowOutput ? extraInfoItems.length * 18 + 12 : 0);
  const totalHeight = Math.max(
    inputHeight + (showAtBottom ? 32 : 0),
    outputTotalHeight + (fitsBelowOutput ? extraHeight : 0),
    actionButtonHeight
  ) + padding * 2;

  // 构造结果
  const slots: SlotDisplay[] = [];

  // 输入物品
  if (gridSize === "single") {
    if (inputs[0]) {
      slots.push({
        slotType: 'item',
        itemId: inputs[0].itemId,
        count: inputs[0].count,
        slotPath: inputs[0].slotPath,
        x: padding,
        y: padding,
        size: slotSize,
        label: "原料",
        role: 'input',
        index: 0
      });
    }
  } else {
    inputs.forEach((info, i) => {
      const x = padding + (i % gridSize.cols) * (slotSize + gap);
      const y = padding + Math.floor(i / gridSize.cols) * (slotSize + gap);
      slots.push({
        slotType: 'item',
        itemId: info?.itemId || "",
        count: info?.count,
        slotPath: info?.slotPath || { type: 'array', path: 'unknown', index: i },
        x,
        y,
        size: slotSize,
        role: 'input',
        index: i
      });
    });
  }

  // 输出物品
  slots.push({
    slotType: 'item',
    ...output,
    slotPath: getOutputSlotPath(recipe),
    x: padding + inputWidth + arrowGap + arrowWidth + arrowGap,
    y: outputY,
    size: slotSize,
    label: "结果",
    role: 'output',
    index: 0
  });

  // 箭头
  const arrow = {
    x: padding + inputWidth + arrowGap + arrowWidth / 2,
    y: centerY,
    text: "→",
    fontSize: 20
  };

  // 额外信息
  const extraInfos: ExtraInfoDisplay[] = [];
  if (fitsBelowOutput) {
    const startX = padding + inputWidth + arrowGap + arrowWidth + arrowGap;
    const startY = outputY + slotSize + labelOffset + labelHeight + 12;
    extraInfoItems.forEach((item, idx) => {
      extraInfos.push({ ...item, x: startX + slotSize / 2, y: startY + idx * 18 });
    });
  } else if (showAtBottom) {
    const startY = padding + inputHeight + 4 + 6;
    extraInfoItems.forEach((item, idx) => {
      extraInfos.push({ ...item, x: padding + 12 + idx * 85, y: startY + 8 });
    });
  }

  return {
    width: totalWidth,
    height: totalHeight,
    slots,
    arrow,
    extraInfos,
    actionButton: {
      x: totalWidth - padding - slotSize,
      y: padding + inputBaseHeight - (actionButtonHeight - 4),
      width: slotSize,
      height: actionButtonHeight - 4
    }
  };
};

// ==================== 具体解析器实现 ====================

const parseOutput = (
  recipe: Recipe
): { itemId: string; count: number } | null => {
  const outSource = recipe.result || recipe.output || (Array.isArray(recipe.results) ? recipe.results[0] : null);
  if (!outSource) return null;
  const info = extractItemInfo(outSource);
  if (!info) return null;
  return { itemId: info.itemId, count: info.count || 1 };
};

const parseShaped: RecipeParser = (r) => {
  const inputs: Array<ItemInputInfo | null> = [];
  if (!r.pattern || !r.key) return null;

  // 默认使用 3x3 网格
  const rows = 3;
  const cols = 3;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const char = r.pattern[y]?.[x];
      const val = char ? r.key[char] : null;
      const info = extractItemInfo(val);
      if (info) {
        inputs.push({
          ...info,
          slotPath: { type: 'shaped', row: y, col: x }
        });
      } else {
        inputs.push(null);
      }
    }
  }
  return createStandardLayout(r, inputs, parseOutput(r), { rows, cols });
};

const parseShapeless: RecipeParser = (r) => {
  if (!r.ingredients) return null;

  // 无序配方填充至 3x3
  const paddedInputs: Array<ItemInputInfo | null> = new Array(9).fill(null);
  r.ingredients.forEach((ing: any, i: number) => {
    if (i < 9) {
      const info = extractItemInfo(ing);
      if (info) {
        paddedInputs[i] = {
          ...info,
          slotPath: { type: 'array', path: 'ingredients', index: i }
        };
      }
    }
  });
  return createStandardLayout(r, paddedInputs, parseOutput(r), { rows: 3, cols: 3 });
};

const parseSmelting: RecipeParser = (r) => {
  const inputSource = r.ingredient || r.input;
  const inputPath = r.ingredient ? 'ingredient' : 'input';
  const info = extractItemInfo(inputSource);

  const input: ItemInputInfo | null = info ? {
    ...info,
    slotPath: { type: 'direct', path: inputPath }
  } : null;

  return createStandardLayout(r, [input], parseOutput(r), "single");
};

const parseEmpowering: RecipeParser = (r) => {
  const items: Array<ItemInputInfo | null> = new Array(9).fill(null);

  // base 在中心位置 (index 4)
  const baseInfo = extractItemInfo(r.base);
  if (baseInfo) {
    items[4] = {
      ...baseInfo,
      slotPath: { type: 'direct', path: 'base' }
    };
  }

  // modifiers 按特定顺序排列
  const modifierIndices = [1, 3, 5, 7, 0, 2, 6, 8];
  const modifiers = Array.isArray(r.modifiers) ? r.modifiers : [];
  modifiers.forEach((m: any, i: number) => {
    if (i < modifierIndices.length) {
      const info = extractItemInfo(m);
      if (info) {
        items[modifierIndices[i]] = {
          ...info,
          slotPath: { type: 'array', path: 'modifiers', index: i }
        };
      }
    }
  });

  return createStandardLayout(r, items, parseOutput(r), { rows: 3, cols: 3 });
};

const parseArcFurnace: RecipeParser = (r) => {
  // IE Arc Furnace: 2 additives + 1 main input
  const items: Array<ItemInputInfo | null> = new Array(6).fill(null);
  const rawAdditives = Array.isArray(r.additives) ? r.additives.flat(2) : [];

  rawAdditives.slice(0, 2).forEach((a: any, i: number) => {
    const info = extractItemInfo(a);
    if (info) {
      items[i] = {
        ...info,
        slotPath: { type: 'array', path: 'additives', index: i }
      };
    }
  });

  const inputInfo = extractItemInfo(r.input);
  if (inputInfo) {
    items[2] = {
      ...inputInfo,
      slotPath: { type: 'direct', path: 'input' }
    };
  }

  return createStandardLayout(r, items, parseOutput(r), { rows: 2, cols: 3 });
};

const parseIEAlloy: RecipeParser = (r) => {
  const i0Info = extractItemInfo(r.input0);
  const i1Info = extractItemInfo(r.input1);

  const inputs: Array<ItemInputInfo | null> = [
    i0Info ? { ...i0Info, slotPath: { type: 'direct', path: 'input0' } } : null,
    i1Info ? { ...i1Info, slotPath: { type: 'direct', path: 'input1' } } : null
  ];

  return createStandardLayout(r, inputs, parseOutput(r), { rows: 1, cols: 2 });
};

const parseEnderIOAlloySmelting: RecipeParser = (r) => {
  if (!r.inputs || !Array.isArray(r.inputs)) return null;

  const inputs: Array<ItemInputInfo | null> = r.inputs.map((ing: any, i: number) => {
    const info = extractItemInfo(ing);
    if (info) {
      return {
        ...info,
        slotPath: { type: 'array', path: 'inputs', index: i }
      };
    }
    return null;
  });

  return createStandardLayout(r, inputs, parseOutput(r), { rows: inputs.length, cols: 1 });
};

// Advanced AE Reaction 解析器
// 布局: [流体输入] [3x3物品输入] [→] [物品/流体输出]
const parseAdvancedAEReaction: RecipeParser = (r) => {
  const padding = 12;
  const slotSize = 40;
  const gap = 4;
  const fluidWidth = 24;
  const fluidHeight = slotSize * 3 + gap * 2;  // 与3x3网格等高
  const arrowGap = 12;
  const arrowWidth = 20;

  // 统一槽位数组
  const slots: SlotDisplay[] = [];

  const gridStartX = padding + fluidWidth + gap;
  const gridWidth = slotSize * 3 + gap * 2;

  // 输入物品 3x3
  const inputRaw = Array.isArray(r.input_items) ? r.input_items : [];

  // 填充3x3网格
  const gridInputs: Array<ItemInputInfo | null> = new Array(9).fill(null);
  inputRaw.forEach((item: any, idx: number) => {
    if (idx < 9) {
      const info = extractItemInfo(item.ingredient || item);
      if (info) {
        gridInputs[idx] = {
          ...info,
          count: item.amount || item.count || 1,
          slotPath: { type: 'array', path: 'input_items', index: idx }
        };
      }
    }
  });

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const info = gridInputs[idx];
      slots.push({
        slotType: 'item',
        itemId: info?.itemId || "",
        count: info?.count,
        x: gridStartX + col * (slotSize + gap),
        y: padding + row * (slotSize + gap),
        size: slotSize,
        role: 'input',
        index: idx,
        slotPath: info?.slotPath || { type: 'array', path: 'input_items', index: idx }
      } as ItemSlotDisplay);
    }
  }

  // 输入流体
  const inputFluid = r.input_fluid;
  if (inputFluid) {
    const fluidIng = inputFluid.ingredient || inputFluid;
    const fluidId = fluidIng.tag || fluidIng.fluid || fluidIng.id || 'unknown';
    slots.push({
      slotType: 'fluid',
      fluidId: fluidId.startsWith('#') ? fluidId : (fluidIng.tag ? '#' + fluidId : fluidId),
      amount: inputFluid.amount || 1000,
      x: padding,
      y: padding,
      width: fluidWidth,
      height: fluidHeight,
      role: 'input',
      slotPath: { type: 'direct', path: 'input_fluid' }
    } as FluidSlotDisplay);
  }

  // 输出解析: 支持 {#: amount, #t: "ae2:f" | "ae2:i", id: "xxx"} 格式
  const output = r.output as any;
  const outputX = gridStartX + gridWidth + arrowGap + arrowWidth + arrowGap;
  let hasFluidOutput = false;
  let hasItemOutput = false;

  if (output) {
    const outputType = output['#t'] as string | undefined;  // "ae2:f" = fluid, "ae2:i" = item
    const outputAmount = (output['#'] || 1) as number;
    const outputId = (output.id || 'unknown') as string;

    if (outputType === 'ae2:f') {
      // 流体输出
      hasFluidOutput = true;
      slots.push({
        slotType: 'fluid',
        fluidId: outputId,
        amount: outputAmount,
        x: outputX + slotSize + gap,
        y: padding,
        width: fluidWidth,
        height: fluidHeight,
        role: 'output',
        slotPath: { type: 'direct', path: 'output' }
      } as FluidSlotDisplay);
    } else {
      // 物品输出
      hasItemOutput = true;
      slots.push({
        slotType: 'item',
        itemId: outputId,
        count: outputAmount,
        x: outputX,
        y: padding + (fluidHeight - slotSize) / 2,  // 垂直居中
        size: slotSize,
        label: "结果",
        role: 'output',
        index: 0,
        slotPath: { type: 'direct', path: 'output' }
      } as ItemSlotDisplay);
    }
  }

  // 计算总尺寸
  const outputWidth = hasFluidOutput && hasItemOutput
    ? slotSize + gap + fluidWidth
    : (hasFluidOutput ? fluidWidth : slotSize);

  const totalWidth = padding + fluidWidth + gap + gridWidth + arrowGap + arrowWidth + arrowGap + outputWidth + padding;
  const totalHeight = padding + fluidHeight + padding;

  // 能量信息
  const extraInfos: ExtraInfoDisplay[] = [];
  if (r.input_energy) {
    extraInfos.push({
      icon: "⚡",
      text: `${r.input_energy} FE`,
      color: "#ef4444",
      label: "能量",
      x: padding + 30,
      y: totalHeight + 5
    });
  }

  return {
    width: totalWidth,
    height: totalHeight + (extraInfos.length > 0 ? 20 : 0),
    slots,
    arrow: {
      x: gridStartX + gridWidth + arrowGap + arrowWidth / 2,
      y: padding + fluidHeight / 2,
      text: "→",
      fontSize: 20
    },
    extraInfos,
    actionButton: {
      x: totalWidth - padding - slotSize,
      y: padding + fluidHeight - 24,
      width: slotSize,
      height: 24
    }
  };
};

// Mekanism Metallurgic Infusing 解析器
// 布局: [化学品输入] [物品输入] [→] [物品输出]
const parseMekanismMetallurgicInfusing: RecipeParser = (r) => {
  const padding = 12;
  const slotSize = 40;
  const chemicalWidth = 24;
  const chemicalHeight = slotSize;
  const arrowGap = 12;
  const arrowWidth = 20;
  const gap = 8;

  const slots: SlotDisplay[] = [];

  // 化学品输入 (infuse type)
  const chemicalInput = r.chemical_input;
  if (chemicalInput) {
    const chemicalId = chemicalInput.tag
      ? (chemicalInput.tag.startsWith('#') ? chemicalInput.tag : '#' + chemicalInput.tag)
      : (chemicalInput.chemical || chemicalInput.id || 'unknown');

    slots.push({
      slotType: 'chemical',
      chemicalType: 'infuse',
      chemicalId: chemicalId,
      amount: chemicalInput.amount || 1,
      x: padding,
      y: padding,
      width: chemicalWidth,
      height: chemicalHeight,
      role: 'input',
      slotPath: { type: 'direct', path: 'chemical_input' }
    } as ChemicalSlotDisplay);
  }

  // 物品输入
  const itemInput = r.item_input;
  const itemInfo = extractItemInfo(itemInput);
  if (itemInfo) {
    slots.push({
      slotType: 'item',
      itemId: itemInfo.itemId,
      count: itemInfo.count || (itemInput?.count as number) || 1,
      x: padding + chemicalWidth + gap,
      y: padding,
      size: slotSize,
      label: "原料",
      role: 'input',
      index: 0,
      slotPath: { type: 'direct', path: 'item_input' }
    } as ItemSlotDisplay);
  }

  // 输出物品
  const output = parseOutput(r);
  if (output) {
    slots.push({
      slotType: 'item',
      itemId: output.itemId,
      count: output.count,
      x: padding + chemicalWidth + gap + slotSize + arrowGap + arrowWidth + arrowGap,
      y: padding,
      size: slotSize,
      label: "结果",
      role: 'output',
      index: 0,
      slotPath: getOutputSlotPath(r)
    } as ItemSlotDisplay);
  }

  // 计算总尺寸
  const contentWidth = chemicalWidth + gap + slotSize + arrowGap + arrowWidth + arrowGap + slotSize;
  const actionButtonX = padding + contentWidth + arrowGap;
  const totalWidth = actionButtonX + slotSize + padding;
  const totalHeight = padding + slotSize + padding;

  // 箭头
  const arrowX = padding + chemicalWidth + gap + slotSize + arrowGap + arrowWidth / 2;
  const arrowY = padding + slotSize / 2;

  return {
    width: totalWidth,
    height: totalHeight,
    slots,
    arrow: {
      x: arrowX,
      y: arrowY,
      text: "→",
      fontSize: 20
    },
    extraInfos: [],
    actionButton: {
      x: totalWidth - padding - slotSize,
      y: padding,
      width: slotSize,
      height: 24
    }
  };
};

// ==================== 解析器表 ====================

const recipeParserTable: Record<string, RecipeParser> = {
  "minecraft:crafting_shaped": parseShaped,
  "crafting_shaped": parseShaped,
  "minecraft:crafting_shapeless": parseShapeless,
  "crafting_shapeless": parseShapeless,
  "minecraft:smelting": parseSmelting,
  "smelting": parseSmelting,
  "minecraft:blasting": parseSmelting,
  "blasting": parseSmelting,
  "minecraft:smoking": parseSmelting,
  "smoking": parseSmelting,
  "minecraft:campfire_cooking": parseSmelting,
  "campfire_cooking": parseSmelting,
  "actuallyadditions:empowering": parseEmpowering,
  "immersiveengineering:arc_furnace": parseArcFurnace,
  "immersiveengineering:alloy": parseIEAlloy,
  "enderio:alloy_smelting": parseEnderIOAlloySmelting,
  "advanced_ae:reaction": parseAdvancedAEReaction,
  "mekanism:metallurgic_infusing": parseMekanismMetallurgicInfusing,
};

// 备用解析逻辑（处理带前缀或包含特定关键字的类型）
const getRecipeLayout = (recipe: Recipe): RecipeLayout | null => {
  const type = recipe.type || "";
  if (recipeParserTable[type]) return recipeParserTable[type](recipe);

  // 模糊匹配
  if (type.includes("shaped")) return parseShaped(recipe);
  if (type.includes("shapeless")) return parseShapeless(recipe);
  if (type.includes("smelting") || type.includes("blasting") || type.includes("cooking")) return parseSmelting(recipe);
  if (type.includes("empowering")) return parseEmpowering(recipe);
  if (type.includes("arc_furnace")) return parseArcFurnace(recipe);
  if (type.includes("alloy_smelting") || (type.includes("enderio") && recipe.inputs)) return parseEnderIOAlloySmelting(recipe);
  if (type.includes("immersiveengineering:alloy") || (type.includes("alloy") && recipe.input0)) return parseIEAlloy(recipe);

  // 默认：尝试根据字段猜测
  if (recipe.pattern && recipe.key) return parseShaped(recipe);
  if (recipe.ingredients) return parseShapeless(recipe);
  if (recipe.ingredient || recipe.input) return parseSmelting(recipe);

  return null;
};

// 获取额外信息列表 (保留作为辅助工具)
const getExtraInfoItems = (recipe: Recipe) => {
  const items: Array<{ icon: string; text: string; color: string; label: string }> = [];
  if (recipe.experience !== undefined) items.push({ icon: "✦", text: `${recipe.experience} XP`, color: "#fbbf24", label: "经验" });
  const time = recipe.cookingtime ?? recipe.time ?? recipe.duration ?? recipe.processingTime;
  if (time !== undefined) {
    const seconds = typeof time === "number" ? Math.round((time / 20) * 10) / 10 : time;
    items.push({ icon: "⏱", text: `${seconds}s`, color: "#f97316", label: "耗时" });
  }
  const energyVal = typeof recipe.energy === "object" ? (recipe.energy.amount ?? recipe.energy.energy ?? recipe.energy.value) : (recipe.energy ?? recipe.physics?.energy);
  if (energyVal !== undefined) items.push({ icon: "⚡", text: `${energyVal} FE`, color: "#ef4444", label: "能量" });
  const tempVal = recipe.temperature ?? recipe.heat ?? recipe.physics?.temperature;
  if (tempVal !== undefined) items.push({ icon: "🌡", text: `${tempVal}°C`, color: "#dc2626", label: "温度" });
  return items;
};

// ============================================================================
// 计算节点尺寸
// ============================================================================

export const calculateRecipeNodeSize = (recipe: Recipe): { width: number; height: number } => {
  const layout = getRecipeLayout(recipe);
  if (!layout) return { width: 300, height: 60 };
  return { width: layout.width, height: layout.height };
};

// ============================================================================
// 默认锚点
// ============================================================================

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// ============================================================================
// 工厂函数
// ============================================================================

export const createRecipeNode = (recipe: Recipe, onCanvas: boolean = true): RecipeNode => {
  const size = calculateRecipeNodeSize(recipe);
  return {
    id: crypto.randomUUID(),
    type: "node/recipe",
    updater: atom(0),
    contentUpdater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: size.width, y: size.height },
    selected: false,
    eAncs: anchors_default,
    aAncs: anchors_rect,
    recipe,
    onCanvas,
    modifyMode: "override",
  };
};

// ============================================================================
// 序列化
// ============================================================================

registerSerializer(
  "node/recipe",
  (obj: Obj) => {
    const node = obj as RecipeNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      aAncs: serializeAnchors(node.aAncs, "rect"),
      eAncs: serializeAnchors(node.eAncs, null),
      selected: node.selected,
      recipe: node.recipe,
      modifyMode: node.modifyMode,
    };
  },
  (data: any) => {
    const node: RecipeNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      selected: data.selected ?? false,
      updater: atom(0),
      contentUpdater: atom(0),
      recipe: data.recipe,
      onCanvas: true,
      modifyMode: data.modifyMode ?? "override",
    };
    return node;
  }
);

// ============================================================================
// 回写工具函数
// ============================================================================

// 设置嵌套对象的值
const setNestedValue = (obj: any, path: string, value: any) => {
  (obj as any)[path] = value;
};

// 有序合成配方的特殊回写逻辑
const applyShapedSlot = (recipe: Recipe, row: number, col: number, newItem: any) => {
  if (!recipe.pattern) recipe.pattern = ["   ", "   ", "   "];
  if (!recipe.key) recipe.key = {};

  // 确保 pattern 有足够的行
  while (recipe.pattern.length <= row) {
    recipe.pattern.push("   ");
  }

  let currentPattern = recipe.pattern[row] || "   ";
  // 确保行有足够的列
  while (currentPattern.length <= col) {
    currentPattern += " ";
  }
  const currentChar = currentPattern[col];

  // 检查该字符在 pattern 中是否被多处使用
  const charUsageCount = currentChar && currentChar !== ' '
    ? recipe.pattern.join('').split(currentChar).length - 1
    : 0;

  if (currentChar && currentChar !== ' ' && charUsageCount > 1) {
    // 该字符被多处使用，需要分配新字符
    const usedChars = new Set(Object.keys(recipe.key));
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const newChar = possible.split("").find(c => !usedChars.has(c)) || currentChar;

    // 更新 pattern 中该位置的字符
    recipe.pattern[row] = currentPattern.substring(0, col) + newChar + currentPattern.substring(col + 1);
    recipe.key[newChar] = newItem;
  } else {
    // 该字符只被使用一次，或是空格（新槽位）
    if (!currentChar || currentChar === ' ') {
      const usedChars = new Set(Object.keys(recipe.key));
      const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const newChar = possible.split("").find(c => !usedChars.has(c)) || "A";
      recipe.pattern[row] = currentPattern.substring(0, col) + newChar + currentPattern.substring(col + 1);
      recipe.key[newChar] = newItem;
    } else {
      recipe.key[currentChar] = newItem;
    }
  }
};

// 统一回写函数
const applySlotPath = (recipe: Recipe, slotPath: SlotPath, newItem: any) => {
  switch (slotPath.type) {
    case 'direct':
      setNestedValue(recipe, slotPath.path, newItem);
      break;
    case 'array':
      let arr = (recipe as any)[slotPath.path];
      if (!arr || !Array.isArray(arr)) {
        arr = [];
        (recipe as any)[slotPath.path] = arr;
      }
      arr[slotPath.index] = newItem;
      break;
    case 'shaped':
      applyShapedSlot(recipe, slotPath.row, slotPath.col, newItem);
      break;
    case 'custom':
      slotPath.writer(recipe, newItem);
      break;
  }
};

// ============================================================================
// SVG 配方内容渲染组件
// ============================================================================

interface RecipeContentProps {
  node: RecipeNode;
  onAddToCanvas?: (node: RecipeNode) => void;
}

// 内部渲染组件,使用 memo 包装，不接收被动更新
export const SVGRecipeContent = React.memo<RecipeContentProps>(({
  node,
  onAddToCanvas,
}) => {
  useAtom(node.contentUpdater);
  const { recipe, onCanvas, modifyMode } = node;
  const layout = getRecipeLayout(recipe);

  if (!layout) {
    return (
      <g>
        <rect x={0} y={0} width={300} height={50} fill="rgba(40,40,45,0.8)" rx="8" />
        <text x={150} y={25} textAnchor="middle" dominantBaseline="middle" fill="#888" fontSize="13">
          暂不支持显示此类型配方: {recipe?.type || "未知"}
        </text>
      </g>
    );
  }

  const containerRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onReplace = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { idorTag } = customEvent.detail;
      const target = e.target as HTMLElement;
      const slot = target.closest('[data-slot-role]');
      if (!slot) return;

      // 从 data 属性获取 slotPath
      const slotPathAttr = slot.getAttribute('data-slot-path');
      if (!slotPathAttr) return;

      let slotPath: SlotPath;
      try {
        slotPath = JSON.parse(slotPathAttr);
      } catch {
        return;
      }

      const role = slot.getAttribute('data-slot-role') as 'input' | 'output';

      // 构建新物品对象
      const newItem = role === 'output'
        ? { id: idorTag, count: 1 }
        : idorTag;

      // 使用统一回写函数
      applySlotPath(recipe, slotPath, newItem);

      Manager.updateAtom(node.contentUpdater);
    };

    el.addEventListener('replace-item', onReplace);
    return () => el.removeEventListener('replace-item', onReplace);
  }, [node, recipe]);

  const handleModeClick = () => {
    if (modifyMode) {
      const modes: RecipeModifyMode[] = ["override", "delete", "add"];
      const currentIndex = modes.indexOf(modifyMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      node.modifyMode = nextMode;
      Manager.updateAtom(node.contentUpdater);
    }
  };

  const modeLabels: Record<RecipeModifyMode, string> = {
    override: "覆盖",
    delete: "删除",
    add: "新增",
  };

  const modeColors: Record<RecipeModifyMode, string> = {
    override: "#f59e0b",
    delete: "#ef4444",
    add: "#22c55e",
  };

  return (
    <g ref={containerRef}>
      {/* 背景 */}
      <rect
        x={0}
        y={0}
        width={layout.width}
        height={layout.height}
        fill="rgba(40,40,45,0.8)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
        rx="8"
      />

      {/* 统一槽位渲染 - 使用动态渲染器 */}
      {layout.slots.map((slot, i) => {
        const Renderer = getSlotRenderer(slot.slotType);
        return (
          <g
            key={`slot-${slot.slotType}-${i}`}
            transform={`translate(${slot.x}, ${slot.y})`}
            onContextMenu={(e) => e.preventDefault()}
            data-slot-role={slot.role}
            data-slot-index={'index' in slot ? slot.index : undefined}
            data-slot-path={JSON.stringify(slot.slotPath)}
          >
            <Renderer slot={slot} />
          </g>
        );
      })}

      {/* 兼容旧的 items 字段（向后兼容） */}
      {layout.items?.map((item, i) => {
        const Renderer = getSlotRenderer('item');
        return (
          <g
            key={`item-${i}`}
            transform={`translate(${item.x}, ${item.y})`}
            onContextMenu={(e) => e.preventDefault()}
            data-slot-role={item.role}
            data-slot-index={item.index}
            data-slot-path={JSON.stringify(item.slotPath)}
          >
            <Renderer slot={item} />
          </g>
        );
      })}

      {/* 兼容旧的 fluids 字段（向后兼容） */}
      {layout.fluids?.map((fluid, i) => {
        const Renderer = getSlotRenderer('fluid');
        return (
          <g
            key={`fluid-${i}`}
            transform={`translate(${fluid.x}, ${fluid.y})`}
            data-slot-role={fluid.role}
            data-slot-path={JSON.stringify(fluid.slotPath)}
          >
            <Renderer slot={fluid} />
          </g>
        );
      })}

      {/* 箭头 */}
      {layout.arrow && (
        <text
          x={layout.arrow.x}
          y={layout.arrow.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize={layout.arrow.fontSize || 20}
        >
          {layout.arrow.text}
        </text>
      )}

      {/* 额外信息 */}
      {layout.extraInfos.map((info, idx) => (
        <g key={idx} transform={`translate(${info.x}, ${info.y})`}>
          <text
            x={0}
            y={0}
            fill="#a1a1aa"
            fontSize="10"
            textAnchor={info.x > layout.width / 2 ? "middle" : "start"}
            dominantBaseline="middle"
          >
            <tspan fill={info.color}>{info.icon}</tspan> {info.text}
          </text>
          <title>{info.label}</title>
        </g>
      ))}

      {/* 操作按钮 */}
      {layout.actionButton && (
        <g transform={`translate(${layout.actionButton.x}, ${layout.actionButton.y})`}>
          {!onCanvas ? (
            <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onAddToCanvas?.(node); }}>
              <rect
                width={layout.actionButton.width}
                height={layout.actionButton.height}
                fill="rgba(34, 197, 94, 0.2)"
                stroke="rgba(34, 197, 94, 0.5)"
                rx="4"
              />
              <text
                x={layout.actionButton.width / 2}
                y={layout.actionButton.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#22c55e"
                fontSize="16"
                fontWeight="bold"
                pointerEvents="none"
              >
                +
              </text>
              <title>添加到画布</title>
            </g>
          ) : (
            <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleModeClick(); }}>
              <rect
                width={layout.actionButton.width}
                height={layout.actionButton.height}
                fill={`${modeColors[modifyMode || "override"]}33`}
                stroke={`${modeColors[modifyMode || "override"]}80`}
                rx="4"
              />
              <text
                x={layout.actionButton.width / 2}
                y={layout.actionButton.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={modeColors[modifyMode || "override"]}
                fontSize="10"
                fontWeight="bold"
                pointerEvents="none"
              >
                {modeLabels[modifyMode || "override"]}
              </text>
              <title>点击切换模式: 覆盖/删除/新增</title>
            </g>
          )}
        </g>
      )}
    </g>
  );
});

// ============================================================================
// 画布节点组件
// ============================================================================

Coms["node/recipe"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as RecipeNode;

  const isActived = node.id === activedId;
  const isSelected = node.selected;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 选中/激活时的边框 */}
      {(isSelected || isActived) && (
        <rect
          x={-2}
          y={-2}
          width={node.size.x + 4}
          height={node.size.y + 4}
          rx="10"
          fill="none"
          stroke={isActived ? "#8b5cf6" : "#6366f1"}
          strokeWidth="2"
        />
      )}

      {/* 配方内容 */}
      <SVGRecipeContent node={node} />
    </g>
  );
};
