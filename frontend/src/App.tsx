import "./css/App.css";
import { Coms, Controllers } from "./Globals";
import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { objects, canvasUpdater } from "./Manager";
import { viewport } from "./Controllers/Camera";

import SettingsPanel from "./Components/SettingPanel";
import ToolBar from "./Components/ToolBar";

import "./Components/TextNode";
import "./Components/ImageNode";
import "./Components/CurveEdge";
import "./Components/LineEdge";
import "./Components/SelectionBox";
import "./Components/ContextMenu";
import "./Components/DeletionTrail"

import "./Controllers/Keyboard";
import "./Controllers/Creator";
import "./Controllers/ContextMenu";
import "./Controllers/Linker";
import "./Controllers/Dragger";
import "./Controllers/Selector";
import "./Controllers/Camera";
import "./Controllers/Deleter";

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    Controllers.map((controller) => controller.Begin(canvas));
    return () => {
      Controllers.map((controller) => controller.End(canvas));
    };
  }, []);

  return (
    <div className="canvas-container" tabIndex={0}>
      {/* 设置按钮 */}
      <button
        className="settings-toggle"
        onClick={() => setShowSettings(!showSettings)}
      >
        ⚙
      </button>

      {/* 设置面板 */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* 工具栏 */}
      <ToolBar />

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
            <polygon points="0 0, 10 3.5, 0 7" fill="#b0bec5" />
          </marker>
          <marker
            id="arrowhead1"
            markerWidth="10"
            markerHeight="7"
            refX="0"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#409eff" />
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
              stroke="#ce8080d5"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        <g
          ref={canvasRef}
          transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
          id="canvas"
        >
          <rect
            x={-50000}
            y={-50000}
            width="100000"
            height="100000"
            fill="url(#grid)"
          />

          {sortedObjects.map((obj) => {
            const Com = Coms[obj.type];
            if (Com) return <Com obj={obj} key={obj.id} />;
          })}
        </g>
      </svg>

      <div className="debug-info"></div>
    </div>
  );
};

export default App;
