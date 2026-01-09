import React, { useState, useEffect } from "react";
import Manager, { objects } from "../Manager";
import { serializeCanvas } from "../Serialization";
import { Quit, Minimize, Maximize, IsMaximized } from "../../wailsjs/go/main/App";

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
        const data = serializeCanvas(objects);
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

// 菜单按钮组件（图标形式）
const MenuButton: React.FC<{ category: MenuCategory; icon: string }> = ({ category, icon }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="menu-button-wrapper"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="menu-button" title={category.label}>
        {icon}
      </button>
      <div className={`menu-dropdown ${isOpen ? "open" : ""}`}>
        {category.items.map((item) =>
          item.divider ? (
            <div key={item.id} className="menu-dropdown-divider" />
          ) : (
            <div
              key={item.id}
              className="menu-dropdown-item"
              onClick={() => {
                item.action();
                setIsOpen(false);
              }}
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

// 窗口控制按钮组件
const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 检查窗口状态
    const checkMaximized = async () => {
      const maximized = await IsMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();
  }, []);

  const handleMaximize = async () => {
    await Maximize();
    const maximized = await IsMaximized();
    setIsMaximized(maximized);
  };

  return (
    <div className="window-controls">
      <button
        className="window-control-btn minimize-btn"
        onClick={() => Minimize()}
        title="最小化"
      >
        <span>─</span>
      </button>
      <button
        className="window-control-btn maximize-btn"
        onClick={handleMaximize}
        title={isMaximized ? "还原" : "最大化"}
      >
        {isMaximized ? <span>❐</span> : <span>□</span>}
      </button>
      <button
        className="window-control-btn close-btn"
        onClick={() => Quit()}
        title="关闭"
      >
        <span>✕</span>
      </button>
    </div>
  );
};

// 顶部菜单栏组件（浮动按钮组）
const TopMenuBar: React.FC = () => {
  // 为每个菜单定义图标
  const menuIcons: Record<string, string> = {
    file: "📁",
    edit: "✏️",
    view: "👁️",
    help: "❓",
  };

  return (
    <>
      {/* 菜单栏容器 */}
      <div className="top-menu-bar">
        {/* 左侧菜单按钮 */}
        <div className="menu-buttons-left" data-wails-no-drag>
          {menuStructure.map((category) => (
            <MenuButton
              key={category.id}
              category={category}
              icon={menuIcons[category.id] || "•"}
            />
          ))}
        </div>

        {/* 中间拖拽区域 */}
        <div className="title-bar-drag-area" data-wails-drag />

        {/* 右侧窗口控制按钮 */}
        <div className="window-controls" data-wails-no-drag>
          <WindowControls />
        </div>
      </div>
    </>
  );
};

export default TopMenuBar;
