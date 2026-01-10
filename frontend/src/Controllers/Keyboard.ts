import { Controllers } from "../Globals";
import { registerSetting, getSetting } from "../Option";
import Manager, { updateCanvas } from "../Manager";
import { objects, saveHistory, undo, redo, mgrAddEdgeRelation } from "../Manager";
import { serializeCanvas, deserializeCanvas, SerializedCanvas } from "../Serialization";
import { screen2Viewport } from "./Camera";

// 键盘操作枚举
export const KeyAction = {
  COPY: "COPY",
  PASTE: "PASTE",
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
} as const;

export type KeyAction = typeof KeyAction[keyof typeof KeyAction];

// ==================== 鼠标位置追踪 ====================
// 用于粘贴时获取鼠标位置
let lastMousePosition: { x: number; y: number } | null = null;

const updateMousePosition = (e: MouseEvent) => {
  lastMousePosition = { x: e.clientX, y: e.clientY };
};

// ==================== 按键映射 ====================
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
  // e.preventDefault();
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

// 剪贴板数据
interface ClipboardData {
  version: number;
  objects: any[];
  center: { x: number; y: number }; // 节点的重心
}

// 复制到剪贴板
const copyToClipboard = async (): Promise<boolean> => {
  // 找出所有选中的节点
  const objs = Object.values(objects);
  const selectedNodes = objs.filter(
    (obj) => obj.type.startsWith("node/") && (obj as any).selected
  );

  if (selectedNodes.length === 0) return false;

  const selectedNodeIds = new Set(selectedNodes.map((obj) => obj.id));

  // 找出所有内部连接的边（两个端点都在选中节点中）
  const internalEdges = objs.filter((obj) => {
    if (!obj.type.startsWith("edge/")) return false;
    const edge = obj as any;
    return selectedNodeIds.has(edge.source?.id) && selectedNodeIds.has(edge.target?.id);
  });

  // 计算选中节点的重心
  let centerX = 0, centerY = 0;
  selectedNodes.forEach((node: any) => {
    centerX += node.pos.x + node.size.x / 2;
    centerY += node.pos.y + node.size.y / 2;
  });
  centerX /= selectedNodes.length;
  centerY /= selectedNodes.length;

  // 序列化数据
  const serializer = serializeCanvas({
    ...Object.fromEntries(selectedNodes.map((n) => [n.id, n])),
    ...Object.fromEntries(internalEdges.map((e) => [e.id, e])),
  });

  // 准备剪贴板数据
  const clipboardData: ClipboardData = {
    version: serializer.version,
    objects: serializer.objects,
    center: { x: centerX, y: centerY },
  };

  try {
    // 写入系统剪贴板
    await navigator.clipboard.writeText(JSON.stringify(clipboardData));
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
};

// 从剪贴板粘贴
const pasteFromClipboard = async (mousePos?: { x: number; y: number }): Promise<boolean> => {
  try {
    // 从系统剪贴板读取
    const clipboardText = await navigator.clipboard.readText();
    const clipboardData: ClipboardData = JSON.parse(clipboardText);

    if (!clipboardData.objects || clipboardData.objects.length === 0) {
      return false;
    }

    // 清除所有选中状态
    Object.values(objects).forEach((obj) => {
      if ("selected" in obj) {
        (obj as any).selected = false;
        Manager.update(obj);
      }
    });

    // 计算粘贴位置（如果有鼠标位置则使用鼠标位置，否则使用原重心位置）
    let targetX = clipboardData.center.x;
    let targetY = clipboardData.center.y;

    if (mousePos) {
      const viewportPos = screen2Viewport(mousePos);
      targetX = viewportPos.x;
      targetY = viewportPos.y;
    }

    // 计算偏移量
    const offsetX = targetX - clipboardData.center.x;
    const offsetY = targetY - clipboardData.center.y;

    // 先为所有节点生成新的 ID 并修改位置
    const idMap = new Map<string, string>(); // 旧 ID -> 新 ID 映射
    clipboardData.objects
      .filter((obj) => obj.type.startsWith("node/"))
      .forEach((nodeData: any) => {
        const newId = crypto.randomUUID();
        idMap.set(nodeData.id, newId);
        nodeData.id = newId;
        nodeData.pos.x += offsetX;
        nodeData.pos.y += offsetY;
        nodeData.selected = true;
      });

    // 为所有边生成新的 ID 和更新 sourceId/targetId
    clipboardData.objects
      .filter((obj) => obj.type.startsWith("edge/"))
      .forEach((edgeData: any) => {
        edgeData.id = crypto.randomUUID();
        const newSourceId = idMap.get(edgeData.sourceId);
        const newTargetId = idMap.get(edgeData.targetId);
        if (newSourceId && newTargetId) {
          edgeData.sourceId = newSourceId;
          edgeData.targetId = newTargetId;
        }
      });

    // 使用 deserializeCanvas 来处理依赖关系
    deserializeCanvas(clipboardData, objects);

    // 记录节点关系
    clipboardData.objects
      .filter((obj) => obj.type.startsWith("edge/"))
      .forEach((edgeData: any) => {
        mgrAddEdgeRelation(edgeData.sourceId, edgeData.targetId);
      });

    saveHistory();
    updateCanvas();
    return true;
  } catch (error) {
    console.error("Failed to paste from clipboard:", error);
    return false;
  }
};

const executeAction = (action: KeyAction): void => {
  switch (action) {
    case KeyAction.COPY:
      copyToClipboard().then((success) => {
        if (success) {
          console.log("Copied to clipboard");
        }
      });
      break;
    case KeyAction.PASTE:
      pasteFromClipboard(lastMousePosition || undefined).then((success) => {
        if (success) {
          console.log("Pasted from clipboard");
        }
      });
      break;
    case KeyAction.DELETE: {
      // 删除选中的节点及其连接的边
      const objs = Object.values(objects);
      // 找出选中的对象ID
      const selectedIds = objs
        .filter((obj) => "selected" in obj && (obj as { selected?: boolean }).selected)
        .map((obj) => obj.id);

      if (selectedIds.length === 0) return;

      // 使用 deleteIdWithEdges 删除（会自动处理连接的边）
      selectedIds.forEach((id) => Manager.deleteIdWithEdges(id));
      // 删除完成，保存历史
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
    case KeyAction.EDIT_NODE: {
      // 进入激活节点的编辑模式
      const activedId = (globalThis as { activedId?: string }).activedId;
      if (activedId) {
        setTimeout(() => {
          const nodeGroup = document.querySelector(`[data-id="${activedId}"]`);
          if (nodeGroup) {
            // 查找 node-group 下的 g 元素（EditableText 的容器）
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
    { id: "keyboard.editNode", action: KeyAction.EDIT_NODE },
    { id: "keyboard.exit", action: KeyAction.EXIT },
    { id: "keyboard.save", action: KeyAction.SAVE },
    { id: "keyboard.saveAs", action: KeyAction.SAVE_AS },
    { id: "keyboard.load", action: KeyAction.LOAD },
    { id: "keyboard.newFile", action: KeyAction.NEW_FILE },
  ];

  categories.forEach(({ id, action }) => {
    const setting = getSetting(id);
    if (setting) {
      updateBinding(action, setting.value);
    }
  });
};

// 按照操作器模式注册
Controllers.push({
  Begin: (canvas: SVGGElement) => {
    initDefaultBindings();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("keypress", onKeyPress);
    // 追踪鼠标位置，用于粘贴功能
    window.addEventListener("mousemove", updateMousePosition);
  },
  End: (canvas: SVGGElement) => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("keypress", onKeyPress);
    window.removeEventListener("mousemove", updateMousePosition);
  },
});