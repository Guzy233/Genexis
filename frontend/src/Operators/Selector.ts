import Manager, { objects } from "../Manager";
import Settings from "../Settings";
import { idFromEvent, Node, Operators } from "../Globals";

export const onClickNode = (e: MouseEvent) => {
  if (e.button !== Settings.Dragging) return;
  const id = idFromEvent(e, ".node-group");
  if (!id) {
    Manager.clearSelected();
    return;
  }

  const node = objects[id] as Node;
  node.selected = true;
  Manager.actived(node.id);
};

Operators.push({
  Begin: () => window.addEventListener("mousedown", onClickNode),
  End: () => window.removeEventListener("mousedown", onClickNode),
});
