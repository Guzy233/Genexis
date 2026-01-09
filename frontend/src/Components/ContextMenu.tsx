import React, { useRef, useState, useLayoutEffect } from "react";
import { Obj, Coms } from "../Globals";
import { useAtom } from "jotai";
import { viewport } from "../Controllers/Camera";
import { ContextMenu, ContextMenuItem } from "../Controllers/ContextMenu";
import Manager from "../Manager";

// 右键菜单组件使用 ContextMenuController 中定义的 ContextMenu 类型

// 右键菜单组件
export const ContextMenuComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  const menu = obj as ContextMenu;
  useAtom(obj.updater);

  const menuRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 120, height: 0 });

  // 测量实际内容大小
  useLayoutEffect(() => {
    if (menuRef.current) {
      setSize({
        width: menuRef.current.offsetWidth,
        height: menuRef.current.offsetHeight,
      });
    }
  }, [menu.items]);

  // 根据 zoom 调整显示
  const scale = 1 / viewport.zoom;

  // 处理菜单项点击
  const handleItemClick = (item: ContextMenuItem) => {
    item.onClick(menu.target);
    Manager.deleteId(menu.id);
  };

  return (
    <g
      className="context-menu"
      transform={`translate(${menu.pos?.x ?? 0}, ${menu.pos?.y ?? 0}) scale(${scale})`}
    >
      <foreignObject
        x={0}
        y={0}
        width={size.width}
        height={size.height}
        style={{ pointerEvents: "auto" }}
      >
        <div ref={menuRef} className="context-menu-content">
          {menu.items.map((item) => (
            <div
              key={item.id}
              className="context-menu-item"
              onMouseDown={() => handleItemClick(item)}
            >
              {item.icon && (
                <span className="context-menu-icon">{item.icon}</span>
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </foreignObject>
    </g>
  );
};

Coms["ui/contextMenu"] = ContextMenuComponent;
