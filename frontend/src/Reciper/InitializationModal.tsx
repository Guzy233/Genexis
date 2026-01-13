import React, { useState, useEffect } from "react";
import { topLayer } from "../Globals";
import { loadRecipes, loadAllTags } from "./Reciper";
import { openItemListPanel } from "./ItemListPanel";
import { OpenFolder } from "../../wailsjs/go/main/App";

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
  const [gameFolder, setGameFolder] = useState("");
  const [version, setVersion] = useState("1.20.1");
  const [datapackName, setDatapackName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (show: boolean) => setVisible(show);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

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
      const response = await fetch("reciper/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameFolder: gameFolder.trim(),
          version: version.trim(),
          datapackName: datapackName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("初始化失败");
      }

      // 初始化成功后加载配方和标签
      await loadRecipes();
      await loadAllTags();
      openItemListPanel();
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
