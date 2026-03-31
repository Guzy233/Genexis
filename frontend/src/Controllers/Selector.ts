import { objects, managerUpdateId, managerAdd, managerUpdate, managerDeleteId } from "../Manager";
import { idFromEvent, Node, Obj, Vec2 } from "../Globals";
import { screen2Viewport } from "./Camera";
import { atom } from "jotai";
import { registerKeyAction, registerMouseAction } from "./KeyBinding";

// ==================== 辅助函数 ====================

// 获取节点中心点
const getNodeCenter = (node: Node): Vec2 => ({
  x: node.pos.x + node.size.x / 2,
  y: node.pos.y + node.size.y / 2,
});

// 框选框组件接口
interface SelectionBox extends Obj {
  start: Vec2;
  end: Vec2;
}

export let activedId = "";
export function active(id: string) {
  const last = activedId;
  activedId = id;
  if (last && objects[last]) managerUpdateId(last);
  if (activedId && objects[activedId]) managerUpdateId(activedId);
}

// ==================== 键盘导航逻辑 ====================

type NavigationDirection = "up" | "down" | "left" | "right";

// 查找指定方向上最近的节点（使用加权分数算法）
const findNearestNodeInDirection = (
  fromNodeId: string,
  direction: NavigationDirection
): Node | null => {
  const fromNode = objects[fromNodeId] as Node;
  if (!fromNode) return null;

  const fromCenter = getNodeCenter(fromNode);
  let nearestNode: Node | null = null;
  let minScore = Infinity;

  Object.values(objects).forEach((obj) => {
    if (obj.id === fromNodeId || !obj.type.startsWith("node/")) return;

    const node = obj as Node;
    const toCenter = getNodeCenter(node);
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    let isCandidate = false;
    let score = 0;

    switch (direction) {
      case "up":
        if (dy < 0) {
          isCandidate = true;
          score = Math.abs(dy) + Math.abs(dx) * 3.0;
        }
        break;
      case "down":
        if (dy > 0) {
          isCandidate = true;
          score = Math.abs(dy) + Math.abs(dx) * 3.0;
        }
        break;
      case "left":
        if (dx < 0) {
          isCandidate = true;
          score = Math.abs(dx) + Math.abs(dy) * 3.0;
        }
        break;
      case "right":
        if (dx > 0) {
          isCandidate = true;
          score = Math.abs(dx) + Math.abs(dy) * 3.0;
        }
        break;
    }

    if (isCandidate && score < minScore) {
      minScore = score;
      nearestNode = node;
    }
  });

  return nearestNode;
};

const navigateToDirection = (direction: NavigationDirection, shiftKey: boolean, ctrlKey: boolean) => {
  if (!activedId) {
    const firstNode = Object.values(objects).find((obj) =>
      obj.type.startsWith("node/")
    ) as Node;
    if (firstNode) {
      active(firstNode.id);
    }
    return;
  }

  const nearestNode = findNearestNodeInDirection(activedId, direction);
  if (!nearestNode) return;

  active(nearestNode.id);

  if (shiftKey) {
    if (!nearestNode.selected) {
      nearestNode.selected = true;
      managerUpdate(nearestNode);
    }
  } else if (ctrlKey) {
    if (nearestNode.selected) {
      nearestNode.selected = false;
      managerUpdate(nearestNode);
    }
  }
};

// ==================== 鼠标选择逻辑 ====================

// 清除所有选中状态
const clearSelection = (includeActived: boolean) => {
  Object.values(objects).forEach((obj) => {
    if ("selected" in obj) {
      obj.selected = false;
      managerUpdate(obj);
    }
  });
  if (includeActived) {
    activedId = "";
  }
};

// 检查节点是否在框选区域内
const isNodeInBox = (node: Node, box: SelectionBox): boolean => {
  const minX = Math.min(box.start.x, box.end.x);
  const maxX = Math.max(box.start.x, box.end.x);
  const minY = Math.min(box.start.y, box.end.y);
  const maxY = Math.max(box.start.y, box.end.y);

  const nodeLeft = node.pos.x;
  const nodeRight = node.pos.x + node.size.x;
  const nodeTop = node.pos.y;
  const nodeBottom = node.pos.y + node.size.y;

  return (
    nodeLeft < maxX && nodeRight > minX && nodeTop < maxY && nodeBottom > minY
  );
};

// ==================== 框选逻辑 ====================

const handleBoxSelection = (e: MouseEvent, extend: boolean) => {
  // 非扩展模式下清除选择
  if (!extend) {
    clearSelection(true);
  }

  // 创建框选框
  const selectionBox: SelectionBox = {
    id: "selection-box",
    type: "ui/selectionBox",
    updater: atom(0),
    start: screen2Viewport({ x: e.clientX, y: e.clientY }),
    end: screen2Viewport({ x: e.clientX, y: e.clientY }),
  };
  managerAdd(selectionBox);

  // 记录初始选中状态，用于取消选择
  const initialSelection = new Map<string, boolean>();
  Object.values(objects).forEach((obj) => {
    if (obj.type.startsWith("node/")) {
      const node = obj as Node;
      initialSelection.set(node.id, node.selected);
    }
  });

  const onMouseMove = (e: MouseEvent) => {
    // 更新框选区域
    selectionBox.end = screen2Viewport({ x: e.clientX, y: e.clientY });
    managerUpdate(selectionBox);

    // 更新框选内的节点状态
    Object.values(objects).forEach((obj) => {
      if (!obj.type.startsWith("node/")) return;

      const node = obj as Node;
      const inBox = isNodeInBox(node, selectionBox);

      if (extend) {
        // 扩展模式：只在框内时选中，不取消
        if (inBox && !node.selected) {
          node.selected = true;
          managerUpdate(obj);
        }
      } else {
        // 普通模式：根据是否在框内设置选中状态
        if (node.selected !== inBox) {
          node.selected = inBox;
          managerUpdate(obj);
        }
      }
    });
  };

  const onMouseUp = () => {
    managerDeleteId(selectionBox.id);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
};

// ==================== 点击节点 ====================

const handleClickNode = (e: MouseEvent, extend: boolean) => {
  const nodeId = idFromEvent(e, ".node-group");
  if (nodeId) {
    const node = objects[nodeId] as Node;
    if (!node) return;

    if (!extend && !node.selected) {
      clearSelection(false);
    }

    node.selected = !node.selected;
    active(node.id);
  } else if (!extend) {
    // 空白区域点击：清除选中
    clearSelection(true);
  }
};

// ==================== 注册鼠标动作 ====================

registerMouseAction({
  action: "selector.click",
  handler: (e) => handleClickNode(e, false),
  settings: {
    id: "selector.click",
    category: "Selector",
    title: "选择节点",
    type: "mousekey",
    defaultValue: 0,
    value: 0,
    description: "点击节点或空白区域，默认为左键",
  },
});

registerMouseAction({
  action: "selector.clickExtend",
  handler: (e) => handleClickNode(e, true),
  settings: {
    id: "selector.clickExtend",
    category: "Selector",
    title: "扩展选择节点",
    type: "mousekey",
    defaultValue: "S0",
    value: "S0",
    description: "扩展模式下点击节点，默认为 Shift+左键",
  },
});

registerMouseAction({
  action: "selector.boxSelect",
  handler: (e) => { e.preventDefault(); handleBoxSelection(e, false); },
  settings: {
    id: "selector.boxSelect",
    category: "Selector",
    title: "框选",
    type: "mousekey",
    defaultValue: 1,
    value: 1,
    description: "框选区域内的节点，默认为中键",
  },
});

registerMouseAction({
  action: "selector.boxSelectExtend",
  handler: (e) => { e.preventDefault(); handleBoxSelection(e, true); },
  settings: {
    id: "selector.boxSelectExtend",
    category: "Selector",
    title: "扩展框选",
    type: "mousekey",
    defaultValue: "S1",
    value: "S1",
    description: "扩展模式下框选，默认为 Shift+中键",
  },
});

// ==================== 注册键盘导航动作 ====================

registerKeyAction({
  action: "selector.navUp",
  handler: () => navigateToDirection("up", false, false),
  settings: {
    id: "selector.navUp",
    category: "Selector",
    title: "向上导航",
    type: "key",
    defaultValue: "i",
    value: "i",
    description: "向上移动激活节点",
  },
});

registerKeyAction({
  action: "selector.navDown",
  handler: () => navigateToDirection("down", false, false),
  settings: {
    id: "selector.navDown",
    category: "Selector",
    title: "向下导航",
    type: "key",
    defaultValue: "k",
    value: "k",
    description: "向下移动激活节点",
  },
});

registerKeyAction({
  action: "selector.navLeft",
  handler: () => navigateToDirection("left", false, false),
  settings: {
    id: "selector.navLeft",
    category: "Selector",
    title: "向左导航",
    type: "key",
    defaultValue: "j",
    value: "j",
    description: "向左移动激活节点",
  },
});

registerKeyAction({
  action: "selector.navRight",
  handler: () => navigateToDirection("right", false, false),
  settings: {
    id: "selector.navRight",
    category: "Selector",
    title: "向右导航",
    type: "key",
    defaultValue: "l",
    value: "l",
    description: "向右移动激活节点",
  },
});

// 扩展选中版本
registerKeyAction({
  action: "selector.navUpExtend",
  handler: () => navigateToDirection("up", true, false),
  settings: {
    id: "selector.navUpExtend",
    category: "Selector",
    title: "向上导航（扩展）",
    type: "key",
    defaultValue: "Si",
    value: "Si",
    description: "向上移动激活节点并选中",
  },
});

registerKeyAction({
  action: "selector.navDownExtend",
  handler: () => navigateToDirection("down", true, false),
  settings: {
    id: "selector.navDownExtend",
    category: "Selector",
    title: "向下导航（扩展）",
    type: "key",
    defaultValue: "Sk",
    value: "Sk",
    description: "向下移动激活节点并选中",
  },
});

registerKeyAction({
  action: "selector.navLeftExtend",
  handler: () => navigateToDirection("left", true, false),
  settings: {
    id: "selector.navLeftExtend",
    category: "Selector",
    title: "向左导航（扩展）",
    type: "key",
    defaultValue: "Sj",
    value: "Sj",
    description: "向左移动激活节点并选中",
  },
});

registerKeyAction({
  action: "selector.navRightExtend",
  handler: () => navigateToDirection("right", true, false),
  settings: {
    id: "selector.navRightExtend",
    category: "Selector",
    title: "向右导航（扩展）",
    type: "key",
    defaultValue: "Sl",
    value: "Sl",
    description: "向右移动激活节点并选中",
  },
});