import { atom, getDefaultStore, PrimitiveAtom } from "jotai";
import { Obj } from "./Globals";
import {
  serializeCanvas,
  deserializeCanvas,
  SerializedCanvas,
} from "./Serialization";
import { SaveFile, SaveFileDirect, LoadFile } from "../wailsjs/go/main/App";

// ==================== 节点关系类型定义 ====================

/**
 * 节点关系图
 * 存储所有节点之间的连接关系
 */
export interface NodeRelationGraph {
  // 上游（父）节点映射：nodeId -> Set<parentIds>
  upstream: Map<string, Set<string>>;
  // 下游（子）节点映射：nodeId -> Set<childIds>
  downstream: Map<string, Set<string>>;
}

export const objects: Record<string, Obj> = {};
export const store = getDefaultStore();

// 空的更新器，用于触发画布重新渲染
export const canvasUpdater = atom<number>(0);

let state: number = 1;

// 更新整张画布
export const updateCanvas = () => {
  store.set(canvasUpdater, state++);
};

// ==================== 文件标签管理系统 ====================

// 历史记录配置
const MAX_HISTORY = 50;

// 每个文件的历史栈
interface FileHistory {
  history: SerializedCanvas[];
  currentIndex: number;
}

// 打开的文件标签信息
export interface FileTab {
  id: string; // 唯一标识
  filePath: string | null; // 文件路径，null 表示未保存的新文件
  fileName: string; // 显示名称
  objects: Record<string, any>; // 该文件的画布数据
  nodeRelations: NodeRelationGraph; // 该文件的节点关系图
  isModified: boolean; // 是否有未保存的修改
  history: FileHistory; // 该文件的撤销/重做历史
  metadata: Record<string, any>; // 元数据
}

// 打开的标签列表
const openTabs: FileTab[] = [];

// 当前激活的标签（直接存储引用）
let activeTab: FileTab | null = null;

// 标签状态更新器（用于触发 UI 更新）
export const tabsUpdater = atom(0);

// 触发标签更新
const updateTabs = () => {
  const current = store.get(tabsUpdater);
  store.set(tabsUpdater, current + 1);
};

// 生成唯一 ID
const generateTabId = () =>
  `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// ==================== 钩子系统 ====================
type FileHook = (tab: FileTab) => void;
const onFileLoadedHooks = new Set<FileHook>();
const onFileSavedHooks = new Set<FileHook>();
const onBeforeSaveHooks = new Set<FileHook>();
const onTabCreatedHooks = new Set<FileHook>();

export const registerOnFileLoaded = (hook: FileHook) => {
  onFileLoadedHooks.add(hook);
  return () => onFileLoadedHooks.delete(hook);
};

export const registerOnFileSaved = (hook: FileHook) => {
  onFileSavedHooks.add(hook);
  return () => onFileSavedHooks.delete(hook);
};

export const registerOnBeforeSave = (hook: FileHook) => {
  onBeforeSaveHooks.add(hook);
  return () => onBeforeSaveHooks.delete(hook);
};

export const registerOnTabCreated = (hook: FileHook) => {
  onTabCreatedHooks.add(hook);
  return () => onTabCreatedHooks.delete(hook);
};

// 创建新的历史栈
const createNewHistory = (): FileHistory => ({
  history: [],
  currentIndex: -1,
});

// 获取当前激活的标签
export const getActiveTab = () => activeTab;

// 获取所有打开的标签
export const getAllTabs = () => [...openTabs];

// 标记当前文件为已修改
const markAsModified = () => {
  if (activeTab && !activeTab.isModified) {
    activeTab.isModified = true;
    updateTabs();
  }
};

// ==================== 撤销/重做系统 ====================

// 保存当前状态到历史记录
export const saveHistory = (): void => {
  if (!activeTab) return;

  const { history, currentIndex } = activeTab.history;

  // 如果不是在最新位置，删除当前位置之后的所有历史
  if (currentIndex < history.length - 1) {
    history.splice(currentIndex + 1);
  }

  const snapshot = serializeCanvas(objects);
  history.push(snapshot);
  activeTab.history.currentIndex = history.length - 1;

  // 限制历史长度
  if (history.length > MAX_HISTORY) {
    history.shift();
    activeTab.history.currentIndex--;
  }
};

// 从历史恢复状态
const restoreHistory = (tab: FileTab, index: number): boolean => {
  if (index < 0 || index >= tab.history.history.length) return false;

  tab.history.currentIndex = index;

  // 清空当前 objects
  Object.keys(objects).forEach((key) => {
    delete objects[key];
  });

  // 从历史恢复
  deserializeCanvas(tab.history.history[index], objects);

  updateCanvas();
  return true;
};

// 撤销
export const undo = (): boolean => {
  if (!activeTab) return false;

  const result = restoreHistory(activeTab, activeTab.history.currentIndex - 1);
  if (result) {
    markAsModified();
  }
  return result;
};

// 重做
export const redo = (): boolean => {
  if (!activeTab) return false;

  const result = restoreHistory(activeTab, activeTab.history.currentIndex + 1);
  if (result) {
    markAsModified();
  }
  return result;
};

// 是否有撤销历史
export const canUndo = (): boolean => {
  return activeTab ? activeTab.history.currentIndex > 0 : false;
};

// 是否有重做历史
export const canRedo = (): boolean => {
  return activeTab ? activeTab.history.currentIndex < activeTab.history.history.length - 1 : false;
};

// ==================== 标签管理 ====================

// 切换到指定标签
export const switchTab = (tab: FileTab) => {
  // 保存当前标签的 objects 状态
  if (activeTab) {
    activeTab.objects = { ...objects };
  }

  // 切换到目标标签
  activeTab = tab;

  // 恢复目标标签的 objects
  Object.assign(objects, tab.objects);

  // 确保 objects 中的对象正确连接（处理边引用）
  Object.values(objects).forEach((obj: any) => {
    if (obj.type?.startsWith("edge/") && obj.source?.id && obj.target?.id) {
      obj.source = objects[obj.source.id];
      obj.target = objects[obj.target.id];
    }
  });

  updateCanvas();
  updateTabs();
  onFileLoadedHooks.forEach(hook => hook(tab));
  return true;
};

// 按 ID 切换标签（兼容旧接口）
export const switchTabById = (tabId: string) => {
  const targetTab = openTabs.find((tab) => tab.id === tabId);
  if (!targetTab) return false;
  return switchTab(targetTab);
};

// 关闭标签
export const closeTab = async (tab: FileTab) => {
  const tabIndex = openTabs.findIndex((t) => t.id === tab.id);
  if (tabIndex === -1) return false;

  // 检查是否有未保存的修改
  if (tab.isModified) {
    // 如果关闭的不是当前标签，先切换过去
    if (activeTab !== tab) {
      switchTab(tab);
    }

    // 弹出确认对话框
    const message = `文件 "${tab.fileName}" 有未保存的更改。\n\n点击"确定"保存后关闭，点击"取消"放弃更改并关闭。`;
    const result = confirm(message);

    if (result) {
      // 用户选择保存
      const saved = await saveFile(false);
      if (!saved) {
        return false;
      }
    }
  }

  // 移除标签
  openTabs.splice(tabIndex, 1);

  // 如果关闭的是当前标签，切换到其他标签
  if (activeTab === tab) {
    if (openTabs.length > 0) {
      // 切换到相邻标签
      const newIndex = Math.min(tabIndex, openTabs.length - 1);
      switchTab(openTabs[newIndex]);
      updateCanvas();
    } else {
      activeTab = null;
      Object.keys(objects).forEach((key) => {
        delete objects[key];
      });
      createNewTab();
      updateCanvas();
    }
  }

  updateTabs();
  return true;
};

// 按 ID 关闭标签（兼容旧接口）
export const closeTabById = async (tabId: string) => {
  const tab = openTabs.find((t) => t.id === tabId);
  if (!tab) return false;
  return closeTab(tab);
};

// 创建新标签
export const createNewTab = () => {
  const newTab: FileTab = {
    id: generateTabId(),
    filePath: null,
    fileName: "未命名",
    objects: {},
    nodeRelations: {
      upstream: new Map(),
      downstream: new Map(),
    },
    isModified: false,
    history: createNewHistory(),
    metadata: {},
  };
  openTabs.push(newTab);
  activeTab = newTab;

  onTabCreatedHooks.forEach(hook => hook(newTab));

  // 初始化历史：保存空状态
  saveHistory();

  updateTabs();
  return newTab;
};

// ==================== 文件操作 ====================

// 从文件路径提取文件名
export const getFilenameFromPath = (path: string): string => {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || "mindgraph.json";
};

// ==================== 纯文件 I/O 操作 ====================

/**
 * 保存序列化数据到文件
 * @param jsonData JSON 字符串数据
 * @param defaultFilename 默认文件名（用于保存对话框）
 * @param filePath 直接保存的文件路径（如果有）
 * @returns 保存的文件路径，失败返回 null
 */
export const saveDataToFile = async (
  jsonData: string,
  defaultFilename: string = "",
  filePath: string | null = null
): Promise<string | null> => {
  try {
    console.log("开始保存文件...");

    // 如果有文件路径，直接保存
    if (filePath) {
      await SaveFileDirect(jsonData, filePath);
      console.log("文件已保存:", filePath);
      return filePath;
    }

    // 否则弹出保存对话框
    const result = await SaveFile(jsonData, defaultFilename);
    console.log("保存结果:", result);

    if (!result) {
      console.log("保存被取消或失败");
      return null;
    }

    return result;
  } catch (error) {
    console.error("保存文件失败:", error);
    alert("保存文件失败: " + (error as Error).message);
    return null;
  }
};

/**
 * 从文件加载数据
 * @returns 包含路径和内容的对象，失败返回 null
 */
export const loadDataFromFile = async (): Promise<{
  path: string;
  content: string;
} | null> => {
  try {
    console.log("开始加载文件...");

    const result = await LoadFile();
    console.log("加载结果:", result);

    if (!result) {
      console.log("加载被取消");
      return null;
    }

    const { path: filePath, content: fileData } = JSON.parse(result);

    if (!filePath || !fileData) {
      console.log("文件路径或内容为空");
      return null;
    }

    return { path: filePath, content: fileData };
  } catch (error) {
    console.error("加载文件失败:", error);
    alert("加载文件失败: " + (error as Error).message);
    return null;
  }
};

// 保存当前文件
export const saveFile = async (saveAs: boolean = false): Promise<boolean> => {
  if (!activeTab) return false;

  // 保存前触发钩子
  onBeforeSaveHooks.forEach(hook => {
    if (activeTab) hook(activeTab);
  });

  // 序列化画布数据
  const canvasData = serializeCanvas(objects);
  const jsonData = JSON.stringify({
    ...canvasData,
    metadata: activeTab.metadata,
  }, null, 2);

  // 确定保存路径
  const filePath = saveAs || !activeTab.filePath ? null : activeTab.filePath;
  const defaultFilename = activeTab.filePath
    ? getFilenameFromPath(activeTab.filePath)
    : "";

  // 调用 File 模块保存
  const savedPath = await saveDataToFile(jsonData, defaultFilename, filePath);

  if (!savedPath) {
    return false;
  }

  // 更新标签信息
  activeTab.filePath = savedPath;
  activeTab.fileName = getFilenameFromPath(savedPath);
  activeTab.isModified = false;
  updateTabs();

  onFileSavedHooks.forEach(hook => {
    if (activeTab) hook(activeTab);
  });
  return true;
};

// 另存为
export const saveFileAs = async (): Promise<boolean> => {
  return saveFile(true);
};

// 加载文件
export const loadFile = async (): Promise<boolean> => {
  const result = await loadDataFromFile();
  if (!result) return false;

  const { path: filePath, content: fileData } = result;

  // 检查文件是否已经打开
  const existingTab = openTabs.find((tab) => tab.filePath === filePath);
  if (existingTab) {
    switchTab(existingTab);
    return true;
  }

  // 解析 JSON 数据
  const data = JSON.parse(fileData);

  // 清空当前对象
  Object.keys(objects).forEach((key) => {
    delete objects[key];
  });

  // 反序列化画布数据
  deserializeCanvas(data, objects);

  // 重建节点关系图
  const nodeRelations: NodeRelationGraph = {
    upstream: new Map(),
    downstream: new Map(),
  };

  // 遍历所有边，重建关系
  Object.values(objects).forEach((obj) => {
    if (obj.type.startsWith("edge/")) {
      const edge = obj as unknown as { source: { id: string }; target: { id: string } };
      if (edge.source && edge.target) {
        const downstream = nodeRelations.downstream.get(edge.source.id) || new Set<string>();
        downstream.add(edge.target.id);
        nodeRelations.downstream.set(edge.source.id, downstream);

        const upstream = nodeRelations.upstream.get(edge.target.id) || new Set<string>();
        upstream.add(edge.source.id);
        nodeRelations.upstream.set(edge.target.id, upstream);
      }
    }
  });

  // 创建新标签或更新当前标签
  const fileName = getFilenameFromPath(filePath);

  // 如果当前标签是空的（未命名且无内容），则替换它
  if (
    activeTab &&
    !activeTab.filePath &&
    Object.keys(activeTab.objects).length === 0 &&
    activeTab.history.history.length <= 1
  ) {
    activeTab.filePath = filePath;
    activeTab.fileName = fileName;
    activeTab.objects = { ...objects };
    activeTab.nodeRelations = nodeRelations;
    activeTab.metadata = data.metadata || {};
    activeTab.isModified = false;
    // 重置历史
    activeTab.history.history = [];
    activeTab.history.currentIndex = -1;
    saveHistory();
  } else {
    const newTab = createNewTab();
    newTab.filePath = filePath;
    newTab.fileName = fileName;
    newTab.objects = { ...objects };
    newTab.nodeRelations = nodeRelations;
    newTab.metadata = data.metadata || {};
    newTab.isModified = false;
    // 重置历史
    newTab.history.history = [];
    newTab.history.currentIndex = -1;
    saveHistory();
  }

  updateCanvas();
  updateTabs();

  if (activeTab) {
    onFileLoadedHooks.forEach(hook => hook(activeTab!));
  }

  return true;
};

// 检查是否有未保存的更改
export const hasUnsavedChanges = (): boolean => {
  return activeTab ? activeTab.isModified : Object.keys(objects).length > 0;
};

// 新建文件
export const newFile = async (): Promise<boolean> => {
  // 保存当前标签的 objects 快照到标签中
  if (activeTab) {
    activeTab.objects = { ...objects };
  }

  // 清空当前对象
  Object.keys(objects).forEach((key) => {
    delete objects[key];
  });

  // 创建新标签
  createNewTab();

  // 触发画布更新
  updateCanvas();

  return true;
};

// ==================== 导出接口 ====================

export const getCurrentFilePath = () => {
  return activeTab?.filePath || null;
};

// Manager 对象操作方法
export const managerAdd = (obj: Obj) => {
  objects[obj.id] = obj;
  updateCanvas();
  markAsModified();
};

export const managerUpdateId = (id: string) => {
  store.set(objects[id].updater, state++);
  markAsModified();
};

export const managerUpdate = (obj: Obj) => {
  store.set(obj.updater, state++);
  markAsModified();
};

export const managerUpdateAtom = (atom: PrimitiveAtom<number>) => {
  store.set(atom, state++);
};

export const managerDeleteId = (id: string) => {
  delete objects[id];
  updateCanvas();
  markAsModified();
};

export const managerDeleteIdWithEdges = (id: string) => {
  const obj = objects[id];
  if (!obj) return;

  // 如果是节点，找出并删除连接到它的所有边
  if (obj.type.startsWith("node/")) {
    const edgesToDelete: string[] = [];
    Object.values(objects).forEach((other) => {
      if (other.type.startsWith("edge/")) {
        const edge = other as unknown as {
          id: string;
          source: { id: string };
          target: { id: string };
        };
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
  markAsModified();
};

export function clearTabs() {
  openTabs.length = 0;
  activeTab = null;
}
