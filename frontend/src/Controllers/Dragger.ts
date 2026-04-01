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

const startDrag = (e: MouseEvent, extend: boolean): boolean => {
  const clickedElement = (e.target as SVGElement).closest(
    ".node-group",
  ) as SVGElement;
  if (!clickedElement) return false;
  const id = clickedElement.dataset.id;
  if (!id) return false;

  const clickedNode = objects[id] as Node;
  const originMouse = { x: e.clientX, y: e.clientY };

  const draggedNodes: DraggedNodeInfo[] = [];

  draggedNodes.push({
    node: clickedNode,
    originPos: { x: clickedNode.pos.x, y: clickedNode.pos.y },
    element: clickedElement,
  });

  // 扩展模式或当前节点已选中时：同时拖动所有选中的节点
  if (extend || clickedNode.selected) {
    Object.values(objects).forEach((obj) => {
      if (!obj.type.startsWith("node/")) return;
      const node = obj as Node;
      if (node.id === id || !node.selected) return;

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
  }

  const draggedNodesArray = draggedNodes.map((info) => info.node);

  const cleanUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", cleanUp);

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

    draggedNodes.forEach(({ node, originPos }) => {
      node.pos.x = originPos.x + deltaX;
      node.pos.y = originPos.y + deltaY;
      managerUpdate(node);
    });

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
      target.dispatchEvent(
        new CustomEvent("node-hover", { detail: draggedNodesArray }),
      );
    }
  };

  const onMouseUp = () => {
    cleanUp();
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
  handler: (e) => startDrag(e, false),
  settings: {
    id: "dragger.key",
    category: "Dragger",
    title: "拖动节点",
    type: "mousekey",
    defaultValue: "M0",
    value: "M0",
    description: "拖动单个节点，默认为左键",
  },
});

registerMouseAction({
  action: "dragger.extendKey",
  handler: (e) => startDrag(e, true),
  settings: {
    id: "dragger.extendKey",
    category: "Dragger",
    title: "扩展拖动节点",
    type: "mousekey",
    defaultValue: "SM0",
    value: "SM0",
    description: "拖动当前节点及所有选中节点，默认为 Shift+左键",
  },
});
