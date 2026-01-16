import React, { useState, useEffect } from "react";
import { topLayer } from "../Globals";
import { loadRecipes, loadAllTags, initializeReciperApi, currentConfig } from "./Reciper";
import { openItemListPanel } from "./ItemListPanel";
import { OpenFolder } from "../../wailsjs/go/main/App";
import { getActiveTab, getAllTabs } from "../Manager";

let showInitModal = false;
const listeners = new Set<(show: boolean) => void>();

export const openInitializationModal = () => {
  showInitModal = true;
  listeners.forEach((l) => l(true));
};

export const closeInitializationModal = () => {
  showInitModal = false;
  listeners.forEach((l) => l(false));
};

const InitializationModal: React.FC = () => {
  const [visible, setVisible] = useState(showInitModal);
  const [gameFolder, setGameFolder] = useState(currentConfig?.gameFolder || "");
  const [version, setVersion] = useState(currentConfig?.version || "1.20.1");
  const [datapackName, setDatapackName] = useState(currentConfig?.datapackName || "");
  const [exportType, setExportType] = useState<"kubejs" | "datapack" | "custom">(currentConfig?.exportType || "kubejs");
  const [exportPath, setExportPath] = useState(currentConfig?.exportPath || "");
  const [language, setLanguage] = useState(currentConfig?.language || "zh_cn");
  const [forceReload, setForceReload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = getAllTabs().filter(t => t.metadata?.reciper);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    const handler = (show: boolean) => {
      setVisible(show);
      if (show) {
        // 自动检测当前文件页的配置
        const activeTab = getActiveTab();
        const config = activeTab?.metadata?.reciper || currentConfig;
        if (config) {
          setGameFolder(config.gameFolder || "");
          setVersion(config.version || "1.20.1");
          setDatapackName(config.datapackName || "");
          setExportType(config.exportType || "kubejs");
          setExportPath(config.exportPath || "");
          setLanguage(config.language || "zh_cn");
        }
      }
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (exportType === "kubejs") {
      setExportPath(`/kubejs/data/${datapackName}`);
    } else if (exportType === "datapack") {
      setExportPath(`/datapacks/${datapackName}.zip`);
    }
  }, [datapackName, exportType]);

  const handleApplyTemplate = (tabId: string) => {
    setSelectedTemplateId(tabId);
    const templateTab = tabs.find(t => t.id === tabId);
    if (templateTab?.metadata?.reciper) {
      const config = templateTab.metadata.reciper;
      setGameFolder(config.gameFolder || "");
      setVersion(config.version || "1.20.1");
      setDatapackName(config.datapackName || "");
      setExportType(config.exportType || "kubejs");
      setExportPath(config.exportPath || "");
      setLanguage(config.language || "zh_cn");
    }
  };

  const handleBrowse = async () => {
    try {
      const path = await OpenFolder();
      if (path) {
        setGameFolder(path);
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
    }
  };

  const handleSubmit = async () => {
    if (!gameFolder.trim()) {
      setError("请输入游戏文件夹路径");
      return;
    }
    if (!version.trim()) {
      setError("请输入游戏版本");
      return;
    }
    if (!datapackName.trim()) {
      setError("请输入数据包名称");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await initializeReciperApi({
        gameFolder: gameFolder.trim(),
        version: version.trim(),
        datapackName: datapackName.trim(),
        exportType: exportType,
        exportPath: exportPath.trim(),
        language: language,
        forceReload: forceReload,
      });
      closeInitializationModal();
    } catch (err) {
      console.error(err);
      setError("初始化失败，请检查路径和版本是否正确");
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeInitializationModal();
    }
  };

  if (!visible) return null;

  return (
    <div
      className="init-modal-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(2px)",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        className="init-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(30, 30, 35, 0.98)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          width: "400px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          animation: "slideIn 0.2s ease",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "20px", color: "#e4e4e7" }}>
          Reciper 初始化
        </h2>

        {error && (
          <div style={{ color: "#ef4444", fontSize: "14px", background: "rgba(239, 68, 68, 0.1)", padding: "8px 12px", borderRadius: "6px" }}>
            {error}
          </div>
        )}

        {tabs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ color: "#a1a1aa", fontSize: "14px" }}>
              使用模板
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleApplyTemplate(e.target.value)}
              style={{
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                padding: "10px 12px",
                color: "#e4e4e7",
                outline: "none",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <option value="" style={{ background: "#27272a" }}>-- 选择已打开的文件作为模板 --</option>
              {tabs.map(tab => (
                <option key={tab.id} value={tab.id} style={{ background: "#27272a" }}>
                  {tab.fileName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ color: "#a1a1aa", fontSize: "14px" }}>
            Minecraft 游戏文件夹 (.minecraft)
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={gameFolder}
              onChange={(e) => setGameFolder(e.target.value)}
              placeholder="例如: C:\Users\User\AppData\Roaming\.minecraft"
              style={{
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                padding: "10px 12px",
                color: "#e4e4e7",
                outline: "none",
                fontSize: "14px",
                flex: 1,
              }}
            />
            <button
              onClick={handleBrowse}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                padding: "0 12px",
                color: "#e4e4e7",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")
              }
            >
              浏览...
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ color: "#a1a1aa", fontSize: "14px" }}>
            游戏版本ID
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="例如: 1.20.1"
            style={{
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              padding: "10px 12px",
              color: "#e4e4e7",
              outline: "none",
              fontSize: "14px",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ color: "#a1a1aa", fontSize: "14px" }}>
            数据包名称
          </label>
          <input
            type="text"
            value={datapackName}
            onChange={(e) => setDatapackName(e.target.value)}
            placeholder="例如: vanilla"
            style={{
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              padding: "10px 12px",
              color: "#e4e4e7",
              outline: "none",
              fontSize: "14px",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ color: "#a1a1aa", fontSize: "14px" }}>
            自动导出路径
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as any)}
              style={{
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                padding: "10px 12px",
                color: "#e4e4e7",
                outline: "none",
                fontSize: "14px",
                cursor: "pointer",
                width: "120px",
              }}
            >
              <option value="kubejs" style={{ background: "#27272a" }}>KubeJS</option>
              <option value="datapack" style={{ background: "#27272a" }}>Datapack</option>
              <option value="custom" style={{ background: "#27272a" }}>自定义</option>
            </select>
            <input
              type="text"
              value={exportPath}
              disabled={exportType !== "custom"}
              onChange={(e) => setExportPath(e.target.value)}
              placeholder="例如: /kubejs/data/packname"
              style={{
                background: exportType === "custom" ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                padding: "10px 12px",
                color: exportType === "custom" ? "#e4e4e7" : "#a1a1aa",
                outline: "none",
                fontSize: "14px",
                flex: 1,
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ color: "#a1a1aa", fontSize: "14px" }}>
            语言 / Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              padding: "10px 12px",
              color: "#e4e4e7",
              outline: "none",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <option value="zh_cn" style={{ background: "#27272a" }}>简体中文 (zh_cn)</option>
            <option value="en_us" style={{ background: "#27272a" }}>English (en_us)</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
          <input
            type="checkbox"
            id="forceReload"
            checked={forceReload}
            onChange={(e) => setForceReload(e.target.checked)}
            style={{
              width: "16px",
              height: "16px",
              cursor: "pointer",
              accentColor: "#6366f1",
            }}
          />
          <label
            htmlFor="forceReload"
            style={{ color: "#e4e4e7", fontSize: "14px", cursor: "pointer" }}
          >
            强制刷新缓存 (Force Reload)
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
          <button
            onClick={() => closeInitializationModal()}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              padding: "8px 16px",
              color: "#a1a1aa",
              cursor: "pointer",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: loading ? "#4f46e5" : "#6366f1",
              border: "none",
              borderRadius: "6px",
              padding: "8px 24px",
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
              transition: "all 0.2s",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#4f46e5")}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = "#6366f1")}
          >
            {loading ? "正在加载..." : "确定"}
          </button>
        </div>
      </div>
    </div>
  );
};

topLayer.push(InitializationModal);

export default InitializationModal;
