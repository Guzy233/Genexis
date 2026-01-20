import React, { useRef, useEffect } from "react";
import { atom, useAtom } from "jotai";
import { managerUpdate, objects, saveHistory } from "../Manager";
import { Anchor, anchors_rect, Node, Coms, Obj } from "../Globals";
import { ToolItems, CATEGORY_NODES } from "../TopLayer/ToolBar";
import { ObjectFactories } from "../Controllers/Creator";
import { activedId } from "../Controllers/Selector";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";

export interface FolderNode extends Node {
  childrenIds: string[];
}

// 注册序列化函数
registerSerializer(
  "node/folder",
  (obj: Obj) => {
    const node = obj as FolderNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      aAncs: serializeAnchors(node.aAncs, "rect"),
      eAncs: serializeAnchors(node.eAncs, null),
      childrenIds: [...node.childrenIds],
      selected: node.selected,
    };
  },
  (data) => {
    const node: FolderNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      childrenIds: data.childrenIds || [],
      selected: data.selected ?? false,
      updater: atom(0),
    };
    return node;
  }
);

const getFillColor = (node: FolderNode) => {
  if (node.id === activedId) return "rgba(139, 92, 246, 0.15)";
  if (node.selected) return "rgba(99, 102, 241, 0.1)";
  return "rgba(255, 255, 255, 0.02)";
};

const getStrokeColor = (node: FolderNode) => {
  if (node.id === activedId) return "#8b5cf6";
  if (node.selected) return "#6366f1";
  return "rgba(255, 255, 255, 0.1)";
};

// 注册对象工厂
ObjectFactories["node/folder"] = (): FolderNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/folder",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 300, y: 200 },
    childrenIds: [],
    selected: false,
    eAncs: [anchors_rect[1], anchors_rect[2]],
    aAncs: anchors_rect,
  };
};

// 注册工具项
ToolItems.push({
  id: "node/folder",
  type: "node",
  category: CATEGORY_NODES,
  icon: (
    <svg viewBox="0 0 60 60" style={{ width: "100%", height: "100%" }}>
      <path
        d="M 10 15 L 25 15 L 30 20 L 50 20 L 50 45 L 10 45 Z"
        fill="rgba(255, 255, 255, 0.05)"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="2"
      />
    </svg>
  ),
});

Coms["node/folder"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as FolderNode;
  const lastPos = useRef({ x: node.pos.x, y: node.pos.y });
  const groupRef = useRef<SVGGElement>(null);

  // 带动子节点逻辑
  const dx = node.pos.x - lastPos.current.x;
  const dy = node.pos.y - lastPos.current.y;

  if (dx !== 0 || dy !== 0) {
    node.childrenIds.forEach((id) => {
      const child = objects[id] as Node;
      if (child) {
        child.pos.x += dx;
        child.pos.y += dy;
        managerUpdate(child);
      }
    });
    lastPos.current = { x: node.pos.x, y: node.pos.y };
  }

  // 边界检查：移除离开文件夹的节点
  useEffect(() => {
    const checkLeavers = () => {
      if (node.childrenIds.length === 0) return;

      const bounds = {
        x1: node.pos.x,
        y1: node.pos.y,
        x2: node.pos.x + node.size.x,
        y2: node.pos.y + node.size.y,
      };

      const nextChildren = node.childrenIds.filter((id) => {
        const child = objects[id] as Node;
        if (!child) return false;
        // 使用中心点判断
        const cx = child.pos.x + child.size.x / 2;
        const cy = child.pos.y + child.size.y / 2;
        return cx >= bounds.x1 && cx <= bounds.x2 && cy >= bounds.y1 && cy <= bounds.y2;
      });

      if (nextChildren.length !== node.childrenIds.length) {
        node.childrenIds = nextChildren;
        managerUpdate(node);
      }
    };

    // 每一帧或位置更新后检查（由于 useEffect 在渲染后执行，且渲染是由 updater 触发的，这里可以胜任）
    checkLeavers();
  });

  // 监听 node-hover 事件以纳入新节点
  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;

    const onNodeHover = (e: any) => {
      const dragged = e.detail as Node;
      if (dragged.id === node.id) return; // 忽略自己

      // 如果不是子节点且中心点在范围内，则加入
      if (!node.childrenIds.includes(dragged.id)) {
        const bounds = {
          x1: node.pos.x,
          y1: node.pos.y,
          x2: node.pos.x + node.size.x,
          y2: node.pos.y + node.size.y,
        };
        const cx = dragged.pos.x + dragged.size.x / 2;
        const cy = dragged.pos.y + dragged.size.y / 2;

        if (cx >= bounds.x1 && cx <= bounds.x2 && cy >= bounds.y1 && cy <= bounds.y2) {
          node.childrenIds.push(dragged.id);
          managerUpdate(node);
        }
      }
    };

    el.addEventListener("node-hover", onNodeHover);
    return () => el.removeEventListener("node-hover", onNodeHover);
  }, [node]);

  return (
    <g
      ref={groupRef}
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 文件夹标题栏（耳朵） */}
      <path
        d={`M 0 0 L 60 0 L 70 10 L ${node.size.x} 10 L ${node.size.x} ${node.size.y} L 0 ${node.size.y} Z`}
        fill={getFillColor(node)}
        stroke={getStrokeColor(node)}
        strokeWidth="2"
      />

      {/* 文件夹底色 */}
      <rect
        y="10"
        width={node.size.x}
        height={node.size.y - 10}
        fill={getFillColor(node)}
        stroke="none"
      />

      {/* 装饰性文字 */}
      <text
        x="10"
        y="30"
        fill="rgba(255, 255, 255, 0.3)"
        fontSize="12"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        Folder
      </text>
    </g>
  );
};
