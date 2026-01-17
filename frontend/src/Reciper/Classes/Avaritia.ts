import { Recipe, SlotDisplay, ItemSlotDisplay, SlotMark } from "../RecipeSlot";
import { RecipeClassBase, registerClassFactory, RecipeLayout, extractItemInfo } from "./RecipeClass";

export class AvaritiaShapedRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly gap = 4;
  private readonly arrowGap = 16;
  private readonly arrowWidth = 20;

  get gridCols(): number {
    const pattern = this.recipe.pattern || [];
    let max = 0;
    pattern.forEach(row => {
      if (typeof row === 'string') max = Math.max(max, row.length);
    });
    return Math.max(max, 3); // 最小 3x3
  }

  get gridRows(): number {
    return Math.max((this.recipe.pattern || []).length, 3); // 最小 3x3
  }

  get width(): number {
    const inputWidth = this.slotSize * this.gridCols + this.gap * (this.gridCols - 1);
    const contentWidth = inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap + this.slotSize;
    // 预留右侧操作按钮空间
    return this.padding + contentWidth + this.padding + (this.slotSize + this.padding);
  }

  get height(): number {
    const inputHeight = this.slotSize * this.gridRows + this.gap * (this.gridRows - 1);
    return inputHeight + this.padding * 2;
  }

  generateLayout(): RecipeLayout {
    const pattern = this.recipe.pattern || [];
    const key = this.recipe.key || {};
    const slots: SlotDisplay[] = [];

    const rows = this.gridRows;
    const cols = this.gridCols;

    for (let row = 0; row < rows; row++) {
      const rowStr = (pattern[row] || "").padEnd(cols, " ");
      for (let col = 0; col < cols; col++) {
        const x = this.padding + col * (this.slotSize + this.gap);
        const y = this.padding + row * (this.slotSize + this.gap);

        const char = rowStr[col];
        const ingredient = char && char !== " " ? key[char] : null;

        let itemId = "";
        let count: number | undefined = undefined;

        if (ingredient) {
          const info = extractItemInfo(ingredient);
          if (info) {
            itemId = info.itemId;
            count = info.count;
          }
        }

        const mark: SlotMark = `input_${row}_${col}` as SlotMark;
        const linearIndex = row * cols + col;

        slots.push({
          slotType: 'item',
          itemId,
          count,
          x,
          y,
          size: this.slotSize,
          index: linearIndex,
          mark
        } as ItemSlotDisplay);
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

    const inputWidth = this.slotSize * cols + this.gap * (cols - 1);
    const inputHeight = this.slotSize * rows + this.gap * (rows - 1);
    const centerY = inputHeight / 2 + this.padding;
    const outputY = centerY - this.slotSize / 2;

    slots.push({
      slotType: 'item',
      itemId: outputItemId,
      count: outputCount,
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: outputY,
      size: this.slotSize,
      label: "结果",
      index: 0,
      mark: `item:${this.recipe.result ? 'result' : 'output'}`
    } as ItemSlotDisplay);

    const arrow = {
      x: this.padding + inputWidth + this.arrowGap + this.arrowWidth / 2,
      y: centerY,
      text: "→",
      fontSize: 20
    };

    const actionButton = {
      x: this.width - this.padding - this.slotSize,
      y: this.height - this.padding - 24,
      width: this.slotSize,
      height: 24
    };

    return { width: this.width, height: this.height, slots, arrow, actionButton };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    if (this.applyFieldMark(mark, info)) return;

    // Avaritia 逻辑与通用 Shaped 类似，但需要处理动态网格
    const posMatch = (mark as string).match(/^input_(\d+)_(\d+)$/);
    if (posMatch) {
      const row = parseInt(posMatch[1]);
      const col = parseInt(posMatch[2]);

      const pattern = this.recipe.pattern || [];
      const key = this.recipe.key || {};

      // 确保 pattern 长度足够
      while (pattern.length <= row) pattern.push(" ".repeat(this.gridCols));
      let currentLine = pattern[row];
      while (currentLine.length <= col) currentLine += " ";

      if (!info || !info.id) {
        // 删除项
        const newLine = currentLine.substring(0, col) + " " + currentLine.substring(col + 1);
        pattern[row] = newLine;
      } else {
        // 查找是否已有相同的物品在 key 中
        let foundChar = "";
        for (const [char, ing] of Object.entries(key)) {
          const ingInfo = extractItemInfo(ing);
          if (ingInfo && ingInfo.itemId === info.id) {
            foundChar = char;
            break;
          }
        }

        if (!foundChar) {
          // 分配新字符
          const usedChars = new Set(Object.keys(key));
          for (let i = 0; i < 26; i++) {
            const c = String.fromCharCode(97 + i);
            if (!usedChars.has(c)) {
              foundChar = c;
              break;
            }
          }
        }

        if (foundChar) {
          key[foundChar] = info.id.startsWith('#') ? { tag: info.id.substring(1) } : { item: info.id };
          const newLine = currentLine.substring(0, col) + foundChar + currentLine.substring(col + 1);
          pattern[row] = newLine;
        }
      }

      this.recipe.pattern = pattern;
      this.recipe.key = key;
      this.clearCache();
    }
  }
}

function avaritiaDetector(recipe: Recipe): RecipeClassBase | null {
  if (recipe.type?.startsWith('avaritia:')) {
    if (recipe.pattern && recipe.key) {
      return new AvaritiaShapedRecipeClass(recipe);
    }
  }
  return null;
}

registerClassFactory(avaritiaDetector);
