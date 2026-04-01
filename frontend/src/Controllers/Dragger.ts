import { objects, managerUpdate } from "../Manager";
import { idFromEvent, Node, Vec2 } from "../Globals";
import { viewport } from "./Camera";
import { saveHistory } from "../Manager";
import { registerMouseAction } from "./KeyBinding";

// 拖动节点信息接口
interface DraggedNodeInfo {
  node: Node;
  originPos: Vec2;
  element: SVGElement;
}

const onClickNode = (e: MouseEvent): boolean => {
  const clickedElement = (e.target as SVGElement).closest(
    ".node-group",
  ) as SVGElement;
  if (!clickedElement) return false;
  const id = clickedElement.dataset.id;
  if (!id) return false;

  const clickedNode = objects[id] as Node;
  const originMouse = { x: e.clientX, y: e.clientY };

  // 收集所有需要拖动的节点（点击节点 + 所有选中节点）
  const draggedNodes: DraggedNodeInfo[] = [];

  // 首先添加点击的节点
  draggedNodes.push({
    node: clickedNode,
    originPos: { x: clickedNode.pos.x, y: clickedNode.pos.y },
    element: clickedElement,
  });

  // 收集其他选中的节点
  Object.values(objects).forEach((obj) => {
    if (!obj.type.startsWith("node/")) return;
    const node = obj as Node;
    // 跳过点击的节点（已添加）和未选中的节点
    if (node.id === id || !node.selected) return;

    // 查找对应的 DOM 元素
    const element = document.querySelector(
      `.node-group[data-id="${node.id}"]`,
    ) as SVGElement;
    if (element) {
      draggedNodes.push({
        node: node,
        originPos: { x: node.pos.x, y: node.pos.y },
        element: element,
      });
    }
  });

  // 提取所有拖动的节点用于事件传递
  const draggedNodesArray = draggedNodes.map((info) => info.node);

  const cleanUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", cleanUp);

    // 只恢复点击节点的指针事件
    clickedElement.style.pointerEvents = "auto";

    if (lastNode)
      lastNode.dispatchEvent(
        new CustomEvent("node-drop", { detail: draggedNodesArray }),
      );
  };

  let lastNode: SVGElement | null = null;

  const onMouseMove = (e: MouseEvent) => {
    const deltaX = (e.clientX - originMouse.x) / viewport.zoom;
    const deltaY = (e.clientY - originMouse.y) / viewport.zoom;

    // 移动所有拖动中的节点
    draggedNodes.forEach(({ node, originPos }) => {
      node.pos.x = originPos.x + deltaX;
      node.pos.y = originPos.y + deltaY;
      managerUpdate(node);
    });

    // 只禁用点击节点的指针事件
    if (deltaX * deltaX + deltaY * deltaY > 10)
      clickedElement.style.pointerEvents = "none";

    const target = (e.target as SVGElement).closest(
      ".node-group",
    ) as SVGElement;
    if (target !== lastNode) {
      if (lastNode) {
        lastNode.dispatchEvent(
          new CustomEvent("node-leave", { detail: draggedNodesArray }),
        );
      }
      lastNode = target;
      if (lastNode) {
        lastNode.dispatchEvent(
          new CustomEvent("node-hover", { detail: draggedNodesArray }),
        );
      }
    } else if (target) {
      // 仍然在同一个节点上，持续发送 hover 表示正在其上方移动
      target.dispatchEvent(
        new CustomEvent("node-hover", { detail: draggedNodesArray }),
      );
    }
  };

  const onMouseUp = () => {
    cleanUp();
    // 拖动结束，保存历史（检查任意节点是否移动）
    const hasMoved = draggedNodes.some(
      ({ node, originPos }) =>
        originPos.x !== node.pos.x || originPos.y !== node.pos.y,
    );
    if (hasMoved) saveHistory();
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", cleanUp);
  return false;
};

registerMouseAction({
  action: "dragger.key",
  handler: onClickNode,
  settings: {
    id: "dragger.key",
    category: "Dragger",
    title: "拖动节点",
    type: "mousekey",
    defaultValue: "M0",
    value: "M0",
    description: "鼠标按键拖动节点，默认为左键",
  },
});
