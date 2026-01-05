import Manager from "../Manager";
import { idFromEvent, Operators } from "../Globals";

let editingElement = "";

export const setEditing = (id: string) => {
  editingElement = id;
  Manager.updateId(id);

  // 临时注册点击监听器，闭包内捕获当前 id
  const onMouseDown = (e: MouseEvent) => {
    const clickedId = idFromEvent(e, ".node-group");
    if (clickedId !== id) {
      // 清除编辑状态并移除自己
      editingElement = "";
      Manager.updateId(id);
      window.removeEventListener("mousedown", onMouseDown, true);
    }
  };
  window.addEventListener("mousedown", onMouseDown, true);
};

export const isEditing = (id: string) => editingElement === id;

const onDblClick = (e: MouseEvent) => {
  const id = idFromEvent(e, ".node-group");
  if (id) {
    setEditing(id);
  }
};

Operators.push({
  Begin: () => window.addEventListener("dblclick", onDblClick),
  End: () => window.removeEventListener("dblclick", onDblClick),
});
