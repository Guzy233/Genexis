import { objects, getActiveTab, managerDeleteId, managerUpdate, managerAdd, managerUpdateId } from "../Manager";
import { Edge, idFromEvent, Node, onSetup, Obj, Vec2 } from "../Globals";
import { registerSetting } from "../Option";
import { screen2Viewport, viewport } from "./Camera";
import { createNodeCentered, ObjectFactories } from "./Creator";
import { getToolForCategory, CATEGORY_EDGES } from "../TopLayer/ToolBar";
import { ContextMenuFactories, ContextMenuItem } from "./ContextMenu";
import { saveHistory } from "../Manager";
import { addEdgeRelation } from "../Algorithm";
import { newParticleNode } from "../Components/ParticleNode";
import { active } from "./Selector";

// 连接器状态
let startButton = 2;

// 注册设置项
registerSetting({
  id: "linker.startButton",
  category: "Linker",
  title: "开始连接",
  type: "mousekey",
  defaultValue: 2,
  value: 2,
  description: "按下此键（鼠标按键）开始从节点拉出连接线",
  onChange: (v) => {
    startButton = v;
  },
});

const startLinking = (vEdge: Edge, vNode: Node) => {
  // 窗口失去焦点时清理所有临时监听器
  const onBlur = () => {
    managerDeleteId(vEdge.id);
    managerDeleteId(vNode.id);
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
    managerUpdate(vNode);
  };

  const onMouseOver = (e: MouseEvent) => {
    const aNodeId = idFromEvent(e, ".node-group");
    if (aNodeId) {
      //移入源节点，删除边，删除虚拟节点
      if (aNodeId === vEdge.sourceId) {
        managerDeleteId(vEdge.id);
        managerDeleteId(vNode.id);
      } else {
        // 移入目标节点，更新边的目标节点，删除虚拟节点
        vEdge.targetId = objects[aNodeId].id;
        vEdge.anchorTarget = { type: "auto" };
        managerUpdateId(vEdge.id);
        managerDeleteId(vNode.id);
      }
    }
  };

  const onMouseOut = (e: MouseEvent) => {
    const aNodeId = idFromEvent(e, ".node-group");
    if (aNodeId) {
      // 移出源节点，重新创建边和虚拟节点
      if (aNodeId === vEdge.sourceId) {
        managerAdd(vNode);
        managerAdd(vEdge);
      } else {
        // 移出目标节点，更新边的目标节点为虚拟节点
        managerAdd(vNode);
        vEdge.targetId = vNode.id;
        vEdge.anchorTarget = { type: "absPos" };
        managerUpdateId(vEdge.id);
      }
    }
  };
  const start: Vec2 = { ...vNode.pos }

  const onMouseUp = (e: MouseEvent) => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp, true);
    window.removeEventListener("mouseover", onMouseOver);
    window.removeEventListener("mouseout", onMouseOut);
    window.removeEventListener("blur", onBlur);

    // 总是清理虚拟节点
    managerDeleteId(vNode.id);

    if (start.x === vNode.pos.x && start.y === vNode.pos.y)
      return
    e.stopPropagation()

    const aNodeId = idFromEvent(e, ".node-group");
    if (aNodeId) {
      if (aNodeId !== vEdge.sourceId) {
        //在已有节点上松开鼠标，设置为目标节点
        vEdge.targetId = objects[aNodeId].id;
        if ((objects[aNodeId] as Node).eAncs.length > 1) {
          vEdge.anchorTarget = { type: "auto" };
        } else {
          vEdge.anchorTarget = (objects[aNodeId] as Node).eAncs[0];
        }
        managerUpdateId(vEdge.id);
        // 更新节点关系
        const activeTab = getActiveTab();
        if (activeTab?.nodeRelations) {
          addEdgeRelation(activeTab.nodeRelations, vEdge.sourceId, vEdge.targetId);
        }
        saveHistory();
      }
    } else {
      const node = createNodeCentered(
        screen2Viewport({ x: e.clientX, y: e.clientY })
      ) as Node;
      if (node?.eAncs.length > 1) {
        vEdge.anchorTarget = { type: "auto" };
      } else {
        vEdge.anchorTarget = node?.eAncs[0];
      }
      if (node) {
        vEdge.targetId = node.id;
        managerAdd(node);
        active(node.id)
        // 更新节点关系
        const activeTab = getActiveTab();
        if (activeTab?.nodeRelations) {
          addEdgeRelation(activeTab.nodeRelations, vEdge.sourceId, vEdge.targetId);
        }
        saveHistory();
      } else {
        managerDeleteId(vEdge.id);
      }
    }

  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("mouseover", onMouseOver);
  window.addEventListener("mouseout", onMouseOut);
  window.addEventListener("blur", onBlur);
}

export const onClickNode = (e: MouseEvent) => {
  if (e.button !== startButton) return; // 右键
  const id = idFromEvent(e, ".node-group");
  if (!id) return;

  //选中节点，开始链接
  e.stopPropagation();

  // 获取 Edges category 的当前工具
  const edgeType = getToolForCategory(CATEGORY_EDGES) || "edge/line";
  const startPos = screen2Viewport({ x: e.clientX, y: e.clientY });
  const vNode = newParticleNode(startPos); // Use ParticleNode
  // vNode.pos is already set by newParticleNode(startPos)

  const vEdge = ObjectFactories[edgeType]() as Edge;
  vEdge.sourceId = objects[id].id;
  vEdge.targetId = vNode.id;
  vEdge.anchorTarget = { type: "absPos" };

  if ((objects[id] as Node).aAncs.length > 1) {
    vEdge.anchorSource = { type: "auto" };
  } else {
    vEdge.anchorSource = (objects[id] as Node).aAncs[0];
  }

  startLinking(vEdge, vNode);
};

onSetup((canvas: SVGSVGElement) => {
  canvas.addEventListener("mousedown", onClickNode);
  return () => canvas.removeEventListener("mousedown", onClickNode);
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
        const vNode = newParticleNode(startPos); // Use ParticleNode

        const vEdge = ObjectFactories[edgeId]() as Edge;
        vEdge.sourceId = node.id;
        vEdge.targetId = vNode.id;
        vEdge.anchorTarget = { type: "absPos" };

        startLinking(vEdge, vNode);
      },
    });
  }

  return items;
};
