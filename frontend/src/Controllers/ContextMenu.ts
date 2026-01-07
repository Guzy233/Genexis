import Manager, { objects } from "../Manager";
import { Obj, Operators, idFromEvent } from "../Globals";
import { screen2Viewport } from "./Camera";
import { ToolItems } from "../Components/ToolBar";
import React from "react";
import { atom } from "jotai";

// 右键菜单项
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: (target: Obj) => void;
}

// 右键菜单工厂
export type ContextMenuFactory = (target: Obj) => ContextMenuItem[];
export const ContextMenuFactories: Record<string, ContextMenuFactory> = {};

// 通用菜单项
const generalItems: ContextMenuItem[] = [];

// 获取右键菜单项（组合通用项和特定类型项）
export const getContextMenuItems = (target: Obj): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];
  items.push(...generalItems);

  const typePrefix = target.type.split("/")[0];
  const factory = ContextMenuFactories[typePrefix];
  if (factory) {
    items.push(...factory(target));
  }

  return items;
};

// 右键菜单组件接口
export interface ContextMenu extends Obj {
  items: ContextMenuItem[];
  target: Obj;
  pos: { x: number; y: number };
}

// 右键点击处理
const onContextMenu = (e: MouseEvent) => {
  e.preventDefault();

  // 查找点击的目标
  const targetId = idFromEvent(e, ".node-group, .edge-group");
  let target: Obj | null = null;
  let items: ContextMenuItem[] = [];

  if (targetId) {
    target = objects[targetId];
    if (target) {
      items = getContextMenuItems(target);
    }
  }

  // 点击空白处或没有特定菜单项时，显示节点创建菜单
  if (!target || items.length === 0) {
    // 创建节点菜单项
    const nodeItems: ContextMenuItem[] = ToolItems.map((tool) => ({
      id: `create-${tool.id}`,
      label: tool.id.split("/").pop() || tool.id,
      icon: tool.icon,
      onClick: () => {
        const node = tool.createNode();
        const pos = screen2Viewport({ x: e.clientX, y: e.clientY });
        node.pos = { x: pos.x - node.size.x / 2, y: pos.y - node.size.y / 2 };
        node.selected = true;
        Manager.add(node);
        Manager.saveHistory();
      },
    }));

    if (nodeItems.length === 0) {
      return; // 没有可创建的节点类型
    }

    items = nodeItems;
    target = null as unknown as Obj;
  }
  const menu: ContextMenu = {
    id: "context-menu",
    type: "ui/contextMenu",
    updater: atom(0),
    items,
    target,
    pos: screen2Viewport({ x: e.clientX, y: e.clientY }),
  };

  // 添加菜单到对象
  Manager.add(menu);

  // 监听 mousedown 事件（过程式设计）
  const onMenuMouseDown = (e: MouseEvent) => {
    // 检查点击是否在菜单内
    const inMenu = (e.target as Element).closest(".context-menu");

    // 点击菜单外，关闭菜单
    if (!inMenu) {
      setTimeout(() => {
        Manager.deleteId("context-menu");
      }, 0);
    }
    window.removeEventListener("mousedown", onMenuMouseDown, true);
  };
  window.addEventListener("mousedown", onMenuMouseDown, true);
};
Operators.push({
  Begin: () => {
    window.addEventListener("contextmenu", onContextMenu);
  },
  End: () => {
    window.removeEventListener("contextmenu", onContextMenu);
  },
});

// 注册删除选项
generalItems.push({
  id: "delete",
  label: "删除",
  icon: "🗑️",
  onClick: (target: Obj) => {
    Manager.deleteId(target.id);
    Manager.saveHistory();
  },
});

// 注册复制选项（占位）
generalItems.push({
  id: "duplicate",
  label: "复制",
  icon: "📋",
  onClick: (target: Obj) => {
    // TODO: 实现复制功能
    console.log("Duplicate not implemented yet for:", target.id);
  },
});
