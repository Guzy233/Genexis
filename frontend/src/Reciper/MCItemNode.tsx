import React, { useState, useEffect, useRef } from "react";
import { atom, useAtom } from "jotai";
import { managerUpdate } from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
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
import { coords, getTagItems, translations, atlasUrl } from "./Reciper";
import { saveHistory } from "../Manager";
import { activedId } from "../Controllers/Selector";

// ============ 纯展示组件：MC物品图标 ============
export interface MCItemIconProps {
  itemId: string;      // 完整物品ID，如 "minecraft:stone"
  size?: number;       // 显示尺寸，默认64
  tag?: string
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
        href={atlasUrl}
        x={-x}
        y={-y}
      />
    </svg>
  );
};

// ============ 通用 SVG 物品格子组件 ============



// SVG 物品格子组件 Props
export interface SVGItemSlotProps {
  itemIdorTag: string
  count?: number
  size?: number;          // 格子大小，默认 40
  iconSize?: number;      // 图标大小，默认 32
}

/**
 * 通用的 SVG 物品格子组件
 * 支持标签轮播、数量显示
 * 内部全部使用 SVG 元素渲染
 */
export const SVGItemSlot: React.FC<SVGItemSlotProps> = ({
  itemIdorTag,
  count = 1,
  size = 40,
  iconSize = 32,
}) => {
  const [idx, setIdx] = useState(0);
  const isTag = itemIdorTag?.startsWith('#');
  const items = isTag ? getTagItems(itemIdorTag) : [itemIdorTag]

  useEffect(() => {
    if (items.length <= 1) return;
    const intv = setInterval(() => setIdx((i) => (i + 1) % items.length), 1000);
    return () => clearInterval(intv);
  }, [items.length]);

  const current = items[idx];

  const bgColor = isTag ? "rgba(255,200,100,0.1)" : "rgba(255,255,255,0.08)";
  const borderColor = isTag ? "rgba(255,200,100,0.3)" : "rgba(255,255,255,0.1)";

  if (!itemIdorTag || !current) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <rect
          x={0}
          y={0}
          width={size}
          height={size}
          fill="rgba(255,255,255,0.02)"
          stroke={borderColor}
          strokeWidth="1"
          rx="4"
        />
      </svg>
    );
  }

  return (
    <>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* 背景矩形 */}
        <rect
          x={0}
          y={0}
          width={size}
          height={size}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth="1"
          rx="4"
        />
        <g
          transform={`translate(${(size - iconSize) / 2}, ${(size - iconSize) / 2})`}
          data-type="item"
          data-count={count || 1}
          data-id={itemIdorTag}
        >
          <MCItemIcon itemId={current} size={iconSize} tag={isTag ? itemIdorTag : undefined} />
        </g>
        {count > 1 && (
          <>
            <rect
              x={size - 12}
              y={size - 12}
              width={14}
              height={12}
              rx="3"
              fill="rgba(0,0,0,0.6)"
            />
            <text
              x={size - 5}
              y={size - 3}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize="9"
              fontWeight="bold"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
            >
              {count}
            </text>
          </>
        )}

        <title>
          {isTag ? `${items.length} 物品` : translations[current] || current}
        </title>
      </svg>
    </>
  );
};

export interface MCItemNode extends Node {
  itemIdorTag: string; // 格式: modid:itemid
  spriteSize: { width: number; height: number };
}


const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 工厂函数：创建新的MC物品节点
export const createMCItemNode = (info?: any): MCItemNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/mc/item",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 80, y: 80 },
    itemIdorTag: info?.id || "actuallyadditions:advanced_coil",
    spriteSize: { width: 64, height: 64 },
    selected: false,
    eAncs: anchors_default,
    aAncs: anchors_rect,
  };
};

// 注册对象工厂
ObjectFactories["node/mc/item"] = createMCItemNode;

// 注册序列化函数
registerSerializer(
  "node/mc/item",
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
      itemId: node.itemIdorTag,
      spriteSize: { ...node.spriteSize },
      selected: node.selected,
    };
  },
  (data: any) => {
    const node: MCItemNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      itemIdorTag: data.itemId,
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
  if (node.itemIdorTag && node.type === "node/mcitem") {
    items.push({
      id: "clearItem",
      label: "清除物品",
      icon: "🗑️",
      onClick: (t: Obj) => {
        const n = t as MCItemNode;
        n.itemIdorTag = "";
        managerUpdate(n);
        saveHistory();
      },
    });
  }

  return items;
};

// MC物品节点组件 - 简化版：只显示图标和中文名称，无边框和ID输入
Coms["node/mc/item"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as MCItemNode;

  // 获取中文翻译
  const chineseName = translations[node.itemIdorTag] || node.itemIdorTag;

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
      <g transform={`translate(${(nodeWidth - iconSize) / 2}, ${padding})`}>
        <SVGItemSlot
          itemIdorTag={node.itemIdorTag}
          size={nodeWidth - 2 * padding}
          iconSize={iconSize}
        />
      </g>

      {/* 显示物品名称（中文名称，支持两行换行） */}
      <text
        x={nodeWidth / 2}
        y={iconSize + padding + 12}
        textAnchor="middle"
        style={{
          fontSize: "11px",
          fill: isActived ? "#c4b5fd" : isSelected ? "#a5b4fc" : "#e4e4e7",
          fontWeight: isActived ? "600" : "normal",
          pointerEvents: "none",
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        }}
      >
        {chineseName.length > 7 ? (
          <>
            <tspan x={nodeWidth / 2} dy="0">
              {chineseName.slice(0, 7)}
            </tspan>
            <tspan x={nodeWidth / 2} dy="13">
              {chineseName.slice(7, 14)}
              {chineseName.length > 14 ? "..." : ""}
            </tspan>
          </>
        ) : (
          chineseName
        )}
      </text>
    </g>
  );
};
