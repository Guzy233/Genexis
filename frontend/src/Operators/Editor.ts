import Manager, { objects } from "../Manager";
import { idFromEvent, Operators } from "../Globals";

let editingElement = "";

// 用于触发 React 更新的 updater
const editorUpdater = { current: 0 };

export const setEditing = (id: string) => {
  editingElement = id;
  editorUpdater.current++;
  Manager.updateId(id);
};

export const isEditing = (id: string) => editingElement === id;

export const clearEditing = () => {
  if (editingElement) {
    const lastId = editingElement;
    editingElement = "";
    editorUpdater.current++;
    Manager.updateId(lastId);
  }
};

const onDblClick = (e: MouseEvent) => {
  const id = idFromEvent(e, ".node-group");
  if (id) {
    setEditing(id);
  }
};

const onMouseDown = (e: MouseEvent) => {
  // 如果当前没有编辑中的元素，直接返回
  if (!editingElement) return;

  // 检查点击的是否是当前编辑的元素
  const clickedId = idFromEvent(e, ".node-group");

  // 如果点击的不是编辑中的节点，清除编辑状态
  if (clickedId !== editingElement) {
    clearEditing();
  }
};

Operators.push({
  Begin: () => {
    window.addEventListener("dblclick", onDblClick);
    window.addEventListener("mousedown", onMouseDown);
  },
  End: () => {
    window.removeEventListener("dblclick", onDblClick);
    window.removeEventListener("mousedown", onMouseDown);
  },
});
