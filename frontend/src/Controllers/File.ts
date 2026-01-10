import { objects, updateCanvas, store } from "../Manager";
import { serializeCanvas, deserializeCanvas } from "../Serialization";
import { SaveFile, LoadFile } from "../../wailsjs/go/main/App";
import { Controllers } from "../Globals";
import { atom } from "jotai";

// 打开的文件标签信息
interface FileTab {
  id: string;              // 唯一标识
  filePath: string | null; // 文件路径，null 表示未保存的新文件
  fileName: string;        // 显示名称
  objects: Record<string, any>; // 该文件的画布数据
  isModified: boolean;     // 是否有未保存的修改
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
const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// 从文件路径提取文件名
const getFilenameFromPath = (path: string): string => {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || "mindgraph.json";
};

// 获取当前激活的标签
export const getActiveTab = () => {
  return openTabs.find(tab => tab.id === activeTabId) || null;
};

// 获取所有打开的标签
export const getAllTabs = () => [...openTabs];

// 获取当前文件路径（兼容旧接口）
export const getCurrentFilePath = () => {
  const activeTab = getActiveTab();
  return activeTab?.filePath || null;
};

// 切换到指定标签
export const switchTab = (tabId: string) => {
  const targetTab = openTabs.find(tab => tab.id === tabId);
  if (!targetTab) return false;

  // 保存当前标签的 objects 状态
  const currentTab = getActiveTab();
  if (currentTab) {
    currentTab.objects = { ...objects };
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
export const closeTab = (tabId: string) => {
  const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
  if (tabIndex === -1) return false;

  const tab = openTabs[tabIndex];

  // 检查是否有未保存的修改
  if (tab.isModified) {
    const confirmed = confirm(`文件 "${tab.fileName}" 有未保存的更改，确定要关闭吗？`);
    if (!confirmed) return false;
  }

  // 移除标签
  openTabs.splice(tabIndex, 1);

  // 如果关闭的是当前标签，切换到其他标签
  if (tabId === activeTabId) {
    if (openTabs.length > 0) {
      // 切换到相邻标签
      const newIndex = Math.min(tabIndex, openTabs.length - 1);
      switchTab(openTabs[newIndex].id);
    } else {
      // 没有标签了，创建新标签
      activeTabId = null;
      Object.keys(objects).forEach((key) => {
        delete objects[key];
      });
      createNewTab();
    }
  }

  updateTabs();
  return true;
};

// 创建新标签
const createNewTab = () => {
  const newTab: FileTab = {
    id: generateTabId(),
    filePath: null,
    fileName: "未命名",
    objects: {},
    isModified: false,
  };
  openTabs.push(newTab);
  activeTabId = newTab.id;
  updateTabs();
  return newTab;
};

// 保存当前标签的 objects 快照
const saveCurrentTabSnapshot = () => {
  const currentTab = getActiveTab();
  if (currentTab) {
    currentTab.objects = { ...objects };
  }
};

// 设置当前标签的修改状态
export const setTabModified = (modified: boolean) => {
  const currentTab = getActiveTab();
  if (currentTab && currentTab.isModified !== modified) {
    currentTab.isModified = modified;
    updateTabs();
  }
};

// 保存文件
export const saveFile = async (saveAs: boolean = false): Promise<boolean> => {
  try {
    console.log("开始保存文件...");

    const activeTab = getActiveTab();
    if (!activeTab) return false;

    // 序列化画布数据
    const serializedData = serializeCanvas(objects);
    const jsonData = JSON.stringify(serializedData, null, 2);

    console.log("序列化数据长度:", jsonData.length);

    // 确定默认文件名
    const defaultFilename = saveAs || !activeTab.filePath ? "" : getFilenameFromPath(activeTab.filePath);

    console.log("默认文件名:", defaultFilename || "(无)");

    // 调用 Wails 后端保存文件
    const result = await SaveFile(jsonData, defaultFilename);

    console.log("保存结果:", result);

    // 用户取消了保存对话框或保存失败
    if (!result) {
      console.log("保存被取消或失败");
      return false;
    }

    // 更新标签信息
    activeTab.filePath = result;
    activeTab.fileName = getFilenameFromPath(result);
    activeTab.isModified = false;

    console.log("文件已保存:", result);
    updateTabs();
    return true;
  } catch (error) {
    console.error("保存文件失败:", error);
    alert("保存文件失败: " + (error as Error).message);
    return false;
  }
};

// 另存为
export const saveFileAs = async (): Promise<boolean> => {
  return saveFile(true);
};

// 加载文件
export const loadFile = async (): Promise<boolean> => {
  try {
    console.log("开始加载文件...");

    // 调用 Wails 后端加载文件
    const result = await LoadFile();

    console.log("加载结果:", result);

    // 用户取消了加载对话框
    if (!result) {
      console.log("加载被取消");
      return false;
    }

    // 解析 JSON 返回值
    const { path: filePath, content: fileData } = JSON.parse(result);

    if (!filePath || !fileData) {
      console.log("文件路径或内容为空");
      return false;
    }

    // 检查文件是否已经打开
    const existingTab = openTabs.find(tab => tab.filePath === filePath);
    if (existingTab) {
      // 文件已打开，切换到该标签
      switchTab(existingTab.id);
      console.log("文件已打开，切换到标签:", existingTab.fileName);
      return true;
    }

    // 保存当前标签状态
    saveCurrentTabSnapshot();

    // 解析 JSON 数据
    const data = JSON.parse(fileData);

    // 清空当前对象
    Object.keys(objects).forEach((key) => {
      delete objects[key];
    });

    // 反序列化画布数据
    deserializeCanvas(data, objects);

    // 创建新标签或更新当前标签
    const fileName = getFilenameFromPath(filePath);

    // 如果当前标签是空的（未命名且无内容），则替换它
    const activeTab = getActiveTab();
    if (activeTab && !activeTab.filePath && Object.keys(activeTab.objects).length === 0) {
      activeTab.filePath = filePath;
      activeTab.fileName = fileName;
      activeTab.objects = { ...objects };
      activeTab.isModified = false;
    } else {
      // 创建新标签
      const newTab: FileTab = {
        id: generateTabId(),
        filePath: filePath,
        fileName: fileName,
        objects: { ...objects },
        isModified: false,
      };
      openTabs.push(newTab);
      activeTabId = newTab.id;
    }

    updateCanvas();
    updateTabs();

    console.log("文件已加载:", filePath);
    return true;
  } catch (error) {
    console.error("加载文件失败:", error);
    alert("加载文件失败: " + (error as Error).message);
    return false;
  }
};

// 检查是否有未保存的更改（简单实现）
export const hasUnsavedChanges = (): boolean => {
  const activeTab = getActiveTab();
  return activeTab ? activeTab.isModified : Object.keys(objects).length > 0;
};

// 新建文件
export const newFile = async (): Promise<boolean> => {
  try {
    // 保存当前标签状态
    saveCurrentTabSnapshot();

    // 检查当前标签是否有未保存的更改
    const activeTab = getActiveTab();
    if (activeTab && activeTab.isModified) {
      const confirmed = confirm(`文件 "${activeTab.fileName}" 有未保存的更改，确定要新建吗？`);
      if (!confirmed) return false;
    }

    // 清空当前对象
    Object.keys(objects).forEach((key) => {
      delete objects[key];
    });

    // 创建新标签
    createNewTab();

    // 触发画布更新
    updateCanvas();

    // 清空历史记录
    const { saveHistory } = await import("../Manager");
    saveHistory();

    return true;
  } catch (error) {
    console.error("新建文件失败:", error);
    return false;
  }
};

// 初始化：创建第一个标签
const initTabs = () => {
  if (openTabs.length === 0) {
    createNewTab();
  }
};

// 注册控制器
Controllers.push({
  Begin: () => {
    initTabs();
  },
  End: () => {
    // 清理：清空所有标签
    openTabs.length = 0;
    activeTabId = null;
  },
});
