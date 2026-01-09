import React, { useState } from "react";

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

// 获取工具标签
const getToolLabel = (item: ToolItem): string => {
  const parts = item.id.split("/");
  return parts[parts.length - 1] || item.id;
};

// 底部 Dock 工具栏组件
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

  // 将所有分类的工具项扁平化并按顺序排列
  const allItems: Array<{ item: ToolItem; category: string }> = [];
  Object.entries(groupedItems).forEach(([category, items]) => {
    items.forEach((item) => allItems.push({ item, category }));
    // 在分类之间添加分隔符
    if (Object.keys(groupedItems).indexOf(category) < Object.keys(groupedItems).length - 1) {
      allItems.push({ item: { id: `divider-${category}`, type: "node", category, icon: null } as any, category });
    }
  });

  return (
    <div className="bottom-dock-bar">
      {allItems.map(({ item, category }, index) => {
        // 分隔符
        if (item.id.startsWith("divider-")) {
          return <div key={`divider-${index}`} className="dock-divider" />;
        }

        const isSelected = selectedTools[category] === item.id;
        const label = getToolLabel(item);

        return (
          <div
            key={item.id}
            className={`dock-item ${isSelected ? "selected" : ""}`}
            onClick={() => selectTool(category, item.id)}
            title={label}
          >
            <div className="dock-icon">{item.icon}</div>
          </div>
        );
      })}
    </div>
  );
};

export default ToolBar;
