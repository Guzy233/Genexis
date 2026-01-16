import Manager, { objects, getActiveTab } from "../Manager";
import { onSetup, Node, Edge } from "../Globals";
import { registerSetting } from "../Option";
import { atom } from "jotai";
import { viewport } from "./Camera";
import { ObjectFactories } from "./Creator";
import { activedId, active } from "./Selector";
import { saveHistory } from "../Manager";
import { addEdgeRelation } from "../Algorithm";

// ==================== 生长逻辑 ====================

/**
 * 开始生长模式
 */
const startGrowMode = (e: KeyboardEvent) => {
  // 如果没有激活节点，不执行生长
  if (!activedId) return;

  const sourceNode = objects[activedId] as Node;
  if (!sourceNode || !sourceNode.type.startsWith("node/")) return;

  e.preventDefault();
  e.stopPropagation();

  // 计算新节点位置（默认在源节点右侧300单位）
  const newNodePos = {
    x: sourceNode.pos.x + 300,
    y: sourceNode.pos.y,
  };

  // 创建新节点
  const newNode = ObjectFactories["node/text"]() as Node;
  newNode.pos = newNodePos;
  newNode.selected = true;

  // 取消源节点的选中状态
  sourceNode.selected = false;
  Manager.update(sourceNode);

  // 添加新节点
  Manager.add(newNode);

  // 更新激活节点为新节点
  active(newNode.id);

  // 创建虚拟边
  const edgeFactory = ObjectFactories["edge/line"];
  if (!edgeFactory) return;

  const vEdge = edgeFactory() as Edge;
  vEdge.source = sourceNode;
  vEdge.target = newNode;
  vEdge.anchorTarget = { type: "auto" };
  Manager.add(vEdge);

  // 窗口失去焦点时清理所有临时监听器
  const onBlur = () => {
    // 清理虚拟边
    if (vEdge.id in objects) {
      Manager.deleteId(vEdge.id);
    }
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("blur", onBlur);
  };

  // 键盘移动新节点
  const onKeyDown = (e: KeyboardEvent) => {
    const moveSpeed = 10 / viewport.zoom;

    switch (e.key.toLowerCase()) {
      case "i":
        newNode.pos.y -= moveSpeed;
        break;
      case "k":
        newNode.pos.y += moveSpeed;
        break;
      case "j":
        newNode.pos.x -= moveSpeed;
        break;
      case "l":
        newNode.pos.x += moveSpeed;
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    Manager.update(newNode);
  };

  // Tab 键松开时结束生长模式
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    // 更新节点关系
    if (vEdge.id in objects) {
      const activeTab = getActiveTab();
      if (activeTab?.nodeRelations) {
        addEdgeRelation(activeTab.nodeRelations, vEdge.source.id, vEdge.target.id);
      }
    }

    // 保存历史
    saveHistory();

    // 进入编辑模式（通过触发双击事件）
    // EditableText 组件在 node-group 下的 g 元素中接收双击事件
    setTimeout(() => {
      const nodeGroup = document.querySelector(`[data-id="${newNode.id}"]`);
      if (nodeGroup) {
        // 查找 node-group 下的 g 元素（EditableText 的容器）
        const editableTextContainer = nodeGroup.querySelector("g");
        if (editableTextContainer) {
          const dblClickEvent = new MouseEvent("dblclick", {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          editableTextContainer.dispatchEvent(dblClickEvent);
        }
      }
    }, 0);

    // 清理监听器
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  };

  // 监听键盘事件
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
};

// ==================== Tab 键监听 ====================

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "Tab") return;
  e.preventDefault();
  if (e.repeat) return;

  startGrowMode(e);
};

// ==================== 注册设置项 ====================

registerSetting({
  id: "grower.enabled",
  category: "Grower",
  title: "启用生长模式",
  type: "toggle",
  defaultValue: true,
  value: true,
  description: "按 Tab 键从激活节点生长出新节点",
});

// ==================== 注册控制器 ====================

onSetup((_canvas: SVGGElement) => {
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
});
