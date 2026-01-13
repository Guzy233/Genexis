import React, { useMemo } from "react";
import { atom } from "jotai";
import {
  Recipe,
  RecipeNode,
  createRecipeNode,
  SVGRecipeContent,
  calculateRecipeNodeSize,
} from "./RecipeNode";
import { screen2Viewport } from "../Controllers/Camera";
import Manager, { saveHistory } from "../Manager";

// 重导出 Recipe 类型供其他模块使用
export type { Recipe } from "./RecipeNode";

// ============================================================================
// 配方预览组件 - 用于弹窗中的预览
// ============================================================================

interface RecipePreviewProps {
  recipe: Recipe;
  // 可选的屏幕位置，用于计算添加到画布时的位置
  getScreenPosition?: () => { x: number; y: number };
  // 添加到画布后的回调（用于关闭弹窗等）
  onAddedToCanvas?: () => void;
}

export const RecipePreview: React.FC<RecipePreviewProps> = ({
  recipe,
  getScreenPosition,
  onAddedToCanvas,
}) => {
  // 创建一个临时的 RecipeNode 对象用于预览（onCanvas=false）
  const previewNode = useMemo<RecipeNode>(() => {
    return {
      id: `preview-${crypto.randomUUID()}`,
      type: "node/recipe",
      updater: atom(0),
      contentUpdater: atom(0),
      pos: { x: 0, y: 0 },
      size: { x: 0, y: 0 }, // 尺寸由内容决定
      selected: false,
      eAncs: [],
      aAncs: [],
      recipe,
      onCanvas: false,
      modifyMode: "override",
    };
  }, [recipe]);

  // 计算节点尺寸
  const nodeSize = useMemo(() => calculateRecipeNodeSize(recipe), [recipe]);

  // 处理添加到画布
  const handleAddToCanvas = (node: RecipeNode) => {
    // 创建一个新的 RecipeNode 用于画布
    const canvasNode = createRecipeNode(node.recipe, true);

    // 获取屏幕位置并转换为视口坐标
    if (getScreenPosition) {
      const screenPos = getScreenPosition();
      const viewportPos = screen2Viewport(screenPos);
      // 保持视觉位置不变：将节点放在相同的屏幕位置
      canvasNode.pos = {
        x: viewportPos.x,
        y: viewportPos.y,
      };
    } else {
      // 如果没有提供位置，放在视口中心附近
      const viewportCenter = screen2Viewport({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      canvasNode.pos = {
        x: viewportCenter.x - canvasNode.size.x / 2,
        y: viewportCenter.y - canvasNode.size.y / 2,
      };
    }

    // 添加到画布
    Manager.add(canvasNode);
    saveHistory();

    // 调用回调（如关闭弹窗）
    onAddedToCanvas?.();
  };

  return (
    <svg
      width={nodeSize.width}
      height={nodeSize.height}
      viewBox={`0 0 ${nodeSize.width} ${nodeSize.height}`}
    >
      <SVGRecipeContent node={previewNode} onAddToCanvas={handleAddToCanvas} />
    </svg>
  );
};
