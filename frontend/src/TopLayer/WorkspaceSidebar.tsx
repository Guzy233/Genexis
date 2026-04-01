import React from "react";
import { useAtom } from "jotai";
import { topLayer } from "../Globals";
import { getActiveTab, getAllTabs } from "../Manager";
import {
  workspaceUpdater,
  fileTreeUpdater,
  getWorkspace,
  getFileTree,
  isInWorkspace,
  openFileByPath,
  refreshFileTree,
  createFileInWorkspace,
  createFolderInWorkspace,
  deleteFileInWorkspace,
  renameInWorkspace,
  closeWorkspace,
  type FileEntry,
} from "../Workspace";

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
  } | null>(null);
  const [renameInput, setRenameInput] = React.useState("");

  const ws = getWorkspace();
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

  if (!ws || !isInWorkspace()) return null;

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

  // 新建文件
  const handleNewFile = async (dirPath: string) => {
    const name = "untitled.exis";
    const relPath = dirPath ? dirPath + "/" + name : name;
    const created = await createFileInWorkspace(relPath);
    if (created) {
      setRenaming({ path: relPath, name });
      setRenameInput(name);
    }
    closeContextMenu();
  };

  // 新建文件夹
  const handleNewFolder = async (dirPath: string) => {
    const name = "new-folder";
    const relPath = dirPath ? dirPath + "/" + name : name;
    const created = await createFolderInWorkspace(relPath);
    if (created) {
      setRenaming({ path: relPath, name });
      setRenameInput(name);
    }
    closeContextMenu();
  };

  // 删除
  const handleDelete = async (entry: FileEntry) => {
    if (confirm(`确定删除 "${entry.name}" 吗？`)) {
      await deleteFileInWorkspace(entry.path);
    }
    closeContextMenu();
  };

  // 重命名
  const startRename = (entry: FileEntry) => {
    setRenaming({ path: entry.path, name: entry.name });
    setRenameInput(entry.name);
    closeContextMenu();
  };

  const confirmRename = async () => {
    if (!renaming) return;
    const oldPath = renaming.path;
    const parts = oldPath.split("/");
    parts[parts.length - 1] = renameInput;
    const newPath = parts.join("/");
    if (oldPath !== newPath) {
      await renameInWorkspace(oldPath, newPath);
    }
    setRenaming(null);
  };

  // 渲染文件树节点
  const renderNode = (entry: FileEntry, depth: number) => {
    const isExpanded = expandedDirs.has(entry.path);
    const isActive = entry.path === activeRelPath;
    const isOpen = openRelPaths.has(entry.path);
    const isRenaming = renaming?.path === entry.path;

    return (
      <div key={entry.path}>
        <div
          className={`ws-tree-item ${isActive ? "active" : ""} ${isOpen ? "open" : ""} ${entry.isDirectory ? "directory" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleFileClick(entry)}
          onContextMenu={(e) => handleContextMenu(e, entry, depth === 0 ? "" : entry.path.split("/").slice(0, -1).join("/"))}
        >
          {entry.isDirectory && (
            <span className="ws-tree-arrow">{isExpanded ? "▾" : "▸"}</span>
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
            <span className="ws-tree-name">{entry.name}</span>
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
  if (collapsed) {
    return (
      <div className="ws-sidebar-collapsed" onClick={() => setCollapsed(false)}>
        <span className="ws-expand-btn">📁</span>
      </div>
    );
  }

  return (
    <div
      className="ws-sidebar"
      onContextMenu={(e) => handleContextMenu(e, null, "")}
    >
      {/* 头部：工作区名称 */}
      <div className="ws-sidebar-header">
        <span className="ws-name">{ws.config.name}</span>
        <div className="ws-header-actions">
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
          <button
            className="ws-header-btn"
            onClick={() => setCollapsed(true)}
            title="收起"
          >
            ‹
          </button>
        </div>
      </div>

      {/* 文件树 */}
      <div className="ws-tree">
        {tree.map((entry) => renderNode(entry, 0))}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="ws-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.entry && !contextMenu.entry.isDirectory && (
            <>
              <div
                className="ws-context-item"
                onClick={() => contextMenu.entry && startRename(contextMenu.entry)}
              >
                重命名
              </div>
              <div
                className="ws-context-item danger"
                onClick={() => contextMenu.entry && handleDelete(contextMenu.entry)}
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

      {/* 点击空白处关闭菜单 */}
      {contextMenu && (
        <div className="ws-context-overlay" onClick={closeContextMenu} />
      )}
    </div>
  );
});
