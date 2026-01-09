import React, { useState } from "react";
import Manager from "../Manager";

// 菜单项接口
interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  divider?: boolean;
}

// 菜单结构接口
interface MenuCategory {
  id: string;
  label: string;
  items: MenuItem[];
}

// 菜单结构定义
const menuStructure: MenuCategory[] = [
  {
    id: "file",
    label: "文件",
    items: [
      { id: "new", label: "新建", shortcut: "Ctrl+N", action: () => console.log("新建") },
      { id: "open", label: "打开", shortcut: "Ctrl+O", action: () => console.log("打开") },
      { id: "save", label: "保存", shortcut: "Ctrl+S", action: () => {
        // 保存到 localStorage
        const data = Manager.serializeCanvas();
        localStorage.setItem("mindgraph", JSON.stringify(data));
        console.log("已保存");
      }},
      { id: "export", label: "导出", action: () => console.log("导出") },
      { id: "divider1", label: "", divider: true, action: () => {} },
      { id: "settings", label: "设置", shortcut: "Ctrl+,", action: () => {
        // 触发设置面板打开事件
        window.dispatchEvent(new CustomEvent("open-settings"));
      }},
    ],
  },
  {
    id: "edit",
    label: "编辑",
    items: [
      { id: "undo", label: "撤销", shortcut: "Ctrl+Z", action: () => Manager.undo() },
      { id: "redo", label: "重做", shortcut: "Ctrl+Y", action: () => Manager.redo() },
      { id: "divider1", label: "", divider: true, action: () => {} },
      { id: "delete", label: "删除", shortcut: "Del", action: () => console.log("删除选中") },
    ],
  },
  {
    id: "view",
    label: "视图",
    items: [
      { id: "zoom-in", label: "放大", shortcut: "Ctrl++", action: () => console.log("放大") },
      { id: "zoom-out", label: "缩小", shortcut: "Ctrl+-", action: () => console.log("缩小") },
      { id: "reset-view", label: "重置视图", shortcut: "Ctrl+0", action: () => console.log("重置视图") },
    ],
  },
  {
    id: "help",
    label: "帮助",
    items: [
      { id: "shortcuts", label: "快捷键", action: () => console.log("快捷键帮助") },
      { id: "about", label: "关于", action: () => console.log("关于 MindGraph3") },
    ],
  },
];

// 菜单组件
const Menu: React.FC<{ category: MenuCategory }> = ({ category }) => {
  return (
    <div className="menu-item">
      {category.label}
      <div className="menu-dropdown">
        {category.items.map((item) =>
          item.divider ? (
            <div key={item.id} className="menu-dropdown-divider" />
          ) : (
            <div
              key={item.id}
              className="menu-dropdown-item"
              onClick={() => item.action()}
            >
              <span>{item.label}</span>
              {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
            </div>
          )
        )}
      </div>
    </div>
  );
};

// 顶部菜单栏组件
const TopMenuBar: React.FC = () => {
  return (
    <div className="top-menu-bar">
      {menuStructure.map((category) => (
        <Menu key={category.id} category={category} />
      ))}
    </div>
  );
};

export default TopMenuBar;
