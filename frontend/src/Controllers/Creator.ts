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
          // addEdgeRelation(node.id, target.id);
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


// ==================== 拖拽创建工具 ====================

export const startDragTool = (
  e: React.MouseEvent | MouseEvent,
  toolId: string,
  iconClone: HTMLElement,
  onClickFallback: () => void
) => {
  const startX = e.clientX;
  const startY = e.clientY;
  let hasDragged = false;
  let ghost: HTMLElement | null = null;

  const onMouseMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    // 拖拽阈值
    if (!hasDragged && (dx * dx + dy * dy > 25)) { // 5px threshold
      hasDragged = true;

      // 创建拖拽残影
      ghost = document.createElement("div");
      ghost.style.position = "fixed";
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "10000";
      ghost.style.opacity = "0.8";

      // 容器样式
      const container = document.createElement("div");
      container.style.width = "48px";
      container.style.height = "48px";
      container.style.display = "flex";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.background = "rgba(40, 40, 45, 0.8)";
      container.style.borderRadius = "8px";
      container.style.border = "1px solid rgba(255, 255, 255, 0.2)";

      // 图标样式调整
      iconClone.style.display = "block";
      iconClone.style.width = "32px";
      iconClone.style.height = "32px";
      // 移除原有的 transform 等可能影响显示的样式
      iconClone.style.transform = "none";

      container.appendChild(iconClone);
      ghost.appendChild(container);
      document.body.appendChild(ghost);

      // 初始位置
      ghost.style.left = (ev.clientX - 24) + "px";
      ghost.style.top = (ev.clientY - 24) + "px";
    }

    if (hasDragged && ghost) {
      ghost.style.left = (ev.clientX - 24) + "px";
      ghost.style.top = (ev.clientY - 24) + "px";
    }
  };

  const onMouseUp = (ev: MouseEvent) => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);

    if (ghost) {
      ghost.remove();
    }

    if (!hasDragged) {
      onClickFallback();
      return;
    }

    // 处理放置
    const target = document.elementFromPoint(ev.clientX, ev.clientY);

    // 检查是否放置在背景画布上 (id="background")
    // 同时也允许放置在 SVG 元素本身上 (通常是背景)
    if (target && (target.id === "background" || target.tagName === 'svg' || target.closest("#background"))) {
      const factory = ObjectFactories[toolId];
      if (factory) {
        const pos = screen2Viewport({ x: ev.clientX, y: ev.clientY });
        const node = factory() as Node;
        // 居中放置
        node.pos = { x: pos.x - node.size.x / 2, y: pos.y - node.size.y / 2 };
        node.selected = true;
        managerAdd(node);
        saveHistory();
      }
    }
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};
