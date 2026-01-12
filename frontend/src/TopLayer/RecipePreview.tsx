import React from "react";
import { SVGItemSlot, MCItemIcon } from "../Components/MCItemNode";
import { translations } from "../Controllers/Recipes";

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

// 解析输入：返回 { items: [{itemId, count}][], isTag: boolean[], layout: 'grid' | 'row' }
const parseInput = (
  recipe: Recipe
): {
  items: Array<{ itemId: string; count?: number } | null>;
  isTag: boolean[];
  layout: "grid" | "single";
} | null => {
  // ingredients 数组
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
  // pattern + key
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
  // ingredient 或 input
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
// SVG 配方预览主组件
// ============================================================================

const SVGRecipePreview: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const inputLayout = parseInput(recipe);
  const output = parseOutput(recipe);

  // 常量定义
  const padding = 12;
  const slotSize = 40;
  const gap = 4;
  const arrowGap = 16;
  const arrowWidth = 20;
  const labelHeight = 16;
  const labelOffset = 4;
  const iconSize = 32;

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

  // 计算额外信息高度
  const hasExtraInfo =
    recipe.experience !== undefined || recipe.cookingtime !== undefined;
  const extraInfoHeight = hasExtraInfo ? 24 : 0;

  const contentWidth =
    inputSize.width + arrowGap + arrowWidth + arrowGap + outputSize.width;
  const contentHeight = Math.max(inputSize.height, outputSize.height);

  const totalWidth = contentWidth + padding * 2;
  const totalHeight = contentHeight + extraInfoHeight + padding * 2;

  // 不支持的配方类型
  if (!inputLayout || !output) {
    return (
      <svg width={300} height={50} viewBox="0 0 300 50">
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
      </svg>
    );
  }

  // 计算各部分位置
  const inputX = padding;
  const inputY = padding;
  const arrowX = inputX + inputSize.width + gap;
  const outputX = arrowX + arrowGap + arrowWidth;
  const extraInfoY =
    padding + Math.max(inputSize.height, outputSize.height) + 4;

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
    >
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
          <g transform={`translate(${inputX}, ${inputY})`}>
            <SVGItemSlot
              info={inputLayout.items[0]}
              isTag={inputLayout.isTag[0]}
              size={slotSize}
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
        // 3x3 网格
        inputLayout.items.map((info, i) => {
          const x = inputX + (i % 3) * (slotSize + gap);
          const y = inputY + Math.floor(i / 3) * (slotSize + gap);
          return (
            <g transform={`translate(${x}, ${y})`}>
              <SVGItemSlot
                info={info}
                isTag={inputLayout.isTag[i]}
                size={slotSize}
              />
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
      <g transform={`translate(${outputX}, ${inputY})`}>
        {/* 背景 */}
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
        {/* 物品图标 - 直接嵌入 MCItemIcon 的 SVG */}
        <g
          transform={`translate(${(slotSize - iconSize) / 2}, ${
            (slotSize - iconSize) / 2
          })`}
        >
          <MCItemIcon itemId={output.itemId} size={iconSize} />
        </g>
        {/* 数量显示 */}
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
          >
            {output.count}
          </text>
        )}
        <title>{translations[output.itemId] || output.itemId}</title>
        {/* 结果标签 */}
        <text
          x={slotSize / 2}
          y={slotSize + labelOffset}
          textAnchor="middle"
          fill="#71717a"
          fontSize="11"
          dominantBaseline="hanging"
        >
          结果
        </text>
      </g>

      {/* 额外信息（经验、烹饪时间） */}
      {hasExtraInfo && (
        <g>
          {/* 分隔线 */}
          <line
            x1={padding}
            y1={extraInfoY}
            x2={totalWidth - padding}
            y2={extraInfoY}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
          {/* 信息文本 */}
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
    </svg>
  );
};

// 导出 SVG 版本
export const RecipePreview: React.FC<{ recipe: Recipe }> = SVGRecipePreview;
