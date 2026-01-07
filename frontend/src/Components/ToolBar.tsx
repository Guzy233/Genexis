import React, { useState } from "react";
import { Node, Coms, Obj } from "../Globals";
import { atom } from "jotai";

// ==================== 工具项相关 ====================

export interface ToolItem {
  id: string;
  category: string;
  icon: React.ReactNode;
  createNode: () => Node;
}

export const ToolItems: ToolItem[] = [];

// 工具项类型（内部使用）
interface ToolItemInternal {
  id: string;
  category: string;
  icon: React.ReactNode;
  createNode: () => Node;
}

// 工具栏状态
let currentToolId: string = ToolItems[0]?.id || "";
const toolSubscribers: Set<(toolId: string) => void> = new Set();

export const setCurrentTool = (toolId: string) => {
  currentToolId = toolId;
  toolSubscribers.forEach((cb) => cb(toolId));
};

export const getCurrentTool = () => currentToolId;

export const onToolChange = (callback: (toolId: string) => void): (() => void) => {
  toolSubscribers.add(callback);
  return () => {
    toolSubscribers.delete(callback);
  };
};

// 虚拟预览节点（用于生成预览图）
const createPreviewNode = (factory: () => Node): Node => {
  const node = factory();
  node.id = "preview";
  // 使用原子确保预览能渲染
  if (!node.updater) {
    node.updater = atom(0);
  }
  return node;
};

// 工具栏组件
export const ToolBar: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string>(() => currentToolId);

  // 订阅工具变化
  React.useEffect(() => {
    return onToolChange(setSelectedTool);
  }, []);

  // 按分类分组工具项
  const groupedItems = ToolItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ToolItemInternal[]>);

  // 选择工具
  const selectTool = (toolId: string) => {
    setCurrentTool(toolId);
  };

  // 创建虚拟节点预览
  const createPreview = (factory: () => Node): React.ReactNode => {
    const node = createPreviewNode(factory);
    const Component = Coms[node.type];
    if (!Component) return null;

    // 缩放预览图
    const scale = 0.4;
    const scaledWidth = node.size.x * scale;
    const scaledHeight = node.size.y * scale;

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

  return (
    <div className="toolbar">
      {Object.entries(groupedItems).map(([category, items]) => (
        <div key={category} className="toolbar-category">
          <div className="toolbar-category-title">{category}</div>
          <div className="toolbar-items">
            {items.map((item) => (
              <div
                key={item.id}
                className={`toolbar-item ${selectedTool === item.id ? "selected" : ""}`}
                onClick={() => selectTool(item.id)}
                title={item.id}
              >
                <div className="toolbar-item-preview">
                  {createPreview(item.createNode)}
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