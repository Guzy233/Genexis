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
): { itemId: string; count?: number } | null => {
  if (!value) return null;
  if (typeof value === "string") {
    return { itemId: value.startsWith("#") ? value.slice(1) : value };
  }
  if (typeof value === "object") {
    if (value.tag) return { itemId: value.tag };
    const id = value.id || value.item;
    if (id)
      return {
        itemId: id.startsWith("#") ? id.slice(1) : id,
        count: value.count,
      };
  }
  return null;
};

// 解析输入
const parseInput = (
  recipe: Recipe
): {
  items: Array<{ itemId: string; count?: number } | null>;
  isTag: boolean[];
  layout: "grid" | "single";
} | null => {
  if (recipe.ingredients) {
    const parsed = recipe.ingredients.map((v) => {
      const info = extractItemInfo(v);
      return { info, isTag: typeof v === "object" && "tag" in v && !!v.tag };
    });
    return {
      items: parsed.map((p) => p.info),
      isTag: parsed.map((p) => p.isTag),
      layout: "grid",
    };
  }
  if (recipe.pattern && recipe.key) {
    const grid: Array<{ itemId: string; count?: number } | null> = [];
    const isTag: boolean[] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const char = recipe.pattern[y]?.[x];
        const val = char ? recipe.key[char] : null;
        const info = extractItemInfo(val);
        grid.push(info);
        isTag.push(
          !!val && typeof val === "object" && "tag" in val && !!val.tag
        );
      }
    }
    return { items: grid, isTag, layout: "grid" };
  }
  const single = recipe.ingredient || recipe.input;
  if (single) {
    const info = extractItemInfo(single);
    const isTag = typeof single === "object" && "tag" in single && !!single.tag;
    return { items: [info], isTag: [isTag], layout: "single" };
  }
  return null;
};

// 解析输出
const parseOutput = (
  recipe: Recipe
): { itemId: string; count: number } | null => {
  const out = recipe.result || recipe.output;
  if (!out) return null;
  const id = out.id || out.item;
  if (!id) return null;
  return { itemId: id, count: out.count || 1 };
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
    return {
      width: slotSize * 3 + gap * 2,
      height: slotSize * 3 + gap * 2,
    };
  };

  const inputSize = getInputSize();
  const outputSize = {
    width: slotSize,
    height: slotSize + labelOffset + labelHeight,
  };

  const hasExtraInfo =
    recipe.experience !== undefined || recipe.cookingtime !== undefined;
  const extraInfoHeight = hasExtraInfo ? 24 : 0;

  const contentWidth =
    inputSize.width + arrowGap + arrowWidth + arrowGap + outputSize.width;
  const contentHeight = Math.max(inputSize.height, outputSize.height);

  const totalWidth = contentWidth + padding * 2;
  const totalHeight = contentHeight + extraInfoHeight + actionButtonHeight + padding * 2;

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
    return {
      width: slotSize * 3 + gap * 2,
      height: slotSize * 3 + gap * 2,
    };
  };

  const inputSize = getInputSize();
  const outputSize = {
    width: slotSize,
    height: slotSize + labelOffset + labelHeight,
  };

  const hasExtraInfo =
    recipe.experience !== undefined || recipe.cookingtime !== undefined;
  const extraInfoHeight = hasExtraInfo ? 24 : 0;

  const contentWidth =
    inputSize.width + arrowGap + arrowWidth + arrowGap + outputSize.width;
  const contentHeight = Math.max(inputSize.height, outputSize.height);

  const totalWidth = contentWidth + padding * 2;
  const totalHeight = contentHeight + extraInfoHeight + actionButtonHeight + padding * 2;

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
  const arrowX = inputX + inputSize.width + gap;
  const outputX = arrowX + arrowGap + arrowWidth;
  const extraInfoY =
    padding + Math.max(inputSize.height, outputSize.height) + 4;
  const actionButtonY = extraInfoY + (hasExtraInfo ? extraInfoHeight : 0) + 4;

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
          const x = inputX + (i % 3) * (slotSize + gap);
          const y = inputY + Math.floor(i / 3) * (slotSize + gap);
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
        x={arrowX + arrowGap / 2}
        y={inputY + contentHeight / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.4)"
        fontSize="20"
      >
        →
      </text>

      {/* 输出槽位 */}
      <g
        transform={`translate(${outputX}, ${inputY})`}
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
          transform={`translate(${(slotSize - iconSize) / 2}, ${
            (slotSize - iconSize) / 2
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

      {/* 额外信息（经验、烹饪时间） */}
      {hasExtraInfo && (
        <g>
          <line
            x1={padding}
            y1={extraInfoY}
            x2={totalWidth - padding}
            y2={extraInfoY}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
          <g transform={`translate(${padding}, ${extraInfoY + 4})`}>
            {recipe.experience !== undefined && (
              <text
                x={0}
                y={8}
                fill="#a1a1aa"
                fontSize="11"
                dominantBaseline="hanging"
              >
                <tspan fill="#fbbf24">✦</tspan> {recipe.experience} 经验
              </text>
            )}
            {recipe.cookingtime !== undefined && (
              <text
                x={recipe.experience !== undefined ? 100 : 0}
                y={8}
                fill="#a1a1aa"
                fontSize="11"
                dominantBaseline="hanging"
              >
                <tspan fill="#f97316">⏱</tspan> {recipe.cookingtime / 20} 秒
              </text>
            )}
          </g>
        </g>
      )}

      {/* 操作按钮区域 */}
      <g transform={`translate(${outputX}, ${actionButtonY})`}>
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
