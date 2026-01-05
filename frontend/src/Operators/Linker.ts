import Manager, { objects } from "../Manager";
import { newCurveEdge } from "../Coms/CurveEdge";
import { idFromEvent, Node, Operators } from "../Globals";
import { defaultTextNode } from "../Coms/TextNode";
import { atom } from "jotai";
import { registerSetting } from "../Option";

// 连接器状态
let isLinking = false; // TODO: 实现连接状态管理
let linkingKey = "Space"; // TODO: 实现键盘触发的连接开始

// 注册设置项
registerSetting({
  id: "linker.startKey",
  category: "Linker",
  title: "开始连接",
  type: "key",
  defaultValue: "Space",
  value: "Space",
  description: "按下此键进入连接模式",
  onChange: (v) => { linkingKey = v; },
});

export const onClickNode = (e: MouseEvent) => {
  if (e.button !== 2) return; // 右键
  const id = idFromEvent(e, ".node-group");
  if (!id) return;

  //选中节点，开始链接
  e.stopPropagation();
  const vNode: Node = {
    //创建虚拟节点
    ...defaultTextNode,
    id: `${Math.random()}`,
    pos: { x: e.clientX, y: e.clientY },
    updater: atom(0),
  };
  // 定义虚拟边，暂时不加入管理器，直到鼠标移出本节点时再加入
  const vEdge = newCurveEdge(objects[id] as Node, vNode);
  vEdge.anchorTarget = { type: "absPos" };

  // 移动鼠标时更新节点（边由于订阅了节点的更新器，会自动更新）
  const onMouseMove = (e: MouseEvent) => {
    vNode.pos.x += e.movementX;
    vNode.pos.y += e.movementY;
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

  const onMouseUp = (e: MouseEvent) => {
    const aNodeId = idFromEvent(e, ".node-group");
    if (aNodeId) {
      //在已有节点上松开鼠标，设置为目标节点
      vEdge.target = objects[aNodeId] as Node;
      vEdge.anchorTarget = { type: "auto" };
      Manager.updateId(vEdge.id);
    } else {
      //在空白处松开鼠标，将虚拟节点作为新节点加入
      vNode.id = `${Math.random()}`;
      vEdge.anchorTarget = { type: "auto" };
      Manager.add(vNode);
    }
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mouseover", onMouseOver);
    window.removeEventListener("mouseout", onMouseOut);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mouseover", onMouseOver);
  window.addEventListener("mouseout", onMouseOut);
};

Operators.push({
  Begin: () => window.addEventListener("mousedown", onClickNode),
  End: () => window.removeEventListener("mousedown", onClickNode),
});