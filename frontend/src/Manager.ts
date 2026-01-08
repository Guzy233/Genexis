import { atom, getDefaultStore } from "jotai";
import { Obj as Obj } from "./Globals";
import { SerializedCanvas, serializeCanvas, deserializeCanvas } from "./Serialization";

export const objects: Record<string, Obj> = {};
export const store = getDefaultStore();

// 历史记录
const MAX_HISTORY = 50;
const history: SerializedCanvas[] = [];
let currentIndex = -1;

// 空的更新器，用于触发画布重新渲染
export const canvasUpdater = atom<number>(0);

let state: number = 1;

// 更新画布（viewport 变化时调用）
export const updateCanvas = () => {
  store.set(canvasUpdater, state++);
};

// 保存当前状态到历史
export const saveHistory = (): void => {
  // 如果不是在最新位置，删除当前位置之后的所有历史
  if (currentIndex < history.length - 1) {
    history.splice(currentIndex + 1);
  }

  // 保存当前状态
  const snapshot = serializeCanvas(objects);
  history.push(snapshot);
  currentIndex = history.length - 1;

  // 限制历史长度
  if (history.length > MAX_HISTORY) {
    history.shift();
    currentIndex--;
  }
};

// 初始化时保存空状态
saveHistory();

// 从历史恢复状态
const restoreHistory = (index: number): boolean => {
  if (index < 0 || index >= history.length) return false;

  currentIndex = index;

  // 清空当前objects
  Object.keys(objects).forEach((key) => {
    delete objects[key];
  });

  // 从历史恢复
  deserializeCanvas(history[index], objects);

  updateCanvas();
  return true;
};

// 撤销
export const undo = (): boolean => {
  return restoreHistory(currentIndex - 1);
};

// 重做
export const redo = (): boolean => {
  return restoreHistory(currentIndex + 1);
};

// 是否有撤销历史
export const canUndo = (): boolean => {
  return currentIndex > 0;
};

// 是否有重做历史
export const canRedo = (): boolean => {
  return currentIndex < history.length - 1;
};

export default {
  saveHistory,
  add: (obj: Obj) => {
    objects[obj.id] = obj;
    // 不在这里保存历史，由操作完成时显式调用 saveHistory
    updateCanvas();
  },
  updateId: (id: string) => {
    store.set(objects[id].updater, state++);
  },
  update: (obj: Obj) => {
    store.set(obj.updater, state++);
  },
  deleteId: (id: string) => {
    delete objects[id];
    updateCanvas();
  },
  deleteIdWithEdges: (id: string) => {
    const obj = objects[id];
    if (!obj) return;

    // 如果是节点，找出并删除连接到它的所有边
    if (obj.type.startsWith("node/")) {
      const edgesToDelete: string[] = [];
      Object.values(objects).forEach((other) => {
        if (other.type.startsWith("edge/")) {
          const edge = other as unknown as { id: string; source: { id: string }; target: { id: string } };
          if (edge.source.id === id || edge.target.id === id) {
            edgesToDelete.push(edge.id);
          }
        }
      });
      // 先删除所有连接的边
      edgesToDelete.forEach((edgeId) => delete objects[edgeId]);
    }

    // 删除对象本身
    delete objects[id];
    updateCanvas();
  },
  clearSelected: () => {
    Object.values(objects).forEach((obj) => {
      if ("selected" in obj) obj.selected = false;
      store.set(obj.updater, state++);
    });
    updateCanvas();
  },
  undo,
  redo,
  canUndo,
  canRedo,
};