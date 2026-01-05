import Manager, { objects } from "../Manager";
import Settings from "../Settings";
import { idFromEvent, Node, Operators } from "../Globals";

export const onClickNode = (e: MouseEvent) => {
  if (e.button !== Settings.Dragging) return;
  const id = idFromEvent(e, ".node-group");
  if (!id) return;

  const node = objects[id] as Node;

  const onBlur = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);
  };

  const onMouseMove = (e: MouseEvent) => {
    node.pos.x += e.movementX;
    node.pos.y += e.movementY;
    Manager.update(node);
  };

  const onMouseUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
};

Operators.push({
  Begin: () => window.addEventListener("mousedown", onClickNode),
  End: () => window.removeEventListener("mousedown", onClickNode),
});
