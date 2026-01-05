import { atom, getDefaultStore } from "jotai";
import { Obj as Obj } from "./Globals";

export const objects: Record<string, Obj> = {};
export const store = getDefaultStore();

// 空的更新器，用于触发画布重新渲染
export const canvasUpdater = atom<number>(0);

let state: number = 0;

// 更新画布（viewport 变化时调用）
export const updateCanvas = () => {
  store.set(canvasUpdater, state++);
};

export default {
  add: (obj: Obj) => {
    objects[obj.id] = obj;
    updateCanvas();
  },
  updateId: (id: string) => {
    store.set(objects[id].updater, state++);
    updateCanvas();
  },
  update: (obj: Obj) => {
    store.set(obj.updater, state++);
    updateCanvas();
  },
  deleteId: (id: string) => {
    delete objects[id];
    updateCanvas();
  },
  clearSelected: () => {
    // 此方法已废弃，请使用 Selector.clearSelection()
    Object.values(objects).forEach((obj) => {
      if("selected" in obj) obj.selected = false;
      store.set(obj.updater, state++);
    })
    updateCanvas();
  }
};
