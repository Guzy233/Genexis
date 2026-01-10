import "./css/App.css";
import "./css/variables.css";
import "./css/dark-theme.css";
import { useAtom } from "jotai";
import { Coms, Controllers } from "./Globals";
import React, { useEffect, useState } from "react";
import { objects, canvasUpdater, createNewTab, clearTabs } from "./Manager";

import SettingsPanel from "./Components/SettingPanel";
import ToolBar from "./Components/ToolBar";
import TopMenuBar from "./Components/TopMenuBar";
import FileTabBar from "./Components/FileTabBar";
import CoordinateSystem from "./Components/CoordinateSystem";

import "./Components/TextNode";
import "./Components/ImageNode";
import "./Components/MCItemNode";
import "./Components/CurveEdge";
import "./Components/LineEdge";
import "./Components/SelectionBox";
import "./Components/ContextMenu";
import "./Components/DeletionTrail";

import "./Controllers/Keyboard";
import "./Controllers/Creator";
import "./Controllers/ContextMenu";
import "./Controllers/Linker";
import "./Controllers/Dragger";
import "./Controllers/Selector";
import "./Controllers/Camera";
import "./Controllers/Deleter";
import "./Controllers/Grower";
import "./Controllers/Recipes";

const App: React.FC = () => {
  useAtom(canvasUpdater);
  const [showSettings, setShowSettings] = useState(false);
  const canvasRef = React.useRef<SVGGElement>(null);

  const objs = Object.values(objects);
  const edges = objs.filter((obj) => obj.type.startsWith("edge"));
  const nodes = objs.filter((obj) => obj.type.startsWith("node"));
  const uis = objs.filter((obj) => obj.type.startsWith("ui"));
  const sortedObjects = [...edges, ...nodes, ...uis];

  // sortedObjects.forEach((o)=>console.log(o.id))

  useEffect(() => {
    // generateRandomNodes(500)
    const canvas = canvasRef.current;
    if (!canvas) return;
    createNewTab();
    Controllers.map((controller) => controller.Begin(canvas));
    return () => {
      Controllers.map((controller) => controller.End(canvas));
      clearTabs();
    };
  }, []);

  // 监听设置面板打开事件
  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true);
    window.addEventListener("open-settings", handleOpenSettings);
    return () => {
      window.removeEventListener("open-settings", handleOpenSettings);
    };
  }, []);

  return (
    <div className="canvas-container" tabIndex={0}>
      {/* 顶部菜单栏 */}
      <TopMenuBar />

      {/* 设置面板背景遮罩 */}
      {showSettings && (
        <div
          className="settings-backdrop visible"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* 设置面板 */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          visible={showSettings}
        />
      )}

      {/* 底部 Dock 工具栏 */}
      <ToolBar />

      {/* 左下角文件标签栏 */}
      <FileTabBar />

      <svg width="100%" height="100%" className="mindmap-svg">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
          </marker>
          <marker
            id="arrowhead1"
            markerWidth="10"
            markerHeight="7"
            refX="0"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#f472b6" />
          </marker>
          <pattern
            id="grid"
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 25 0 L 0 0 0 25"
              fill="none"
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        <g
          // transform={`translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`}
          ref={canvasRef}
          id="canvas"
        >
          <rect
            x={-50000}
            y={-50000}
            width="100000"
            height="100000"
            fill="url(#grid)"
          />

          {/* 坐标系 */}
          <CoordinateSystem />

          {sortedObjects.map((obj) => {
            const Com = Coms[obj.type];
            if (Com) return <Com obj={obj} key={obj.id} />;
          })}
        </g>
      </svg>

      {/* <div className="debug-info"></div> */}
    </div>
  );
};

export default App;
