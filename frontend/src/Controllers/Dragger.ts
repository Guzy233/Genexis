import { objects, managerUpdate } from "../Manager";
import { idFromEvent, Node, onSetup } from "../Globals";
import { viewport } from "./Camera";
import { registerSetting } from "../Option";
import { saveHistory } from "../Manager";

let draggingKey: number = 0;

registerSetting({
  id: "dragger.key",
  category: "Dragger",
  title: "拖动节点",
  type: "mousekey",
  defaultValue: 0,
  value: 0,
  description: "鼠标按键拖动节点，默认为左键",
  onChange: (v) => (draggingKey = v), // 值变化时通知注册者
});

export const onClickNode = (e: MouseEvent) => {
  if (e.button !== draggingKey) return;

  const nodeElement = (e.target as SVGElement).closest(".node-group") as SVGElement
  if (!nodeElement) return
  const id = nodeElement.dataset.id;
  if (!id) return

  const node = objects[id] as Node;
  const originPos = { x: node.pos.x, y: node.pos.y };
  const originMouse = { x: e.clientX, y: e.clientY };

  const cleanUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", cleanUp);

    nodeElement.style.pointerEvents = "auto"

    if (lastNode) lastNode.dispatchEvent(new CustomEvent("node-drop", { detail: node }))
  }

  let lastNode: SVGElement | null = null

  const onMouseMove = (e: MouseEvent) => {
    const deltaX = (e.clientX - originMouse.x) / viewport.zoom;
    const deltaY = (e.clientY - originMouse.y) / viewport.zoom;

    node.pos.x = originPos.x + deltaX;
    node.pos.y = originPos.y + deltaY;

    if (deltaX || deltaY)
      nodeElement.style.pointerEvents = "none"

    const target = (e.target as SVGElement).closest(".node-group") as SVGElement
    if (target !== lastNode) {
      if (lastNode) {
        lastNode.dispatchEvent(new CustomEvent("node-leave", { detail: node }));
      }
      lastNode = target;
      if (lastNode) {
        lastNode.dispatchEvent(new CustomEvent("node-hover", { detail: node }));
      }
    } else if (target) {
      // 仍然在同一个节点上，持续发送 hover 表示正在其上方移动
      target.dispatchEvent(new CustomEvent("node-hover", { detail: node }));
    }

    managerUpdate(node);
  };

  const onMouseUp = () => {
    cleanUp()
    // 拖动结束，保存历史
    if (originPos.x !== node.pos.x || originPos.y !== node.pos.y) saveHistory();
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", cleanUp);
};

onSetup((canvas: SVGSVGElement) => {
  canvas.addEventListener("mousedown", onClickNode);
  return () => canvas.removeEventListener("mousedown", onClickNode);
});
