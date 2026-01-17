import { Recipe, SlotDisplay, ItemSlotDisplay, FluidSlotDisplay, SlotMark } from "../RecipeSlot";
import { RecipeClassBase, registerClassFactory, RecipeLayout, extractItemInfo } from "./RecipeClass";

export class Ae2ReactionRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly fluidWidth = 24;
  private readonly fluidHeight = 40;
  private readonly gap = 4;
  private readonly largeGap = 12;
  private readonly arrowGap = 16;
  private readonly arrowWidth = 20;

  get width(): number {
    const inputWidth = this.fluidWidth + this.largeGap + (this.slotSize * 3 + this.gap * 2);
    const outputWidth = this.slotSize + this.largeGap + this.fluidWidth;
    const contentWidth = inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap + outputWidth;
    // 预留右侧操作按钮空间
    return this.padding + contentWidth + this.padding + (this.slotSize + this.padding);
  }

  get height(): number {
    const gridHeight = this.slotSize * 3 + this.gap * 2;
    return this.padding + gridHeight + this.padding;
  }

  generateLayout(): RecipeLayout {
    const slots: SlotDisplay[] = [];
    const recipe = this.recipe;

    // 1. 输入流体 (左侧垂直居中)
    const inputFluid = recipe.input_fluid;
    let inputFluidId = "";
    let inputFluidAmount = 0;
    if (inputFluid) {
      const ingredient = inputFluid.ingredient;
      if (ingredient) {
        if (ingredient.fluid) inputFluidId = ingredient.fluid;
        else if (ingredient.tag) inputFluidId = '#' + ingredient.tag;
        else if (ingredient.item) inputFluidId = ingredient.item;
      }
      inputFluidAmount = inputFluid.amount || 0;
    }

    slots.push({
      slotType: 'fluid',
      fluidId: inputFluidId,
      amount: inputFluidAmount,
      x: this.padding,
      y: this.padding + (this.height - this.padding * 2 - this.fluidHeight) / 2,
      width: this.fluidWidth,
      height: this.fluidHeight,
      mark: 'inputFluid'
    } as FluidSlotDisplay);

    // 2. 3x3 物品输入 (参考无序合成)
    const inputItems = recipe.input_items || [];
    const gridStartX = this.padding + this.fluidWidth + this.largeGap;
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = gridStartX + col * (this.slotSize + this.gap);
      const y = this.padding + row * (this.slotSize + this.gap);

      const item = inputItems[i];
      let itemId = "";
      let count: number | undefined = undefined;

      if (item) {
        const info = extractItemInfo(item.ingredient || item);
        if (info) {
          itemId = info.itemId;
          count = item.amount || info.count;
        }
      }

      slots.push({
        slotType: 'item',
        itemId,
        count,
        x,
        y,
        size: this.slotSize,
        index: i,
        mark: `input${i + 1}`
      } as ItemSlotDisplay);
    }

    // 3. 输出 (右侧)
    const output = recipe.output as any;
    const isOutputFluid = output && output["#t"] === "ae2:f";
    const isOutputItem = output && output["#t"] === "ae2:i";

    const centerY = this.height / 2;
    const outputItemX = gridStartX + (this.slotSize * 3 + this.gap * 2) + this.arrowGap + this.arrowWidth + this.arrowGap;
    const outputFluidX = outputItemX + this.slotSize + this.largeGap;

    // 物品输出槽
    slots.push({
      slotType: 'item',
      itemId: isOutputItem ? (output.id || output.item) : "",
      count: isOutputItem ? output["#"] : undefined,
      x: outputItemX,
      y: centerY - this.slotSize / 2,
      size: this.slotSize,
      label: "成品",
      index: 0,
      mark: 'outputItem'
    } as ItemSlotDisplay);

    // 流体输出槽
    slots.push({
      slotType: 'fluid',
      fluidId: isOutputFluid ? (output.id || output.fluid) : "",
      amount: isOutputFluid ? (output["#"] || output.amount) : 0,
      x: outputFluidX,
      y: centerY - this.fluidHeight / 2,
      width: this.fluidWidth,
      height: this.fluidHeight,
      mark: 'outputFluid'
    } as FluidSlotDisplay);

    // 4. 其它元素 (箭头和按钮)
    const arrow = {
      x: gridStartX + (this.slotSize * 3 + this.gap * 2) + this.arrowGap + this.arrowWidth / 2,
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

    // 如果有能量消耗，加一个小提示 (可以通过 SlotRenderer 或单独处理，此处暂时简化)
    if (recipe.input_energy) {
      // 可以考虑在左上角或底部显示能量，此处留空待视觉优化
    }

    return { width: this.width, height: this.height, slots, arrow, actionButton };
  }

  replaceByMark(mark: SlotMark, info: any): void {
    const recipe = this.recipe;

    // 1. 流体输入
    if (mark === 'inputFluid') {
      if (!info || !info.id) {
        delete recipe.input_fluid;
      } else {
        const amount = recipe.input_fluid?.amount || 1000;
        const ingredient: any = {};
        if (info.id.startsWith('#')) ingredient.tag = info.id.substring(1);
        else {
          // 判断是流体还是物品，AE2 Reaction 通常接受流体
          ingredient.fluid = info.id;
        }
        recipe.input_fluid = { amount, ingredient };
      }
    }

    // 2. 3x3 物品输入
    else if ((mark as string).startsWith('input')) {
      const inputMatch = (mark as string).match(/^input(\d+)$/);
      if (inputMatch) {
        const idx = parseInt(inputMatch[1]) - 1;
        if (!recipe.input_items) recipe.input_items = [];

        if (!info || !info.id) {
          recipe.input_items.splice(idx, 1);
          // 保持数组长度以维持位置（可选，参考无序合成处理）
          while (recipe.input_items.length < 9) {
            recipe.input_items.push(null as any);
          }
        } else {
          const newItem = {
            amount: info.amount || 1,
            ingredient: info.id.startsWith('#') ? { tag: info.id.substring(1) } : { item: info.id }
          };
          recipe.input_items[idx] = newItem;
        }
      }
    }

    // 3. 输出逻辑 (互相排斥)
    else if (mark === 'outputItem' || mark === 'outputFluid') {
      if (!info || !info.id) {
        delete recipe.output;
      } else {
        const isFluid = mark === 'outputFluid';
        recipe.output = {
          "#": info.amount || 1,
          "#t": isFluid ? "ae2:f" : "ae2:i",
          id: info.id
        } as any;
      }
    }

    this.clearCache();
  }
}

// 注册工厂
function ae2Detector(recipe: Recipe): Ae2ReactionRecipeClass | null {
  if (recipe.type === 'advanced_ae:reaction') {
    return new Ae2ReactionRecipeClass(recipe);
  }
  return null;
}

registerClassFactory(ae2Detector);
