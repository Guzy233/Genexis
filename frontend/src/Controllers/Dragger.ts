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

  nodeElement.style.pointerEvents = "none"

  const node = objects[id] as Node;
  let lastX = e.clientX;
  let lastY = e.clientY;

  const originPos = { x: node.pos.x, y: node.pos.y };

  const cleanUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", cleanUp);

    nodeElement.style.pointerEvents = "auto"
  }

  const onMouseMove = (e: MouseEvent) => {
    const target = (e.target as SVGElement).closest(".node-group") as SVGElement
    if (target) {
      target.dispatchEvent(new CustomEvent("node-hover", { detail: node }));
    }

    const deltaX = (e.clientX - lastX) / viewport.zoom;
    const deltaY = (e.clientY - lastY) / viewport.zoom;
    lastX = e.clientX;
    lastY = e.clientY;
    node.pos.x += deltaX;
    node.pos.y += deltaY;
    managerUpdate(node);
  };

  const onMouseUp = () => {
    cleanUp()
    // 拖动结束，保存历史
    if (originPos !== node.pos) saveHistory();
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", cleanUp);
};

onSetup((canvas: SVGSVGElement) => {
  canvas.addEventListener("mousedown", onClickNode);
  return () => canvas.removeEventListener("mousedown", onClickNode);
});
