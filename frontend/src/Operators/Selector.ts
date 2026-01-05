import Manager, { objects } from "../Manager";
import { idFromEvent, Node, Operators, Obj, Vec2 } from "../Globals";
import { registerSetting } from "../Option";
import { atom } from "jotai";

// 选择系统状态
let activedId: string = "";
let extendKey: string = "Shift";

// 框选状态
interface SelectionBox extends Obj {
  start: Vec2;
  end: Vec2;
}

let selectionBox: SelectionBox | null = null;
let isBoxSelecting = false;
let isExtendSelection = false; // 框选时是否扩展选择

// 注册设置项
registerSetting({
  id: "selector.extendKey",
  category: "Selector",
  title: "扩展选中键",
  type: "key",
  defaultValue: "Shift",
  value: "Shift",
  description: "按下此键时选择节点会保留当前选中状态",
  onChange: (v) => { extendKey = v; },
});

registerSetting({
  id: "selector.boxSelectButton",
  category: "Selector",
  title: "框选触发键",
  type: "number",
  defaultValue: 1,
  value: 1,
  description: "1=左键, 2=中键, 0/2=右键(取决于系统)",
  onChange: (v) => { boxSelectButton = v; },
});

let boxSelectButton: number = 1; // 中键

// 检查按键是否按下
const isKeyPressed = (key: string, e: MouseEvent): boolean => {
  if (key === "Shift") return e.shiftKey;
  if (key === "Control") return e.ctrlKey;
  if (key === "Alt") return e.altKey;
  return false;
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

  return nodeLeft < maxX && nodeRight > minX && nodeTop < maxY && nodeBottom > minY;
};

// 点击处理：选择和激活
const onMouseDown = (e: MouseEvent) => {
  const id = idFromEvent(e, ".node-group");

  // 框选
  if (e.button === boxSelectButton && !id) {
    e.preventDefault();
    isBoxSelecting = true;

    // 保存扩展键状态
    isExtendSelection = isKeyPressed(extendKey, e);

    // 非扩展模式下清除选择
    if (!isExtendSelection) {
      clearSelection(true);
    }

    selectionBox = {
      id: "selection-box",
      type: "ui/selectionBox",
      updater: atom(0),
      start: { x: e.clientX, y: e.clientY },
      end: { x: e.clientX, y: e.clientY },
    };
    Manager.add(selectionBox);
    return;
  }

  if (!id) {
    clearSelection(true);
    return;
  }

  const node = objects[id] as Node;

  // 检查扩展键是否按下
  const isExtend = isKeyPressed(extendKey, e);

  if (!isExtend) {
    // 不按扩展键：清除其他选择，只保留当前
    clearSelection(false);
  }
  // 否则保留当前选择

  // 切换当前节点的选中状态
  node.selected = !node.selected;

  // 设置为激活状态
  activedId = id;
  Manager.updateId(id);
};

const onMouseMove = (e: MouseEvent) => {
  if (!isBoxSelecting || !selectionBox) return;

  // 更新框选区域
  selectionBox.end = { x: e.clientX, y: e.clientY };
  Manager.update(selectionBox);

  // 动态更新框选内的节点状态
  Object.values(objects).forEach((obj) => {
    if (!obj.type.startsWith("node/")) return;

    const node = obj as Node;
    const inBox = isNodeInBox(node, selectionBox!);

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

const onMouseUp = (_e: MouseEvent) => {
  if (!isBoxSelecting || !selectionBox) return;

  isBoxSelecting = false;

  // 清除框选框
  Manager.deleteId(selectionBox.id);
  selectionBox = null;
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

// 获取当前激活的节点ID
export const getActivedId = () => activedId;

// 检查节点是否被激活
export const isActived = (id: string) => activedId === id;

// 清除选择
export const clearAllSelection = () => clearSelection(true);

Operators.push({
  Begin: () => {
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  },
  End: () => {
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  },
});
