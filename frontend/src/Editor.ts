import Manager, { objects } from "./Manager";
import { idFromEvent, Operators } from "./Globals";

let editingElement = "";

export const setEditing = (id: string) => {
  editingElement = id;
};

export const isEditing = (id: string) => editingElement === id;

export const clearEditing = () => {
  editingElement = "";
};

const onDblClick = (e: MouseEvent) => {
  const id = idFromEvent(e, ".node-group");
  if (id) {
    editingElement = id
    Manager.updateId(id)
  }
};

Operators.push({
  Begin: () => window.addEventListener("dblclick", onDblClick),
  End: () => window.removeEventListener("dblclick", onDblClick),
});