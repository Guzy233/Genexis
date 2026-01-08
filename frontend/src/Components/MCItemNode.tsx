import React, { useState, useRef, useEffect } from "react";
import { atom, useAtom } from "jotai";
import Manager from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ToolItems, CATEGORY_NODES } from "./ToolBar";
import { ObjectFactories } from "../Controllers/Creator";
import {
  ContextMenuFactories,
  ContextMenuItem,
} from "../Controllers/ContextMenu";
import { activedId } from "../Controllers/Selector";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";
import { coords } from "../Controllers/Recipes";

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
  const spriteUrl = `/${modId}.png`;
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

const getFillColor = (node: MCItemNode) => {
  if (node.id === activedId) return "#8ce7ab33";
  if (node.selected) return "#e3f2fd33";
  return "rgba(59, 59, 59, 0.15)";
};

const getStrokeColor = (node: MCItemNode) => {
  if (node.id === activedId) return "#7d6bb4ff";
  if (node.selected) return "#765a80ff";
  return "#805a5a78";
};

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 解析物品ID并获取坐标信息
// coords的键是完整的物品ID（如 "minecraft:stone"）
// 每个物品图标为32x32像素
const getItemCoords = (itemId: string) => {
  const itemData = coords[itemId];
  if (!itemData) return null;

  const [modId, itemName] = itemId.split(":");

  return {
    modId,
    itemName,
    x: itemData.X,
    y: itemData.Y,
  };
};

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
  icon: <span style={{ fontSize: 16 }}>⛏️</span>,
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
      aAncs: serializeAnchors(node.aAncs),
      eAncs: serializeAnchors(node.eAncs),
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
        Manager.saveHistory();
      },
    });
  }

  return items;
};

// MC物品节点组件
export const MCItemNodeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as MCItemNode;
  const [isEditing, setIsEditing] = useState(false);
  const [tempItemId, setTempItemId] = useState(node.itemId);
  const inputRef = useRef<HTMLInputElement>(null);

  // 离开编辑模式
  const finishEditing = () => {
    setIsEditing(false);
    node.itemId = tempItemId.trim();
    Manager.update(node);
    Manager.saveHistory();
  };

  // 输入框变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempItemId(e.target.value);
  };

  // 输入框失焦
  const handleBlur = () => {
    finishEditing();
  };

  // 按 Enter 完成
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      finishEditing();
    }
  };

  // 获取物品坐标信息（用于显示名称）
  const coordsData = node.itemId ? getItemCoords(node.itemId) : null;

  // 节点高度根据内容调整
  const nodeHeight = 100;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 背景框 */}
      <rect
        width={node.size.x}
        height={nodeHeight}
        rx="6"
        fill={getFillColor(node)}
        stroke={getStrokeColor(node)}
        strokeWidth="2"
      />

      {/* 物品ID输入框区域 */}
      <foreignObject
        x="4"
        y="2"
        width={node.size.x - 8}
        height="24"
        style={{ overflow: "visible" }}
      >
        <input
          ref={inputRef}
          className="node-url-input"
          style={{
            width: "100%",
            height: "20px",
            border: "none",
            background: isEditing ? "white" : "transparent",
            fontSize: "12px",
            color: "#666",
            textAlign: "center",
            outline: "none",
            cursor: isEditing ? "text" : "pointer",
            pointerEvents: "auto",
          }}
          value={isEditing ? tempItemId : node.itemId}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsEditing(true)}
          placeholder="modid:itemid"
        />
      </foreignObject>

      {/* 物品图标区域 */}
      <foreignObject
        x={(node.size.x - 64) / 2}
        y={30}
        width={64}
        height={64}
      >
        <MCItemIcon itemId={node.itemId} size={64} />
      </foreignObject>

      {/* 显示物品名称 */}
      {coordsData && (
        <foreignObject
          x="4"
          y={nodeHeight - 18}
          width={node.size.x - 8}
          height="16"
          style={{ overflow: "hidden" }}
        >
          <div
            style={{
              fontSize: "10px",
              color: "#aaa",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {coordsData.itemName}
          </div>
        </foreignObject>
      )}
    </g>
  );
};
Coms["node/mcitem"] = MCItemNodeComponent;
