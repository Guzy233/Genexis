import Manager from "../Manager";
import { Controllers, Vec2, Node, Obj } from "../Globals";
import { screen2Viewport } from "./Camera";
import { getToolForCategory } from "../Components/ToolBar";
import { CATEGORY_NODES } from "../Components/TextNode";

// 通用对象工厂
export type ObjectFactory = (...args: any[]) => Obj;
export const ObjectFactories: Record<string, ObjectFactory> = {};

// ==================== 节点创建 ====================

export function createNodeCentered(pos: Vec2) {
  // 获取 Nodes category 的当前工具
  const currentTool = getToolForCategory(CATEGORY_NODES);
  if (currentTool && ObjectFactories[currentTool]) {
    const factory = ObjectFactories[currentTool];
    const node = factory() as Node;
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

Controllers.push({
  Begin: (canvas: SVGGElement) => canvas.addEventListener("dblclick", onDblClick),
  End: (canvas: SVGGElement) => canvas.removeEventListener("dblclick", onDblClick),
});
