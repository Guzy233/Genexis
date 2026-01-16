import React, { useEffect, useRef } from "react";
import { atom, useAtom } from "jotai";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";
import { activedId } from "../Controllers/Selector";
import { RECIPE_TYPE_NAMES } from "./Reciper";
import { PrimitiveAtom } from "jotai";
import { managerUpdateAtom } from "../Manager";

// 导入拆分出的组件和类型
import {
  Recipe,
  SlotPath,
  getSlotRenderer,
} from "./RecipeSlot";
import {
  getRecipeLayout,
  calculateRecipeNodeSize,
  RecipeLayout,
} from "./RecipeLayout";

// 重新导出 Recipe 类型以保持兼容性
export type { Recipe } from "./RecipeSlot";
export { calculateRecipeNodeSize } from "./RecipeLayout";
// ============================================================================
// 类型定义
// ============================================================================

// 配方修改模式
export type RecipeModifyMode = "override" | "delete" | "add";

// RecipeNode 接口：继承 Node，包含 recipe 和 onCanvas
export interface RecipeNode extends Node {
  recipe: Recipe;
  onCanvas: boolean;
  modifyMode?: RecipeModifyMode;
  //由于配方内部计算复杂，额外增加一个更新器专门用于更新内部布局，外层节点位置更新不影响内部布局计算
  contentUpdater: PrimitiveAtom<number>
}

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
    contentUpdater: atom(0),
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
      modifyMode: node.modifyMode,
    };
  },
  (data: any) => {
    const node: RecipeNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      selected: data.selected ?? false,
      updater: atom(0),
      contentUpdater: atom(0),
      recipe: data.recipe,
      onCanvas: true,
      modifyMode: data.modifyMode ?? "override",
    };
    return node;
  }
);

// ============================================================================
// 回写工具函数
// ============================================================================

// 设置嵌套对象的值
const setNestedValue = (obj: any, path: string, value: any) => {
  (obj as any)[path] = value;
};

// 有序合成配方的特殊回写逻辑
const applyShapedSlot = (recipe: Recipe, row: number, col: number, newItem: any) => {
  if (!recipe.pattern) recipe.pattern = ["   ", "   ", "   "];
  if (!recipe.key) recipe.key = {};

  // 确保 pattern 有足够的行
  while (recipe.pattern.length <= row) {
    recipe.pattern.push("   ");
  }

  let currentPattern = recipe.pattern[row] || "   ";
  // 确保行有足够的列
  while (currentPattern.length <= col) {
    currentPattern += " ";
  }
  const currentChar = currentPattern[col];

  // 检查该字符在 pattern 中是否被多处使用
  const charUsageCount = currentChar && currentChar !== ' '
    ? recipe.pattern.join('').split(currentChar).length - 1
    : 0;

  if (currentChar && currentChar !== ' ' && charUsageCount > 1) {
    // 该字符被多处使用，需要分配新字符
    const usedChars = new Set(Object.keys(recipe.key));
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const newChar = possible.split("").find(c => !usedChars.has(c)) || currentChar;

    // 更新 pattern 中该位置的字符
    recipe.pattern[row] = currentPattern.substring(0, col) + newChar + currentPattern.substring(col + 1);
    recipe.key[newChar] = newItem;
  } else {
    // 该字符只被使用一次，或是空格（新槽位）
    if (!currentChar || currentChar === ' ') {
      const usedChars = new Set(Object.keys(recipe.key));
      const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const newChar = possible.split("").find(c => !usedChars.has(c)) || "A";
      recipe.pattern[row] = currentPattern.substring(0, col) + newChar + currentPattern.substring(col + 1);
      recipe.key[newChar] = newItem;
    } else {
      recipe.key[currentChar] = newItem;
    }
  }
};

// 统一回写函数
const applySlotPath = (recipe: Recipe, slotPath: SlotPath, newItem: any) => {
  switch (slotPath.type) {
    case 'direct':
      setNestedValue(recipe, slotPath.path, newItem);
      break;
    case 'array':
      let arr = (recipe as any)[slotPath.path];
      if (!arr || !Array.isArray(arr)) {
        arr = [];
        (recipe as any)[slotPath.path] = arr;
      }
      arr[slotPath.index] = newItem;
      break;
    case 'shaped':
      applyShapedSlot(recipe, slotPath.row, slotPath.col, newItem);
      break;
    case 'custom':
      slotPath.writer(recipe, newItem);
      break;
  }
};

// ============================================================================
// SVG 配方内容渲染组件
// ============================================================================

interface RecipeContentProps {
  node: RecipeNode;
  onAddToCanvas?: (node: RecipeNode) => void;
}

// 内部渲染组件,使用 memo 包装，不接收被动更新
export const SVGRecipeContent = React.memo<RecipeContentProps>(({
  node,
  onAddToCanvas,
}) => {
  useAtom(node.contentUpdater);
  const { recipe, onCanvas, modifyMode } = node;
  const layout = getRecipeLayout(recipe);

  if (!layout) {
    return (
      <g>
        <rect x={0} y={0} width={300} height={50} fill="rgba(40,40,45,0.8)" rx="8" />
        <text x={150} y={25} textAnchor="middle" dominantBaseline="middle" fill="#888" fontSize="13">
          暂不支持显示此类型配方: {recipe?.type || "未知"}
        </text>
      </g>
    );
  }

  const containerRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onReplace = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { idorTag } = customEvent.detail;
      const target = e.target as HTMLElement;
      const slot = target.closest('[data-slot-role]');
      if (!slot) return;

      // 从 data 属性获取 slotPath
      const slotPathAttr = slot.getAttribute('data-slot-path');
      if (!slotPathAttr) return;

      let slotPath: SlotPath;
      try {
        slotPath = JSON.parse(slotPathAttr);
      } catch {
        return;
      }

      const role = slot.getAttribute('data-slot-role') as 'input' | 'output';

      // 构建新物品对象
      let newItem: any;
      if (role === 'output') {
        // 输出槽位始终使用 id 格式
        newItem = { id: idorTag.startsWith('#') ? idorTag.substring(1) : idorTag, count: 1 };
      } else {
        // 输入槽位需要区分 item 和 tag
        if (idorTag.startsWith('#')) {
          // tag 格式 - 去掉 # 前缀
          newItem = { tag: idorTag.substring(1) };
        } else {
          // item 格式
          newItem = { item: idorTag };
        }
      }

      // 使用统一回写函数
      applySlotPath(recipe, slotPath, newItem);

      managerUpdateAtom(node.contentUpdater);
    };

    el.addEventListener('replace-item', onReplace);
    return () => el.removeEventListener('replace-item', onReplace);
  }, [node, recipe]);

  const handleModeClick = () => {
    if (modifyMode) {
      const modes: RecipeModifyMode[] = ["override", "delete", "add"];
      const currentIndex = modes.indexOf(modifyMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      node.modifyMode = nextMode;
      managerUpdateAtom(node.contentUpdater);
    }
  };

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

  return (
    <g ref={containerRef}>
      {/* 背景 */}
      <rect
        x={0}
        y={0}
        width={layout.width}
        height={layout.height}
        fill="rgba(40,40,45,0.8)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
        rx="8"
      />

      {/* 统一槽位渲染 - 使用动态渲染器 */}
      {layout.slots.map((slot, i) => {
        const Renderer = getSlotRenderer(slot.slotType);
        return (
          <g
            key={`slot-${slot.slotType}-${i}`}
            transform={`translate(${slot.x}, ${slot.y})`}
            onContextMenu={(e) => e.preventDefault()}
            data-slot-role={slot.role}
            data-slot-index={'index' in slot ? slot.index : undefined}
            data-slot-path={JSON.stringify(slot.slotPath)}
          >
            <Renderer slot={slot} />
          </g>
        );
      })}

      {/* 箭头 */}
      {layout.arrow && (
        <text
          x={layout.arrow.x}
          y={layout.arrow.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize={layout.arrow.fontSize || 20}
        >
          {layout.arrow.text}
        </text>
      )}

      {/* 额外信息 */}
      {layout.extraInfos.map((info, idx) => (
        <g key={idx} transform={`translate(${info.x}, ${info.y})`}>
          <text
            x={0}
            y={0}
            fill="#a1a1aa"
            fontSize="10"
            textAnchor={info.x > layout.width / 2 ? "middle" : "start"}
            dominantBaseline="middle"
          >
            <tspan fill={info.color}>{info.icon}</tspan> {info.text}
          </text>
          <title>{info.label}</title>
        </g>
      ))}

      {/* 操作按钮 */}
      {layout.actionButton && (
        <g transform={`translate(${layout.actionButton.x}, ${layout.actionButton.y})`}>
          {!onCanvas ? (
            <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onAddToCanvas?.(node); }}>
              <rect
                width={layout.actionButton.width}
                height={layout.actionButton.height}
                fill="rgba(34, 197, 94, 0.2)"
                stroke="rgba(34, 197, 94, 0.5)"
                rx="4"
              />
              <text
                x={layout.actionButton.width / 2}
                y={layout.actionButton.height / 2}
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
            <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleModeClick(); }}>
              <rect
                width={layout.actionButton.width}
                height={layout.actionButton.height}
                fill={`${modeColors[modifyMode || "override"]}33`}
                stroke={`${modeColors[modifyMode || "override"]}80`}
                rx="4"
              />
              <text
                x={layout.actionButton.width / 2}
                y={layout.actionButton.height / 2}
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
      )}
    </g>
  );
});

// ============================================================================
// 画布节点组件
// ============================================================================

// 获取配方类型的中文名称
const getRecipeTypeName = (type: string): string => {
  if (RECIPE_TYPE_NAMES[type]) {
    return RECIPE_TYPE_NAMES[type];
  }

  // 尝试模糊匹配
  const lowerType = type.toLowerCase();
  if (lowerType.includes('shaped')) return '有序合成';
  if (lowerType.includes('shapeless')) return '无序合成';
  if (lowerType.includes('smelting')) return '熔炼';
  if (lowerType.includes('blasting')) return '高炉冶炼';
  if (lowerType.includes('crushing')) return '粉碎';
  if (lowerType.includes('mixing')) return '搅拌';
  if (lowerType.includes('pressing')) return '压制';
  if (lowerType.includes('infusing')) return '灌注';

  // 返回原始类型（去掉命名空间前缀）
  const shortType = type.split(':').pop() || type;
  return shortType.replace(/_/g, ' ');
};

Coms["node/recipe"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as RecipeNode;

  const isActived = node.id === activedId;
  const isSelected = node.selected;
  const typeName = getRecipeTypeName(node.recipe.type || "");

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 配方类型名称 - 左上角外部 */}
      {node.onCanvas && <text
        x={0}
        y={-6}
        fill="#71717a"
        fontSize="10"
        dominantBaseline="auto"
        pointerEvents="none"
      >
        {typeName}
      </text>}

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
      <SVGRecipeContent node={node} />
    </g>
  );
};
