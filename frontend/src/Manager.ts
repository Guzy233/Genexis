import { Atom, atom, getDefaultStore, PrimitiveAtom, useAtom } from "jotai";
import { Obj as Obj } from "./Globals";

export const idsAtom = atom<string[]>([]);

export const objects: Record<string, Obj> = {};
export const store = getDefaultStore();

let state: number = 0;

export let actived: string = "";

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
  actived: (id: string) => {
    const last = actived;
    if (last) store.set(objects[last].updater, state++);
    actived = id;
    store.set(objects[id].updater, state++);
  },
  clearSelected: () => {
    // const last = actived;
    // if (last) store.set(objects[last].updater, state++);
    actived = "";
    Object.values(objects).forEach((obj) => {
      if("selected" in obj) obj.selected = false;
      store.set(obj.updater, state++);
    })
  }
};
