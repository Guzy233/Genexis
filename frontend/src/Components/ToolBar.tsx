import React, { useState } from "react";
import { Node, Coms, Obj } from "../Globals";
import { atom } from "jotai";
import { ObjectFactories } from "../Controllers/Creator";

// ==================== 工具项相关 ====================

export type ToolItemType = "node" | "edge";

// 定义 category 常量
export const CATEGORY_NODES = "Nodes";
export const CATEGORY_EDGES = "Edges";

export interface ToolItem {
  id: string;
  type: ToolItemType;
  category: string;
  icon: React.ReactNode;
  preview?: React.ReactNode;
}

export const ToolItems: ToolItem[] = [];

// 工具栏状态：每个 category 都有自己的选中工具
const categoryTools: Record<string, string> = {};
const toolSubscribers: Set<(category: string, toolId: string) => void> = new Set();

// 设置 category 的默认工具
export const setDefaultTool = (category: string, toolId: string) => {
  categoryTools[category] = toolId;
};

// 设置 category 的当前工具
export const setToolForCategory = (category: string, toolId: string) => {
  categoryTools[category] = toolId;
  toolSubscribers.forEach((cb) => cb(category, toolId));
};

// 获取指定 category 的当前工具
export const getToolForCategory = (category: string): string => {
  return categoryTools[category] || "";
};

// 订阅工具变化
export const onToolChange = (
  callback: (category: string, toolId: string) => void
): (() => void) => {
  toolSubscribers.add(callback);
  return () => {
    toolSubscribers.delete(callback);
  };
};

// 虚拟预览节点
const createPreviewNode = (factory: () => Node): Node => {
  const node = factory();
  node.id = "preview";
  if (!node.updater) {
    node.updater = atom(0);
  }
  return node;
};

// 创建节点预览
const createNodePreview = (factory: () => Node): React.ReactNode => {
  const node = createPreviewNode(factory);
  const Component = Coms[node.type];
  if (!Component) return null;

  return (
    <svg
      viewBox={`0 0 ${node.size.x} ${node.size.y}`}
      style={{
        overflow: "visible",
      }}
    >
      <Component obj={node as Obj} />
    </svg>
  );
};

// 工具栏组件
export const ToolBar: React.FC = () => {
  // 为每个 category 维护选中状态
  const [selectedTools, setSelectedTools] = useState<Record<string, string>>(() => ({ ...categoryTools }));

  // 订阅工具变化
  React.useEffect(() => {
    return onToolChange((category, toolId) => {
      setSelectedTools((prev) => ({ ...prev, [category]: toolId }));
    });
  }, []);

  // 按分类分组工具项
  const groupedItems = ToolItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ToolItem[]>);

  // 选择工具
  const selectTool = (category: string, toolId: string) => {
    setToolForCategory(category, toolId);
  };

  // 创建预览
  const createPreview = (item: ToolItem): React.ReactNode => {
    if (item.type === "node" && ObjectFactories[item.id]) {
      return createNodePreview(() => ObjectFactories[item.id]() as Node);
    }
    if (item.type === "edge" && item.preview) {
      return item.preview;
    }
    return item.icon;
  };

  return (
    <div className="toolbar">
      {Object.entries(groupedItems).map(([category, items]) => (
        <div key={category} className="toolbar-category">
          <div className="toolbar-category-title">{category}</div>
          <div className="toolbar-items">
            {items.map((item) => (
              <div
                key={item.id}
                className={`toolbar-item ${selectedTools[category] === item.id ? "selected" : ""}`}
                onClick={() => selectTool(category, item.id)}
                title={item.id}
              >
                <div className="toolbar-item-preview">
                  {createPreview(item)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToolBar;
