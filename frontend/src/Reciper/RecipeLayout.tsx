import {
  Recipe,
  SlotPath,
  SlotDisplay,
  ItemInputInfo,
  ItemSlotDisplay,
  FluidSlotDisplay,
  ChemicalSlotDisplay,
} from "./RecipeSlot";

// ============================================================================
// 布局工具函数
// ============================================================================

export const extractItemInfo = (
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
export const getOutputSlotPath = (recipe: Recipe): SlotPath => {
  if (recipe.result) return { type: 'direct', path: 'result' };
  if (recipe.output) return { type: 'direct', path: 'output' };
  if (Array.isArray(recipe.results)) return { type: 'array', path: 'results', index: 0 };
  return { type: 'direct', path: 'result' }; // 默认
};

// 获取额外信息列表 (保留作为辅助工具)
export const getExtraInfoItems = (recipe: Recipe) => {
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

export const createStandardLayout = (
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

export const parseOutput = (
  recipe: Recipe
): { itemId: string; count: number } | null => {
  const outSource = recipe.result || recipe.output || (Array.isArray(recipe.results) ? recipe.results[0] : null);
  if (!outSource) return null;
  const info = extractItemInfo(outSource);
  if (!info) return null;
  return { itemId: info.itemId, count: info.count || 1 };
};

export const parseShaped: RecipeParser = (r) => {
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

export const parseShapeless: RecipeParser = (r) => {
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

export const parseSmelting: RecipeParser = (r) => {
  const inputSource = r.ingredient || r.input;
  const inputPath = r.ingredient ? 'ingredient' : 'input';
  const info = extractItemInfo(inputSource);

  const input: ItemInputInfo | null = info ? {
    ...info,
    slotPath: { type: 'direct', path: inputPath }
  } : null;

  return createStandardLayout(r, [input], parseOutput(r), "single");
};

export const parseEmpowering: RecipeParser = (r) => {
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

export const parseArcFurnace: RecipeParser = (r) => {
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

export const parseIEAlloy: RecipeParser = (r) => {
  const i0Info = extractItemInfo(r.input0);
  const i1Info = extractItemInfo(r.input1);

  const inputs: Array<ItemInputInfo | null> = [
    i0Info ? { ...i0Info, slotPath: { type: 'direct', path: 'input0' } } : null,
    i1Info ? { ...i1Info, slotPath: { type: 'direct', path: 'input1' } } : null
  ];

  return createStandardLayout(r, inputs, parseOutput(r), { rows: 1, cols: 2 });
};

export const parseEnderIOAlloySmelting: RecipeParser = (r) => {
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

export const parseAdvancedAEReaction: RecipeParser = (r) => {
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

export const parseMekanismMetallurgicInfusing: RecipeParser = (r) => {
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

export const recipeParserTable: Record<string, RecipeParser> = {
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
export const getRecipeLayout = (recipe: Recipe): RecipeLayout | null => {
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

// ============================================================================
// 计算节点尺寸
// ============================================================================

export const calculateRecipeNodeSize = (recipe: Recipe): { width: number; height: number } => {
  const layout = getRecipeLayout(recipe);
  if (!layout) return { width: 300, height: 60 };
  return { width: layout.width, height: layout.height };
};
