import { useAtom } from "jotai";
import { Coms, setCanvasInstance, clearCanvasInstance, topLayer } from "./Globals";
import React, { useEffect } from "react";
import { objects, canvasUpdater, createNewTab, clearTabs } from "./Manager";

import "./TopLayer/ToolBar";
import "./TopLayer/TopMenuBar";
import "./TopLayer/FileTabBar";
import "./TopLayer/ArrowEndDefs";
import "./TopLayer/SettingPanel";

import "./Components/TextNode";
import "./Components/FolderNode";
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

import "./PluginManager";

import { CoordinateSystem } from "./UIs/CoordinateSystem";

const LAYER_COUNT = 1;

const getSpatialLayerIndex = (obj: any) => {
  if (LAYER_COUNT <= 1) return 0;
  // 节点和边都根据位置分配象限，减少层与层之间的重叠
  const pos = obj.pos || (obj.source && obj.source.pos);
  if (pos) {
    const quadX = pos.x < 0 ? 0 : 1;
    const quadY = pos.y < 0 ? 0 : 1;
    return (quadX + quadY * 2) % LAYER_COUNT;
  }
  return 0;
};

const App: React.FC = () => {
  useAtom(canvasUpdater);
  const canvasRef = React.useRef<SVGSVGElement>(null);


  const objs = Object.values(objects);

  // 将对象按空间坐标分发到 4 个非重叠或少重叠的层中
  const edgeLayers = Array.from({ length: LAYER_COUNT }, () => [] as any[]);
  const nodeLayers = Array.from({ length: LAYER_COUNT }, () => [] as any[]);
  const uiLayer: any[] = [];

  objs.forEach(obj => {
    if (obj.type.startsWith("edge")) {
      edgeLayers[getSpatialLayerIndex(obj)].push(obj);
    } else if (obj.type.startsWith("node")) {
      nodeLayers[getSpatialLayerIndex(obj)].push(obj);
    } else {
      uiLayer.push(obj);
    }
  });

  useEffect(() => {
    // generateRandomNodes(500)
    const canvas = canvasRef.current;
    if (!canvas) return;
    createNewTab();

    setCanvasInstance(canvas);

    return () => {
      clearCanvasInstance();
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

          {/* 渲染边层 (在节点之下) */}
          {edgeLayers.map((layer, i) => (
            <g key={`edge-layer-${i}`} className="compositing-layer">
              {layer.map((obj) => {
                const Com = Coms[obj.type];
                if (Com) return <Com obj={obj} key={obj.id} />;
                return null;
              })}
            </g>
          ))}

          {/* 渲染节点层 */}
          {nodeLayers.map((layer, i) => (
            <g key={`node-layer-${i}`} className="compositing-layer">
              {layer
                .sort((a, b) => (a.z || 0) - (b.z || 0))
                .map((obj) => {
                  const Com = Coms[obj.type] || (obj.type.startsWith("node") ? Coms["node/undefined"] : null);
                  if (Com) return <Com obj={obj} key={obj.id} />;
                  return null;
                })}
            </g>
          ))}

          {/* 渲染 UI 层 (在节点之上) */}
          <g className="compositing-layer">
            {uiLayer.map((obj) => {
              const Com = Coms[obj.type];
              if (Com) return <Com obj={obj} key={obj.id} />;
              return null;
            })}
          </g>
        </g>
      </svg>

      {topLayer.map((Top, i) => {
        return <Top key={i} />;
      })}
    </div>
  );
};

export default App;
