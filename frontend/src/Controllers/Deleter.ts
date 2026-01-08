import Manager, { objects } from "../Manager";
import { Obj, Controllers } from "../Globals";

// 右键按下时进入删除模式
export const onMouseDown = (e: MouseEvent) => {
  if (e.button !== 2) return; // 只响应右键

  // 在空白处按下才进入删除模式
  const target = e.target as HTMLElement;
  const group = target.closest(".node-group, .edge-group");
  if (group) return; // 点击在元素上，不触发删除

  const pos = { x: e.clientX, y: e.clientY };

  e.preventDefault();
  e.stopImmediatePropagation();

  // 阻止默认右键菜单
  const onContextMenu = (e: MouseEvent) => {
    if (pos.x === e.clientX && pos.y === e.clientY) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  // 窗口失去焦点时退出删除模式
  const onBlur = () => {
    window.removeEventListener("mouseover", onMouseOver, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("blur", onBlur);
  };

  // 鼠标移到节点/边上时立即删除
  const onMouseOver = (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    const g = el.closest(".node-group, .edge-group");
    if (!g) return;

    const id = g.getAttribute("data-id");
    if (!id || !(id in objects)) return;

    const obj = objects[id];

    // 删除节点
    if (obj.type.startsWith("node/")) {
      // 先删除关联的边
      for (const edgeId in objects) {
        const edge = objects[edgeId];
        if (edge.type.startsWith("edge/")) {
          const curveEdge = edge as Obj & { source: Obj; target: Obj };
          if (curveEdge.source.id === id || curveEdge.target.id === id) {
            Manager.deleteId(edgeId);
          }
        }
      }
      Manager.deleteId(id);
    }
    // 删除边
    else if (obj.type.startsWith("edge/")) {
      Manager.deleteId(id);
    }
  };

  const onMouseUp = () => {
    Manager.saveHistory();
    window.removeEventListener("mouseover", onMouseOver, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    window.removeEventListener("blur", onBlur);
    setTimeout(() => {
      window.removeEventListener("contextmenu", onContextMenu, true);
    }, 0);
  };

  window.addEventListener("mouseover", onMouseOver, true);
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("blur", onBlur);
  window.addEventListener("contextmenu", onContextMenu, true);
};

Controllers.push({
  Begin: (canvas: SVGGElement) => canvas.addEventListener("mousedown", onMouseDown),
  End: (canvas: SVGGElement) => canvas.removeEventListener("mousedown", onMouseDown),
});
