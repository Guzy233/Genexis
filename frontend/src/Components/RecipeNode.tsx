import React from "react";
import { atom, useAtom } from "jotai";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ObjectFactories } from "../Controllers/Creator";
import { ToolItems, CATEGORY_NODES } from "../TopLayer/ToolBar";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";
import { activedId } from "../Controllers/Selector";
import { SVGItemSlot, MCItemIcon } from "./MCItemNode";
import { translations } from "../Controllers/Recipes";
import { openRecipeModal } from "../TopLayer/RecipeListModal";

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
  modifyMode?: RecipeModifyMode; // 仅当 onCanvas=true 时有效
}

// ============================================================================
// 工具函数
// ============================================================================

const extractItemInfo = (
  value: any
): { itemId: string; count?: number; isTag?: boolean } | null => {
  if (!value) return null;
  if (typeof value === "string") {
    const isTag = value.startsWith("#");
    return { itemId: isTag ? value.slice(1) : value, isTag: isTag };
  }
  if (typeof value === "object") {
    if (value.tag) return { itemId: value.tag, isTag: true };

    // 支持 IE/Common 的 basePredicate 结构
    const target = value.basePredicate || value;
    const id = target.id || target.item;
    const tag = target.tag;

    if (tag) return { itemId: tag, isTag: true, count: value.count };
    if (id) {
      const isTag = id.startsWith("#");
      return {
        itemId: isTag ? id.slice(1) : id,
        count: value.count,
        isTag: isTag
      };
    }
  }
  return null;
};

// ==================== 配方解析策略 ====================

interface ParsedInput {
  items: Array<{ itemId: string; count?: number } | null>;
  isTag: boolean[];
  layout: "grid" | "single";
  gridSize?: { rows: number; cols: number }; // 仅 layout 为 grid 时有效
}

interface RecipeParser {
  name: string;
  canParse: (recipe: Recipe) => boolean;
  parse: (recipe: Recipe) => ParsedInput | null;
}

const recipeParsers: RecipeParser[] = [
  // 1. 有序合成 (Shaped)
  {
    name: "shaped",
    canParse: (r) => !!(r.pattern && r.key),
    parse: (r) => {
      const grid: Array<{ itemId: string; count?: number } | null> = [];
      const isTag: boolean[] = [];
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const char = r.pattern![y]?.[x];
          const val = char ? r.key![char] : null;
          const info = extractItemInfo(val);
          grid.push(info);
          isTag.push(!!val && typeof val === "object" && "tag" in val && !!val.tag);
        }
      }
      return { items: grid, isTag, layout: "grid", gridSize: { rows: 3, cols: 3 } };
    },
  },
  // 2. 无序合成 (Shapeless)
  {
    name: "shapeless",
    canParse: (r) => !!r.ingredients,
    parse: (r) => {
      const items = new Array(9).fill(null);
      const isTag = new Array(9).fill(false);
      r.ingredients!.forEach((v, i) => {
        if (i < 9) {
          items[i] = extractItemInfo(v);
          isTag[i] = typeof v === "object" && "tag" in v && !!v.tag;
        }
      });
      return { items, isTag, layout: "grid", gridSize: { rows: 3, cols: 3 } };
    },
  },
  // 3. AA 强化配方 (Empowering)
  {
    name: "empowering",
    canParse: (r) => !!(r.base && r.modifiers && r.type?.includes("empowering")),
    parse: (r) => {
      const items = new Array(9).fill(null);
      const isTag = new Array(9).fill(false);

      const baseInfo = extractItemInfo(r.base);
      items[4] = baseInfo;
      isTag[4] = !!baseInfo?.isTag;

      const modifierIndices = [1, 3, 5, 7, 0, 2, 6, 8];
      const modifiers = Array.isArray(r.modifiers) ? r.modifiers : [];
      modifiers.forEach((m: any, i: number) => {
        if (i < modifierIndices.length) {
          const idx = modifierIndices[i];
          const info = extractItemInfo(m);
          items[idx] = info;
          isTag[idx] = !!info?.isTag;
        }
      });
      return { items, isTag, layout: "grid", gridSize: { rows: 3, cols: 3 } };
    },
  },
  // 4. IE 电弧炉 (Arc Furnace)
  {
    name: "arc_furnace",
    canParse: (r) => r.type?.includes("arc_furnace"),
    parse: (r) => {
      const items = new Array(6).fill(null);
      const isTag = new Array(6).fill(false);

      // 添加物 1x2 (Row 0, Col 0-1)
      const rawAdditives = Array.isArray(r.additives) ? r.additives.flat(2) : [];
      rawAdditives.forEach((a: any, i: number) => {
        if (i < 2) {
          const info = extractItemInfo(a);
          items[i] = info;
          isTag[i] = !!info?.isTag;
        }
      });

      // 主输入 (Row 1, Col 0 => Index 2)
      const inputInfo = extractItemInfo(r.input);
      if (inputInfo) {
        items[2] = inputInfo;
        isTag[2] = !!inputInfo.isTag;
      }

      return { items: items, isTag: isTag, layout: "grid", gridSize: { rows: 3, cols: 2 } };
    },
  },
  // 5. IE 合金窑 (Alloy Kiln)
  {
    name: "ie_alloy",
    canParse: (r) => r.type?.includes("immersiveengineering:alloy") || (!!r.input0 && !!r.input1 && r.type?.includes("alloy")),
    parse: (r) => {
      const i0 = extractItemInfo(r.input0);
      const i1 = extractItemInfo(r.input1);
      return {
        items: [i0, i1],
        isTag: [!!i0?.isTag, !!i1?.isTag],
        layout: "grid",
        gridSize: { rows: 1, cols: 2 }
      };
    },
  },
  // 6. EnderIO 合金炉 (Alloy Smelting)
  {
    name: "alloy_smelting",
    canParse: (r) => r.type?.includes("alloy_smelting") || (!!r.inputs && Array.isArray(r.inputs) && r.type?.includes("enderio")),
    parse: (r) => {
      const items = new Array(3).fill(null);
      const isTag = new Array(3).fill(false);
      const rawInputs = Array.isArray(r.inputs) ? r.inputs : [];
      rawInputs.forEach((v: any, i: number) => {
        if (i < 3) {
          const info = extractItemInfo(v);
          items[i] = info;
          isTag[i] = !!info?.isTag;
        }
      });
      return { items, isTag, layout: "grid", gridSize: { rows: 3, cols: 1 } };
    },
  },
  // 7. 单物品输入 (Single)
  {
    name: "single",
    canParse: (r) => !!(r.ingredient || r.input),
    parse: (r) => {
      const single = r.ingredient || r.input;
      const info = extractItemInfo(single);
      const isTag = !!info?.isTag;
      return { items: [info], isTag: [isTag], layout: "single" };
    },
  }
];

// 解析输入
const parseInput = (recipe: Recipe): ParsedInput | null => {
  for (const parser of recipeParsers) {
    if (parser.canParse(recipe)) {
      return parser.parse(recipe);
    }
  }
  return null;
};

// 解析输出
const parseOutput = (
  recipe: Recipe
): { itemId: string; count: number } | null => {
  const outSource = recipe.result || recipe.output || (Array.isArray(recipe.results) ? recipe.results[0] : null);
  if (!outSource) return null;
  const info = extractItemInfo(outSource);
  if (!info) return null;
  return { itemId: info.itemId, count: info.count || 1 };
};

// 获取额外信息列表
const getExtraInfoItems = (recipe: Recipe) => {
  const items: Array<{ icon: string; text: string; color: string; label: string }> = [];

  // 1. 经验
  if (recipe.experience !== undefined) {
    items.push({ icon: "✦", text: `${recipe.experience} XP`, color: "#fbbf24", label: "经验" });
  }

  // 2. 耗时
  const time = recipe.cookingtime ?? recipe.time ?? recipe.duration ?? recipe.processingTime;
  if (time !== undefined) {
    const seconds = typeof time === "number" ? Math.round((time / 20) * 10) / 10 : time;
    items.push({ icon: "⏱", text: `${seconds}s`, color: "#f97316", label: "耗时" });
  }

  // 3. 能量
  const energyVal = typeof recipe.energy === "object"
    ? (recipe.energy.amount ?? recipe.energy.energy ?? recipe.energy.value)
    : (recipe.energy ?? recipe.physics?.energy);
  if (energyVal !== undefined) {
    items.push({ icon: "⚡", text: `${energyVal} FE`, color: "#ef4444", label: "能量" });
  }

  // 4. 温度
  const tempVal = recipe.temperature ?? recipe.heat ?? recipe.physics?.temperature;
  if (tempVal !== undefined) {
    items.push({ icon: "🌡", text: `${tempVal}°C`, color: "#dc2626", label: "温度" });
  }

  return items;
};

// ============================================================================
// 计算节点尺寸
// ============================================================================

export const calculateRecipeNodeSize = (recipe: Recipe): { width: number; height: number } => {
  const inputLayout = parseInput(recipe);

  const padding = 12;
  const slotSize = 40;
  const gap = 4;
  const arrowGap = 16;
  const arrowWidth = 20;
  const labelHeight = 16;
  const labelOffset = 4;
  const actionButtonHeight = 28; // 加号/状态切换按钮高度

  const getInputSize = () => {
    if (!inputLayout) return { width: slotSize, height: slotSize };
    if (inputLayout.layout === "single") {
      return {
        width: slotSize,
        height: slotSize + labelOffset + labelHeight,
      };
    }
    const cols = inputLayout.gridSize?.cols || 3;
    const rows = inputLayout.gridSize?.rows || 3;
    return {
      width: slotSize * cols + gap * (cols - 1),
      height: slotSize * rows + gap * (rows - 1),
    };
  };

  const inputSize = getInputSize();
  const outputSize = {
    width: slotSize,
    height: slotSize + labelOffset + labelHeight,
  };

  const infoItems = getExtraInfoItems(recipe);
  const contentWidth =
    inputSize.width + arrowGap + arrowWidth + arrowGap + outputSize.width;

  const actionButtonWidth = slotSize;

  // 1. 计算对齐后的高度需求
  // 槽位中心对齐逻辑：
  const inputBaseHeight = inputLayout?.layout === "single" ? slotSize : inputSize.height;
  const centerY = inputBaseHeight / 2;
  const outputTop = centerY - slotSize / 2;
  const outputTotalHeight = outputTop + outputSize.height;

  // 2. 判定额外信息是否能放在输出下方
  const spaceBelowOutput = inputSize.height - (outputTop + outputSize.height);
  // 每个项目占 18px，留出 12px 缓冲区
  const fitsBelowOutput = infoItems.length > 0 && spaceBelowOutput >= (infoItems.length * 18 + 12);

  const showAtBottom = infoItems.length > 0 && !fitsBelowOutput;
  const extraInfoHeight = showAtBottom ? 32 : 0; // 调大间距以便留白

  const totalWidth = contentWidth + arrowGap + actionButtonWidth + padding * 2;

  // 总高度取三者最大值：输入侧（含底部信息）、输出侧（含下方信息）、操作按钮
  const totalHeight = Math.max(
    inputSize.height + extraInfoHeight,
    outputTotalHeight + (fitsBelowOutput ? infoItems.length * 18 + 12 : 0),
    actionButtonHeight - 4
  ) + padding * 2;

  return { width: totalWidth, height: totalHeight };
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

// 注册对象工厂
ObjectFactories["node/recipe"] = (): RecipeNode => {
  // 默认创建一个空配方节点（实际使用时应通过 createRecipeNode 指定配方）
  const emptyRecipe: Recipe = { type: "minecraft:crafting_shaped" };
  return createRecipeNode(emptyRecipe, true);
};

// 注册工具项
ToolItems.push({
  id: "node/recipe",
  type: "node",
  category: CATEGORY_NODES,
  icon: (
    <svg viewBox="0 0 60 60" style={{ width: "100%", height: "100%" }}>
      {/* 工作台图标 */}
      <rect
        x="8"
        y="8"
        width="44"
        height="44"
        rx="6"
        fill="rgba(139, 69, 19, 0.3)"
        stroke="#8B4513"
        strokeWidth="2"
      />
      {/* 3x3 网格 */}
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={12 + col * 13}
            y={12 + row * 13}
            width="11"
            height="11"
            rx="2"
            fill="rgba(255, 255, 255, 0.1)"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1"
          />
        ))
      )}
    </svg>
  ),
});

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
      onCanvas: node.onCanvas,
      modifyMode: node.modifyMode,
    };
  },
  (data) => {
    const node: RecipeNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      selected: data.selected ?? false,
      updater: atom(0),
      recipe: data.recipe,
      onCanvas: data.onCanvas ?? true,
      modifyMode: data.modifyMode ?? "override",
    };
    return node;
  }
);

// ============================================================================
// SVG 配方内容渲染组件
// ============================================================================

interface RecipeContentProps {
  node: RecipeNode;
  onAddToCanvas?: (node: RecipeNode) => void;
  onModeChange?: (mode: RecipeModifyMode) => void;
}

// 内部渲染组件
const SVGRecipeContentInner: React.FC<RecipeContentProps> = ({
  node,
  onAddToCanvas,
  onModeChange,
}) => {
  const { recipe, onCanvas, modifyMode } = node;
  const inputLayout = parseInput(recipe);
  const output = parseOutput(recipe);

  // 处理物品槽位点击 - 打开该物品的配方
  const handleItemClick = (itemId: string | undefined, e: React.MouseEvent) => {
    if (!itemId) return;
    e.stopPropagation();
    // 左键查看合成配方，右键查看用途
    if (e.button === 0) {
      openRecipeModal(itemId, "result");
    } else if (e.button === 2) {
      openRecipeModal(itemId, "usage");
    }
  };

  // 常量定义
  const padding = 12;
  const slotSize = 40;
  const gap = 4;
  const arrowGap = 16;
  const arrowWidth = 20;
  const labelHeight = 16;
  const labelOffset = 4;
  const iconSize = 32;
  const actionButtonHeight = 28;

  // 计算尺寸
  const getInputSize = () => {
    if (!inputLayout) return { width: slotSize, height: slotSize };
    if (inputLayout.layout === "single") {
      return {
        width: slotSize,
        height: slotSize + labelOffset + labelHeight,
      };
    }
    const cols = inputLayout.gridSize?.cols || 3;
    const rows = inputLayout.gridSize?.rows || 3;
    return {
      width: slotSize * cols + gap * (cols - 1),
      height: slotSize * rows + gap * (rows - 1),
    };
  };

  const inputSize = getInputSize();
  const outputSize = {
    width: slotSize,
    height: slotSize + labelOffset + labelHeight,
  };

  const infoItems = getExtraInfoItems(recipe);

  // 1. 布局对齐计算
  const inputBaseHeight = inputLayout?.layout === "single" ? slotSize : inputSize.height;
  const centerY = inputBaseHeight / 2 + padding;

  // 输出槽位顶部位置 = 槽位中心 - 槽位一半高度
  const outputY = centerY - slotSize / 2;
  const outputTotalBottom = outputY + outputSize.height;

  // 2. 空间判定
  const spaceBelowOutput = (inputBaseHeight + padding) - outputTotalBottom;
  const fitsBelowOutput = infoItems.length > 0 && spaceBelowOutput >= (infoItems.length * 18 + 12);

  const showAtBottom = infoItems.length > 0 && !fitsBelowOutput;
  const showBelowOutput = infoItems.length > 0 && fitsBelowOutput;

  const extraInfoHeight = showAtBottom ? 32 : 0;
  const contentWidth =
    inputSize.width + arrowGap + arrowWidth + arrowGap + outputSize.width;

  const actionButtonWidth = slotSize;
  const totalWidth = contentWidth + arrowGap + actionButtonWidth + padding * 2;
  const totalHeight = Math.max(inputSize.height + extraInfoHeight, outputY - padding + outputSize.height + (showBelowOutput ? infoItems.length * 18 + 12 : 0), actionButtonHeight - 4) + padding * 2;

  // 不支持的配方类型
  if (!inputLayout || !output) {
    return (
      <g>
        <rect
          x={0}
          y={0}
          width={300}
          height={50}
          fill="rgba(40,40,45,0.8)"
          rx="8"
        />
        <text
          x={150}
          y={25}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#888"
          fontSize="13"
        >
          暂不支持显示此类型配方: {recipe?.type || "未知"}
        </text>
      </g>
    );
  }

  // 计算各部分位置
  const inputX = padding;
  const inputY = padding;
  const arrowX = inputX + inputSize.width + arrowGap;
  const outputX = arrowX + arrowWidth + arrowGap;

  const extraInfoBottomY = inputY + inputSize.height + 4;

  // 放在输出下方的起始位置
  const extraInfoBelowX = outputX;
  const extraInfoBelowY = outputY + outputSize.height + 12;

  const actionButtonX = totalWidth - padding - slotSize;
  const actionButtonY = inputY + inputBaseHeight - (actionButtonHeight - 4);

  // 修正箭头 Y 坐标，始终对齐槽位中心
  const arrowCenterY = centerY;

  // 模式切换按钮文字
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

  const handleModeClick = () => {
    if (onModeChange && modifyMode) {
      const modes: RecipeModifyMode[] = ["override", "delete", "add"];
      const currentIndex = modes.indexOf(modifyMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      onModeChange(nextMode);
    }
  };

  return (
    <g>
      {/* 背景 */}
      <rect
        x={0}
        y={0}
        width={totalWidth}
        height={totalHeight}
        fill="rgba(40,40,45,0.8)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
        rx="8"
      />

      {/* 输入槽位 */}
      {inputLayout.layout === "single" ? (
        <>
          <g
            transform={`translate(${inputX}, ${inputY})`}
            style={{ cursor: "pointer" }}
            onMouseDownCapture={(e) => handleItemClick(inputLayout.items[0]?.itemId, e)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <SVGItemSlot
              info={inputLayout.items[0]}
              isTag={inputLayout.isTag[0]}
              size={slotSize}
            />
            {/* 透明点击层 */}
            <rect
              x={0}
              y={0}
              width={slotSize}
              height={slotSize}
              fill="transparent"
              style={{ cursor: "pointer" }}
            />
          </g>
          <text
            x={inputX + slotSize / 2}
            y={inputY + slotSize + labelOffset}
            textAnchor="middle"
            fill="#71717a"
            fontSize="11"
            dominantBaseline="hanging"
          >
            原料
          </text>
        </>
      ) : (
        inputLayout.items.map((info, i) => {
          const cols = inputLayout.gridSize?.cols || 3;
          const x = inputX + (i % cols) * (slotSize + gap);
          const y = inputY + Math.floor(i / cols) * (slotSize + gap);
          return (
            <g
              key={i}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: info ? "pointer" : "default" }}
              onMouseDownCapture={(e) => handleItemClick(info?.itemId, e)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <SVGItemSlot
                info={info}
                isTag={inputLayout.isTag[i]}
                size={slotSize}
              />
              {/* 透明点击层 */}
              {info && (
                <rect
                  x={0}
                  y={0}
                  width={slotSize}
                  height={slotSize}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                />
              )}
            </g>
          );
        })
      )}

      {/* 箭头 */}
      <text
        x={arrowX + arrowWidth / 2}
        y={arrowCenterY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.4)"
        fontSize="20"
      >
        →
      </text>

      {/* 输出槽位 */}
      <g
        transform={`translate(${outputX}, ${outputY})`}
        style={{ cursor: "pointer" }}
        onMouseDownCapture={(e) => handleItemClick(output.itemId, e)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <rect
          x={0}
          y={0}
          width={slotSize}
          height={slotSize}
          fill="rgba(99,102,241,0.15)"
          stroke="rgba(99,102,241,0.3)"
          strokeWidth="1"
          rx="4"
        />
        <g
          transform={`translate(${(slotSize - iconSize) / 2}, ${(slotSize - iconSize) / 2
            })`}
        >
          <MCItemIcon itemId={output.itemId} size={iconSize} />
        </g>
        {output.count > 1 && (
          <text
            x={slotSize - 5}
            y={slotSize - 3}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize="10"
            fontWeight="bold"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
            pointerEvents="none"
          >
            {output.count}
          </text>
        )}
        <title>{translations[output.itemId] || output.itemId}</title>
        <text
          x={slotSize / 2}
          y={slotSize + labelOffset}
          textAnchor="middle"
          fill="#71717a"
          fontSize="11"
          dominantBaseline="hanging"
          pointerEvents="none"
        >
          结果
        </text>
        {/* 透明点击层确保点击 */}
        <rect
          x={0}
          y={0}
          width={slotSize}
          height={slotSize}
          fill="transparent"
        />
      </g>

      {/* 额外信息 */}
      {showAtBottom && (
        <g>
          <line
            x1={padding + 12}
            y1={extraInfoBottomY}
            x2={totalWidth - padding - 12}
            y2={extraInfoBottomY}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
          <g transform={`translate(${padding + 12}, ${extraInfoBottomY + 6})`}>
            {infoItems.map((item, idx) => (
              <text
                key={idx}
                x={idx * 85}
                y={8}
                fill="#a1a1aa"
                fontSize="11"
                dominantBaseline="hanging"
              >
                <tspan fill={item.color}>{item.icon}</tspan> {item.text}
                <title>{item.label}</title>
              </text>
            ))}
          </g>
        </g>
      )}

      {showBelowOutput && (
        <g transform={`translate(${extraInfoBelowX}, ${extraInfoBelowY})`}>
          {infoItems.map((item, idx) => (
            <g key={idx} transform={`translate(0, ${idx * 18})`}>
              <text
                x={slotSize / 2}
                y={0}
                fill="#a1a1aa"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="hanging"
              >
                <tspan fill={item.color}>{item.icon}</tspan> {item.text}
              </text>
              <title>{item.label}</title>
            </g>
          ))}
        </g>
      )}

      {/* 操作按钮区域 */}
      <g transform={`translate(${actionButtonX}, ${actionButtonY})`}>
        {!onCanvas ? (
          /* 加号按钮 - 添加到画布 */
          <g style={{ cursor: "pointer" }}>
            <rect
              x={0}
              y={0}
              width={slotSize}
              height={actionButtonHeight - 4}
              fill="rgba(34, 197, 94, 0.2)"
              stroke="rgba(34, 197, 94, 0.5)"
              strokeWidth="1"
              rx="4"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCanvas?.(node);
              }}
            />
            <text
              x={slotSize / 2}
              y={(actionButtonHeight - 4) / 2}
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
          /* 模式切换按钮 */
          <g style={{ cursor: "pointer" }}>
            <rect
              x={0}
              y={0}
              width={slotSize}
              height={actionButtonHeight - 4}
              fill={`${modeColors[modifyMode || "override"]}33`}
              stroke={`${modeColors[modifyMode || "override"]}80`}
              strokeWidth="1"
              rx="4"
              style={{ cursor: "pointer" }}
              onClickCapture={(e) => {
                e.stopPropagation();
                handleModeClick();
              }}
            />
            <text
              x={slotSize / 2}
              y={(actionButtonHeight - 4) / 2}
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
    </g>
  );
};

// 使用 memo 包装，只在 recipe 数据或状态变化时重新渲染
export const SVGRecipeContent = React.memo(
  SVGRecipeContentInner,
  (prevProps, nextProps) => {
    // 比较 recipe 对象（浅比较关键字段）
    const prevRecipe = prevProps.node.recipe;
    const nextRecipe = nextProps.node.recipe;

    if (prevRecipe !== nextRecipe) {
      // 深度比较 recipe 的关键字段
      if (prevRecipe.type !== nextRecipe.type) return false;
      if (JSON.stringify(prevRecipe.ingredients) !== JSON.stringify(nextRecipe.ingredients)) return false;
      if (JSON.stringify(prevRecipe.pattern) !== JSON.stringify(nextRecipe.pattern)) return false;
      if (JSON.stringify(prevRecipe.key) !== JSON.stringify(nextRecipe.key)) return false;
      if (JSON.stringify(prevRecipe.result) !== JSON.stringify(nextRecipe.result)) return false;
      if (JSON.stringify(prevRecipe.output) !== JSON.stringify(nextRecipe.output)) return false;
    }

    // 比较 onCanvas 和 modifyMode
    if (prevProps.node.onCanvas !== nextProps.node.onCanvas) return false;
    if (prevProps.node.modifyMode !== nextProps.node.modifyMode) return false;

    // 回调函数不需要比较（它们的变化不影响渲染）
    return true;
  }
);

// ============================================================================
// 画布节点组件
// ============================================================================

Coms["node/recipe"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as RecipeNode;

  const isActived = node.id === activedId;
  const isSelected = node.selected;

  const handleModeChange = (mode: RecipeModifyMode) => {
    node.modifyMode = mode;
    // 触发重新渲染
    import("../Manager").then(({ default: Manager }) => {
      Manager.update(node);
    });
  };

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
      <SVGRecipeContent node={node} onModeChange={handleModeChange} />
    </g>
  );
};
