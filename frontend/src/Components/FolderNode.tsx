import React, { useRef, useEffect } from "react";
import { atom, useAtom } from "jotai";
import { managerUpdate, objects, saveHistory, updateCanvas } from "../Manager";
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
      z: node.z,
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
      z: data.z ?? 0,
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
    z: 0,
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
  const [updater] = useAtom(obj.updater);
  const node = obj as FolderNode;
  const groupRef = useRef<SVGGElement>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  // 自动布局与自动大小逻辑
  const reLayout = React.useCallback(() => {
    let currentY = 40; // 标题栏下方开始
    let maxWidth = 150;
    let changed = false;

    node.childrenIds.forEach((id) => {
      const child = objects[id] as Node;
      if (child) {
        const targetX = node.pos.x + 10;
        const targetY = node.pos.y + currentY;

        if (child.pos.x !== targetX || child.pos.y !== targetY) {
          child.pos.x = targetX;
          child.pos.y = targetY;
          managerUpdate(child);
        }

        currentY += child.size.y + 10;
        maxWidth = Math.max(maxWidth, child.size.x + 20);
      }
    });

    if (node.size.y !== currentY || node.size.x !== maxWidth) {
      node.size.y = currentY;
      node.size.x = maxWidth;
      changed = true;
    }

    if (changed) {
      managerUpdate(node);
    }
  }, [node, updater]);

  useEffect(() => {
    reLayout();
  }, [node.pos.x, node.pos.y, node.childrenIds, reLayout]);



  // 监听 node-hover 事件以纳入新节点并处理高亮
  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;

    const onNodeHover = (e: any) => {
      const dragged = e.detail as Node;
      if (dragged.id === node.id) return;

      if (!isDraggingOver) {
        setIsDraggingOver(true);
        node.z = (node.z ?? 0) + 2;
        updateCanvas();
      }

      const isChild = node.childrenIds.includes(dragged.id);

      if (!isChild) {
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

          // 设置层级关系：子文件夹(Z+3) > 本文件夹(Z) > 普通节点(Z+1)
          const baseZ = (node.z ?? 0) - 2;
          if (dragged.type === "node/folder") {
            dragged.z = baseZ + 3;
          } else {
            dragged.z = baseZ + 1;
          }

          managerUpdate(node);
          managerUpdate(dragged);
          reLayout();
        }
      } else {
        // 已经是子项，强制布局使其吸附，覆盖 Dragger 的鼠标相对移动
        reLayout();
      }
    };

    const onNodeLeave = (e: any) => {
      if (isDraggingOver) {
        setIsDraggingOver(false);
        node.z = (node.z ?? 0) - 2;
        updateCanvas();
      }

      const dragged = e.detail as Node;
      if (!dragged) return;

      const index = node.childrenIds.indexOf(dragged.id);
      if (index !== -1) {
        node.childrenIds.splice(index, 1);
        dragged.z = 0; // 移出文件夹后恢复基础层级
        managerUpdate(node);
        managerUpdate(dragged);
        reLayout();
      }
    };

    const onNodeDrop = (e: any) => {
      if (isDraggingOver) {
        setIsDraggingOver(false);
        node.z = (node.z ?? 0) - 2;
        updateCanvas();
      }
    }

    el.addEventListener("node-hover", onNodeHover);
    el.addEventListener("node-leave", onNodeLeave);
    el.addEventListener("node-drop", onNodeDrop)
    return () => {
      el.removeEventListener("node-hover", onNodeHover);
      el.removeEventListener("node-leave", onNodeLeave);
      el.removeEventListener("node-drop", onNodeDrop)
    }
  }, [node, reLayout, isDraggingOver]);

  return (
    <g
      ref={groupRef}
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 文件夹高亮层 */}
      {isDraggingOver && (
        <rect
          x="-4"
          y="-4"
          width={node.size.x + 8}
          height={node.size.y + 8}
          rx="10"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="3"
          strokeDasharray="4 4"
          style={{ opacity: 0.6 }}
        />
      )}

      <path
        d={`M 0 0 L 60 0 L 70 10 L ${node.size.x} 10 L ${node.size.x} ${node.size.y} L 0 ${node.size.y} Z`}
        fill={getFillColor(node)}
        stroke={getStrokeColor(node)}
        strokeWidth="2"
      />

      <rect
        y="10"
        width={node.size.x}
        height={node.size.y - 10}
        fill={getFillColor(node)}
        stroke="none"
      />

      <text
        x="10"
        y="30"
        fill={isDraggingOver ? "#8b5cf6" : "rgba(255, 255, 255, 0.3)"}
        fontSize="12"
        fontWeight={isDraggingOver ? "bold" : "normal"}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {isDraggingOver ? "Drop to add" : "Folder"}
      </text>
    </g>
  );
};
