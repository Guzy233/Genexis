import "./css/App.css";
import "./css/variables.css";
import "./css/dark-theme.css";
import { useAtom } from "jotai";
import { Coms, Controllers, topLayer } from "./Globals";
import React, { useEffect } from "react";
import { objects, canvasUpdater, createNewTab, clearTabs } from "./Manager";

import "./TopLayer/ToolBar";
import "./TopLayer/TopMenuBar";
import "./TopLayer/FileTabBar";
import "./TopLayer/ArrowEndDefs";
import "./TopLayer/SettingPanel";

import "./Components/TextNode";
import "./Components/ImageNode";
import "./Components/MCItemNode";
import "./Components/CurveEdge";
import "./Components/LineEdge";

import "./UIs/SelectionBox";
import "./UIs/ContextMenu";
import "./UIs/DeletionTrail";

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

import { CoordinateSystem } from "./UIs/CoordinateSystem";

const App: React.FC = () => {
  useAtom(canvasUpdater);
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

  return (
    <div className="canvas-container" tabIndex={0}>
      <svg width="100%" height="100%" className="mindmap-svg">
        <g ref={canvasRef} id="canvas">
          <rect
            x={-50000}
            y={-50000}
            width="100000"
            height="100000"
            fill="url(#grid)"
          />

          <CoordinateSystem />

          {sortedObjects.map((obj) => {
            const Com = Coms[obj.type];
            if (Com) return <Com obj={obj} key={obj.id} />;
          })}
        </g>
      </svg>

      {topLayer.map((Top, i) => {
        return <Top key={i} />;
      })}
    </div>
  );
};

export default App;
