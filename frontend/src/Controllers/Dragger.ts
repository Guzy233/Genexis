import Manager, { objects } from "../Manager";
import { idFromEvent, Node, Controllers } from "../Globals";
import { viewport } from "./Camera";
import { registerSetting } from "../Option";
import { saveHistory } from "../Manager";

let draggingKey: number = 0;

registerSetting({
  id: "dragger.key",
  category: "Dragger",
  title: "拖动节点",
  type: "number",
  defaultValue: 0,
  value: 0,
  // description?: "string",
  onChange: (v) => (draggingKey = v), // 值变化时通知注册者
});

export const onClickNode = (e: MouseEvent) => {
  if (e.button !== draggingKey) return;
  const id = idFromEvent(e, ".node-group");
  if (!id) return;

  const node = objects[id] as Node;
  let lastX = e.clientX;
  let lastY = e.clientY;

  const originPos = {x:node.pos.x,y:node.pos.y};

  const onBlur = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);
  };

  const onMouseMove = (e: MouseEvent) => {
    const deltaX = (e.clientX - lastX) / viewport.zoom;
    const deltaY = (e.clientY - lastY) / viewport.zoom;
    lastX = e.clientX;
    lastY = e.clientY;
    node.pos.x += deltaX;
    node.pos.y += deltaY;
    Manager.update(node);
  };

  const onMouseUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);
    // 拖动结束，保存历史
    if (originPos !== node.pos) saveHistory();
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
};

Controllers.push({
  Begin: (canvas: SVGGElement) => canvas.addEventListener("mousedown", onClickNode),
  End: (canvas: SVGGElement) => canvas.removeEventListener("mousedown", onClickNode),
});
