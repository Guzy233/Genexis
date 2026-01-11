import Manager, { objects } from "../Manager";
import { idFromEvent, Node, Controllers, Obj, Vec2 } from "../Globals";
import { screen2Viewport } from "./Camera";
import { registerSetting, getSetting } from "../Option";
import { atom } from "jotai";

// ==================== 键盘导航配置 ====================

type NavigationDirection = "up" | "down" | "left" | "right";

interface KeyboardNavConfig {
  up: string;
  down: string;
  left: string;
  right: string;
}

const defaultNavKeys: KeyboardNavConfig = {
  up: "i",
  down: "k",
  left: "j",
  right: "l",
};

let navKeys: KeyboardNavConfig = { ...defaultNavKeys };

// 从按键配置获取方向（忽略大小写）
const getDirectionFromKey = (key: string): NavigationDirection | null => {
  const lowerKey = key.toLowerCase();
  if (lowerKey === navKeys.up) return "up";
  if (lowerKey === navKeys.down) return "down";
  if (lowerKey === navKeys.left) return "left";
  if (lowerKey === navKeys.right) return "right";
  return null;
};

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
  if (last) Manager.updateId(last);
  if (activedId) Manager.updateId(activedId);
}

// ==================== 键盘导航逻辑 ====================

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

    // 空间搜索算法：基于方向过滤并计算加权距离
    // 权重系数 3.0 用于惩罚非主方向上的偏移，使跳跃更倾向于直线
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

// 键盘导航事件处理
const handleKeyboardNavigation = (e: KeyboardEvent) => {
  const direction = getDirectionFromKey(e.key);
  if (!direction) return;

  // 如果没有激活节点，尝试激活第一个节点
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

  // 根据修饰键处理选中状态
  if (e.shiftKey) {
    // Shift: 切换为选中状态
    if (!nearestNode.selected) {
      nearestNode.selected = true;
      Manager.update(nearestNode);
    }
  } else if (e.ctrlKey) {
    // Ctrl: 切换为未选中状态
    if (nearestNode.selected) {
      nearestNode.selected = false;
      Manager.update(nearestNode);
    }
  }
  // 注意：不处理按方向键时已经激活的节点
};

// ==================== 鼠标选择逻辑 ====================

// 获取设置值的辅助函数
const getSettings = () => ({
  extendKey: (getSetting("selector.extendKey")?.value as string) || "Shift",
  boxSelectButton:
    (getSetting("selector.boxSelectButton")?.value as number) || 1,
});

// 检查按键是否按下
const isKeyPressed = (key: string, e: MouseEvent): boolean => {
  if (key === "Shift") return e.shiftKey;
  if (key === "Control") return e.ctrlKey;
  if (key === "Alt") return e.altKey;
  return false;
};

// 清除所有选中状态
const clearSelection = (includeActived: boolean) => {
  Object.values(objects).forEach((obj) => {
    if ("selected" in obj) {
      obj.selected = false;
      Manager.update(obj);
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

const handleBoxSelection = (e: MouseEvent) => {
  const { extendKey } = getSettings();
  const isExtendSelection = isKeyPressed(extendKey, e);

  // 非扩展模式下清除选择
  if (!isExtendSelection) {
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
  Manager.add(selectionBox);

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
    Manager.update(selectionBox);

    // 更新框选内的节点状态
    Object.values(objects).forEach((obj) => {
      if (!obj.type.startsWith("node/")) return;

      const node = obj as Node;
      const inBox = isNodeInBox(node, selectionBox);
      const wasSelected = initialSelection.get(node.id) || false;

      if (isExtendSelection) {
        // 扩展模式：只在框内时选中，不取消
        if (inBox && !node.selected) {
          node.selected = true;
          Manager.update(obj);
        }
      } else {
        // 普通模式：根据是否在框内设置选中状态
        if (node.selected !== inBox) {
          node.selected = inBox;
          Manager.update(obj);
        }
      }
    });
  };

  const onMouseUp = () => {
    Manager.deleteId(selectionBox.id);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
};

// ==================== 节点选择逻辑 ====================

const handleNodeSelection = (e: MouseEvent, nodeId: string) => {
  const { extendKey } = getSettings();
  const node = objects[nodeId] as Node;
  if (!node) return;

  const isExtend = isKeyPressed(extendKey, e);

  if (!isExtend) {
    // 不按扩展键：清除其他选择，只保留当前
    clearSelection(false);
  }

  // 切换当前节点的选中状态
  node.selected = !node.selected;

  // 设置为激活状态
  active(node.id);
};

// ==================== 空白区域点击逻辑 ====================

const handleBlankAreaClick = () => {
  clearSelection(true);
};

// ==================== 主事件处理 ====================

const onMouseDown = (e: MouseEvent) => {
  const { boxSelectButton } = getSettings();
  const nodeId = idFromEvent(e, ".node-group");

  // 框选：指定鼠标按键 + 点击空白处
  if (e.button === boxSelectButton && !nodeId) {
    e.preventDefault();
    handleBoxSelection(e);
    return;
  }

  // 点击节点
  if (nodeId) {
    handleNodeSelection(e, nodeId);
    return;
  }

  // 点击空白区域（非框选键）
  handleBlankAreaClick();
};

// ==================== 注册设置项 ====================

registerSetting({
  id: "selector.extendKey",
  category: "Selector",
  title: "扩展选中键",
  type: "key",
  defaultValue: "Shift",
  value: "Shift",
  description: "按下此键时选择节点会保留当前选中状态",
});

registerSetting({
  id: "selector.boxSelectButton",
  category: "Selector",
  title: "框选触发键",
  type: "number",
  defaultValue: 1,
  value: 1,
  description: "1=左键, 2=中键, 0/2=右键(取决于系统)",
});

// 注册键盘导航设置
registerSetting({
  id: "selector.navUp",
  category: "Selector",
  title: "向上导航",
  type: "key",
  defaultValue: "i",
  value: "i",
  description: "向上移动激活节点",
  onChange: (v) => {
    navKeys.up = v;
  },
});

registerSetting({
  id: "selector.navDown",
  category: "Selector",
  title: "向下导航",
  type: "key",
  defaultValue: "k",
  value: "k",
  description: "向下移动激活节点",
  onChange: (v) => {
    navKeys.down = v;
  },
});

registerSetting({
  id: "selector.navLeft",
  category: "Selector",
  title: "向左导航",
  type: "key",
  defaultValue: "j",
  value: "j",
  description: "向左移动激活节点",
  onChange: (v) => {
    navKeys.left = v;
  },
});

registerSetting({
  id: "selector.navRight",
  category: "Selector",
  title: "向右导航",
  type: "key",
  defaultValue: "l",
  value: "l",
  description: "向右移动激活节点",
  onChange: (v) => {
    navKeys.right = v;
  },
});

// ==================== 注册控制器 ====================

Controllers.push({
  Begin: (canvas: SVGGElement) => {
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", handleKeyboardNavigation);
  },
  End: (canvas: SVGGElement) => {
    canvas.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("keydown", handleKeyboardNavigation);
  },
});
