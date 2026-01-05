import { Atom, atom, getDefaultStore, PrimitiveAtom, useAtom } from "jotai";
import { Obj as Obj } from "./Globals";

export const idsAtom = atom<string[]>([]);

export const objects: Record<string, Obj> = {};
export const store = getDefaultStore();

let state: number = 0;

export default {
  add: (obj: Obj) => {
    objects[obj.id] = obj;
    store.set(idsAtom, (ids) => [...ids, obj.id]);
  },
  updateId: (id: string) => {
    store.set(objects[id].updater, state++);
  },
  update: (obj: Obj) => {
    store.set(obj.updater, state++);
  },
  deleteId: (id: string) => {
    store.set(idsAtom, (ids) => ids.filter((i) => i !== id));
    delete objects[id];
  },
  clearSelected: () => {
    // 此方法已废弃，请使用 Selector.clearSelection()
    Object.values(objects).forEach((obj) => {
      if("selected" in obj) obj.selected = false;
      store.set(obj.updater, state++);
    })
  }
};
