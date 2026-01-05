import { Operators, Obj } from "../Globals";
import { registerSetting, setValue, getSetting } from "../Option";
import Manager from "../Manager";
import { objects } from "../Manager";

// 键盘操作枚举
export const KeyAction = {
  COPY: "COPY",
  PASTE: "PASTE",
  DELETE: "DELETE",
  UNDO: "UNDO",
  REDO: "REDO",
  SELECT_ALL: "SELECT_ALL",
  SHOW_ACTIONS: "SHOW_ACTIONS",
  EXIT: "EXIT",
} as const;

export type KeyAction = typeof KeyAction[keyof typeof KeyAction];

// 动态按键映射
const keyMap = new Map<string, KeyAction>();

// 按键查询字符串到 KeyAction 的映射
const actionToKey = new Map<KeyAction, string>();

/**
 * 根据按键查询字符串查找对应的操作
 */
function findAction(query: string): KeyAction | undefined {
  return keyMap.get(query);
}

/**
 * 根据操作获取当前绑定的按键
 */
export function getBinding(action: KeyAction): string | undefined {
  return actionToKey.get(action);
}

/**
 * 更新按键绑定
 */
function updateBinding(action: KeyAction, key: string): void {
  // 移除旧的绑定
  const oldKey = actionToKey.get(action);
  if (oldKey) {
    keyMap.delete(oldKey);
  }

  // 设置新的绑定
  keyMap.set(key, action);
  actionToKey.set(action, key);
}

// 键盘事件处理
const onKeyDown = (e: KeyboardEvent): void => {
  e.preventDefault();
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

const executeAction = (action: KeyAction): void => {
  switch (action) {
    case KeyAction.COPY:
      console.log("Copy");
      break;
    case KeyAction.PASTE:
      console.log("Paste");
      break;
    case KeyAction.DELETE: {
      // 删除选中的节点及其连接的边
      const objs = Object.values(objects);
      // 找出选中的节点ID
      const selectedNodeIds = new Set<string>();
      objs.forEach((obj) => {
        if (obj.type.startsWith("node/") && "selected" in obj && (obj as { selected?: boolean }).selected) {
          selectedNodeIds.add(obj.id);
        }
      });

      if (selectedNodeIds.size === 0) return;

      // 找出连接到选中节点的边
      const edgesToDelete: string[] = [];
      objs.forEach((obj) => {
        if (obj.type.startsWith("edge/")) {
          const edge = obj as unknown as { id: string; source: { id: string }; target: { id: string } };
          if (selectedNodeIds.has(edge.source.id) || selectedNodeIds.has(edge.target.id)) {
            edgesToDelete.push(edge.id);
          }
        }
      });

      // 删除边
      edgesToDelete.forEach((id) => Manager.deleteId(id));
      // 删除节点
      selectedNodeIds.forEach((id) => Manager.deleteId(id));
      break;
    }
    case KeyAction.UNDO:
      console.log("Undo");
      break;
    case KeyAction.REDO:
      console.log("Redo");
      break;
    case KeyAction.SELECT_ALL: {
      // 选中所有节点
      const objs = Object.values(objects);
      objs.forEach((obj) => {
        if (obj.type.startsWith("node/")) {
          (obj as { selected?: boolean }).selected = true;
          Manager.update(obj);
        }
      });
      break;
    }
    case KeyAction.SHOW_ACTIONS:
      // 切换显示设置面板（由外部处理）
      break;
    case KeyAction.EXIT:
      console.log("Exit");
      break;
  }
};

const onKeyUp = (_e: KeyboardEvent): void => {
  // 预留：处理按键释放
};

const onKeyPress = (_e: KeyboardEvent): void => {
  // 预留
};

// 注册键盘相关设置项
registerSetting({
  id: "keyboard.copy",
  category: "Keyboard",
  title: "复制",
  type: "key",
  defaultValue: "Cc",
  value: "Cc",
  description: "复制选中的节点",
  onChange: (v) => updateBinding(KeyAction.COPY, v),
});

registerSetting({
  id: "keyboard.paste",
  category: "Keyboard",
  title: "粘贴",
  type: "key",
  defaultValue: "Cv",
  value: "Cv",
  description: "粘贴剪贴板内容",
  onChange: (v) => updateBinding(KeyAction.PASTE, v),
});

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
  id: "keyboard.exit",
  category: "Keyboard",
  title: "退出",
  type: "key",
  defaultValue: "Escape",
  value: "Escape",
  description: "退出当前状态",
  onChange: (v) => updateBinding(KeyAction.EXIT, v),
});

// 初始化默认绑定
const initDefaultBindings = () => {
  const categories = [
    { id: "keyboard.copy", action: KeyAction.COPY },
    { id: "keyboard.paste", action: KeyAction.PASTE },
    { id: "keyboard.delete", action: KeyAction.DELETE },
    { id: "keyboard.undo", action: KeyAction.UNDO },
    { id: "keyboard.redo", action: KeyAction.REDO },
    { id: "keyboard.selectAll", action: KeyAction.SELECT_ALL },
    { id: "keyboard.showActions", action: KeyAction.SHOW_ACTIONS },
    { id: "keyboard.exit", action: KeyAction.EXIT },
  ];

  categories.forEach(({ id, action }) => {
    const setting = getSetting(id);
    if (setting) {
      updateBinding(action, setting.value);
    }
  });
};

// 按照操作器模式注册
Operators.push({
  Begin: () => {
    initDefaultBindings();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("keypress", onKeyPress);
  },
  End: () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("keypress", onKeyPress);
  },
});