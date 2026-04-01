import React from "react";
import { useAtom } from "jotai";
import { topLayer } from "../Globals";
import { getActiveTab, getAllTabs, managerAdd, saveHistory, tabsUpdater } from "../Manager";
import { ObjectFactories } from "../Controllers/Creator";
import { screen2Viewport } from "../Controllers/Camera";
import {
  workspaceUpdater,
  fileTreeUpdater,
  getWorkspace,
  getFileTree,
  isInWorkspace,
  openFileByPath,
  refreshFileTree,
  createUniqueFileInWorkspace,
  createUniqueFolderInWorkspace,
  deleteFileInWorkspace,
  renameInWorkspace,
  closeWorkspace,
  type DeleteMode,
  type FileEntry,
} from "../Workspace";
import { showConfirmDialog, showDeleteChoiceDialog } from "./ConfirmDialog";
import type { FileLinkNode } from "../Components/FileLinkNode";

type DeletePreference = "ask" | DeleteMode;
const DELETE_PREF_KEY = "workspace.delete.preference";

const getDeletePreference = (): DeletePreference => {
  const raw = localStorage.getItem(DELETE_PREF_KEY);
  if (raw === "trash" || raw === "permanent") return raw;
  return "ask";
};

const setDeletePreference = (preference: DeletePreference) => {
  localStorage.setItem(DELETE_PREF_KEY, preference);
};

topLayer.push(() => {
  const [, forceUpdate] = useAtom(workspaceUpdater);
  const [, forceTreeUpdate] = useAtom(fileTreeUpdater);

  const [collapsed, setCollapsed] = React.useState(false);
  const [expandedDirs, setExpandedDirs] = React.useState<Set<string>>(
    new Set()
  );
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
    parentPath: string;
  } | null>(null);
  const [renaming, setRenaming] = React.useState<{
    path: string;
    name: string;
    isDirectory: boolean;
  } | null>(null);
  const [renameInput, setRenameInput] = React.useState("");
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [tabsTick] = useAtom(tabsUpdater);
  const sidebarRef = React.useRef<HTMLDivElement | null>(null);
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null);

  const ws = getWorkspace();
  const inWorkspace = !!ws && isInWorkspace();
  const tree = getFileTree();
  const activeTab = getActiveTab();
  const openTabs = getAllTabs();
  const activeRelPath = activeTab?.workspaceRelativePath || null;
  const openRelPaths = new Set(
    openTabs.map((t) => t.workspaceRelativePath).filter(Boolean) as string[]
  );

  // 强制使用 atoms
  void forceUpdate;
  void forceTreeUpdate;
  void tabsTick;

  // keep hooks order stable; defer early return until after hooks

  // 切换目录展开状态
  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // 处理文件点击
  const handleFileClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      if (!entry.children || entry.children.length === 0) return;
      toggleDir(entry.path);
    } else {
      openFileByPath(entry.path);
    }
  };

  // 右键菜单
  const handleContextMenu = (
    e: React.MouseEvent,
    entry: FileEntry | null,
    parentPath: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry, parentPath });
  };

  const closeContextMenu = () => setContextMenu(null);

const getParentPath = (path: string): string => {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(0, idx) : "";
};

const splitBaseAndExt = (fileName: string): { base: string; ext: string } => {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return { base: fileName, ext: "" };
  return { base: fileName.slice(0, dot), ext: fileName.slice(dot) };
};

const getDisplayName = (entry: FileEntry): string => {
  if (entry.isDirectory) return entry.name;
  return splitBaseAndExt(entry.name).base;
};

const expandPathChain = (path: string) => {
  if (!path) return;
  const parts = path.split("/").filter(Boolean);
  setExpandedDirs((prev) => {
    const next = new Set(prev);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      next.add(current);
    }
    return next;
  });
};

  const DND_MIME = "application/x-genexis-workspace-entry";

  const parseDragEntry = (e: React.DragEvent): FileEntry | null => {
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as FileEntry;
    } catch {
      return null;
    }
  };

  const findEntryByPath = React.useCallback(
    (items: FileEntry[], path: string): FileEntry | null => {
      for (const item of items) {
        if (item.path === path) return item;
        if (item.isDirectory && item.children?.length) {
          const found = findEntryByPath(item.children, path);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  const handleTreeDragStart = (e: React.DragEvent, entry: FileEntry) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DND_MIME, JSON.stringify(entry));
    e.dataTransfer.setData("text/plain", entry.path);
  };

  const createLinkNodeOnCanvas = (entry: FileEntry, clientX: number, clientY: number) => {
    if (entry.isDirectory) return false;
    const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!target) return false;

    const onCanvas =
      target.id === "background" ||
      target.closest("#background") ||
      target.closest("svg.mindmap-svg");
    if (!onCanvas) return false;

    const factory = ObjectFactories["node/file-link"];
    if (!factory) return false;

    const node = factory() as FileLinkNode;
    const pos = screen2Viewport({ x: clientX, y: clientY });
    node.text = entry.name;
    node.workspaceRelativePath = entry.path;
    node.pos = { x: pos.x - node.size.x / 2, y: pos.y - node.size.y / 2 };
    node.selected = true;
    managerAdd(node);
    saveHistory();
    return true;
  };

  const moveEntryToDir = async (dragged: FileEntry, targetDir: string) => {
    if (!dragged.path) return;
    if (dragged.isDirectory && (targetDir === dragged.path || targetDir.startsWith(dragged.path + "/"))) {
      return;
    }

    const targetPath = targetDir ? `${targetDir}/${dragged.name}` : dragged.name;
    if (targetPath === dragged.path) return;

    const moved = await renameInWorkspace(dragged.path, targetPath);
    if (!moved) {
      await showConfirmDialog({
        title: "移动失败",
        message: "目标位置已存在同名项，或目标路径无效。",
        confirmText: "知道了",
        cancelText: "关闭",
      });
      return;
    }
    setSelectedPath(targetPath);
  };

  const handleDropToDir = async (
    e: React.DragEvent,
    targetDir: string,
    alsoTryCanvasLink: boolean = false
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const dragged = parseDragEntry(e);
    if (!dragged) return;

    if (alsoTryCanvasLink && createLinkNodeOnCanvas(dragged, e.clientX, e.clientY)) {
      return;
    }

    await moveEntryToDir(dragged, targetDir);
  };

  // 新建文件
  const handleNewFile = async (dirPath: string) => {
    const createdPath = await createUniqueFileInWorkspace(dirPath, "untitled.exis");
    if (createdPath) {
      expandPathChain(getParentPath(createdPath));
      const name = createdPath.split("/").pop() || "untitled.exis";
      const { base } = splitBaseAndExt(name);
      setRenaming({ path: createdPath, name, isDirectory: false });
      setRenameInput(base);
      setSelectedPath(createdPath);
    }
    closeContextMenu();
  };

  // 新建文件夹
  const handleNewFolder = async (dirPath: string) => {
    const createdPath = await createUniqueFolderInWorkspace(dirPath, "new-folder");
    if (createdPath) {
      const name = createdPath.split("/").pop() || "new-folder";
      expandPathChain(getParentPath(createdPath));
      setRenaming({ path: createdPath, name, isDirectory: true });
      setRenameInput(name);
      setSelectedPath(createdPath);
    } else {
      const relPath = dirPath ? `${dirPath}/new-folder` : "new-folder";
      await showConfirmDialog({
        title: "创建文件夹失败",
        message: `无法创建 "${relPath}"。请检查名称或权限。`,
        confirmText: "知道了",
        cancelText: "关闭",
      });
    }
    closeContextMenu();
  };

  // 删除
  // 重命名
  const handleDeleteWithConfirm = async (entry: FileEntry) => {
    const targetName = entry.isDirectory ? "文件夹" : "文件";
    let mode: DeleteMode | null = null;

    const preference = getDeletePreference();
    if (preference === "ask") {
      const result = await showDeleteChoiceDialog({
        title: `删除${targetName}`,
        message: `请选择删除 "${entry.name}" 的方式：`,
      });
      if (result.action === "cancel") {
        closeContextMenu();
        return;
      }
      mode = result.action;
      if (result.dontAskAgain) {
        setDeletePreference(mode);
      }
    } else {
      mode = preference;
    }

    const deleted = await deleteFileInWorkspace(entry.path, mode);
    if (!deleted) {
      await showConfirmDialog({
        title: "删除失败",
        message: "删除操作未完成，请检查文件占用或权限后重试。",
        confirmText: "知道了",
        cancelText: "关闭",
      });
      closeContextMenu();
      return;
    }
    if (selectedPath === entry.path) setSelectedPath(null);
    closeContextMenu();
  };

  const startRename = (entry: FileEntry) => {
    setRenaming({ path: entry.path, name: entry.name, isDirectory: entry.isDirectory });
    setRenameInput(entry.isDirectory ? entry.name : splitBaseAndExt(entry.name).base);
    setSelectedPath(entry.path);
    closeContextMenu();
  };

  const confirmRename = async () => {
    if (!renaming) return;
    const nextName = renameInput.trim();
    if (!nextName || nextName.includes("/") || nextName.includes("\\")) {
      return;
    }
    const oldPath = renaming.path;
    const parts = oldPath.split("/");
    if (renaming.isDirectory) {
      parts[parts.length - 1] = nextName;
    } else {
      const { ext } = splitBaseAndExt(renaming.name);
      let nextBase = nextName;
      if (ext && nextBase.toLowerCase().endsWith(ext.toLowerCase())) {
        nextBase = nextBase.slice(0, nextBase.length - ext.length).trim();
      }
      if (!nextBase) return;
      parts[parts.length - 1] = `${nextBase}${ext}`;
    }
    const newPath = parts.join("/");
    if (oldPath !== newPath) {
      const renamed = await renameInWorkspace(oldPath, newPath);
      if (!renamed) {
        await showConfirmDialog({
          title: "重命名失败",
          message: "目标名称已存在或无效，请更换后重试。",
          confirmText: "知道了",
          cancelText: "关闭",
        });
        return;
      }
      setSelectedPath(newPath);
    }
    setRenaming(null);
  };

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!inWorkspace) return;
      if (renaming) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const targetPath = selectedPath || activeRelPath;
      if (!targetPath) return;
      const entry = findEntryByPath(tree, targetPath);
      if (!entry) return;
      if (e.key === "F2") {
        e.preventDefault();
        startRename(entry);
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        void handleDeleteWithConfirm(entry);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inWorkspace, selectedPath, activeRelPath, renaming, tree, findEntryByPath]);

  React.useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const menuEl = contextMenuRef.current;
    const rect = menuEl.getBoundingClientRect();
    const padding = 8;
    let nextX = contextMenu.x;
    let nextY = contextMenu.y;
    if (nextX + rect.width > window.innerWidth - padding) {
      nextX = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (nextY + rect.height > window.innerHeight - padding) {
      nextY = Math.max(padding, window.innerHeight - rect.height - padding);
    }
    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu((prev) =>
        prev ? { ...prev, x: nextX, y: nextY } : prev
      );
    }
  }, [contextMenu]);

  React.useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) {
        closeContextMenu();
        return;
      }
      if (target.closest(".ws-context-menu")) return;
      closeContextMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const clearLayoutVars = () => {
      root.style.removeProperty("--left-stack-top");
      root.style.removeProperty("--left-sidebar-height");
      root.style.removeProperty("--left-tabs-top");
      root.style.removeProperty("--left-tabs-height");
      root.style.removeProperty("--left-tabs-bottom");
      root.style.removeProperty("--left-collapse-top");
    };

    if (!inWorkspace) {
      clearLayoutVars();
      return;
    }

    const computeLayout = () => {
      const sidebarEl = sidebarRef.current;
      const tabList = document.querySelector(".file-tab-list") as HTMLElement | null;
      if (!sidebarEl && !collapsed) return;
      const headerEl = sidebarEl?.querySelector(".ws-sidebar-header") as HTMLElement | null;
      const treeEl = sidebarEl?.querySelector(".ws-tree") as HTMLElement | null;

      const railTop = 50;
      const railBottom = 10;
      const gap = 8;
      const available = Math.max(120, window.innerHeight - railTop - railBottom);

      const collapsedHandleHeight = 44;
      const minTabsVisibleHeight = 46;
      const rowCount = treeEl ? treeEl.querySelectorAll(".ws-tree-item").length : 0;
      const treeNatural = rowCount * 28 + 8;
      const sidebarNatural = collapsed
        ? collapsedHandleHeight
        : Math.max(72, (headerEl?.offsetHeight || 0) + treeNatural);
      const tabNaturalRaw = tabList ? tabList.scrollHeight : 0;
      const hasTabs = tabNaturalRaw > 0;
      const tabNatural = hasTabs ? Math.max(minTabsVisibleHeight, tabNaturalRaw) : 0;

      const half = Math.floor(available / 2);
      let sidebarHeight = sidebarNatural;
      let tabsHeight = tabNatural;
      let stackTop = railTop;

      if (!hasTabs) {
        sidebarHeight = Math.min(sidebarNatural, available);
      } else if (sidebarNatural > half && tabNatural > half) {
        // 两边都超过半屏：各占一半并滚动
        sidebarHeight = half;
        tabsHeight = half;
      } else if (sidebarNatural <= half) {
        // 侧栏小于半屏：优先完整显示侧栏
        sidebarHeight = sidebarNatural;
        tabsHeight = Math.min(tabNatural, Math.max(0, available - gap - sidebarHeight));
      } else {
        // 标签小于半屏：优先完整显示标签
        tabsHeight = tabNatural;
        sidebarHeight = Math.min(sidebarNatural, Math.max(0, available - gap - tabsHeight));
      }

      if (hasTabs) {
        const remainingForTabs = Math.max(0, available - gap);
        const maxSidebarByMinTabs = Math.max(0, remainingForTabs - minTabsVisibleHeight);
        if (tabsHeight < minTabsVisibleHeight) {
          tabsHeight = minTabsVisibleHeight;
        }
        if (sidebarHeight > maxSidebarByMinTabs) {
          sidebarHeight = maxSidebarByMinTabs;
        }
      }

      const total = sidebarHeight + (hasTabs ? gap : 0) + tabsHeight;
      const centeredTop = railTop + Math.max(0, Math.floor((available - total) / 2));
      const sidebarBottomLimit = window.innerHeight - railBottom - tabsHeight - (hasTabs ? gap : 0);
      stackTop = Math.min(centeredTop, sidebarBottomLimit - sidebarHeight);
      if (stackTop < railTop) stackTop = railTop;

      const tabsTop = hasTabs ? (window.innerHeight - railBottom - tabsHeight) : stackTop + sidebarHeight;
      const collapseTop = collapsed
        ? stackTop + Math.floor(collapsedHandleHeight / 2)
        : stackTop + Math.floor(sidebarHeight / 2);

      root.style.setProperty("--left-stack-top", `${stackTop}px`);
      root.style.setProperty("--left-sidebar-height", `${sidebarHeight}px`);
      root.style.setProperty("--left-tabs-top", `${tabsTop}px`);
      root.style.setProperty("--left-tabs-height", `${tabsHeight}px`);
      root.style.setProperty("--left-tabs-bottom", `auto`);
      root.style.setProperty("--left-collapse-top", `${collapseTop}px`);
    };

    const raf = requestAnimationFrame(computeLayout);
    const onResize = () => computeLayout();
    window.addEventListener("resize", onResize);

    const sidebarEl = sidebarRef.current;
    const tabList = document.querySelector(".file-tab-list") as HTMLElement | null;
    const observer = new ResizeObserver(() => computeLayout());
    if (sidebarEl) observer.observe(sidebarEl);
    if (tabList) observer.observe(tabList);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [inWorkspace, collapsed, tree, openTabs.length, expandedDirs, renaming, selectedPath]);

  // 渲染文件树节点
  const renderNode = (entry: FileEntry, depth: number) => {
    const isExpanded = expandedDirs.has(entry.path);
    const hasChildren = !!entry.children && entry.children.length > 0;
    const isActive = entry.path === activeRelPath;
    const isOpen = openRelPaths.has(entry.path);
    const isSelected = entry.path === selectedPath;
    const isRenaming = renaming?.path === entry.path;

    return (
      <div key={entry.path}>
        <div
          className={`ws-tree-item ${isActive ? "active" : ""} ${isOpen ? "open" : ""} ${isSelected ? "selected" : ""} ${entry.isDirectory ? "directory" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          draggable={!isRenaming}
          onDragStart={(e) => handleTreeDragStart(e, entry)}
          onDragEnd={(e) => {
            createLinkNodeOnCanvas(entry, e.clientX, e.clientY);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) =>
            handleDropToDir(
              e,
              entry.isDirectory ? entry.path : getParentPath(entry.path)
            )
          }
          onClick={() => {
            setSelectedPath(entry.path);
            handleFileClick(entry);
          }}
          onContextMenu={(e) =>
            handleContextMenu(
              e,
              entry,
              entry.isDirectory ? entry.path : getParentPath(entry.path)
            )
          }
        >
          {entry.isDirectory && (
            <span className="ws-tree-arrow">{hasChildren ? (isExpanded ? "▾" : "▸") : ""}</span>
          )}
          {!entry.isDirectory && <span className="ws-tree-file-icon">📄</span>}
          {isRenaming ? (
            <input
              className="ws-rename-input"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onBlur={confirmRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRename();
                if (e.key === "Escape") setRenaming(null);
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="ws-tree-name">{getDisplayName(entry)}</span>
          )}
          {entry.isDirectory && !isRenaming && (
            <span className="ws-row-actions">
              <button
                className="ws-row-btn"
                title="新建文件"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewFile(entry.path);
                }}
              >
                +F
              </button>
              <button
                className="ws-row-btn"
                title="新建文件夹"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewFolder(entry.path);
                }}
              >
                +D
              </button>
            </span>
          )}
        </div>
        {entry.isDirectory && isExpanded && entry.children && (
          <div className="ws-tree-children">
            {entry.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // 折叠状态：只显示一个小按钮
  if (!inWorkspace || !ws) return null;

  if (collapsed) {
    return (
      <div className="ws-sidebar-collapsed" onClick={() => setCollapsed(false)}>
        <span className="ws-expand-btn">›</span>
      </div>
    );
  }

  return (
    <>
    <div
      ref={sidebarRef}
      className="ws-sidebar"
      onContextMenu={(e) => handleContextMenu(e, null, "")}
    >
      <button
        className="ws-collapse-edge"
        onClick={() => setCollapsed(true)}
        title="收起工作区"
      >
        &lt;
      </button>
      {/* 头部：工作区名称 */}
      <div className="ws-sidebar-header">
        <span className="ws-name">{ws.config.name}</span>
        <div className="ws-header-actions">
          <span className="ws-header-create-actions">
            <button
              className="ws-header-btn"
              onClick={() => handleNewFile("")}
              title="新建文件"
            >
              +F
            </button>
            <button
              className="ws-header-btn"
              onClick={() => handleNewFolder("")}
              title="新建文件夹"
            >
              +D
            </button>
          </span>
          <button
            className="ws-header-btn"
            onClick={() => refreshFileTree()}
            title="刷新"
          >
            ↻
          </button>
          <button
            className="ws-header-btn"
            onClick={() => closeWorkspace()}
            title="关闭工作区"
          >
            ×
          </button>
        </div>
      </div>

      {/* 文件树 */}
      <div
        className="ws-tree"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => handleDropToDir(e, "", true)}
      >
        {tree.map((entry) => renderNode(entry, 0))}
      </div>

    </div>
    {/* 右键菜单：作为侧栏外层同级节点，避免 fixed 在 filter 容器内偏移 */}
    {contextMenu && (
      <div
        ref={contextMenuRef}
        className="ws-context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {contextMenu.entry && (
          <>
            <div
              className="ws-context-item"
              onClick={() => contextMenu.entry && startRename(contextMenu.entry)}
            >
              重命名
            </div>
            <div
              className="ws-context-item danger"
              onClick={() =>
                contextMenu.entry && handleDeleteWithConfirm(contextMenu.entry)
              }
            >
              删除
            </div>
            <div className="ws-context-divider" />
          </>
        )}
        <div
          className="ws-context-item"
          onClick={() => handleNewFile(contextMenu.parentPath)}
        >
          新建文件
        </div>
        <div
          className="ws-context-item"
          onClick={() => handleNewFolder(contextMenu.parentPath)}
        >
          新建文件夹
        </div>
      </div>
    )}
    </>
  );
});
