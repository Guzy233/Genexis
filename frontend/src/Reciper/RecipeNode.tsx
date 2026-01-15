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

export interface ItemDisplay {
  itemId: string;
  count?: number;
  x: number;
  y: number;
  size: number;
  label?: string;
  role: 'input' | 'output';
  index: number;
  slotPath: SlotPath;  // 槽位路径，用于回写
}

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
  items: ItemDisplay[];
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
  const items: ItemDisplay[] = [];

  // 输入物品
  if (gridSize === "single") {
    if (inputs[0]) {
      items.push({
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
      items.push({
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
  items.push({
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
    items,
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

      {/* 物品绘制 */}
      {layout.items.map((item, i) => (
        <g
          key={i}
          transform={`translate(${item.x}, ${item.y})`}
          onContextMenu={(e) => e.preventDefault()}
          data-slot-role={item.role}
          data-slot-index={item.index}
          data-slot-path={JSON.stringify(item.slotPath)}
        >
          <SVGItemSlot
            itemIdorTag={item.itemId}
            count={item.count}
            size={item.size}
          />
          {item.label && (
            <text
              x={item.size / 2}
              y={item.size + 4}
              textAnchor="middle"
              fill="#71717a"
              fontSize="11"
              dominantBaseline="hanging"
              pointerEvents="none"
            >
              {item.label}
            </text>
          )}
        </g>
      ))}

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
