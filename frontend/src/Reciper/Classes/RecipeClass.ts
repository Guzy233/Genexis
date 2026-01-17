import { Recipe, SlotDisplay, ItemSlotDisplay, SlotMark } from "../RecipeSlot";

// ============================================================================
// 布局核心类型定义
// ============================================================================

export interface RecipeLayout {
  width: number;
  height: number;
  slots: SlotDisplay[];       // 统一的槽位数组
  arrow?: { x: number; y: number; text: string; fontSize?: number };
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

  protected applyFieldMark(mark: SlotMark, info: any, allowDelete: boolean = false): boolean {
    if (typeof mark !== 'string') return false;
    const match = mark.match(/^(item|fluid):(.+)$/);
    if (!match) return false;

    const [_, type, fieldName] = match;

    // 删除逻辑
    if (!info || info.id === "" || info.id === undefined) {
      if (allowDelete) {
        delete (this.recipe as any)[fieldName];
        this.clearCache();
      }
      // 多数固定槽位的配方应当忽略删除操作，只有输入输出个数不定的配方（如合成表）允许删除
      // 这里返回 true 表示 mark 已匹配，但是操作被忽略
      return true;
    }

    // 替换逻辑
    const id = info.id as string;
    const value: any = {};

    if (type === 'item') {
      if (id.startsWith('#')) value.tag = id.substring(1);
      else value.item = id;
      if (info.amount && info.amount > 1) value.count = info.amount;
    } else if (type === 'fluid') {
      if (id.startsWith('#')) value.tag = id.substring(1);
      else value.fluid = id;
      value.amount = info.amount || 1;
    }

    (this.recipe as any)[fieldName] = value;
    this.clearCache();
    return true;
  }

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
    return inputHeight + this.padding * 2;
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
      mark: `item:${this.recipe.result ? 'result' : 'output'}`
    };

    slots.push(outputSlot);

    // 箭头
    const arrow = {
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth / 2,
      y: centerY,
      text: "→",
      fontSize: 20
    };

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
      actionButton
    };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    if (this.applyFieldMark(mark, info)) return;

    const ingredients = this.recipe.ingredients || [];

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
    return inputHeight + this.padding * 2;
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
      mark: `item:${this.recipe.result ? 'result' : 'output'}`
    };

    slots.push(outputSlot);

    const arrow = {
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth / 2,
      y: centerY,
      text: "→",
      fontSize: 20
    };


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
      actionButton
    };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    if (this.applyFieldMark(mark, info)) return;

    if (!this.recipe.pattern) this.recipe.pattern = ["   ", "   ", "   "];
    if (!this.recipe.key) this.recipe.key = {};

    const pattern = this.recipe.pattern;
    const key = this.recipe.key;

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
// 具体配方类: 通用 1进1出 (支持熔炼、烧炼以及各种单输入单输出机器)
// ============================================================================

export class Generic1In1OutRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly arrowGap = 20;
  private readonly arrowWidth = 24;

  private inputKey: string;
  private outputKey: string;

  constructor(recipe: Recipe, inputKey?: string, outputKey?: string) {
    super(recipe);
    this.inputKey = inputKey || (recipe.ingredient ? 'ingredient' : (recipe.item_input ? 'item_input' : 'input'));
    this.outputKey = outputKey || (recipe.result ? 'result' : (recipe.output ? 'output' : (recipe.item_output ? 'item_output' : 'results')));
  }

  get width(): number {
    return this.padding + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap + this.slotSize + this.padding + this.slotSize + this.padding;
  }

  get height(): number {
    const time = this.recipe.cookingtime ?? this.recipe.time ?? this.recipe.duration;
    const hasExtra = this.recipe.experience !== undefined || time !== undefined;
    return this.padding + this.slotSize + this.padding + (hasExtra ? 24 : 0);
  }

  generateLayout(): RecipeLayout {
    const slots: SlotDisplay[] = [];
    const inputSource = this.recipe[this.inputKey];
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
      mark: `item:${this.inputKey}`
    };
    slots.push(inputSlot);

    const outputSource = this.recipe[this.outputKey] || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    const outputInfo = extractItemInfo(outputSource);
    const outputSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: outputInfo?.itemId || "",
      count: outputInfo?.count || 1,
      x: this.padding + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: this.padding,
      size: this.slotSize,
      label: "结果",
      index: 0,
      mark: `item:${this.outputKey}`
    };
    slots.push(outputSlot);

    const arrow = {
      x: this.padding + this.slotSize + this.arrowGap + this.arrowWidth / 2,
      y: this.padding + this.slotSize / 2,
      text: "→",
      fontSize: 20
    };

    const actionButton = {
      x: this.width - this.padding - this.slotSize,
      y: this.padding,
      width: this.slotSize,
      height: 24
    };

    return { width: this.width, height: this.height, slots, arrow, actionButton };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    if (this.applyFieldMark(mark, info)) return;
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

  // 1. 已知特定类型
  if (type.includes('smelting') || type.includes('blasting') || type.includes('smoking') || type.includes('campfire_cooking')) return new Generic1In1OutRecipeClass(recipe);
  if (type.includes('shapeless') || (recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 1)) return new ShapelessRecipeClass(recipe);

  // 2. 插件注册的工厂
  for (const factory of factories) {
    const result = factory(recipe);
    if (result) return result;
  }

  // 3. 通用 1进1出检测 (只检测关键字段是否存在)
  const hasInput = recipe.ingredient || recipe.input || recipe.item_input;
  const hasOutput = recipe.result || recipe.output || recipe.item_output || (Array.isArray(recipe.results) && recipe.results.length === 1);
  if (hasInput && hasOutput) {
    // 排除掉已经确定的复杂布局
    if (!recipe.pattern && !recipe.key && (!recipe.ingredients || (Array.isArray(recipe.ingredients) && recipe.ingredients.length <= 1))) {
      return new Generic1In1OutRecipeClass(recipe);
    }
  }

  return null;
}

export function calculateRecipeNodeSize(recipe: Recipe): { width: number; height: number } {
  const rc = createRecipeClass(recipe);
  if (rc) return { width: rc.width, height: rc.height };
  return { width: 300, height: 60 };
}
