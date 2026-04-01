import { atom } from "jotai";
import { getDefaultStore } from "jotai";
import {
  OpenFolder,
  ListDirectory,
  ReadWorkspaceConfig,
  WriteWorkspaceConfig,
  CreateDirectory,
  DeleteFile,
  MoveToTrash,
  RenamePath,
  FileExists,
} from "../wailsjs/go/main/App";
import {
  loadFileDirect,
  getActiveTab,
  getAllTabs,
  switchTab,
  closeTab,
  getFilenameFromPath,
  setWorkspaceRoot,
} from "./Manager";

const store = getDefaultStore();

// ==================== 类型定义 ====================

export interface FileEntry {
  name: string;
  path: string; // 相对路径
  isDirectory: boolean;
  children?: FileEntry[];
}

export interface WorkspaceLink {
  source: string; // 源文件相对路径
  sourceNode: string; // 源节点 ID
  target: string; // 目标文件相对路径
  label?: string;
}

export interface WorkspaceConfig {
  version: number;
  name: string;
  openFiles: string[];
  activeFile: string | null;
  metadata: Record<string, any>;
  links: WorkspaceLink[];
}

export interface Workspace {
  rootPath: string;
  config: WorkspaceConfig;
}

export type DeleteMode = "trash" | "permanent";

// ==================== 模块状态 ====================

let workspace: Workspace | null = null;
let fileTree: FileEntry[] = [];

export const workspaceUpdater = atom(0);
export const fileTreeUpdater = atom(0);

const updateWorkspaceUI = () => {
  store.set(workspaceUpdater, (store.get(workspaceUpdater) as number) + 1);
};

const updateFileTreeUI = () => {
  store.set(fileTreeUpdater, (store.get(fileTreeUpdater) as number) + 1);
};

const normalizeFileTree = (raw: unknown): FileEntry[] => {
  return Array.isArray(raw) ? (raw as FileEntry[]) : [];
};

const withTimeout = async <T>(
  task: Promise<T>,
  timeoutMs: number,
  fallback: T,
  label: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[workspace] ${label} timeout after ${timeoutMs}ms`);
          resolve(fallback);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// ==================== 钩子系统 ====================

type WorkspaceHook = () => void;
const onWorkspaceOpenedHooks = new Set<WorkspaceHook>();
const onWorkspaceClosedHooks = new Set<WorkspaceHook>();

export const registerOnWorkspaceOpened = (hook: WorkspaceHook) => {
  onWorkspaceOpenedHooks.add(hook);
  return () => onWorkspaceOpenedHooks.delete(hook);
};

export const registerOnWorkspaceClosed = (hook: WorkspaceHook) => {
  onWorkspaceClosedHooks.add(hook);
  return () => onWorkspaceClosedHooks.delete(hook);
};

// ==================== 路径工具 ====================

export const resolveAbsolutePath = (relativePath: string): string => {
  if (!workspace) return relativePath;
  // 使用正斜杠拼接后交给 Go 处理
  const root = workspace.rootPath.replace(/\\/g, "/");
  return root + "/" + relativePath;
};

export const resolveRelativePath = (absolutePath: string): string | null => {
  if (!workspace) return null;
  const root = workspace.rootPath.replace(/\\/g, "/");
  const normalized = absolutePath.replace(/\\/g, "/");
  if (normalized.startsWith(root + "/")) {
    return normalized.substring(root.length + 1);
  }
  return null;
};

const getTabsInPathScope = (relativePath: string) => {
  const prefix = relativePath + "/";
  return getAllTabs().filter((tab) => {
    const rel = tab.workspaceRelativePath;
    return !!rel && (rel === relativePath || rel.startsWith(prefix));
  });
};

const getUniqueRelativePath = async (
  requestedPath: string
): Promise<string> => {
  const normalize = requestedPath.replace(/\\/g, "/");
  const parts = normalize.split("/");
  const rawName = parts.pop() || "untitled.exis";
  const parent = parts.join("/");

  const dot = rawName.lastIndexOf(".");
  const hasExt = dot > 0;
  const base = hasExt ? rawName.slice(0, dot) : rawName;
  const ext = hasExt ? rawName.slice(dot) : "";

  let candidate = normalize;
  let index = 1;

  while (true) {
    const abs = resolveAbsolutePath(candidate);
    const exists = await FileExists(abs);
    if (!exists) return candidate;
    const nextName = `${base}-${index}${ext}`;
    candidate = parent ? `${parent}/${nextName}` : nextName;
    index++;
  }
};

// ==================== 核心操作 ====================

export const openWorkspace = async (): Promise<boolean> => {
  try {
    const rootPath = await OpenFolder();
    if (!rootPath) return false;

    if (workspace) {
      const closed = await closeWorkspace();
      if (!closed) return false;
    }

    // 读取工作区配置
    const configStr = await withTimeout(
      ReadWorkspaceConfig(rootPath),
      5000,
      "{}",
      "ReadWorkspaceConfig"
    );
    let config: WorkspaceConfig;
    try {
      config = JSON.parse(configStr);
    } catch {
      config = createDefaultConfig(rootPath);
    }

    // 确保必要字段存在
    config.openFiles = config.openFiles || [];
    config.activeFile = config.activeFile || null;
    config.metadata = config.metadata || {};
    config.links = config.links || [];
    if (!config.name) {
      config.name = rootPath.replace(/\\/g, "/").split("/").pop() || "Workspace";
    }

    // 读取文件树
    const treeStr = await withTimeout(
      ListDirectory(rootPath),
      5000,
      "[]",
      "ListDirectory"
    );
    try {
      fileTree = normalizeFileTree(JSON.parse(treeStr));
    } catch {
      fileTree = [];
    }

    workspace = { rootPath, config };
    setWorkspaceRoot(rootPath);
    updateWorkspaceUI();
    updateFileTreeUI();

    // 恢复之前打开的文件
    for (const relPath of config.openFiles) {
      const absPath = resolveAbsolutePath(relPath);
      const exists = await withTimeout(
        FileExists(absPath),
        1500,
        false,
        `FileExists(${relPath})`
      );
      if (exists) {
        await loadFileDirect(absPath);
      }
    }

    // 切换到上次活动的文件
    if (config.activeFile) {
      const tabs = getAllTabs();
      const targetTab = tabs.find(
        (t) => t.workspaceRelativePath === config.activeFile
      );
      if (targetTab) {
        switchTab(targetTab);
      }
    }

    onWorkspaceOpenedHooks.forEach((hook) => hook());
    return true;
  } catch (error) {
    console.error("打开工作区失败:", error);
    return false;
  }
};

export const closeWorkspace = async (): Promise<boolean> => {
  if (!workspace) return false;

  const workspaceTabs = getAllTabs().filter((tab) => !!tab.workspaceRelativePath);
  if (workspaceTabs.length > 0) {
    const { showConfirmDialog } = await import("./TopLayer/ConfirmDialog");
    const confirmed = await showConfirmDialog({
      title: "关闭工作区",
      message: `将关闭当前工作区，并关闭其中已打开的 ${workspaceTabs.length} 个文件标签。`,
      confirmText: "关闭工作区",
      cancelText: "取消",
      danger: true,
    });
    if (!confirmed) return false;
  }

  for (const tab of workspaceTabs) {
    const closed = await closeTab(tab);
    if (!closed) return false;
  }

  await saveWorkspaceConfig();

  workspace = null;
  fileTree = [];
  setWorkspaceRoot(null);
  updateWorkspaceUI();
  updateFileTreeUI();

  onWorkspaceClosedHooks.forEach((hook) => hook());
  return true;
};

// ==================== 查询 ====================

export const getWorkspace = (): Workspace | null => workspace;

export const getWorkspaceRoot = (): string | null => workspace?.rootPath || null;

export const isInWorkspace = (): boolean => workspace !== null;

export const getFileTree = (): FileEntry[] => [...fileTree];

// ==================== 文件树操作 ====================

export const refreshFileTree = async (): Promise<FileEntry[]> => {
  if (!workspace) return [];
  try {
    const treeStr = await ListDirectory(workspace.rootPath);
    fileTree = normalizeFileTree(JSON.parse(treeStr));
    updateFileTreeUI();
    return [...fileTree];
  } catch (error) {
    console.error("刷新文件树失败:", error);
    return [];
  }
};

export const openFileByPath = async (relativePath: string): Promise<boolean> => {
  const absPath = resolveAbsolutePath(relativePath);
  const success = await loadFileDirect(absPath);
  if (success && workspace) {
    if (!workspace.config.openFiles.includes(relativePath)) {
      workspace.config.openFiles.push(relativePath);
    }
    workspace.config.activeFile = relativePath;
    updateWorkspaceUI();
    await saveWorkspaceConfig();
  }
  return success;
};

export const createFileInWorkspace = async (
  relativePath: string
): Promise<boolean> => {
  if (!workspace) return false;
  const absPath = resolveAbsolutePath(relativePath);

  try {
    // 创建空画布文件
    const emptyCanvas = JSON.stringify({ version: 2, objects: [] }, null, 2);
    const exists = await FileExists(absPath);
    if (exists) return false;
    const { SaveFileDirect } = await import("../wailsjs/go/main/App");
    await SaveFileDirect(emptyCanvas, absPath);
    await refreshFileTree();
    return true;
  } catch (error) {
    console.error("创建文件失败:", error);
    return false;
  }
};

export const createUniqueFileInWorkspace = async (
  directoryPath: string,
  baseName: string = "untitled.exis"
): Promise<string | null> => {
  if (!workspace) return null;
  const requested = directoryPath ? `${directoryPath}/${baseName}` : baseName;
  const uniquePath = await getUniqueRelativePath(requested);
  const created = await createFileInWorkspace(uniquePath);
  return created ? uniquePath : null;
};

export const createFolderInWorkspace = async (
  relativePath: string
): Promise<boolean> => {
  if (!workspace) return false;
  const absPath = resolveAbsolutePath(relativePath);

  try {
    const exists = await FileExists(absPath);
    if (exists) return false;
    await CreateDirectory(absPath);
    await refreshFileTree();
    return true;
  } catch (error) {
    console.error("创建文件夹失败:", error);
    return false;
  }
};

export const createUniqueFolderInWorkspace = async (
  directoryPath: string,
  baseName: string = "new-folder"
): Promise<string | null> => {
  if (!workspace) return null;
  const requested = directoryPath ? `${directoryPath}/${baseName}` : baseName;
  const uniquePath = await getUniqueRelativePath(requested);
  const created = await createFolderInWorkspace(uniquePath);
  return created ? uniquePath : null;
};

export const deleteFileInWorkspace = async (
  relativePath: string,
  mode: DeleteMode = "permanent"
): Promise<boolean> => {
  if (!workspace) return false;
  const absPath = resolveAbsolutePath(relativePath);

  try {
    const tabsToClose = getTabsInPathScope(relativePath);
    for (const tab of tabsToClose) {
      const closed = await closeTab(tab);
      if (!closed) return false;
    }

    if (mode === "trash") {
      await MoveToTrash(absPath);
    } else {
      await DeleteFile(absPath);
    }
    // 从 openFiles 中移除
    const prefix = relativePath + "/";
    workspace.config.openFiles = workspace.config.openFiles.filter(
      (f) => f !== relativePath && !f.startsWith(prefix)
    );
    if (
      workspace.config.activeFile === relativePath ||
      workspace.config.activeFile?.startsWith(prefix)
    ) {
      workspace.config.activeFile = workspace.config.openFiles[0] || null;
    }
    updateWorkspaceUI();
    await saveWorkspaceConfig();
    await refreshFileTree();
    return true;
  } catch (error) {
    console.error("删除文件失败:", error);
    return false;
  }
};

export const renameInWorkspace = async (
  oldRelativePath: string,
  newRelativePath: string
): Promise<boolean> => {
  if (!workspace) return false;
  const oldAbs = resolveAbsolutePath(oldRelativePath);
  const newAbs = resolveAbsolutePath(newRelativePath);

  try {
    if (oldRelativePath === newRelativePath) return true;

    await RenamePath(oldAbs, newAbs);
    // 更新 openFiles / activeFile 中的引用（兼容目录重命名）
    const prefix = oldRelativePath + "/";
    workspace.config.openFiles = workspace.config.openFiles.map((f) => {
      if (f === oldRelativePath) return newRelativePath;
      if (f.startsWith(prefix)) return newRelativePath + f.substring(oldRelativePath.length);
      return f;
    });
    if (workspace.config.activeFile === oldRelativePath) {
      workspace.config.activeFile = newRelativePath;
    } else if (workspace.config.activeFile?.startsWith(prefix)) {
      workspace.config.activeFile =
        newRelativePath + workspace.config.activeFile.substring(oldRelativePath.length);
    }

    // 更新已打开标签上的相对路径信息
    const tabs = getAllTabs();
    tabs.forEach((tab) => {
      const rel = tab.workspaceRelativePath;
      if (!rel) return;
      if (rel === oldRelativePath) {
        tab.workspaceRelativePath = newRelativePath;
        tab.filePath = resolveAbsolutePath(newRelativePath);
        tab.fileName = getFilenameFromPath(resolveAbsolutePath(newRelativePath));
      } else if (rel.startsWith(prefix)) {
        const nextRel = newRelativePath + rel.substring(oldRelativePath.length);
        tab.workspaceRelativePath = nextRel;
        tab.filePath = resolveAbsolutePath(nextRel);
        tab.fileName = getFilenameFromPath(resolveAbsolutePath(nextRel));
      }
    });

    updateWorkspaceUI();
    await saveWorkspaceConfig();
    await refreshFileTree();
    return true;
  } catch (error) {
    console.error("重命名失败:", error);
    return false;
  }
};

// ==================== 配置持久化 ====================

const createDefaultConfig = (rootPath: string): WorkspaceConfig => ({
  version: 1,
  name: rootPath.replace(/\\/g, "/").split("/").pop() || "Workspace",
  openFiles: [],
  activeFile: null,
  metadata: {},
  links: [],
});

export const saveWorkspaceConfig = async (): Promise<void> => {
  if (!workspace) return;
  try {
    // 同步当前标签状态（每次按当前工作区根路径重新计算，防止脏数据）
    const tabs = getAllTabs();
    const active = getActiveTab();

    const relByTab = new Map<string, string>();
    tabs.forEach((tab) => {
      if (!tab.filePath) {
        tab.workspaceRelativePath = null;
        return;
      }
      const rel = resolveRelativePath(tab.filePath);
      tab.workspaceRelativePath = rel;
      if (rel) {
        relByTab.set(tab.id, rel);
      }
    });

    workspace.config.openFiles = Array.from(relByTab.values());
    workspace.config.activeFile = active ? relByTab.get(active.id) || null : null;

    const data = JSON.stringify(workspace.config, null, 2);
    await WriteWorkspaceConfig(workspace.rootPath, data);
  } catch (error) {
    console.error("保存工作区配置失败:", error);
  }
};

// ==================== 元数据 API（供插件使用） ====================

export const getMetadata = (pluginId: string): any => {
  if (!workspace) return null;
  return workspace.config.metadata[pluginId] || null;
};

export const setMetadata = (pluginId: string, data: any): void => {
  if (!workspace) return;
  workspace.config.metadata[pluginId] = data;
  saveWorkspaceConfig();
};

// ==================== 跨文件链接 ====================

export const getLinks = (): WorkspaceLink[] => {
  return workspace?.config.links || [];
};

export const addLink = (link: WorkspaceLink): void => {
  if (!workspace) return;
  workspace.config.links.push(link);
  updateWorkspaceUI();
  saveWorkspaceConfig();
};

export const removeLink = (
  source: string,
  sourceNode: string
): void => {
  if (!workspace) return;
  workspace.config.links = workspace.config.links.filter(
    (l) => !(l.source === source && l.sourceNode === sourceNode)
  );
  updateWorkspaceUI();
  saveWorkspaceConfig();
};

export const getLinksFromFile = (relativePath: string): WorkspaceLink[] => {
  if (!workspace) return [];
  return workspace.config.links.filter((l) => l.source === relativePath);
};

export const getLinksToFile = (relativePath: string): WorkspaceLink[] => {
  if (!workspace) return [];
  return workspace.config.links.filter((l) => l.target === relativePath);
};
