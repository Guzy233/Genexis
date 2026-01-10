import { atom, getDefaultStore } from "jotai";
import { Obj as Obj } from "./Globals";
import {
  serializeCanvas,
  deserializeCanvas,
  SerializedCanvas,
} from "./Serialization";
import { SaveFile, SaveFileDirect, LoadFile } from "../wailsjs/go/main/App";
import {
  NodeRelationGraph,
  createRelationGraph,
  addEdgeRelation,
  removeEdgeRelation,
  clearNodeRelations,
  updateRelationsFromEdge,
  calculateChildPosition,
  serializeRelationGraph,
  deserializeRelationGraph,
  rebuildRelationGraph,
} from "./Algorithm";

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
}

// 打开的标签列表
const openTabs: FileTab[] = [];

// 当前激活的标签 ID
let activeTabId: string | null = null;

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

// 创建新的历史栈
const createNewHistory = (): FileHistory => ({
  history: [],
  currentIndex: -1,
});

// 获取当前激活的标签
export const getActiveTab = () => {
  return openTabs.find((tab) => tab.id === activeTabId) || null;
};

// 获取所有打开的标签
export const getAllTabs = () => [...openTabs];

// 设置当前标签的修改状态
export const setTabModified = (modified: boolean) => {
  const currentTab = getActiveTab();
  if (currentTab && currentTab.isModified !== modified) {
    currentTab.isModified = modified;
    updateTabs();
  }
};

// 标记当前文件为已修改
const markAsModified = () => {
  setTabModified(true);
};

// ==================== 撤销/重做系统 ====================

// 保存当前状态到历史记录
export const saveHistory = (): void => {
  const activeTab = getActiveTab();
  if (!activeTab) return;

  const { history, currentIndex } = activeTab.history;

  // 如果不是在最新位置，删除当前位置之后的所有历史
  if (currentIndex < history.length - 1) {
    history.splice(currentIndex + 1);
  }

  // 保存当前状态
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
  const activeTab = getActiveTab();
  if (!activeTab) return false;

  const result = restoreHistory(activeTab, activeTab.history.currentIndex - 1);
  if (result) {
    setTabModified(true);
  }
  return result;
};

// 重做
export const redo = (): boolean => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;

  const result = restoreHistory(activeTab, activeTab.history.currentIndex + 1);
  if (result) {
    setTabModified(true);
  }
  return result;
};

// 是否有撤销历史
export const canUndo = (): boolean => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;
  return activeTab.history.currentIndex > 0;
};

// 是否有重做历史
export const canRedo = (): boolean => {
  const activeTab = getActiveTab();
  if (!activeTab) return false;
  return activeTab.history.currentIndex < activeTab.history.history.length - 1;
};

// ==================== 标签管理 ====================

// 切换到指定标签
export const switchTab = (tabId: string) => {
  const targetTab = openTabs.find((tab) => tab.id === tabId);
  if (!targetTab) return false;

  // 保存当前标签的 objects 和 nodeRelations 状态
  const currentTab = getActiveTab();
  if (currentTab) {
    currentTab.objects = { ...objects };
    // nodeRelations 已经是引用，不需要额外保存
  }

  // 切换到目标标签
  activeTabId = tabId;

  // 清空当前 objects
  Object.keys(objects).forEach((key) => {
    delete objects[key];
  });

  // 恢复目标标签的 objects
  Object.assign(objects, targetTab.objects);

  // 确保 objects 中的对象正确连接（处理边引用）
  Object.values(objects).forEach((obj: any) => {
    if (obj.type?.startsWith("edge/") && obj.source?.id && obj.target?.id) {
      obj.source = objects[obj.source.id];
      obj.target = objects[obj.target.id];
    }
  });

  updateCanvas();
  updateTabs();
  return true;
};

// 关闭标签
export const closeTab = async (tabId: string) => {
  const tabIndex = openTabs.findIndex((tab) => tab.id === tabId);
  if (tabIndex === -1) return false;

  const tab = openTabs[tabIndex];

  // 检查是否有未保存的修改
  if (tab.isModified) {
    // 如果关闭的是当前标签，需要先切换过去以保存数据
    const wasActive = tabId === activeTabId;
    if (wasActive) {
      // 保存当前标签的 objects 快照
      tab.objects = { ...objects };
    } else {
      // 切换到该标签以便保存
      switchTab(tabId);
    }

    // 弹出确认对话框
    const message = `文件 "${tab.fileName}" 有未保存的更改。\n\n点击"确定"保存后关闭，点击"取消"放弃更改并关闭。`;
    const result = confirm(message);

    if (result) {
      // 用户选择保存
      const saved = await saveFile(false);
      if (!saved) {
        // 保存失败或取消，不关闭标签
        if (!wasActive) {
          // 恢复原来的激活标签
          const currentActive = getActiveTab();
          if (currentActive && currentActive.id !== tabId) {
            switchTab(currentActive.id);
          }
        }
        return false;
      }
    }
    // 用户点击取消，放弃更改，继续关闭
  }

  // 移除标签
  openTabs.splice(tabIndex, 1);

  // 如果关闭的是当前标签，切换到其他标签
  if (tabId === activeTabId) {
    if (openTabs.length > 0) {
      // 切换到相邻标签
      const newIndex = Math.min(tabIndex, openTabs.length - 1);
      switchTab(openTabs[newIndex].id);
      updateCanvas();
    } else {
      activeTabId = null;
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

// 创建新标签
export const createNewTab = () => {
  const newTab: FileTab = {
    id: generateTabId(),
    filePath: null,
    fileName: "未命名",
    objects: {},
    nodeRelations: createRelationGraph(),
    isModified: false,
    history: createNewHistory(),
  };
  openTabs.push(newTab);
  activeTabId = newTab.id;

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
  const activeTab = getActiveTab();
  if (!activeTab) return false;

  // 序列化画布数据
  const serializedData = serializeCanvas(objects);
  const jsonData = JSON.stringify(serializedData, null, 2);

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
  setTabModified(false);
  updateTabs();

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
    switchTab(existingTab.id);
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
  const nodeRelations = rebuildRelationGraph(objects);

  // 创建新标签或更新当前标签
  const fileName = getFilenameFromPath(filePath);

  // 如果当前标签是空的（未命名且无内容），则替换它
  const activeTab = getActiveTab();
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
    setTabModified(false);
    // 重置历史
    activeTab.history.history = [];
    activeTab.history.currentIndex = -1;
    saveHistory();
  } else {
    // 创建新标签
    const newTab = createNewTab();
    newTab.filePath = filePath;
    newTab.fileName = fileName;
    newTab.objects = { ...objects };
    newTab.nodeRelations = nodeRelations;
    setTabModified(false);
    // 重置历史
    newTab.history.history = [];
    newTab.history.currentIndex = -1;
    saveHistory();
  }

  updateCanvas();
  updateTabs();

  return true;
};

// 检查是否有未保存的更改
export const hasUnsavedChanges = (): boolean => {
  const activeTab = getActiveTab();
  return activeTab ? activeTab.isModified : Object.keys(objects).length > 0;
};

// 新建文件
export const newFile = async (): Promise<boolean> => {
  // 保存当前标签的 objects 快照到标签中
  const activeTab = getActiveTab();
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
  const activeTab = getActiveTab();
  return activeTab?.filePath || null;
};

// ==================== 节点关系管理（转发函数） ====================

/**
 * 获取当前标签的关系图
 */
const getCurrentRelationGraph = (): NodeRelationGraph | null => {
  const activeTab = getActiveTab();
  return activeTab?.nodeRelations || null;
};

/**
 * 添加边的关系记录
 */
export const mgrAddEdgeRelation = (
  sourceId: string,
  targetId: string
): void => {
  const graph = getCurrentRelationGraph();
  if (graph) {
    addEdgeRelation(graph, sourceId, targetId);
  }
};

/**
 * 移除边的关系记录
 */
export const mgrRemoveEdgeRelation = (
  sourceId: string,
  targetId: string
): void => {
  const graph = getCurrentRelationGraph();
  if (graph) {
    removeEdgeRelation(graph, sourceId, targetId);
  }
};

/**
 * 清除节点的关系记录
 */
export const mgrClearNodeRelations = (nodeId: string): void => {
  const graph = getCurrentRelationGraph();
  if (graph) {
    clearNodeRelations(graph, nodeId);
  }
};

/**
 * 根据边更新节点关系
 */
export const mgrUpdateRelationsFromEdge = (edgeId: string): void => {
  const graph = getCurrentRelationGraph();
  if (graph) {
    updateRelationsFromEdge(graph, objects, edgeId);
  }
};

/**
 * 计算子节点位置
 */
export const mgrCalculateChildPosition = (
  parentId: string | null,
  defaultPos: { x: number; y: number }
): { x: number; y: number } => {
  const graph = getCurrentRelationGraph();
  if (graph) {
    return calculateChildPosition(graph, objects, parentId, defaultPos);
  }
  return defaultPos;
};

// Manager 默认导出
export default {
  add: (obj: Obj) => {
    objects[obj.id] = obj;
    updateCanvas();
    markAsModified();
  },
  updateId: (id: string) => {
    store.set(objects[id].updater, state++);
    markAsModified();
  },
  update: (obj: Obj) => {
    store.set(obj.updater, state++);
    markAsModified();
  },
  deleteId: (id: string) => {
    delete objects[id];
    updateCanvas();
    markAsModified();
  },
  deleteIdWithEdges: (id: string) => {
    const obj = objects[id];
    if (!obj) return;

    // 如果是节点，清理关系记录
    if (obj.type.startsWith("node/")) {
      mgrClearNodeRelations(id);
    }

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
  },
};

export function clearTabs() {
  openTabs.length = 0;
  activeTabId = null;
}
