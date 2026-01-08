import Manager, { objects } from "../Manager";
import { idFromEvent, Node, Controllers, Obj, Vec2 } from "../Globals";
import { screen2Viewport } from "./Camera";
import { registerSetting, getSetting } from "../Option";
import { atom } from "jotai";

// 框选框组件接口
interface SelectionBox extends Obj {
  start: Vec2;
  end: Vec2;
}

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

  return (
    nodeLeft < maxX && nodeRight > minX && nodeTop < maxY && nodeBottom > minY
  );
};

export let activedId = "";

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

// 点击处理
const onMouseDown = (e: MouseEvent) => {
  const id = idFromEvent(e, ".node-group");

  // 获取当前设置值
  const extendKey =
    (getSetting("selector.extendKey")?.value as string) || "Shift";
  const boxSelectButton =
    (getSetting("selector.boxSelectButton")?.value as number) || 1;

  // 框选
  if (e.button === boxSelectButton && !id) {
    e.preventDefault();

    // 获取扩展键状态
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

    const extendMode = isExtendSelection;

    const onBlur = () => {
      Manager.deleteId(selectionBox.id);

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
    };

    const onMouseMove = (e: MouseEvent) => {
      // 更新框选区域
      selectionBox.end = screen2Viewport({ x: e.clientX, y: e.clientY });
      Manager.update(selectionBox);

      // 动态更新框选内的节点状态
      Object.values(objects).forEach((obj) => {
        if (!obj.type.startsWith("node/")) return;

        const node = obj as Node;
        const inBox = isNodeInBox(node, selectionBox);

        if (extendMode) {
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
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", onBlur);
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
  activedId = "";
  Manager.updateId(id);
};

// 清除选择（供外部调用）
export const clearAllSelection = () => clearSelection(true);

// 注册设置项
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

Controllers.push({
  Begin: (canvas: SVGGElement) => canvas.addEventListener("mousedown", onMouseDown),
  End: (canvas: SVGGElement) => canvas.removeEventListener("mousedown", onMouseDown),
});
