import React from "react";
import { atom, useAtom } from "jotai";
import Manager from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ToolItems, CATEGORY_NODES } from "../TopLayer/ToolBar";
import { ObjectFactories } from "../Controllers/Creator";
import {
  ContextMenuFactories,
  ContextMenuItem,
} from "../Controllers/ContextMenu";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";
import { coords, translations } from "../Controllers/Recipes";
import { saveHistory } from "../Manager";
import { activedId } from "../Controllers/Selector";

// ============ 纯展示组件：MC物品图标 ============
export interface MCItemIconProps {
  itemId: string;      // 完整物品ID，如 "minecraft:stone"
  size?: number;       // 显示尺寸，默认64
}

/**
 * MC物品图标展示组件
 * 只传入itemId即可显示对应的物品图标
 */
export const MCItemIcon: React.FC<MCItemIconProps> = ({ itemId, size = 64 }) => {
  // 获取物品坐标信息
  const itemData = coords[itemId];
  if (!itemData) {
    // 未找到物品时显示占位符
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <rect
          width={32}
          height={32}
          fill="rgba(255, 255, 255, 0.1)"
          stroke="#666"
          strokeWidth="1"
        />
        <text
          x={16}
          y={16}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#999"
          fontSize="8"
        >
          ?
        </text>
      </svg>
    );
  }

  const [modId] = itemId.split(":");
  const spriteUrl = `/reciper/atlas`;
  const x = itemData.X;
  const y = itemData.Y;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ imageRendering: "pixelated" }}
    >
      <image
        href={spriteUrl}
        x={-x}
        y={-y}
      />
    </svg>
  );
};

export interface MCItemNode extends Node {
  itemId: string; // 格式: modid:itemid
  spriteSize: { width: number; height: number };
}


const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 工厂函数：创建新的MC物品节点
export const createMCItemNode = (): MCItemNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/mcitem",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 80, y: 80 },
    itemId: "actuallyadditions:advanced_coil",
    spriteSize: { width: 64, height: 64 },
    selected: false,
    eAncs: anchors_default,
    aAncs: anchors_rect,
  };
};

// 注册对象工厂
ObjectFactories["node/mcitem"] = createMCItemNode;

// 注册工具项
ToolItems.push({
  id: "node/mcitem",
  type: "node",
  category: CATEGORY_NODES,
  icon: (
    <svg viewBox="0 0 60 60" style={{ width: "100%", height: "100%" }}>
      <rect
        x="4"
        y="8"
        width="52"
        height="44"
        rx="8"
        fill="rgba(255, 255, 255, 0.05)"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="2"
      />
      {/* 工作台图标 - 3D 透视效果 */}
      {/* 顶部表面 */}
      <path
        d="M 18 22 L 30 16 L 42 22 L 30 28 Z"
        fill="rgba(99, 102, 241, 0.3)"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 左侧面 */}
      <path
        d="M 18 22 L 18 36 L 30 42 L 30 28 Z"
        fill="rgba(99, 102, 241, 0.15)"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 右侧面 */}
      <path
        d="M 30 28 L 30 42 L 42 36 L 42 22 Z"
        fill="rgba(99, 102, 241, 0.2)"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
});

// 注册序列化函数
registerSerializer(
  "node/mcitem",
  (obj: Obj) => {
    const node = obj as MCItemNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      // 可用锚点使用预设 "rect"（四方向锚点）
      aAncs: serializeAnchors(node.aAncs, "rect"),
      // 启用锚点使用编码字符串
      eAncs: serializeAnchors(node.eAncs, null),
      itemId: node.itemId,
      spriteSize: { ...node.spriteSize },
      selected: node.selected,
    };
  },
  (data) => {
    const node: MCItemNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      itemId: data.itemId,
      spriteSize: { ...data.spriteSize },
      selected: data.selected ?? false,
      updater: atom(0),
    };
    return node;
  }
);

// 注册MC物品节点特定右键菜单
ContextMenuFactories["node"] = (target: Obj): ContextMenuItem[] => {
  const node = target as MCItemNode;
  const items: ContextMenuItem[] = [];

  // 清除物品选项（仅当有物品时显示）
  if (node.itemId && node.type === "node/mcitem") {
    items.push({
      id: "clearItem",
      label: "清除物品",
      icon: "🗑️",
      onClick: (t: Obj) => {
        const n = t as MCItemNode;
        n.itemId = "";
        Manager.update(n);
        saveHistory();
      },
    });
  }

  return items;
};

// MC物品节点组件 - 简化版：只显示图标和中文名称，无边框和ID输入
Coms["node/mcitem"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as MCItemNode;

  // 获取中文翻译
  const chineseName = translations[node.itemId] || node.itemId;

  // 节点尺寸
  const nodeWidth = 72;
  const iconSize = 64;
  const lineHeight = 14;
  const maxLines = 2;
  const padding = 4;

  // 判断是否选中或激活
  const isActived = node.id === activedId;
  const isSelected = node.selected;

  // 边框颜色
  const strokeColor = isActived ? "#8b5cf6" : isSelected ? "#6366f1" : "#6366f1";
  const strokeWidth = (isSelected || isActived) ? 2 : 0;

  // 计算节点总高度
  const nodeHeight = iconSize + padding * 2 + lineHeight * maxLines + 4;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 选中/激活时的边框 */}
      {(isSelected || isActived) && (
        <rect
          x={0}
          y={0}
          width={nodeWidth}
          height={nodeHeight}
          rx="6"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={isActived ? 1 : 0.7}
        />
      )}

      {/* 物品图标区域 */}
      <foreignObject x={(nodeWidth - iconSize) / 2} y={padding} width={iconSize} height={iconSize}>
        <MCItemIcon itemId={node.itemId} size={iconSize} />
      </foreignObject>

      {/* 显示物品名称（中文名称，支持换行） */}
      <foreignObject
        x={-4} // 稍微扩展宽度以容纳更多文字
        y={iconSize + padding + 2}
        width={nodeWidth + 8}
        height={lineHeight * maxLines}
      >
        <div
          style={{
            fontSize: "11px",
            color: isActived ? "#c4b5fd" : isSelected ? "#a5b4fc" : "#e4e4e7",
            textAlign: "center",
            lineHeight: `${lineHeight}px`,
            wordBreak: "break-word",
            overflowWrap: "break-word",
            fontWeight: isActived ? "600" : "normal",
            display: "-webkit-box",
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {chineseName}
        </div>
      </foreignObject>
    </g>
  );
};
