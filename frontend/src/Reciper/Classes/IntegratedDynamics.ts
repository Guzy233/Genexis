import { Recipe, SlotDisplay, ItemSlotDisplay, FluidSlotDisplay, SlotMark } from "../RecipeSlot";
import { RecipeClassBase, registerClassFactory, RecipeLayout, extractItemInfo } from "./RecipeClass";

export class IntegratedDynamicsSqueezerRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly gap = 8;
  private readonly arrowWidth = 24;
  private readonly arrowGap = 16;
  private readonly gridCols = 3;

  get width(): number {
    const outputItems = this.recipe.output_items || [];
    const outCols = Math.max(1, Math.min(this.gridCols, outputItems.length));
    const outWidth = outCols * this.slotSize + (outCols - 1) * this.gap;

    // 输入(1个) + 箭头 + 输出展示区 + 操作按钮
    return this.padding + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap + outWidth + this.padding + (this.slotSize + this.padding);
  }

  get height(): number {
    const outputItems = this.recipe.output_items || [];
    const outRows = Math.max(1, Math.ceil(outputItems.length / this.gridCols));
    const contentHeight = Math.max(this.slotSize, outRows * this.slotSize + (outRows - 1) * this.gap);
    return contentHeight + this.padding * 2;
  }

  generateLayout(): RecipeLayout {
    const slots: SlotDisplay[] = [];
    const recipe = this.recipe;

    // 1. 物品输入
    const inputItem = recipe.input_item || recipe.item;
    const inputInfo = extractItemInfo(inputItem);
    slots.push({
      slotType: 'item',
      itemId: inputInfo?.itemId || "",
      count: inputInfo?.count,
      x: this.padding,
      y: (this.height - this.slotSize) / 2,
      size: this.slotSize,
      label: "原料",
      index: 0,
      mark: 'item:input_item'
    } as ItemSlotDisplay);

    // 2. 物品输出列表
    const outputItems = recipe.output_items || [];
    const outStartX = this.padding + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap;

    outputItems.forEach((out: any, i: number) => {
      const col = i % this.gridCols;
      const row = Math.floor(i / this.gridCols);
      const itemInfo = extractItemInfo(out.item || out);

      let label = "";
      if (out.chance !== undefined && out.chance < 1) {
        label = `${(out.chance * 100).toFixed(0)}%`;
      }

      slots.push({
        slotType: 'item',
        itemId: itemInfo?.itemId || "",
        count: itemInfo?.count,
        x: outStartX + col * (this.slotSize + this.gap),
        y: this.padding + row * (this.slotSize + this.gap),
        size: this.slotSize,
        label: label,
        index: i,
        mark: `array:output_items:${i}`
      } as ItemSlotDisplay);
    });

    // 3. 流体输出 (如果有)
    const fluidOutput = recipe.output_fluid || recipe.fluid;
    if (fluidOutput) {
      // 暂时放在物品输出右侧或下方，这里简单处理
    }

    const arrow = {
      x: this.padding + this.slotSize + this.arrowGap + this.arrowWidth / 2,
      y: this.height / 2,
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

    const arrayMatch = (mark as string).match(/^array:(.+):(\d+)$/);
    if (arrayMatch) {
      const field = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);
      const arr = (this.recipe as any)[field];
      if (!arr || !arr[index]) return;

      if (!info || !info.id) {
        arr.splice(index, 1);
      } else {
        const newItem: any = { item: {} };
        if (info.id.startsWith('#')) newItem.item.tag = info.id.substring(1);
        else newItem.item.id = info.id;
        if (info.amount && info.amount > 1) newItem.item.count = info.amount;

        // 保持原有的概率
        if (arr[index].chance !== undefined) newItem.chance = arr[index].chance;
        arr[index] = newItem;
      }
      this.clearCache();
    }
  }
}

// 注册工厂
function idDetector(recipe: Recipe): RecipeClassBase | null {
  if (recipe.type === 'integrateddynamics:squeezer' || recipe.type === 'integrateddynamics:mechanical_squeezer') {
    return new IntegratedDynamicsSqueezerRecipeClass(recipe);
  }
  return null;
}

registerClassFactory(idDetector);
