import { registerKeyAction } from "./Keyboard";
import { onSetup } from "../Globals";
import { updateCanvas, getActiveTab, managerUpdate } from "../Manager";
import { objects, saveHistory } from "../Manager";
import { serializeCanvas, deserializeCanvas } from "../Serialization";
import { screen2Viewport } from "./Camera";
import { addEdgeRelation } from "../Algorithm";

// 键盘操作枚举 - 复制粘贴相关
export const ClipboardAction = {
  COPY: "COPY",
  PASTE: "PASTE",
} as const;

export type ClipboardAction = typeof ClipboardAction[keyof typeof ClipboardAction];

// 剪贴板数据
interface ClipboardData {
  version: number;
  objects: any[];
  center: { x: number; y: number }; // 节点的重心
}

// ==================== 鼠标位置追踪 ====================
// 用于粘贴时获取鼠标位置
let lastMousePosition: { x: number; y: number } | null = null;

const updateMousePosition = (e: MouseEvent) => {
  lastMousePosition = { x: e.clientX, y: e.clientY };
};

// ==================== 复制功能 ====================
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

// ==================== 粘贴功能 ====================
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
        managerUpdate(obj);
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
    const activeTab = getActiveTab();
    if (activeTab?.nodeRelations) {
      clipboardData.objects
        .filter((obj) => obj.type.startsWith("edge/"))
        .forEach((edgeData: any) => {
          addEdgeRelation(activeTab.nodeRelations, edgeData.sourceId, edgeData.targetId);
        });
    }

    saveHistory();
    updateCanvas();
    return true;
  } catch (error) {
    console.error("Failed to paste from clipboard:", error);
    return false;
  }
};

// ==================== 向 Keyboard 注册按键动作 ====================
// 这些注册会在模块加载时执行，确保在 Keyboard.onSetup 之前完成

// 注册复制按键
registerKeyAction({
  action: ClipboardAction.COPY,
  handler: () => {
    copyToClipboard().then((success) => {
      if (success) {
        console.log("Copied to clipboard");
      }
    });
  },
  settings: {
    id: "keyboard.copy",
    category: "Keyboard",
    title: "复制",
    type: "key",
    defaultValue: "Cc",
    value: "Cc",
    description: "复制选中的节点",
  },
});

// 注册粘贴按键
registerKeyAction({
  action: ClipboardAction.PASTE,
  handler: () => {
    pasteFromClipboard(lastMousePosition || undefined).then((success) => {
      if (success) {
        console.log("Pasted from clipboard");
      }
    });
  },
  settings: {
    id: "keyboard.paste",
    category: "Keyboard",
    title: "粘贴",
    type: "key",
    defaultValue: "Cv",
    value: "Cv",
    description: "粘贴剪贴板内容",
  },
});

// ==================== 控制器注册 ====================
onSetup((_canvas: SVGGElement) => {
  // 追踪鼠标位置，用于粘贴功能
  window.addEventListener("mousemove", updateMousePosition);

  return () => {
    window.removeEventListener("mousemove", updateMousePosition);
  };
});

// 导出功能供其他模块使用（如右键菜单）
export { copyToClipboard, pasteFromClipboard };
