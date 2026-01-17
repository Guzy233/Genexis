import { onSetup } from "../Globals";
import { registerSetting, getSetting, SettingItem } from "../Option";
import { objects, saveHistory, undo, redo, managerDeleteIdWithEdges, managerUpdate } from "../Manager";
import { active } from "./Selector";

// 动作 ID 类型
export type ActionId = string;

// ==================== 按键动作注册系统 ====================
// 允许其他控制器向 Keyboard 注册按键动作

type KeyActionHandler = () => void;

interface KeyActionRegistration {
  action: string;
  handler: KeyActionHandler;
  settings: Omit<SettingItem, "onChange">;
}

// 注册的按键动作处理器：actionId -> handler
const actionHandlers: Map<string, KeyActionHandler> = new Map();

// 注册按键动作的接口（供其他控制器使用）
export function registerKeyAction(registration: KeyActionRegistration): void {
  actionHandlers.set(registration.action, registration.handler);

  // 向 Option 系统转发注册设置项
  registerSetting({
    ...registration.settings,
    onChange: (v) => updateBinding(registration.action, v),
  });

  // 立即初始化按键映射，确保外部注册的按键也能生效
  updateBinding(registration.action, registration.settings.value);
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

const executeAction = (actionId: string): void => {
  const handler = actionHandlers.get(actionId);
  if (handler) {
    handler();
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

// ==================== 内置动作处理器注册 ====================

const registerBuiltinActions = () => {
  actionHandlers.set("keyboard.delete", () => {
    active("");
    const objs = Object.values(objects);
    const selectedIds = objs
      .filter((obj) => "selected" in obj && (obj as { selected?: boolean }).selected)
      .map((obj) => obj.id);

    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) => managerDeleteIdWithEdges(id));
    saveHistory();
  });

  actionHandlers.set("keyboard.undo", () => undo());
  actionHandlers.set("keyboard.redo", () => redo());

  actionHandlers.set("keyboard.selectAll", () => {
    const objs = Object.values(objects);
    objs.forEach((obj) => {
      if (obj.type.startsWith("node/")) {
        (obj as { selected?: boolean }).selected = true;
        managerUpdate(obj);
      }
    });
  });

  actionHandlers.set("keyboard.editNode", () => {
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
  });

  actionHandlers.set("keyboard.exit", () => console.log("Exit"));

  actionHandlers.set("keyboard.save", () => {
    import("../Manager").then(({ saveFile }) => saveFile());
  });

  actionHandlers.set("keyboard.saveAs", () => {
    import("../Manager").then(({ saveFileAs }) => saveFileAs());
  });

  actionHandlers.set("keyboard.load", () => {
    import("../Manager").then(({ loadFile }) => loadFile());
  });

  actionHandlers.set("keyboard.newFile", () => {
    import("../Manager").then(({ newFile }) => newFile());
  });
};

const builtinActionIds = [
  "keyboard.delete",
  "keyboard.undo",
  "keyboard.redo",
  "keyboard.selectAll",
  "keyboard.showActions",
  "keyboard.editNode",
  "keyboard.exit",
  "keyboard.save",
  "keyboard.saveAs",
  "keyboard.load",
  "keyboard.newFile",
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
  onChange: (v) => updateBinding("keyboard.delete", v),
});

registerSetting({
  id: "keyboard.undo",
  category: "Keyboard",
  title: "撤销",
  type: "key",
  defaultValue: "Cz",
  value: "Cz",
  description: "撤销上一步操作",
  onChange: (v) => updateBinding("keyboard.undo", v),
});

registerSetting({
  id: "keyboard.redo",
  category: "Keyboard",
  title: "重做",
  type: "key",
  defaultValue: "CSZ",
  value: "CSZ",
  description: "重做被撤销的操作",
  onChange: (v) => updateBinding("keyboard.redo", v),
});

registerSetting({
  id: "keyboard.selectAll",
  category: "Keyboard",
  title: "全选",
  type: "key",
  defaultValue: "Ca",
  value: "Ca",
  description: "选中所有节点",
  onChange: (v) => updateBinding("keyboard.selectAll", v),
});

registerSetting({
  id: "keyboard.showActions",
  category: "Keyboard",
  title: "显示操作日志",
  type: "key",
  defaultValue: "F7",
  value: "F7",
  description: "在控制台显示操作日志",
  onChange: (v) => updateBinding("keyboard.showActions", v),
});

registerSetting({
  id: "keyboard.editNode",
  category: "Keyboard",
  title: "编辑节点",
  type: "key",
  defaultValue: "Enter",
  value: "Enter",
  description: "进入当前激活节点的编辑模式",
  onChange: (v) => updateBinding("keyboard.editNode", v),
});

registerSetting({
  id: "keyboard.exit",
  category: "Keyboard",
  title: "退出",
  type: "key",
  defaultValue: "Escape",
  value: "Escape",
  description: "退出当前状态",
  onChange: (v) => updateBinding("keyboard.exit", v),
});

registerSetting({
  id: "keyboard.save",
  category: "Keyboard",
  title: "保存",
  type: "key",
  defaultValue: "Cs",
  value: "Cs",
  description: "保存当前文件",
  onChange: (v) => updateBinding("keyboard.save", v),
});

registerSetting({
  id: "keyboard.saveAs",
  category: "Keyboard",
  title: "另存为",
  type: "key",
  defaultValue: "CSs",
  value: "CSs",
  description: "另存为新文件",
  onChange: (v) => updateBinding("keyboard.saveAs", v),
});

registerSetting({
  id: "keyboard.load",
  category: "Keyboard",
  title: "打开",
  type: "key",
  defaultValue: "Co",
  value: "Co",
  description: "打开文件",
  onChange: (v) => updateBinding("keyboard.load", v),
});

registerSetting({
  id: "keyboard.newFile",
  category: "Keyboard",
  title: "新建",
  type: "key",
  defaultValue: "Cn",
  value: "Cn",
  description: "新建文件",
  onChange: (v) => updateBinding("keyboard.newFile", v),
});

// 初始化默认绑定
const initDefaultBindings = () => {
  const allActionIds = [
    ...builtinActionIds,
    ...Array.from(actionHandlers.keys()),
  ];

  allActionIds.forEach((actionId) => {
    const setting = getSetting(actionId);
    if (setting) {
      updateBinding(actionId, setting.value);
    }
  });
};

// 按照操作器模式注册
onSetup((_canvas: SVGGElement) => {
  registerBuiltinActions();
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
