import Manager, { objects } from "../Manager";
import { Obj, Controllers, idFromEvent } from "../Globals";
import { screen2Viewport } from "./Camera";
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
export type ContextMenuFactory = (target: Obj, event: MouseEvent) => ContextMenuItem[];
export const ContextMenuFactories: Record<string, ContextMenuFactory> = {};

// 通用菜单项
const generalItems: ContextMenuItem[] = [];

// 获取右键菜单项（组合通用项和特定类型项）
export const getContextMenuItems = (target: Obj, event: MouseEvent): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];

  const typePrefix = target.type.split("/")[0];
  const factory = ContextMenuFactories[typePrefix];
  if (factory) {
    items.push(...factory(target, event));
  }

  // 对于非画布对象，添加通用菜单项
  if (typePrefix !== "canvas") {
    items.push(...generalItems);
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
  let target: Obj;

  if (targetId) {
    target = objects[targetId];
  } else {
    // 创建画布对象
    target = {
      id: "canvas",
      type: "canvas",
    } as Obj;
  }

  // 获取右键菜单项
  const items = getContextMenuItems(target, e);

  if (items.length === 0) {
    return; // 没有菜单项，不显示菜单
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
Controllers.push({
  Begin: (canvas: SVGGElement) => {
    canvas.addEventListener("contextmenu", onContextMenu);
  },
  End: (canvas: SVGGElement) => {
    canvas.removeEventListener("contextmenu", onContextMenu);
  },
});

// 注册删除选项
generalItems.push({
  id: "delete",
  label: "删除",
  icon: "🗑️",
  onClick: (target: Obj) => {
    Manager.deleteIdWithEdges(target.id);
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
