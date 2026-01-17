import { managerAdd } from "../Manager";
import { onSetup, Vec2, Node, Obj } from "../Globals";
import { screen2Viewport } from "./Camera";
import { getToolForCategory, CATEGORY_NODES } from "../TopLayer/ToolBar";
import { ContextMenuFactories, ContextMenuItem } from "./ContextMenu";
import { addEdgeRelation } from "../Algorithm";
import { saveHistory } from "../Manager";

// 通用对象工厂
export type ObjectFactory = (...args: any[]) => Obj;
export const ObjectFactories: Record<string, ObjectFactory> = {};

// ==================== 随机节点生成（用于性能测试） ====================

export function generateRandomNodes(count: number = 100): void {
  const createTextFactory = ObjectFactories["node/text"];
  const createEdgeFactory = ObjectFactories["edge/curve"];

  if (!createTextFactory) {
    console.error("Text node factory not found");
    return;
  }

  const nodes: any[] = [];

  // 生成随机节点
  for (let i = 0; i < count; i++) {
    const node = createTextFactory() as any;
    // 随机位置（分布在较大的区域）
    node.pos = {
      x: Math.random() * 4000 - 2000,
      y: Math.random() * 4000 - 2000,
    };
    // 随机大小
    node.size = {
      x: 80 + Math.random() * 120,
      y: 40 + Math.random() * 60,
    };
    // 随机文本
    node.text = `Node ${i + 1}`;

    managerAdd(node);
    nodes.push(node);
  }

  // 生成随机连接（每个节点随机连接 0-1 个其他节点，减少边数量）
  nodes.forEach((node, index) => {
    const connectionCount = Math.floor(Math.random() * 2); // 0-1 个连接，减少性能负担

    for (let i = 0; i < connectionCount; i++) {
      const targetIndex = Math.floor(Math.random() * count);
      if (targetIndex !== index && targetIndex > index) { // 避免重复连接
        const target = nodes[targetIndex];

        if (createEdgeFactory) {
          const edge = createEdgeFactory(node, target, "");
          managerAdd(edge);

          // 记录节点关系
          addEdgeRelation(node.id, target.id);
        }
      }
    }
  });

  console.log(`Generated ${count} random nodes with reduced connections for performance`);
}

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
    managerAdd(node);
    saveHistory();
  }
};

onSetup((canvas: SVGSVGElement) => {
  canvas.addEventListener("dblclick", onDblClick);
  return () => canvas.removeEventListener("dblclick", onDblClick);
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
          managerAdd(node);
          saveHistory();
        }
      },
    });
  }

  return items;
};
