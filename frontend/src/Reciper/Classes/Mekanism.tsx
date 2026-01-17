import { Recipe, registerRender as registerRenderer, SlotDisplayBase, SlotRendererProps } from "../RecipeSlot";
import { SlotDisplay, ItemSlotDisplay, SlotMark } from "../RecipeSlot";
import { RecipeClassBase, registerClassFactory, RecipeLayout, extractItemInfo } from "./RecipeClass";
import { Node } from "../../Globals";
import { atom, useAtom } from "jotai";
import { ObjectFactories } from "../../Controllers/Creator";
import { activedId } from "../../Controllers/Selector";
import { Anchor, anchors_rect, Obj, Coms } from "../../Globals";
import { registerSerializer, serializeAnchors, deserializeAnchors } from "../../Serialization";


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
const CHEMICAL_TYPE_CONFIG: Record<ChemicalType, { icon: string; defaultColor: string; label: string }> = {
  gas: { icon: '◯', defaultColor: '#88ccff', label: '气体' },
  slurry: { icon: '◈', defaultColor: '#a08060', label: '矿浆' },
  infuse: { icon: '✦', defaultColor: '#ff88ff', label: '灌注物' },
  pigment: { icon: '◆', defaultColor: '#ffcc00', label: '颜料' },
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

// 化学品槽位 (Mekanism风格)
export interface ChemicalSlotDisplay extends SlotDisplayBase {
  slotType: 'chemical';
  chemicalType: 'gas' | 'slurry' | 'infuse' | 'pigment';
  chemicalId: string;
  amount: number;         // mb
  width: number;
  height: number;
}

registerRenderer("chemical",
  ({ slot }: SlotRendererProps<ChemicalSlotDisplay>) => {
    const color = getChemicalColor(slot.chemicalType, slot.chemicalId);
    // 对于小量化学品使用固定比例，避免高度显示不正常
    const maxAmount = slot.amount < 1000 ? 1000 : 10000;
    const fillPercent = Math.min(1, Math.max(0.1, slot.amount / maxAmount));  // 至少显示10%
    const fillHeight = Math.max(4, slot.height * fillPercent);  // 至少4px高度
    const emptyHeight = slot.height - fillHeight;

    // 化学品类型图标 (优先使用显示配置中的图标)
    const icon = CHEMICAL_TYPE_CONFIG[slot.chemicalType]?.icon || '?';

    return (
      <g
        style={{ cursor: 'pointer' }}
        data-type="chemical"
        data-id={slot.chemicalId}
        data-amount={slot.amount}
        data-chemicaltype={slot.chemicalType}
      >
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
          style={{ pointerEvents: 'none' }}
        >
          {icon}
        </text>
        <text
          x={slot.width / 2}
          y={slot.height + 12}
          textAnchor="middle"
          fill="#a1a1aa"
          fontSize="9"
          dominantBaseline="hanging"
          style={{ pointerEvents: 'none' }}
        >
          {slot.amount >= 1000 ? `${(slot.amount / 1000).toFixed(1)}B` : `${slot.amount}mb`}
        </text>
        <title>{slot.chemicalType}: {slot.chemicalId} - {slot.amount}mb</title>
      </g>
    );
  })

type ChemicalType = 'gas' | 'slurry' | 'infuse' | 'pigment';

// ============ 化学品节点接口 ============
export interface MCChemicalNode extends Node {
  type: 'node/mc/chemical';
  chemicalId: string;                // 化学品ID
  chemicalType: ChemicalType; // 化学品类型
  amount: number;            // 数量 (mb)
}

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 工厂函数
export const createMCChemicalNode = (info?: any): MCChemicalNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/mc/chemical",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 72, y: 100 },
    selected: false,
    eAncs: anchors_default,
    aAncs: anchors_rect,
    // 化学品特有属性
    chemicalType: info?.chemicaltype || "gas",
    chemicalId: info?.id || "",
    amount: 1000,
  } as MCChemicalNode;
};

// 注册工厂
ObjectFactories["node/mc/chemical"] = createMCChemicalNode;

// 注册序列化
registerSerializer(
  "node/mc/chemical",
  (obj: Obj) => {
    const node = obj as MCChemicalNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      aAncs: serializeAnchors(node.aAncs, "rect"),
      eAncs: serializeAnchors(node.eAncs, null),
      selected: node.selected,
      chemicalId: (node as any).id,
      chemicalType: node.chemicalType,
      amount: node.amount,
    };
  },
  (data: any) => {
    const node: MCChemicalNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      selected: data.selected ?? false,
      updater: atom(0),
      chemicalType: data.chemicalType ?? 'gas',
      amount: data.amount ?? 1000,
      chemicalId: ""
    } as MCChemicalNode;
    (node as any).chemicalId = data.chemicalId;
    return node;
  }
);

// 化学品节点组件
Coms["node/mc/chemical"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as MCChemicalNode;
  const chemicalId = node.chemicalId || "mekanism:hydrogen";
  const chemicalType = node.chemicalType || 'gas';
  const amount = node.amount || 1000;

  const isActived = node.id === activedId;
  const isSelected = node.selected;
  const strokeColor = isActived ? "#8b5cf6" : isSelected ? "#6366f1" : "transparent";
  const strokeWidth = (isSelected || isActived) ? 2 : 0;

  const color = getChemicalColor(chemicalType, chemicalId);
  const config = CHEMICAL_TYPE_CONFIG[chemicalType] || CHEMICAL_TYPE_CONFIG.gas;

  const nodeWidth = 72;
  const nodeHeight = 100;
  const tankHeight = 64;
  const tankWidth = 64;
  const fillPercent = Math.min(1, Math.max(0.1, amount / 10000));
  const fillHeight = tankHeight * fillPercent;

  // 获取显示名称
  const displayName = chemicalId.split(':').pop()?.replace(/_/g, ' ') || chemicalId;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 选中边框 */}
      {(isSelected || isActived) && (
        <rect
          x={0}
          y={0}
          width={nodeWidth}
          height={nodeHeight}
          rx="6"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}

      {/* 化学品容器 */}
      <g transform={`translate(${(nodeWidth - tankWidth) / 2}, 4)`}
        data-type="chemical"
        data-amount={amount}
        data-id={chemicalId}
        data-chemicaltype={chemicalType}
      >
        {/* 背景 (带虚线边框表示化学品) */}
        <rect
          x={0}
          y={0}
          width={tankWidth}
          height={tankHeight}
          fill="rgba(30, 30, 35, 0.9)"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="4,2"
          rx="4"

        />
        {/* 化学品填充 */}
        <rect
          x={2}
          y={tankHeight - fillHeight + 2}
          width={tankWidth - 4}
          height={Math.max(0, fillHeight - 4)}
          fill={color}
          opacity={0.6}
          rx="2"
        />
        {/* 类型图标 */}
        <text
          x={tankWidth / 2}
          y={tankHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize="16"
        >
          {config.icon}
        </text>
      </g>

      {/* 类型标签 */}
      <text
        x={nodeWidth / 2}
        y={tankHeight + 12}
        textAnchor="middle"
        fill="#71717a"
        fontSize="9"
        style={{ pointerEvents: "none" }}
      >
        {config.label}
      </text>

      {/* 名称标签 */}
      <text
        x={nodeWidth / 2}
        y={tankHeight + 24}
        textAnchor="middle"
        fill={isActived ? "#c4b5fd" : isSelected ? "#a5b4fc" : "#e4e4e7"}
        fontSize="10"
        style={{ pointerEvents: "none" }}
      >
        {displayName.length > 8 ? displayName.slice(0, 8) + '...' : displayName}
      </text>

      {/* 数量标签 */}
      <text
        x={nodeWidth / 2}
        y={tankHeight + 36}
        textAnchor="middle"
        fill="#71717a"
        fontSize="9"
        style={{ pointerEvents: "none" }}
      >
        {amount >= 1000 ? `${(amount / 1000).toFixed(1)}B` : `${amount}mb`}
      </text>
    </g>
  );
};


// ============================================================================
// Mekanism 通用化学品+物品配方类 (净化、注入、灌注)
// ============================================================================

export class MekanismItemChemicalRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly chemicalWidth = 24;
  private readonly chemicalHeight = 40;
  private readonly gap = 8;
  private readonly arrowGap = 12;
  private readonly arrowWidth = 20;

  get width(): number {
    const contentWidth = this.chemicalWidth + this.gap + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap + this.slotSize;
    const actionButtonX = this.padding + contentWidth + this.arrowGap;
    return actionButtonX + this.slotSize + this.padding;
  }

  get height(): number {
    return this.padding + this.slotSize + this.padding;
  }

  generateLayout(): RecipeLayout {
    const slots: SlotDisplay[] = [];

    // ========== 化学品输入槽位 ==========
    const chemicalInput = this.recipe.chemical_input;
    if (chemicalInput) {
      const chemicalId = chemicalInput.tag
        ? (chemicalInput.tag.startsWith('#') ? chemicalInput.tag : '#' + chemicalInput.tag)
        : (chemicalInput.chemical || chemicalInput.id || 'unknown');

      // 根据配方类型推断化学品类型
      let chemType: ChemicalType = 'gas';
      if (this.recipe.type.includes('infusing')) chemType = 'infuse';
      else if (this.recipe.type.includes('purifying') || this.recipe.type.includes('injecting')) chemType = 'gas';
      // 也可以根据字段名推断 (Mekanism 内部有时会用不同的键)
      if (chemicalInput.gas) chemType = 'gas';
      if (chemicalInput.infuse) chemType = 'infuse';

      const chemicalSlot: ChemicalSlotDisplay & { mark: SlotMark } = {
        slotType: 'chemical',
        chemicalType: chemType,
        chemicalId: chemicalId,
        amount: chemicalInput.amount || 1,
        x: this.padding,
        y: this.padding,
        width: this.chemicalWidth,
        height: this.chemicalHeight,
        mark: 'inputChemical'
      };

      slots.push(chemicalSlot);
    }

    // ========== 物品输入槽位 ==========
    const itemInput = this.recipe.item_input;
    const itemInfo = extractItemInfo(itemInput);

    let itemId = "";
    let itemCount = 1;

    if (itemInfo) {
      itemId = itemInfo.itemId;
      itemCount = itemInfo.count || (itemInput?.count as number) || 1;
    }

    const itemInputSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId,
      count: itemCount,
      x: this.padding + this.chemicalWidth + this.gap,
      y: this.padding,
      size: this.slotSize,
      label: "原料",
      index: 0,
      mark: 'item:item_input'
    };

    slots.push(itemInputSlot);

    // ========== 输出物品槽位 ==========
    const outputKey = this.recipe.result ? 'result' : 'output';
    const output = this.recipe[outputKey] || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    let outputItemId = "";
    let outputCount = 1;

    if (output) {
      const outInfo = extractItemInfo(output);
      if (outInfo) {
        outputItemId = outInfo.itemId;
        outputCount = outInfo.count || 1;
      }
    }

    const outputSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: outputItemId,
      count: outputCount,
      x: this.padding + this.chemicalWidth + this.gap + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: this.padding,
      size: this.slotSize,
      label: "结果",
      index: 0,
      mark: `item:${outputKey}`
    };

    slots.push(outputSlot);

    // ========== 箭头 ==========
    const arrowX = this.padding + this.chemicalWidth + this.gap + this.slotSize + this.arrowGap + this.arrowWidth / 2;
    const arrowY = this.padding + this.slotSize / 2;

    const arrow = {
      x: arrowX,
      y: arrowY,
      text: "→",
      fontSize: 20
    };

    // ========== 操作按钮 ==========
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

    if (mark === 'inputChemical') {
      if (!info || info.id === "" || info.id === undefined) return;

      const newChemical: any = { amount: (this.recipe.chemical_input as any)?.amount || 1 };
      if (info.id.startsWith('#')) {
        newChemical.tag = info.id.substring(1);
      } else {
        newChemical.chemical = info.id;
      }
      (this.recipe as any).chemical_input = newChemical;
      this.clearCache();
      return;
    }

    this.clearCache();
  }
}

// ============================================================================
// Mekanism 绑定配方类 (Combining) - 上下结构
// ============================================================================

export class MekanismCombiningRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly gap = 4;
  private readonly arrowGap = 16;
  private readonly arrowWidth = 24;

  get width(): number {
    const inputWidth = this.slotSize;
    const contentWidth = inputWidth + this.arrowGap + this.arrowWidth + this.arrowGap + this.slotSize;
    const actionButtonX = this.padding + contentWidth + this.arrowGap;
    return actionButtonX + this.slotSize + this.padding;
  }

  get height(): number {
    return this.padding + this.slotSize * 2 + this.gap + this.padding;
  }

  generateLayout(): RecipeLayout {
    const slots: SlotDisplay[] = [];

    // ========== 从输入 (extra_input) - 上 ==========
    const extraInput = this.recipe.extra_input;
    const extraInfo = extractItemInfo(extraInput);
    const extraSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: extraInfo?.itemId || "",
      count: extraInfo?.count,
      x: this.padding,
      y: this.padding,
      size: this.slotSize,
      label: "次",
      index: 0,
      mark: 'item:extra_input'
    };
    slots.push(extraSlot);

    // ========== 主输入 (main_input) - 下 ==========
    const mainInput = this.recipe.main_input;
    const mainInfo = extractItemInfo(mainInput);
    const mainSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: mainInfo?.itemId || "",
      count: mainInfo?.count,
      x: this.padding,
      y: this.padding + this.slotSize + this.gap,
      size: this.slotSize,
      label: "主",
      index: 0,
      mark: 'item:main_input'
    };
    slots.push(mainSlot);

    // ========== 输出 ==========
    const outputKey = this.recipe.result ? 'result' : 'output';
    const output = this.recipe[outputKey] || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    const outputInfo = extractItemInfo(output);

    // 居中显示输出
    const centerY = (this.height - this.slotSize) / 2;

    const outputSlot: ItemSlotDisplay = {
      slotType: 'item',
      itemId: outputInfo?.itemId || "",
      count: outputInfo?.count || 1,
      x: this.padding + this.slotSize + this.arrowGap + this.arrowWidth + this.arrowGap,
      y: centerY,
      size: this.slotSize,
      label: "结果",
      index: 0,
      mark: `item:${outputKey}`
    };
    slots.push(outputSlot);

    // 箭头
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
    this.clearCache();
  }
}

// ============================================================================
// Mekanism 物品 -> 化学品类 (氧化/Oxidizing)
// ============================================================================

export class MekanismItemToChemicalRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly chemicalWidth = 24;
  private readonly chemicalHeight = 40;
  private readonly gap = 12;
  private readonly arrowWidth = 20;

  get width(): number {
    const contentWidth = this.slotSize + this.gap + this.arrowWidth + this.gap + this.chemicalWidth;
    const actionButtonX = this.padding + contentWidth + this.gap;
    return actionButtonX + this.slotSize + this.padding;
  }

  get height(): number {
    return this.padding + this.slotSize + this.padding;
  }

  generateLayout(): RecipeLayout {
    const slots: SlotDisplay[] = [];

    // ========== 物品输入 ==========
    const input = this.recipe.input || (Array.isArray(this.recipe.inputs) ? this.recipe.inputs[0] : null);
    const inputInfo = extractItemInfo(input);

    slots.push({
      slotType: 'item',
      itemId: inputInfo?.itemId || "",
      count: inputInfo?.count,
      x: this.padding,
      y: this.padding,
      size: this.slotSize,
      label: "原料",
      index: 0,
      mark: 'item:input'
    } as ItemSlotDisplay);

    // ========== 化学品输出 ==========
    // 对于 Oxidizing，输出通常是 gas，但有时定义在 output 字段
    const output = this.recipe.output || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    let chemicalId = "";
    let amount = 0;

    if (output) {
      chemicalId = output.id || output.gas || output.fluid || (output.tag ? '#' + output.tag : "");
      amount = output.amount || 0;
    }

    slots.push({
      slotType: 'chemical',
      chemicalType: 'gas', // Oxidizing 默认输出气体
      chemicalId: chemicalId,
      amount: amount,
      x: this.padding + this.slotSize + this.gap + this.arrowWidth + this.gap,
      y: this.padding,
      width: this.chemicalWidth,
      height: this.chemicalHeight,
      mark: 'outputChemical'
    } as ChemicalSlotDisplay & { mark: SlotMark });

    // 箭头
    const arrow = {
      x: this.padding + this.slotSize + this.gap + this.arrowWidth / 2,
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

    if (mark === 'outputChemical') {
      if (!info || !info.id) {
        delete this.recipe.output;
      } else {
        this.recipe.output = {
          id: info.id,
          amount: info.amount || 1000
        } as any;
      }
    }
    this.clearCache();
  }
}

// ============================================================================
// Mekanism 化学品 -> 物品类 (结晶/Crystallizing)
// ============================================================================

export class MekanismChemicalToItemRecipeClass extends RecipeClassBase {
  private readonly padding = 12;
  private readonly slotSize = 40;
  private readonly chemicalWidth = 24;
  private readonly chemicalHeight = 40;
  private readonly gap = 12;
  private readonly arrowWidth = 20;

  get width(): number {
    const contentWidth = this.chemicalWidth + this.gap + this.arrowWidth + this.gap + this.slotSize;
    const actionButtonX = this.padding + contentWidth + this.gap;
    return actionButtonX + this.slotSize + this.padding;
  }

  get height(): number {
    return this.padding + this.slotSize + this.padding;
  }

  generateLayout(): RecipeLayout {
    const slots: SlotDisplay[] = [];

    // ========== 化学品输入 ==========
    const input = this.recipe.input || (Array.isArray(this.recipe.inputs) ? this.recipe.inputs[0] : null);
    let chemicalId = "";
    let amount = 0;

    if (input) {
      chemicalId = input.chemical || input.id || (input.tag ? '#' + input.tag : "");
      amount = input.amount || 0;
    }

    slots.push({
      slotType: 'chemical',
      chemicalType: 'gas', // Crystallizing 通常输入气体或浆料，默认为 gas
      chemicalId: chemicalId,
      amount: amount,
      x: this.padding,
      y: this.padding,
      width: this.chemicalWidth,
      height: this.chemicalHeight,
      mark: 'inputChemical'
    } as ChemicalSlotDisplay & { mark: SlotMark });

    // ========== 物品输出 ==========
    const output = this.recipe.output || (Array.isArray(this.recipe.results) ? this.recipe.results[0] : null);
    const outputInfo = extractItemInfo(output);

    slots.push({
      slotType: 'item',
      itemId: outputInfo?.itemId || "",
      count: outputInfo?.count,
      x: this.padding + this.chemicalWidth + this.gap + this.arrowWidth + this.gap,
      y: this.padding,
      size: this.slotSize,
      label: "成品",
      index: 0,
      mark: 'item:output'
    } as ItemSlotDisplay);

    // 箭头
    const arrow = {
      x: this.padding + this.chemicalWidth + this.gap + this.arrowWidth / 2,
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

    if (mark === 'inputChemical') {
      if (!info || !info.id) {
        delete this.recipe.input;
      } else {
        this.recipe.input = {
          chemical: info.id,
          amount: info.amount || 1000
        } as any;
      }
    }
    this.clearCache();
  }
}

// ============================================================================
// Mekanism 配方检测器 - 使用注册系统
// ============================================================================


/**
 * Mekanism配方检测器
 * 检查是否为Mekanism配方并返回对应的类实例
 */
function mekanism(recipe: Recipe): RecipeClassBase | null {
  // 1. 化学品 + 物品 输入类配方 (净化、注入、灌注)
  if (recipe.type.includes("purifying") ||
    recipe.type.includes("injecting") ||
    recipe.type.includes("metallurgic_infusing")) {
    return new MekanismItemChemicalRecipeClass(recipe);
  }

  // 2. 双物品输入绑定类配方 (Combining)
  if (recipe.type.includes("combining") || (recipe.main_input && recipe.extra_input)) {
    return new MekanismCombiningRecipeClass(recipe);
  }

  // 3. 物品 -> 化学品类配方 (Oxidizing)
  if (recipe.type.includes("oxidizing")) {
    return new MekanismItemToChemicalRecipeClass(recipe);
  }

  // 4. 化学品 -> 物品类配方 (Crystallizing)
  if (recipe.type.includes("crystallizing")) {
    return new MekanismChemicalToItemRecipeClass(recipe);
  }

  return null;
}

// 自动注册Mekanism配方检测器
registerClassFactory(mekanism);

