import { onSetup } from "../Globals";
import { registerSetting, getSetting, SettingItem } from "../Option";
import { objects, saveHistory, undo, redo, managerDeleteIdWithEdges, managerUpdate } from "../Manager";
import { active } from "./Selector";

// 键盘操作枚举
export const KeyAction = {
  DELETE: "DELETE",
  UNDO: "UNDO",
  REDO: "REDO",
  SELECT_ALL: "SELECT_ALL",
  SHOW_ACTIONS: "SHOW_ACTIONS",
  EDIT_NODE: "EDIT_NODE",
  EXIT: "EXIT",
  SAVE: "SAVE",
  SAVE_AS: "SAVE_AS",
  LOAD: "LOAD",
  NEW_FILE: "NEW_FILE",
  OPEN_ITEM_LIST: "OPEN_ITEM_LIST",
} as const;

export type KeyAction = typeof KeyAction[keyof typeof KeyAction];

// ==================== 按键动作注册系统 ====================
// 允许其他控制器向 Keyboard 注册按键动作

type KeyActionHandler = () => void;

interface KeyActionRegistration {
  action: string;
  handler: KeyActionHandler;
  settings: Omit<SettingItem, "onChange">;
}

// 注册的按键动作
const registeredActions: Map<string, KeyActionRegistration> = new Map();

// 注册按键动作的接口（供其他控制器使用）
export function registerKeyAction(registration: KeyActionRegistration): void {
  registeredActions.set(registration.action, registration);

  // 向 Option 系统转发注册设置项
  registerSetting({
    ...registration.settings,
    onChange: (v) => updateBinding(registration.action as KeyAction, v),
  });
}

// ==================== 按键映射 ====================
// 动态按键映射
const keyMap = new Map<string, string>();

// 按键查询字符串到动作的映射
const actionToKey = new Map<string, string>();

/**
 * 根据按键查询字符串查找对应的操作
 */
function findAction(query: string): string | undefined {
  return keyMap.get(query);
}

/**
 * 根据操作获取当前绑定的按键
 */
export function getBinding(action: string): string | undefined {
  return actionToKey.get(action);
}

/**
 * 更新按键绑定
 */
function updateBinding(action: string, key: string): void {
  // 移除旧的绑定
  const oldKey = actionToKey.get(action);
  if (oldKey) {
    keyMap.delete(oldKey);
  }

  // 设置新的绑定
  keyMap.set(key, action);
  actionToKey.set(action, key);
}

// ==================== 内置动作处理器 ====================

const executeAction = (action: string): void => {
  // 首先检查是否是注册的外部动作
  const registered = registeredActions.get(action);
  if (registered) {
    registered.handler();
    return;
  }

  // 处理内置动作
  switch (action) {
    case KeyAction.DELETE: {
      active("");
      const objs = Object.values(objects);
      const selectedIds = objs
        .filter(
          (obj) => "selected" in obj && (obj as { selected?: boolean }).selected
        )
        .map((obj) => obj.id);

      if (selectedIds.length === 0) return;

      selectedIds.forEach((id) => managerDeleteIdWithEdges(id));
      saveHistory();
      break;
    }
    case KeyAction.UNDO:
      undo();
      break;
    case KeyAction.REDO:
      redo();
      break;
    case KeyAction.SELECT_ALL: {
      const objs = Object.values(objects);
      objs.forEach((obj) => {
        if (obj.type.startsWith("node/")) {
          (obj as { selected?: boolean }).selected = true;
          managerUpdate(obj);
        }
      });
      break;
    }
    case KeyAction.SHOW_ACTIONS:
      // 切换显示设置面板（由外部处理）
      break;
    case KeyAction.EDIT_NODE: {
      const activedId = (globalThis as { activedId?: string }).activedId;
      if (activedId) {
        setTimeout(() => {
          const nodeGroup = document.querySelector(`[data-id="${activedId}"]`);
          if (nodeGroup) {
            const editableTextContainer = nodeGroup.querySelector("g");
            if (editableTextContainer) {
              const dblClickEvent = new MouseEvent("dblclick", {
                bubbles: true,
                cancelable: true,
                view: window,
              });
              editableTextContainer.dispatchEvent(dblClickEvent);
            }
          }
        }, 0);
      }
      break;
    }
    case KeyAction.EXIT:
      console.log("Exit");
      break;
    case KeyAction.SAVE:
      import("../Manager").then(({ saveFile }) => {
        saveFile();
      });
      break;
    case KeyAction.SAVE_AS:
      import("../Manager").then(({ saveFileAs }) => {
        saveFileAs();
      });
      break;
    case KeyAction.LOAD:
      import("../Manager").then(({ loadFile }) => {
        loadFile();
      });
      break;
    case KeyAction.NEW_FILE:
      import("../Manager").then(({ newFile }) => {
        newFile();
      });
      break;
    case KeyAction.OPEN_ITEM_LIST:
      // 打开物品列表面板（由外部处理）
      break;
  }
};

// ==================== 键盘事件处理 ====================

const onKeyDown = (e: KeyboardEvent): void => {
  if (e.repeat) return;

  const query =
    (e.ctrlKey && e.key !== "Control" ? "C" : "") +
    (e.altKey && e.key !== "Alt" ? "A" : "") +
    (e.shiftKey && e.key !== "Shift" ? "S" : "") +
    e.key;

  const action = findAction(query);
  if (action) {
    executeAction(action);
  }
};

const onKeyUp = (_e: KeyboardEvent): void => {
  // 预留：处理按键释放
};

const onKeyPress = (_e: KeyboardEvent): void => {
  // 预留
};

// ==================== 内置设置项定义 ====================

const builtinSettings: Array<{ id: string; action: string }> = [
  { id: "keyboard.delete", action: KeyAction.DELETE },
  { id: "keyboard.undo", action: KeyAction.UNDO },
  { id: "keyboard.redo", action: KeyAction.REDO },
  { id: "keyboard.selectAll", action: KeyAction.SELECT_ALL },
  { id: "keyboard.showActions", action: KeyAction.SHOW_ACTIONS },
  { id: "keyboard.editNode", action: KeyAction.EDIT_NODE },
  { id: "keyboard.exit", action: KeyAction.EXIT },
  { id: "keyboard.save", action: KeyAction.SAVE },
  { id: "keyboard.saveAs", action: KeyAction.SAVE_AS },
  { id: "keyboard.load", action: KeyAction.LOAD },
  { id: "keyboard.newFile", action: KeyAction.NEW_FILE },
];

// 注册内置设置项
registerSetting({
  id: "keyboard.delete",
  category: "Keyboard",
  title: "删除",
  type: "key",
  defaultValue: "Delete",
  value: "Delete",
  description: "删除选中的节点",
  onChange: (v) => updateBinding(KeyAction.DELETE, v),
});

registerSetting({
  id: "keyboard.undo",
  category: "Keyboard",
  title: "撤销",
  type: "key",
  defaultValue: "Cz",
  value: "Cz",
  description: "撤销上一步操作",
  onChange: (v) => updateBinding(KeyAction.UNDO, v),
});

registerSetting({
  id: "keyboard.redo",
  category: "Keyboard",
  title: "重做",
  type: "key",
  defaultValue: "CSZ",
  value: "CSZ",
  description: "重做被撤销的操作",
  onChange: (v) => updateBinding(KeyAction.REDO, v),
});

registerSetting({
  id: "keyboard.selectAll",
  category: "Keyboard",
  title: "全选",
  type: "key",
  defaultValue: "Ca",
  value: "Ca",
  description: "选中所有节点",
  onChange: (v) => updateBinding(KeyAction.SELECT_ALL, v),
});

registerSetting({
  id: "keyboard.showActions",
  category: "Keyboard",
  title: "显示操作日志",
  type: "key",
  defaultValue: "F7",
  value: "F7",
  description: "在控制台显示操作日志",
  onChange: (v) => updateBinding(KeyAction.SHOW_ACTIONS, v),
});

registerSetting({
  id: "keyboard.editNode",
  category: "Keyboard",
  title: "编辑节点",
  type: "key",
  defaultValue: "Enter",
  value: "Enter",
  description: "进入当前激活节点的编辑模式",
  onChange: (v) => updateBinding(KeyAction.EDIT_NODE, v),
});

registerSetting({
  id: "keyboard.exit",
  category: "Keyboard",
  title: "退出",
  type: "key",
  defaultValue: "Escape",
  value: "Escape",
  description: "退出当前状态",
  onChange: (v) => updateBinding(KeyAction.EXIT, v),
});

registerSetting({
  id: "keyboard.save",
  category: "Keyboard",
  title: "保存",
  type: "key",
  defaultValue: "Cs",
  value: "Cs",
  description: "保存当前文件",
  onChange: (v) => updateBinding(KeyAction.SAVE, v),
});

registerSetting({
  id: "keyboard.saveAs",
  category: "Keyboard",
  title: "另存为",
  type: "key",
  defaultValue: "CSs",
  value: "CSs",
  description: "另存为新文件",
  onChange: (v) => updateBinding(KeyAction.SAVE_AS, v),
});

registerSetting({
  id: "keyboard.load",
  category: "Keyboard",
  title: "打开",
  type: "key",
  defaultValue: "Co",
  value: "Co",
  description: "打开文件",
  onChange: (v) => updateBinding(KeyAction.LOAD, v),
});

registerSetting({
  id: "keyboard.newFile",
  category: "Keyboard",
  title: "新建",
  type: "key",
  defaultValue: "Cn",
  value: "Cn",
  description: "新建文件",
  onChange: (v) => updateBinding(KeyAction.NEW_FILE, v),
});

registerSetting({
  id: "keyboard.openItemList",
  category: "Keyboard",
  title: "物品列表",
  type: "key",
  defaultValue: "Ce",
  value: "Ce",
  description: "打开物品列表面板",
  onChange: (v) => updateBinding(KeyAction.OPEN_ITEM_LIST, v),
});

// 初始化默认绑定
const initDefaultBindings = () => {
  const allSettings = [
    ...builtinSettings,
    // 外部注册的动作也会通过 registerKeyAction 自动添加设置项
    ...Array.from(registeredActions.entries()).map(([action, _]) => ({
      id: registeredActions.get(action)!.settings.id,
      action,
    })),
  ];

  allSettings.forEach(({ id, action }) => {
    const setting = getSetting(id);
    if (setting) {
      updateBinding(action, setting.value);
    }
  });
};

// 按照操作器模式注册
onSetup((_canvas: SVGGElement) => {
  initDefaultBindings();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("keypress", onKeyPress);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("keypress", onKeyPress);
  };
});
