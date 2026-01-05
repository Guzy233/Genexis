import Manager, { objects } from "../Manager";
import Settings from "../Settings";
import { idFromEvent, Node, Operators } from "../Globals";

export const onClickNode = (e: MouseEvent) => {
  if (e.button !== Settings.Dragging) return;
  const id = idFromEvent(e, ".node-group");
  if (!id) return;

  const node = objects[id] as Node;
  const onMouseMove = (e: MouseEvent) => {
    node.pos.x += e.movementX;
    node.pos.y += e.movementY;
    Manager.update(node);
  };

  const onMouseUp = (e: MouseEvent) => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};

Operators.push({
  Begin: () => window.addEventListener("mousedown", onClickNode),
  End: () => window.removeEventListener("mousedown", onClickNode),
});
