import Manager, { objects, mgrUpdateRelationsFromEdge } from "../Manager";
import { Edge, idFromEvent, Node, Controllers, Obj } from "../Globals";
import { atom } from "jotai";
import { registerSetting } from "../Option";
import { screen2Viewport, viewport } from "./Camera";
import { createNodeCentered, ObjectFactories } from "./Creator";
import { getToolForCategory, CATEGORY_EDGES } from "../TopLayer/ToolBar";
import { ContextMenuFactories, ContextMenuItem } from "./ContextMenu";
import { saveHistory } from "../Manager";

// 连接器状态
let linkingKey = "Space";

// 注册设置项
registerSetting({
  id: "linker.startKey",
  category: "Linker",
  title: "开始连接",
  type: "key",
  defaultValue: "Space",
  value: "Space",
  description: "按下此键进入连接模式",
  onChange: (v) => {
    linkingKey = v;
  },
});

const startLinking = (vEdge:Edge,vNode:Node) => {
  // 窗口失去焦点时清理所有临时监听器
  const onBlur = () => {
    Manager.deleteId(vEdge.id);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mouseover", onMouseOver);
    window.removeEventListener("mouseout", onMouseOut);
    window.removeEventListener("blur", onBlur);
  };

  // 移动鼠标时更新节点（边由于订阅了节点的更新器，会自动更新）
  const onMouseMove = (e: MouseEvent) => {
    vNode.pos.x += e.movementX / viewport.zoom;
    vNode.pos.y += e.movementY / viewport.zoom;
    Manager.update(vNode);
  };

  const onMouseOver = (e: MouseEvent) => {
    const aNodeId = idFromEvent(e, ".node-group");
    if (aNodeId) {
      //移入源节点，删除边
      if (aNodeId === vEdge.source.id) {
        Manager.deleteId(vEdge.id);
      } else {
        // 移入目标节点，更新边的目标节点
        vEdge.target = objects[aNodeId] as Node;
        vEdge.anchorTarget = { type: "auto" };
        Manager.updateId(vEdge.id);
      }
    }
  };

  const onMouseOut = (e: MouseEvent) => {
    const aNodeId = idFromEvent(e, ".node-group");
    if (aNodeId) {
      // 移出源节点，重新创建边
      if (aNodeId === vEdge.source.id) {
        Manager.add(vEdge);
      } else {
        // 移出目标节点，更新边的目标节点
        vEdge.target = vNode;
        vEdge.anchorTarget = { type: "absPos" };
        Manager.updateId(vEdge.id);
      }
    }
  };

  const onContextMenu = (e: MouseEvent) => {
    if (!(vEdge.id in objects)) return; // 未移动，不创建节点
    e.preventDefault(); // 阻止默认右键菜单
    e.stopImmediatePropagation();
  };

  const onMouseUp = (e: MouseEvent) => {
    const aNodeId = idFromEvent(e, ".node-group");
    if (aNodeId) {
      if (aNodeId !== vEdge.source.id) {
        //在已有节点上松开鼠标，设置为目标节点
        vEdge.target = objects[aNodeId] as Node;
        vEdge.anchorTarget = { type: "auto" };
        Manager.updateId(vEdge.id);
        // 更新节点关系
        mgrUpdateRelationsFromEdge(vEdge.id);
        saveHistory();
      }
    } else {
      const node = createNodeCentered(
        screen2Viewport({ x: e.clientX, y: e.clientY })
      );
      vEdge.anchorTarget = { type: "auto" };
      if (node) {
        vEdge.target = node;
        Manager.add(node);
        Manager.update(vEdge);
        // 更新节点关系
        mgrUpdateRelationsFromEdge(vEdge.id);
        saveHistory();
      } else {
        Manager.deleteId(vEdge.id);
      }
    }
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp, true);
    window.removeEventListener("mouseover", onMouseOver);
    window.removeEventListener("mouseout", onMouseOut);
    window.removeEventListener("blur", onBlur);

    setTimeout(() => {
      window.removeEventListener("contextmenu", onContextMenu, true);
    }, 0);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("mouseover", onMouseOver);
  window.addEventListener("mouseout", onMouseOut);
  window.addEventListener("blur", onBlur);
}

export const onClickNode = (e: MouseEvent) => {
  if (e.button !== 2) return; // 右键
  const id = idFromEvent(e, ".node-group");
  if (!id) return;

  //选中节点，开始链接
  e.stopPropagation();

  // 获取 Edges category 的当前工具
  const edgeType = getToolForCategory(CATEGORY_EDGES) || "edge/line";
  const startPos = screen2Viewport({ x: e.clientX, y: e.clientY });
  const vNode = ObjectFactories["node/text"]() as Node;
  vNode.pos = { ...startPos };
  const vEdge = ObjectFactories[edgeType]() as Edge;
  vEdge.source = objects[id] as Node;
  vEdge.target = vNode;
  vEdge.anchorTarget = { type: "absPos" };

  startLinking(vEdge,vNode);
};

Controllers.push({
  Begin: (canvas: SVGGElement) => canvas.addEventListener("mousedown", onClickNode),
  End: (canvas: SVGGElement) => canvas.removeEventListener("mousedown", onClickNode),
});

// ==================== 右键菜单注册 ====================

// 注册节点的右键菜单工厂（连接选项）
ContextMenuFactories["node"] = (target: Obj | null, event: MouseEvent): ContextMenuItem[] => {
  if (!target) return [];

  const items: ContextMenuItem[] = [];

  // 遍历所有边类型的工具项，创建对应的菜单项
  const edgeTools = Object.keys(ObjectFactories).filter(id => id.startsWith("edge/"));

  for (const edgeId of edgeTools) {
    const edgeLabel = edgeId.split("/").pop() || edgeId;
    items.push({
      id: `link-${edgeId}`,
      label: `连接 (${edgeLabel})`,
      icon: null,
      onClick: () => {
        const node = target as Node;
        const startPos = screen2Viewport({ x: event.clientX, y: event.clientY });
        const vNode = ObjectFactories["node/text"]() as Node;
        vNode.pos = { ...startPos };
        const vEdge = ObjectFactories[edgeId]() as Edge;
        vEdge.source = node;
        vEdge.target = vNode;
        vEdge.anchorTarget = { type: "absPos" };

        startLinking(vEdge, vNode);
      },
    });
  }

  return items;
};
