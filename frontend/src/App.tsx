import "./css/App.css";
import "./css/variables.css";
import "./css/dark-theme.css";
import { useAtom } from "jotai";
import { Coms, onSetups, topLayer } from "./Globals";
import React, { useEffect } from "react";
import { objects, canvasUpdater, createNewTab, clearTabs } from "./Manager";

import "./TopLayer/ToolBar";
import "./TopLayer/TopMenuBar";
import "./TopLayer/FileTabBar";
import "./TopLayer/ArrowEndDefs";
import "./TopLayer/SettingPanel";

import "./Components/TextNode";
import "./Components/ImageNode";
import "./Components/CurveEdge";
import "./Components/LineEdge";
import "./Components/UndefinedNode";

import "./UIs/SelectionBox";
import "./UIs/ContextMenu";
import "./UIs/DeletionTrail";

import "./Controllers/Clipboard";
import "./Controllers/Keyboard";
import "./Controllers/Creator";
import "./Controllers/ContextMenu";
import "./Controllers/Linker";
import "./Controllers/Dragger";
import "./Controllers/Selector";
import "./Controllers/Camera";
import "./Controllers/Deleter";
import "./Controllers/Grower";

import "./Reciper/ItemListPanel";
import "./Reciper/RecipeListModal";
import "./Reciper/MCItemNode";
import "./Reciper/RecipeNode";
import "./Reciper/Reciper";
import "./Reciper/ItemPointer"

import { CoordinateSystem } from "./UIs/CoordinateSystem";

const App: React.FC = () => {
  useAtom(canvasUpdater);
  const canvasRef = React.useRef<SVGSVGElement>(null);


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

    const cleanups = onSetups.map((setup) => setup(canvas));

    return () => {
      cleanups.forEach((cleanup) => cleanup?.());
      clearTabs();
    };
  }, []);

  return (
    <div
      className="canvas-container"
      tabIndex={0}
      onContextMenuCapture={(e) => e.preventDefault()}
    >
      <svg width="100%" height="100%" className="mindmap-svg"
        ref={canvasRef} id="canvas"
      >
        <rect
          width="100%"
          height="100%"
          fill="url(#grid)"
          id="background"
        />
        <g id="vp">
          <CoordinateSystem />

          {sortedObjects.map((obj) => {
            const Com = Coms[obj.type] || (obj.type.startsWith("node") ? Coms["node/undefined"] : null);
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
