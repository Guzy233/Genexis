import { Recipe, SlotDisplay, ItemSlotDisplay, SlotMark } from "../RecipeSlot";

// ============================================================================
// 布局核心类型定义
// ============================================================================

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


// 获取额外信息列表
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

// ============================================================================
// 配方类基类
// ============================================================================

export abstract class RecipeClassBase {
  protected recipe: Recipe;
  protected layoutCache?: RecipeLayout;

  constructor(recipe: Recipe) {
    this.recipe = recipe;
  }

  // 获取配方宽度
  abstract get width(): number;

  // 获取配方高度
  abstract get height(): number;

  // 生成布局信息
  abstract generateLayout(): RecipeLayout;

  // 获取布局 (缓存)
  getLayout(): RecipeLayout {
    if (!this.layoutCache) {
      this.layoutCache = this.generateLayout();
    }
    return this.layoutCache as RecipeLayout;
  }

  // 根据mark和info替换配方内容
  abstract replaceByMark(mark: SlotMark, info: any): void;

  // 获取原始配方对象 (用于序列化等)
  getRecipe(): Recipe {
    return this.recipe;
  }

  // 清除布局缓存 (修改后需要调用)
  protected clearCache() {
    this.layoutCache = undefined;
  }
}

// ============================================================================
// 具体配方类: 无序合成
// ============================================================================

export class ShapelessRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly gap = 4;
  private readonly arrowGap = 16;
  private readonly arrowWidth = 20;
  private readonly gridCols = 3;
  private readonly gridRows = 3;

  get width(): number {
    const inputWidth = this.slotSize * this.gridCols + this.gap * (this.gridCols - 1);
    const contentWidth = inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap + this.slotSize;
    const actionButtonX = this.padding + contentWidth + this.arrowGap;
    return actionButtonX + this.slotSize + this.padding;
  }

  get height(): number {
    const inputHeight = this.slotSize * this.gridRows + this.gap * (this.gridRows - 1);
    const extraInfoItems = getExtraInfoItems(this.recipe);
    const showAtBottom = extraInfoItems.length > 0;
    return inputHeight + (showAtBottom ? 32 : 0) + this.padding * 2;
  }

  generateLayout(): RecipeLayout {
    const ingredients = this.recipe.ingredients || [];
    const slots: SlotDisplay[] = [];

    // 输入槽位 (3x3网格)
    for (let i = 0; i < 9; i++) {
      const x = this.padding + (i % this.gridCols) * (this.slotSize + this.gap);
      const y = this.padding + Math.floor(i / this.gridCols) * (this.slotSize + this.gap);

      const ingredient = ingredients[i];
      const hasItem = ingredient !== undefined && ingredient !== null;

      // 提取物品信息
      let itemId = "";
      let count: number | undefined = undefined;

      if (hasItem) {
        const info = extractItemInfo(ingredient);
        if (info) {
          itemId = info.itemId;
          count = info.count;
        }
      }

      const mark: SlotMark = hasItem ? `input${i + 1}` as SlotMark : 'emptySlot';

      const slot: ItemSlotDisplay = {
        slotType: 'item',
        itemId,
        count,
        x,
        y,
        size: this.slotSize,
        index: i,
        mark
      };

      slots.push(slot);
    }

    // 输出槽位
    const output = this.recipe.result || this.recipe.output || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    let outputItemId = "";
    let outputCount = 1;

    if (output) {
      const info = extractItemInfo(output);
      if (info) {
        outputItemId = info.itemId;
        outputCount = info.count || 1;
      }
    }

    const inputWidth = this.slotSize * this.gridCols + this.gap * (this.gridCols - 1);
    const inputHeight = this.slotSize * this.gridRows + this.gap * (this.gridRows - 1);
    const centerY = inputHeight / 2 + this.padding;
    const outputY = centerY - this.slotSize / 2;

    const outputSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: outputItemId,
      count: outputCount,
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: outputY,
      size: this.slotSize,
      label: "结果",
      index: 0,
      mark: 'outputItem'
    };

    slots.push(outputSlot);

    // 箭头
    const arrow = {
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth / 2,
      y: centerY,
      text: "→",
      fontSize: 20
    };

    // 额外信息
    const extraInfoItems = getExtraInfoItems(this.recipe);
    const extraInfos: ExtraInfoDisplay[] = [];

    if (extraInfoItems.length > 0) {
      const startY = this.padding + inputHeight + 4 + 6;
      extraInfoItems.forEach((item, idx) => {
        extraInfos.push({ ...item, x: this.padding + 12 + idx * 85, y: startY + 8 });
      });
    }

    // 操作按钮
    const actionButton = {
      x: this.width - this.padding - this.slotSize,
      y: this.padding + inputHeight - 24,
      width: this.slotSize,
      height: 24
    };

    return {
      width: this.width,
      height: this.height,
      slots,
      arrow,
      extraInfos,
      actionButton
    };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    const ingredients = this.recipe.ingredients || [];

    // 处理输出
    if (mark === 'outputItem') {
      if (!info || info.id === "" || info.id === undefined) {
        return;
      }
      const outputKey = this.recipe.result ? 'result' : 'output';
      (this.recipe as any)[outputKey] = { id: info.id, count: info.amount || 1 };
      this.clearCache();
      return;
    }

    // 处理空槽位 - 添加到ingredients数组末尾
    if (mark === 'emptySlot') {
      if (!info || info.id === "" || info.id === undefined) {
        return;
      }

      const newItem: any = {};
      if (info.id.startsWith('#')) {
        newItem.tag = info.id.substring(1);
      } else {
        newItem.item = info.id;
      }
      if (info.amount && info.amount > 1) {
        newItem.count = info.amount;
      }

      let insertIndex = ingredients.length;
      for (let i = 0; i < 9; i++) {
        if (!ingredients[i]) {
          insertIndex = i;
          break;
        }
      }

      ingredients[insertIndex] = newItem;
      this.recipe.ingredients = ingredients;
      this.clearCache();
      return;
    }

    // 处理具体输入槽位 inputN
    const inputMatch = mark.match(/^input(\d+)$/);
    if (inputMatch) {
      const slotIndex = parseInt(inputMatch[1]) - 1;

      if (!info || info.id === "" || info.id === undefined) {
        ingredients.splice(slotIndex, 1);
        while (ingredients.length < 9) {
          ingredients.push(null as any);
        }
      } else {
        const newItem: any = {};
        if (info.id.startsWith('#')) {
          newItem.tag = info.id.substring(1);
        } else {
          newItem.item = info.id;
        }
        if (info.amount && info.amount > 1) {
          newItem.count = info.amount;
        }
        ingredients[slotIndex] = newItem;
      }

      this.recipe.ingredients = ingredients;
      this.clearCache();
      return;
    }
  }
}

// ============================================================================
// 具体配方类: 有序合成
// ============================================================================

export class ShapedRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly gap = 4;
  private readonly arrowGap = 16;
  private readonly arrowWidth = 20;
  private readonly gridCols = 3;
  private readonly gridRows = 3;

  get width(): number {
    const inputWidth = this.slotSize * this.gridCols + this.gap * (this.gridCols - 1);
    const contentWidth = inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap + this.slotSize;
    const actionButtonX = this.padding + contentWidth + this.arrowGap;
    return actionButtonX + this.slotSize + this.padding;
  }

  get height(): number {
    const inputHeight = this.slotSize * this.gridRows + this.gap * (this.gridRows - 1);
    const extraInfoItems = getExtraInfoItems(this.recipe);
    const showAtBottom = extraInfoItems.length > 0;
    return inputHeight + (showAtBottom ? 32 : 0) + this.padding * 2;
  }

  generateLayout(): RecipeLayout {
    const pattern = this.recipe.pattern || [];
    const key = this.recipe.key || {};
    const slots: SlotDisplay[] = [];

    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const x = this.padding + col * (this.slotSize + this.gap);
        const y = this.padding + row * (this.slotSize + this.gap);

        const char = pattern[row]?.[col] || ' ';
        const ingredient = char !== ' ' ? key[char] : null;
        const hasItem = ingredient !== undefined && ingredient !== null;

        let itemId = "";
        let count: number | undefined = undefined;

        if (hasItem) {
          const info = extractItemInfo(ingredient);
          if (info) {
            itemId = info.itemId;
            count = info.count;
          }
        }

        const mark: SlotMark = hasItem ? `input_${row}_${col}` : 'emptySlot';
        const linearIndex = row * this.gridCols + col;

        const slot: ItemSlotDisplay = {
          slotType: 'item',
          itemId,
          count,
          x,
          y,
          size: this.slotSize,
          index: linearIndex,
          mark
        };

        slots.push(slot);
      }
    }

    const output = this.recipe.result || this.recipe.output || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    let outputItemId = "";
    let outputCount = 1;

    if (output) {
      const info = extractItemInfo(output);
      if (info) {
        outputItemId = info.itemId;
        outputCount = info.count || 1;
      }
    }

    const inputWidth = this.slotSize * this.gridCols + this.gap * (this.gridCols - 1);
    const inputHeight = this.slotSize * this.gridRows + this.gap * (this.gridRows - 1);
    const centerY = inputHeight / 2 + this.padding;
    const outputY = centerY - this.slotSize / 2;

    const outputSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: outputItemId,
      count: outputCount,
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: outputY,
      size: this.slotSize,
      label: "结果",
      index: 0,
      mark: 'outputItem'
    };

    slots.push(outputSlot);

    const arrow = {
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth / 2,
      y: centerY,
      text: "→",
      fontSize: 20
    };

    const extraInfoItems = getExtraInfoItems(this.recipe);
    const extraInfos: ExtraInfoDisplay[] = [];

    if (extraInfoItems.length > 0) {
      const startY = this.padding + inputHeight + 4 + 6;
      extraInfoItems.forEach((item, idx) => {
        extraInfos.push({ ...item, x: this.padding + 12 + idx * 85, y: startY + 8 });
      });
    }

    const actionButton = {
      x: this.width - this.padding - this.slotSize,
      y: this.padding + inputHeight - 24,
      width: this.slotSize,
      height: 24
    };

    return {
      width: this.width,
      height: this.height,
      slots,
      arrow,
      extraInfos,
      actionButton
    };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    if (!this.recipe.pattern) this.recipe.pattern = ["   ", "   ", "   "];
    if (!this.recipe.key) this.recipe.key = {};

    const pattern = this.recipe.pattern;
    const key = this.recipe.key;

    if (mark === 'outputItem') {
      if (!info || info.id === "" || info.id === undefined) {
        return;
      }
      const outputKey = this.recipe.result ? 'result' : 'output';
      (this.recipe as any)[outputKey] = { id: info.id, count: info.amount || 1 };
      this.clearCache();
      return;
    }

    const posMatch = mark.match(/^input_(\d+)_(\d+)$/);
    if (!posMatch && mark !== 'emptySlot') return;

    let row = 0, col = 0, positionFound = false;

    if (posMatch) {
      row = parseInt(posMatch[1]);
      col = parseInt(posMatch[2]);
      positionFound = true;
    } else if (mark === 'emptySlot') {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const char = pattern[r]?.[c] || ' ';
          if (char === ' ') {
            row = r; col = c; positionFound = true; break;
          }
        }
        if (positionFound) break;
      }
      if (!positionFound) return;
    }

    if (!positionFound) return;

    while (pattern.length <= row) pattern.push("   ");
    let currentPattern = pattern[row] || "   ";
    while (currentPattern.length <= col) currentPattern += " ";

    const currentChar = currentPattern[col];

    if (!info || info.id === "" || info.id === undefined) {
      if (currentChar === ' ') return;
      const charUsageCount = this.countCharUsage(currentChar);
      if (charUsageCount > 1) {
        pattern[row] = currentPattern.substring(0, col) + ' ' + currentPattern.substring(col + 1);
      } else {
        pattern[row] = currentPattern.substring(0, col) + ' ' + currentPattern.substring(col + 1);
        delete key[currentChar];
      }
      this.clearCache();
      return;
    }

    const newItem: any = {};
    if (info.id.startsWith('#')) newItem.tag = info.id.substring(1);
    else newItem.item = info.id;
    if (info.amount && info.amount > 1) newItem.count = info.amount;

    if (currentChar === ' ') {
      const newChar = this.allocateChar();
      pattern[row] = currentPattern.substring(0, col) + newChar + currentPattern.substring(col + 1);
      key[newChar] = newItem;
    } else {
      const charUsageCount = this.countCharUsage(currentChar);
      if (charUsageCount > 1) {
        const newChar = this.allocateChar();
        pattern[row] = currentPattern.substring(0, col) + newChar + currentPattern.substring(col + 1);
        key[newChar] = newItem;
      } else {
        key[currentChar] = newItem;
      }
    }

    this.clearCache();
  }

  private countCharUsage(char: string): number {
    if (!char || char === ' ') return 0;
    const pattern = this.recipe.pattern || [];
    return pattern.join('').split(char).length - 1;
  }

  private allocateChar(): string {
    const key = this.recipe.key || {};
    const usedChars = new Set(Object.keys(key));
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (const char of possible) {
      if (!usedChars.has(char)) return char;
    }
    return "#";
  }
}

export type RecipeClassDetector = (recipe: Recipe) => RecipeClassBase | null;
const factories: RecipeClassDetector[] = [];
export function registerClassFactory(detector: RecipeClassDetector): void {
  factories.push(detector);
}

// ============================================================================
// 具体配方类: 熔炼/烧炼 (1进1出)
// ============================================================================

export class SmeltingRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly arrowGap = 20;
  private readonly arrowWidth = 24;

  get width(): number {
    return this.padding + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap + this.slotSize + this.padding + this.slotSize + this.padding;
  }

  get height(): number {
    return this.padding + this.slotSize + this.padding + 24;
  }

  generateLayout(): RecipeLayout {
    const slots: SlotDisplay[] = [];
    const inputSource = this.recipe.ingredient || this.recipe.input;
    const inputInfo = extractItemInfo(inputSource);
    const inputSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: inputInfo?.itemId || "",
      count: inputInfo?.count,
      x: this.padding,
      y: this.padding,
      size: this.slotSize,
      label: "原料",
      index: 0,
      mark: 'input1'
    };
    slots.push(inputSlot);

    const output = parseOutput(this.recipe);
    const outputSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: output?.itemId || "",
      count: output?.count || 1,
      x: this.padding + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: this.padding,
      size: this.slotSize,
      label: "结果",
      index: 0,
      mark: 'outputItem'
    };
    slots.push(outputSlot);

    const arrow = {
      x: this.padding + this.slotSize + this.arrowGap + this.arrowWidth / 2,
      y: this.padding + this.slotSize / 2,
      text: "→",
      fontSize: 20
    };

    const extraInfoItems = getExtraInfoItems(this.recipe);
    const extraInfos: ExtraInfoDisplay[] = [];
    if (extraInfoItems.length > 0) {
      const startY = this.padding + this.slotSize + 16;
      extraInfoItems.forEach((item, idx) => {
        extraInfos.push({ ...item, x: this.padding + idx * 80, y: startY });
      });
    }

    const actionButton = {
      x: this.width - this.padding - this.slotSize,
      y: this.padding,
      width: this.slotSize,
      height: 24
    };

    return { width: this.width, height: this.height, slots, arrow, extraInfos, actionButton };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    if (mark === 'outputItem') {
      const outputKey = this.recipe.result ? 'result' : 'output';
      if (!info || info.id === "") return;
      (this.recipe as any)[outputKey] = { id: info.id, count: info.amount || 1 };
    } else if (mark === 'input1') {
      const inputKey = this.recipe.ingredient ? 'ingredient' : 'input';
      if (!info || info.id === "") {
        delete (this.recipe as any)[inputKey];
      } else {
        const newItem: any = {};
        if (info.id.startsWith('#')) newItem.tag = info.id.substring(1);
        else newItem.item = info.id;
        if (info.amount > 1) newItem.count = info.amount;
        (this.recipe as any)[inputKey] = newItem;
      }
    }
    this.clearCache();
  }
}

function parseOutput(recipe: Recipe): { itemId: string; count: number } | null {
  const outSource = recipe.result || recipe.output || (Array.isArray(recipe.results) ? recipe.results[0] : null);
  if (!outSource) return null;
  const info = extractItemInfo(outSource);
  if (!info) return null;
  return { itemId: info.itemId, count: info.count || 1 };
}

export function createRecipeClass(recipe: Recipe): RecipeClassBase | null {
  const type = recipe.type || "";
  if (recipe.pattern && recipe.key) return new ShapedRecipeClass(recipe);
  if (type.includes('smelting') || type.includes('blasting') || type.includes('smoking') || type.includes('campfire_cooking')) return new SmeltingRecipeClass(recipe);
  if (type.includes('shapeless') || recipe.ingredients) return new ShapelessRecipeClass(recipe);
  for (const factory of factories) {
    const result = factory(recipe);
    if (result) return result;
  }
  return null;
}

export function calculateRecipeNodeSize(recipe: Recipe): { width: number; height: number } {
  const rc = createRecipeClass(recipe);
  if (rc) return { width: rc.width, height: rc.height };
  return { width: 300, height: 60 };
}
