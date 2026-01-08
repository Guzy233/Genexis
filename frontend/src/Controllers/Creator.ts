import Manager from "../Manager";
import { Controllers, Vec2, Node, Obj } from "../Globals";
import { screen2Viewport } from "./Camera";
import { getToolForCategory, CATEGORY_NODES } from "../Components/ToolBar";
import { ContextMenuFactories, ContextMenuItem } from "./ContextMenu";

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

// ==================== 右键菜单注册 ====================

// 注册空白处的右键菜单工厂
ContextMenuFactories["canvas"] = (_target: Obj, event: MouseEvent): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];

  // 遍历所有节点类型的工具项，创建对应的菜单项
  const nodeTools = Object.keys(ObjectFactories).filter(id => id.startsWith("node/"));

  for (const toolId of nodeTools) {
    items.push({
      id: `create-${toolId}`,
      label: toolId.split("/").pop() || toolId,
      icon: null,
      onClick: () => {
        const factory = ObjectFactories[toolId];
        if (factory) {
          const node = factory() as Node;
          const pos = screen2Viewport({ x: event.clientX, y: event.clientY });
          node.pos = { x: pos.x - node.size.x / 2, y: pos.y - node.size.y / 2 };
          node.selected = true;
          Manager.add(node);
          Manager.saveHistory();
        }
      },
    });
  }

  return items;
};
