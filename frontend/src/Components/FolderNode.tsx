import React, { useRef, useEffect, useMemo } from "react";
import { atom, useAtom, getDefaultStore } from "jotai";
import { managerUpdate, managerDeleteId, managerAdd, objects, saveHistory, updateCanvas, store } from "../Manager";
import { Anchor, anchors_rect, Node, Coms, Obj } from "../Globals";
import { ToolItems, CATEGORY_NODES } from "../TopLayer/ToolBar";
import { ObjectFactories } from "../Controllers/Creator";
import { activedId } from "../Controllers/Selector";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
  Serializers,
  Deserializers,
} from "../Serialization";
import { EditableText } from "./EditableText";

export interface FolderNode extends Node {
  childrenIds: string[];
  name: string;
  collapsed: boolean;
  hiddenChildren: Obj[]; // 存储折叠时移除的子节点
}

// 注册序列化函数
registerSerializer(
  "node/folder",
  (obj: Obj) => {
    const node = obj as FolderNode;
    const serializedHiddenChildren = node.hiddenChildren.map((child) => {
      const serializer = Serializers[child.type];
      return serializer ? serializer(child) : { ...child, updater: undefined };
    });

    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      aAncs: serializeAnchors(node.aAncs, "rect"),
      eAncs: serializeAnchors(node.eAncs, null),
      childrenIds: [...node.childrenIds],
      name: node.name,
      collapsed: node.collapsed,
      hiddenChildren: serializedHiddenChildren,
      selected: node.selected,
      z: node.z,
    };
  },
  (data) => {
    const deserializedHiddenChildren = (data.hiddenChildren || []).map((childData: any) => {
      const deserializer = Deserializers[childData.type];
      return deserializer ? deserializer(childData) : { ...childData, updater: atom(0) };
    });

    const node: FolderNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      childrenIds: data.childrenIds || [],
      name: data.name || "Folder",
      collapsed: data.collapsed ?? false,
      hiddenChildren: deserializedHiddenChildren,
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
    name: "Folder",
    collapsed: false,
    hiddenChildren: [],
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

  // 用于名称编辑的 atom
  const isEditingAtom = useMemo(() => atom(false), [node.id]);

  // 使用锁标记当前是否正在进行布局计算，防止子节点更新回调造成死循环
  const isLayoutingRef = useRef(false);

  // 订阅每个子节点的 updater，检测删除事件和大小变化
  // 简化逻辑：每次 childrenIds 变化时，重新订阅所有子节点
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    node.childrenIds.forEach((childId) => {
      const child = objects[childId];
      if (!child) return;

      // 订阅子节点的 updater
      const unsubscribe = store.sub(child.updater, () => {
        const value = store.get(child.updater);
        if (value === -1) {
          // 子节点被删除，从 childrenIds 中移除
          const index = node.childrenIds.indexOf(childId);
          if (index !== -1) {
            node.childrenIds.splice(index, 1);
            managerUpdate(node);
          }
        } else {
          // 子节点更新（包括大小变化），触发父文件夹重新布局
          // 关键：如果正在进行父节点的布局计算（isLayoutingRef为true），则忽略此次更新
          if (!isLayoutingRef.current) {
            managerUpdate(node);
          }
        }
      });
      unsubs.push(unsubscribe);
    });

    return () => {
      // 清理所有订阅
      unsubs.forEach((unsub) => unsub());
    };
  }, [node.childrenIds]); // 依赖整个 childrenIds 数组引用，确保列表变化时刷新订阅

  // 处理名称变更
  const handleNameChange = (newName: string) => {
    node.name = newName || "Folder";
    managerUpdate(node);
    saveHistory();
  };

  // 递归收集所有子节点（包括嵌套的子文件夹内容）
  const collectAllChildren = React.useCallback((ids: string[]): Obj[] => {
    const collected: Obj[] = [];
    ids.forEach((id) => {
      const child = objects[id];
      if (!child) return;
      collected.push(child);
      // 如果是文件夹，递归收集其子项
      if (child.type === "node/folder") {
        const folderChild = child as FolderNode;
        collected.push(...collectAllChildren(folderChild.childrenIds));
      }
    });
    return collected;
  }, []);

  // 折叠：收起所有子节点
  const handleCollapse = React.useCallback(() => {
    if (node.childrenIds.length === 0) return;

    // 收集所有子节点
    const children = collectAllChildren(node.childrenIds);
    node.hiddenChildren = children;

    // 从 objects 中移除所有子节点
    children.forEach((child) => {
      managerDeleteId(child.id);
    });

    // 清空 childrenIds 并设置折叠状态
    node.childrenIds = [];
    node.collapsed = true;
    managerUpdate(node);
    saveHistory();
  }, [node, collectAllChildren]);

  // 展开：恢复所有子节点
  const handleExpand = React.useCallback(() => {
    // 如果没有隐藏的子节点，重置 collapsed 状态并返回
    if (node.hiddenChildren.length === 0) {
      node.collapsed = false;
      managerUpdate(node);
      return;
    }

    // 找出直接子节点的 ID（第一层）
    const directChildIds: string[] = [];

    // 恢复所有隐藏的子节点到 objects
    node.hiddenChildren.forEach((child) => {
      // 重新添加到 objects
      managerAdd(child);
    });

    // 从 hiddenChildren 中找出直接子节点
    // 直接子节点是那些不在任何其他 hiddenChildren 的 childrenIds 中的节点
    const allChildrenIdsInFolders = new Set<string>();
    node.hiddenChildren.forEach((child) => {
      if (child.type === "node/folder") {
        (child as FolderNode).childrenIds.forEach((id) => {
          allChildrenIdsInFolders.add(id);
        });
      }
    });

    node.hiddenChildren.forEach((child) => {
      if (!allChildrenIdsInFolders.has(child.id)) {
        directChildIds.push(child.id);
      }
    });

    // 恢复状态
    node.childrenIds = directChildIds;
    node.hiddenChildren = [];
    node.collapsed = false;
    managerUpdate(node);
    saveHistory();
  }, [node]);

  // 递归更新子项层级（支持深层嵌套）
  const updateChildrenZ = React.useCallback((parentZ: number, childIds: string[]) => {
    childIds.forEach((id) => {
      const child = objects[id] as Node;
      if (!child) return;

      const targetZ = child.type === "node/folder" ? parentZ + 3 : parentZ + 1;
      if (child.z !== targetZ) {
        child.z = targetZ;
        managerUpdate(child);
      }

      // 如果子项是文件夹，递归更新其子项
      if (child.type === "node/folder") {
        const folderChild = child as FolderNode;
        if (folderChild.childrenIds && folderChild.childrenIds.length > 0) {
          updateChildrenZ(targetZ, folderChild.childrenIds);
        }
      }
    });
  }, []);

  // 自动布局与自动大小逻辑
  const reLayout = React.useCallback(() => {
    isLayoutingRef.current = true; // 上锁：开始布局

    try {
      let currentY = 40; // 标题栏下方开始
      let maxWidth = 150;
      let sizeChanged = false;
      // 拖拽时文件夹层级临时 +2，子节点应使用原始 baseZ
      const baseZ = isDraggingOver ? (node.z ?? 0) - 2 : (node.z ?? 0);

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

      // 递归更新所有子项层级
      updateChildrenZ(baseZ, node.childrenIds);

      if (node.size.y !== currentY || node.size.x !== maxWidth) {
        node.size.y = currentY;
        node.size.x = maxWidth;
        sizeChanged = true;
      }

      if (sizeChanged) {
        managerUpdate(node);
      }

      // 确保层级变更后触发画布重新排序
      updateCanvas();
    } finally {
      isLayoutingRef.current = false; // 解锁：布局结束
    }
  }, [node, updateChildrenZ, isDraggingOver]); // 移除 updater 依赖，避免循环

  useEffect(() => {
    reLayout();
  }, [reLayout, updater, node.pos.x, node.pos.y, node.childrenIds.length]);



  // 监听 node-hover 事件以纳入新节点并处理高亮
  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;

    const onNodeHover = (e: any) => {
      const draggedNodes = e.detail as Node[];
      if (!draggedNodes || draggedNodes.length === 0) return;

      // 过滤掉自身
      const validNodes = draggedNodes.filter(n => n.id !== node.id);
      if (validNodes.length === 0) return;

      if (!isDraggingOver) {
        setIsDraggingOver(true);
        node.z = (node.z ?? 0) + 2;
        updateCanvas();
      }

      // 使用第一个拖拽节点计算插入位置
      const primaryNode = validNodes[0];
      const draggedCenterY = primaryNode.pos.y + primaryNode.size.y / 2;
      let targetIndex = 0;

      // 遍历现有子节点，找到合适的插入位置
      for (let i = 0; i < node.childrenIds.length; i++) {
        const childId = node.childrenIds[i];
        // 跳过所有拖拽中的节点
        if (validNodes.some(n => n.id === childId)) continue;

        const child = objects[childId] as Node;
        if (!child) continue;

        const childCenterY = child.pos.y + child.size.y / 2;
        if (draggedCenterY > childCenterY) {
          targetIndex = i + 1;
        }
      }

      // 处理每个拖拽的节点
      validNodes.forEach((dragged, idx) => {
        const isChild = node.childrenIds.includes(dragged.id);

        if (!isChild) {
          // 新节点：插入到计算出的位置（后续节点依次排列）
          node.childrenIds.splice(targetIndex + idx, 0, dragged.id);

          // 设置层级关系：子文件夹(Z+3) > 本文件夹(Z) > 普通节点(Z+1)
          const baseZ = (node.z ?? 0) - 2;
          if (dragged.type === "node/folder") {
            dragged.z = baseZ + 3;
          } else {
            dragged.z = baseZ + 1;
          }

          managerUpdate(dragged);
        } else {
          // 已经是子项：检查是否需要重新排序
          const currentIndex = node.childrenIds.indexOf(dragged.id);
          // 调整 targetIndex（因为移除当前元素后索引会变化）
          const adjustedTargetIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;

          if (currentIndex !== adjustedTargetIndex + idx) {
            // 需要重新排序
            node.childrenIds.splice(currentIndex, 1);
            node.childrenIds.splice(adjustedTargetIndex + idx, 0, dragged.id);
          }
        }
      });

      managerUpdate(node);
      // 强制布局使其吸附，覆盖 Dragger 的鼠标相对移动
      reLayout();
    };

    const onNodeLeave = (e: any) => {
      if (isDraggingOver) {
        setIsDraggingOver(false);
        node.z = (node.z ?? 0) - 2;
        updateCanvas();
      }

      const draggedNodes = e.detail as Node[];
      if (!draggedNodes || draggedNodes.length === 0) return;

      // 移除所有拖拽节点
      draggedNodes.forEach((dragged) => {
        if (!dragged) return;

        const index = node.childrenIds.indexOf(dragged.id);
        if (index !== -1) {
          node.childrenIds.splice(index, 1);
          dragged.z = 0; // 移出文件夹后恢复基础层级
          managerUpdate(dragged);
        }
      });

      managerUpdate(node);
      reLayout();
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

      {/* 文件夹名称区域 */}
      <g
        transform="translate(5, 13)"
        onDoubleClick={() => {
          if (!isDraggingOver) {
            getDefaultStore().set(isEditingAtom, true);
          }
        }}
      >
        {/* 透明点击区域 */}
        <rect
          width={60}
          height={22}
          fill="transparent"
          style={{ cursor: "text" }}
        />
        {isDraggingOver ? (
          <text
            x="5"
            y="15"
            textAnchor="start"
            dominantBaseline="middle"
            fill="#8b5cf6"
            fontSize="12"
            fontWeight="bold"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            Drop to add
          </text>
        ) : (
          <EditableText
            text={node.name}
            size={{ x: 60, y: 22 }}
            onEndEditing={handleNameChange}
            isEditingAtom={isEditingAtom}
            inputClassName="folder-name-input"
            displayClassName="folder-name-display"
            fontSize="12px"
            textAlign="left"
            placeholder="Folder"
          />
        )}
      </g>

      {/* 折叠/展开按钮 */}
      {(node.childrenIds.length > 0 || node.hiddenChildren.length > 0) && (
        <g
          transform={`translate(${node.size.x - 18}, 25)`}
          onClick={(e) => {
            e.stopPropagation();
            if (node.collapsed) {
              handleExpand();
            } else {
              handleCollapse();
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {/* +/- 符号 */}
          <text
            x="2"
            y="1"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255, 255, 255, 0.6)"
            fontSize="18"
            fontWeight="bold"
          >
            {node.collapsed ? "+" : "-"}
          </text>
        </g>
      )}
    </g>
  );
};
