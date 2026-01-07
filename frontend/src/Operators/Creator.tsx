import Manager from "../Manager";
import { Operators, Vec2, Node } from "../Globals";
import { screen2Viewport } from "./Camera";
import { getCurrentTool } from "../Coms/ToolBar";

// ==================== 节点工厂相关 ====================

export type NodeFactory = () => Node;
export const NodeFactories: Record<string, NodeFactory> = {};

export function createNodeCentered(pos: Vec2) {
  const currentTool = getCurrentTool();
  if (currentTool && NodeFactories[currentTool]) {
    const node = NodeFactories[currentTool]();
    node.pos = { x: pos.x - node.size.x / 2, y: pos.y - node.size.y / 2 };
    node.selected = true;
    return node;
  }
}

// 双击创建节点
const onDblClick = (e: MouseEvent) => {
  // 检查点击的是否是节点（如果点到节点就不创建）
  const target = e.target as HTMLElement;
  if (target.closest(".node-group")) return;

  const node = createNodeCentered(
    screen2Viewport({ x: e.clientX, y: e.clientY })
  );
  if (node) {
    Manager.add(node);
    Manager.saveHistory();
  }
};

Operators.push({
  Begin: () => window.addEventListener("dblclick", onDblClick),
  End: () => window.removeEventListener("dblclick", onDblClick),
});
