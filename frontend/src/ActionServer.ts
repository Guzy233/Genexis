import { atom } from "jotai";
import { Vec2, Obj, subtract } from "./Globals";

export type Action =
  | { type: "POINTER_DOWN"; pos: Vec2; target: Obj; button: number } // 鼠标按下
  | { type: "POINTER_DBCLICK"; pos: Vec2; target: Obj } // 鼠标双击
  | { type: "LINKING_START"; pos: Vec2; target: Obj } // 链接开始
  | { type: "POINTER_MOVE"; dPos: Vec2; pos: Vec2 } // 鼠标移动
  | { type: "POINTER_UP"; pos: Vec2; target: Obj } // 鼠标抬起
  | { type: "PANNING_START"; start: Vec2 } // 平移开始
  | { type: "CREATE_CENTERED"; center: Vec2; target: Obj }
  | { type: "RECONNECT"; target: Obj; side: "s" | "t"; pos: Vec2 }
    | { type: "MOUSE_ENTER_NODE"; node: Obj }
    | { type: "MOUSE_LEAVE_NODE"; node: Obj }
  | { type: "COPY" } // 复制
  | { type: "PASTE" } // 粘贴
  | { type: "DELETE" } // 删除
  | { type: "UNDO" } // 撤销
  | { type: "UP" }
  | { type: "DOWN" }
  | { type: "LEFT" }
  | { type: "RIGHT" }
  | { type: "MOVE_UP" }
  | { type: "MOVE_DOWN" }
  | { type: "MOVE_LEFT" }
  | { type: "MOVE_RIGHT" }
  | { type: "SEL_UP" }
  | { type: "SEL_DOWN" }
  | { type: "SEL_LEFT" }
  | { type: "SEL_RIGHT" }
  | { type: "END_TASK" }
  | { type: "GROW" }
  | { type: "ENTER" }
  | { type: "EXIT" }
  | { type: "RELOAD" }
  | { type: "SELECT_ALL" }
  | { type: "REDO" } // 重做
  | { type: "EXPANDING_SELECTION" }
  | { type: "PANNING_READY" }
  | { type: "UNDO_REACH_LIMIT" }
  | { type: "EDITING_DONE" }
  | { type: "SHOW_ACTIONS" }
  | { type: "RAW_KEYUP"; key: string }
  | { type: "NONE" };

const keyMap: Record<string, Action> = {};

interface KeyAction {
  key: string;
  action: Action;
  description: string;
}

const keyActions: KeyAction[] = [
  { key: "Cc", action: { type: "COPY" }, description: "Copy" },
  { key: "Cv", action: { type: "PASTE" }, description: "Paste" },
  { key: "X", action: { type: "DELETE" }, description: "Delete" },
  { key: "Cz", action: { type: "UNDO" }, description: "Undo" },
  { key: "Delete", action: { type: "DELETE" }, description: "Delete" },
  { key: " ", action: { type: "PANNING_READY" }, description: "CanPan" },
  { key: "w", action: { type: "UP" }, description: "" },
  { key: "s", action: { type: "DOWN" }, description: "" },
  { key: "a", action: { type: "LEFT" }, description: "" },
  { key: "d", action: { type: "RIGHT" }, description: "" },
  { key: "i", action: { type: "SEL_UP" }, description: "" },
  { key: "k", action: { type: "SEL_DOWN" }, description: "" },
  { key: "j", action: { type: "SEL_LEFT" }, description: "" },
  { key: "l", action: { type: "SEL_RIGHT" }, description: "" },
  { key: "Tab", action: { type: "GROW" }, description: "" },
  { key: "ArrowUp", action: { type: "MOVE_UP" }, description: "" },
  { key: "ArrowLeft", action: { type: "MOVE_LEFT" }, description: "" },
  { key: "ArrowDown", action: { type: "MOVE_DOWN" }, description: "" },
  { key: "ArrowRight", action: { type: "MOVE_RIGHT" }, description: "" },
  { key: "F7", action: { type: "SHOW_ACTIONS" }, description: "" },
  { key: "Shift", action: { type: "EXPANDING_SELECTION" }, description: "" },
  { key: "Enter", action: { type: "ENTER" }, description: "" },
  { key: "Ca", action: { type: "SELECT_ALL" }, description: "" },
  { key: "Escape", action: { type: "EXIT" }, description: "" },
  { key: "F5", action: { type: "RELOAD" }, description: "" },
  { key: "Cz", action: { type: "UNDO" }, description: "" },
  { key: "CSZ", action: { type: "REDO" }, description: "" },
  { key: "", action: { type: "NONE" }, description: "" },
  { key: "", action: { type: "NONE" }, description: "" },
  { key: "", action: { type: "NONE" }, description: "" },
];

export function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === "Tab") {
    e.preventDefault();
  }
  if (e.repeat) return;

  const query =
    (e.ctrlKey && e.key !== "Control" ? "C" : "") +
    (e.altKey && e.key !== "Alt" ? "A" : "") +
    (e.shiftKey && e.key !== "Shift" ? "S" : "") +
    e.key;

  const action = keyMap[query];
  if (action) {
    actionBus.despacth(action);
  }
}
export function handleKeyUp(e: KeyboardEvent): void {
  const query =
    (e.ctrlKey ? "C" : "") +
    (e.altKey ? "A" : "") +
    (e.shiftKey ? "S" : "") +
    e.key;
  actionBus.despacth({ type: "RAW_KEYUP", key: query });
}
export function handleKeyPress(e: KeyboardEvent): void {}

export function registerKeyBindings() {
  keyActions.forEach((action) => {
    keyMap[action.key] = action.action;
  });
}

export enum ConsumeType {
  Consume,
  Continue,
  Finish,
  EndEaten,
}

class ActionBus {
  listeners = new Array<(m: Action) => ConsumeType>();

  showActions = false;

  addListener(task: (m: Action) => ConsumeType) {
    this.listeners.push(task);
  }

  despacth(m: Action) {
    if (this.showActions) {
      console.log(m);
    }

    for (let i = this.listeners.length - 1; i >= 0; i--) {
      const task = this.listeners[i];
      const result = task(m);
      switch (result) {
        case ConsumeType.Continue:
          break;
        case ConsumeType.Consume:
          return;
        case ConsumeType.Finish:
          this.listeners.splice(i, 1);
          return;
        case ConsumeType.EndEaten:
          this.listeners.splice(i, 1);
          break;
      }
    }
    baseTask(m);
  }

  clear() {
    for (const task of this.listeners) task({ type: "END_TASK" });
  }
}
export const actionBus = new ActionBus();

function baseTask(m: Action) {
  switch (m.type) {
    case "SHOW_ACTIONS": {
      actionBus.showActions = !actionBus.showActions;
      break;
    }
    case "POINTER_DBCLICK": {
      actionBus.despacth({
        type: "CREATE_CENTERED",
        target: {
          id: "",
          type: "text",
          updater:atom(0),
          // tags: new Set(),
        },
        center: m.pos,
      });

      break;
    }
  }
}

export const viewport = {
  pos: { x: 0, y: 0 },
  zoom: 1,
};

let mousePos = { x: 0, y: 0 };

export const handleMouseMove = (e: MouseEvent): void => {
  const currentPos = { x: e.clientX, y: e.clientY };
  const dPos = subtract(currentPos, mousePos);
  dPos.x = dPos.x / viewport.zoom;
  dPos.y = dPos.y / viewport.zoom;
  mousePos = currentPos;
  actionBus.despacth({ type: "POINTER_MOVE", dPos: dPos, pos: currentPos });
};
