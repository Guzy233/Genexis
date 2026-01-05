import "./css/App.css";
import { Coms, Obj, Operators, viewport } from "./Globals";
import React, { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { objects, idsAtom } from "./Manager";


import SettingsPanel from "./Coms/SettingPanel";

import "./Operators/Keyboard";
import "./Operators/Creator";
import "./Operators/Editor";

import "./Coms/TextNode";
import "./Coms/CurveEdge";
import "./Operators/Linker";
import "./Operators/Dragger";
import "./Operators/Selector";



const App: React.FC = () => {
  const [ids] = useAtom(idsAtom);
  const [showSettings, setShowSettings] = useState(false);

  // 为ids排序，按edge->node的顺序
  const sortedIds = useMemo(() => {
    const edges = ids.filter((id) => objects[id].type.startsWith("edge"));
    const nodes = ids.filter((id) => objects[id].type.startsWith("node"));
    return [...edges, ...nodes];
  }, [ids]);

  useEffect(() => {
    Operators.map((op) => op.Begin());

    return () => {
      Operators.map((op) => op.End());
    };
  }, []);

  return (
    <div
      className="canvas-container"
      tabIndex={0}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      {/* 设置按钮 */}
      <button
        className="settings-toggle"
        onClick={() => setShowSettings(!showSettings)}
      >
        ⚙
      </button>

      {/* 设置面板 */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

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
          transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
        >
          <rect
            x={-50000}
            y={-50000}
            width="100000"
            height="100000"
            fill="url(#grid)"
          />

          {sortedIds.map((id) => {
            const Com = Coms[objects[id].type];
            if (Com) return <Com obj={objects[id]} key={id} />;
          })}
        </g>
      </svg>

      <div className="debug-info"></div>
    </div>
  );
};

export default App;