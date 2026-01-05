import Manager from "../Manager";
import { screen2Viewport, Operators, NodeFactories } from "../Globals";
import { getCurrentTool } from "../Coms/ToolBar";

// 双击创建节点
const onDblClick = (e: MouseEvent) => {
  // 检查点击的是否是节点（如果点到节点就不创建）
  const target = e.target as HTMLElement;
  if (target.closest(".node-group")) return;

  // 如果当前选中了工具，使用对应的工厂函数
  const currentTool = getCurrentTool();
  if (currentTool && NodeFactories[currentTool]) {
    const pos = screen2Viewport({ x: e.clientX, y: e.clientY });
    const node = NodeFactories[currentTool]();
    node.pos = { x: pos.x - node.size.x / 2, y: pos.y - node.size.y / 2 };
    node.selected = true;
    Manager.add(node);
  }
};

Operators.push({
  Begin: () => window.addEventListener("dblclick", onDblClick),
  End: () => window.removeEventListener("dblclick", onDblClick),
});
