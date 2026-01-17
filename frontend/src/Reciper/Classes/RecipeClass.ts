import { Recipe } from "../RecipeSlot";
import { RecipeLayout, ExtraInfoDisplay, getExtraInfoItems } from "../RecipeLayout";
import { SlotDisplay, ItemSlotDisplay } from "../RecipeSlot";

/**
 * 新的配方类系统
 * 每个配方实例化为一个类,包含布局信息和修改逻辑
 * 使用 mark 标识槽位,简化回写逻辑
 */

// ============================================================================
// 槽位标记定义
// ============================================================================

export type SlotMark =
  | `input${number}`      // input1, input2, input3...
  | `emptySlot`           // 空槽位 (无序合成中未填充的槽位)
  | `outputItem`          // 物品输出
  | `outputFluid`         // 流体输出
  | `inputFluid`          // 流体输入
  | `inputChemical`       // 化学品输入
  | `outputChemical`      // 化学品输出
  | string;               // 其他自定义标记

// 带mark的槽位显示 - 使用交叉类型以保持兼容性
export type MarkedSlotDisplay = SlotDisplay & {
  mark: SlotMark;
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

  // 生成布局信息 (带mark)
  abstract generateLayout(): RecipeLayout & { markedSlots: MarkedSlotDisplay[] };

  // 获取布局 (缓存)
  getLayout(): RecipeLayout & { markedSlots: MarkedSlotDisplay[] } {
    if (!this.layoutCache) {
      this.layoutCache = this.generateLayout();
    }
    return this.layoutCache as RecipeLayout & { markedSlots: MarkedSlotDisplay[] };
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

  generateLayout(): RecipeLayout & { markedSlots: MarkedSlotDisplay[] } {
    const ingredients = this.recipe.ingredients || [];
    const markedSlots: MarkedSlotDisplay[] = [];
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
        if (typeof ingredient === 'string') {
          itemId = ingredient;
        } else if (typeof ingredient === 'object') {
          const tag = ingredient.tag;
          const item = ingredient.item || ingredient.id;

          if (tag) {
            itemId = tag.startsWith('#') ? tag : '#' + tag;
          } else if (item) {
            itemId = item;
          }
          count = ingredient.count;
        }
      }

      const mark: SlotMark = hasItem ? `input${i + 1}` as SlotMark : 'emptySlot';

      const slot: ItemSlotDisplay & { mark: SlotMark } = {
        slotType: 'item',
        itemId,
        count,
        x,
        y,
        size: this.slotSize,
        role: 'input',
        index: i,
        slotPath: { type: 'array', path: 'ingredients', index: i },
        mark
      };

      markedSlots.push(slot);
      slots.push(slot);
    }

    // 输出槽位
    const output = this.recipe.result || this.recipe.output || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    let outputItemId = "";
    let outputCount = 1;

    if (output) {
      if (typeof output === 'string') {
        outputItemId = output;
      } else if (typeof output === 'object') {
        outputItemId = output.id || output.item || "";
        outputCount = output.count || 1;
      }
    }

    const inputWidth = this.slotSize * this.gridCols + this.gap * (this.gridCols - 1);
    const inputHeight = this.slotSize * this.gridRows + this.gap * (this.gridRows - 1);
    const centerY = inputHeight / 2 + this.padding;
    const outputY = centerY - this.slotSize / 2;

    const outputSlot: ItemSlotDisplay & { mark: SlotMark } = {
      slotType: 'item',
      itemId: outputItemId,
      count: outputCount,
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: outputY,
      size: this.slotSize,
      label: "结果",
      role: 'output',
      index: 0,
      slotPath: { type: 'direct', path: this.recipe.result ? 'result' : 'output' },
      mark: 'outputItem'
    };

    markedSlots.push(outputSlot);
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
    const contentWidth = inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap + this.slotSize;
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
      markedSlots,
      arrow,
      extraInfos,
      actionButton
    };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    const ingredients = this.recipe.ingredients || [];

    // 处理输出
    if (mark === 'outputItem') {
      // 输出槽位一般不允许修改,但为了完整性保留逻辑
      if (!info || info.id === "" || info.id === undefined) {
        // 不处理删除输出
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
        // 空槽位删除操作,无需处理
        return;
      }

      // 构建新物品对象
      const newItem: any = {};
      if (info.id.startsWith('#')) {
        newItem.tag = info.id.substring(1);
      } else {
        newItem.item = info.id;
      }
      if (info.amount && info.amount > 1) {
        newItem.count = info.amount;
      }

      // 找到第一个空位或数组末尾
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
      const slotIndex = parseInt(inputMatch[1]) - 1; // input1 -> index 0

      if (!info || info.id === "" || info.id === undefined) {
        // 删除操作 - 将后面的物品向前补位
        ingredients.splice(slotIndex, 1);
        // 确保数组至少有9个元素用于显示
        while (ingredients.length < 9) {
          ingredients.push(null as any);
        }
      } else {
        // 替换操作
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

  generateLayout(): RecipeLayout & { markedSlots: MarkedSlotDisplay[] } {
    const pattern = this.recipe.pattern || [];
    const key = this.recipe.key || {};
    const markedSlots: MarkedSlotDisplay[] = [];
    const slots: SlotDisplay[] = [];

    // 输入槽位 (3x3网格)
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const x = this.padding + col * (this.slotSize + this.gap);
        const y = this.padding + row * (this.slotSize + this.gap);

        // 从pattern中获取字符
        const char = pattern[row]?.[col] || ' ';
        const ingredient = char !== ' ' ? key[char] : null;
        const hasItem = ingredient !== undefined && ingredient !== null;

        // 提取物品信息
        let itemId = "";
        let count: number | undefined = undefined;

        if (hasItem) {
          if (typeof ingredient === 'string') {
            itemId = ingredient;
          } else if (typeof ingredient === 'object') {
            const tag = ingredient.tag;
            const item = ingredient.item || ingredient.id;

            if (tag) {
              itemId = tag.startsWith('#') ? tag : '#' + tag;
            } else if (item) {
              itemId = item;
            }
            count = ingredient.count;
          }
        }

        // 使用位置mark: input_row_col 格式
        const mark: SlotMark = hasItem ? `input_${row}_${col}` : 'emptySlot';
        const linearIndex = row * this.gridCols + col;

        const slot: ItemSlotDisplay & { mark: SlotMark } = {
          slotType: 'item',
          itemId,
          count,
          x,
          y,
          size: this.slotSize,
          role: 'input',
          index: linearIndex,
          slotPath: { type: 'shaped', row, col },
          mark
        };

        markedSlots.push(slot);
        slots.push(slot);
      }
    }

    // 输出槽位
    const output = this.recipe.result || this.recipe.output || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    let outputItemId = "";
    let outputCount = 1;

    if (output) {
      if (typeof output === 'string') {
        outputItemId = output;
      } else if (typeof output === 'object') {
        outputItemId = output.id || output.item || "";
        outputCount = output.count || 1;
      }
    }

    const inputWidth = this.slotSize * this.gridCols + this.gap * (this.gridCols - 1);
    const inputHeight = this.slotSize * this.gridRows + this.gap * (this.gridRows - 1);
    const centerY = inputHeight / 2 + this.padding;
    const outputY = centerY - this.slotSize / 2;

    const outputSlot: ItemSlotDisplay & { mark: SlotMark } = {
      slotType: 'item',
      itemId: outputItemId,
      count: outputCount,
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: outputY,
      size: this.slotSize,
      label: "结果",
      role: 'output',
      index: 0,
      slotPath: { type: 'direct', path: this.recipe.result ? 'result' : 'output' },
      mark: 'outputItem'
    };

    markedSlots.push(outputSlot);
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
      markedSlots,
      arrow,
      extraInfos,
      actionButton
    };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    // 确保pattern和key存在
    if (!this.recipe.pattern) this.recipe.pattern = ["   ", "   ", "   "];
    if (!this.recipe.key) this.recipe.key = {};

    const pattern = this.recipe.pattern;
    const key = this.recipe.key;

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

    // 解析mark获取位置
    const posMatch = mark.match(/^input_(\d+)_(\d+)$/);
    if (!posMatch && mark !== 'emptySlot') return;

    let row: number = 0;
    let col: number = 0;
    let positionFound = false;

    if (posMatch) {
      row = parseInt(posMatch[1]);
      col = parseInt(posMatch[2]);
      positionFound = true;
    } else if (mark === 'emptySlot') {
      // 空槽位: 找到第一个空位置
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const char = pattern[r]?.[c] || ' ';
          if (char === ' ') {
            row = r;
            col = c;
            positionFound = true;
            break;
          }
        }
        if (positionFound) break;
      }

      if (!positionFound) {
        // 没有空位,无法添加
        return;
      }
    }

    if (!positionFound) {
      return;
    }

    // 确保pattern有足够的行
    while (pattern.length <= row) {
      pattern.push("   ");
    }

    // 确保该行有足够的列
    let currentPattern = pattern[row] || "   ";
    while (currentPattern.length <= col) {
      currentPattern += " ";
    }

    const currentChar = currentPattern[col];

    // ========== 删除操作 ==========
    if (!info || info.id === "" || info.id === undefined) {
      if (currentChar === ' ') return; // 已经是空的

      // 检查该字符在pattern中的使用次数
      const charUsageCount = this.countCharUsage(currentChar);

      if (charUsageCount > 1) {
        // 字符被多处使用,只清除当前位置
        pattern[row] = currentPattern.substring(0, col) + ' ' + currentPattern.substring(col + 1);
      } else {
        // 字符只被使用一次,清除pattern位置并删除key
        pattern[row] = currentPattern.substring(0, col) + ' ' + currentPattern.substring(col + 1);
        delete key[currentChar];
      }

      this.clearCache();
      return;
    }

    // ========== 添加/替换操作 ==========
    const newItem: any = {};
    if (info.id.startsWith('#')) {
      newItem.tag = info.id.substring(1);
    } else {
      newItem.item = info.id;
    }
    if (info.amount && info.amount > 1) {
      newItem.count = info.amount;
    }

    if (currentChar === ' ') {
      // 空位置,需要分配新字符
      const newChar = this.allocateChar();
      pattern[row] = currentPattern.substring(0, col) + newChar + currentPattern.substring(col + 1);
      key[newChar] = newItem;
    } else {
      // 非空位置,检查字符复用
      const charUsageCount = this.countCharUsage(currentChar);

      if (charUsageCount > 1) {
        // 字符被多处使用,需要分配新字符
        const newChar = this.allocateChar();
        pattern[row] = currentPattern.substring(0, col) + newChar + currentPattern.substring(col + 1);
        key[newChar] = newItem;
      } else {
        // 字符只被使用一次,直接替换key
        key[currentChar] = newItem;
      }
    }

    this.clearCache();
  }

  // 辅助方法: 统计字符在pattern中的使用次数
  private countCharUsage(char: string): number {
    if (!char || char === ' ') return 0;
    const pattern = this.recipe.pattern || [];
    return pattern.join('').split(char).length - 1;
  }

  // 辅助方法: 分配一个未使用的字符
  private allocateChar(): string {
    const key = this.recipe.key || {};
    const usedChars = new Set(Object.keys(key));
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (const char of possible) {
      if (!usedChars.has(char)) {
        return char;
      }
    }

    // 如果26个字母都用完了,使用小写字母
    const possibleLower = "abcdefghijklmnopqrstuvwxyz";
    for (const char of possibleLower) {
      if (!usedChars.has(char)) {
        return char;
      }
    }

    // 如果还用完了,使用数字
    for (let i = 0; i <= 9; i++) {
      const char = i.toString();
      if (!usedChars.has(char)) {
        return char;
      }
    }
    // 实在没有了,返回 #
    return "#";
  }
}

export type RecipeClassDetector = (recipe: Recipe) => RecipeClassBase | null;

const factories: RecipeClassDetector[] = [];

export function registerClassFactory(detector: RecipeClassDetector): void {
  factories.push(detector);
}

export function createRecipeClass(recipe: Recipe): RecipeClassBase | null {
  const type = recipe.type || "";

  // ========== 原版和通用配方 (内置) ==========
  if (recipe.pattern && recipe.key) {
    return new ShapedRecipeClass(recipe);
  }

  // 无序合成
  if (type.includes('shapeless') || recipe.ingredients) {
    return new ShapelessRecipeClass(recipe);
  }

  for (const factory of factories) {
    const result = factory(recipe);
    if (result) return result;
  }

  return null;
}
