import Manager, { objects } from "../Manager";
import { Obj, Controllers, Vec2 } from "../Globals";
import { screen2Viewport } from "./Camera";
import { atom } from "jotai";

// 删除轨迹接口
interface DeletionTrail extends Obj {
  points: Vec2[];
}

// 右键按下时进入删除模式
export const onMouseDown = (e: MouseEvent) => {
  if (e.button !== 2) return; // 只响应右键

  // 在空白处按下才进入删除模式
  const target = e.target as HTMLElement;
  const group = target.closest(".node-group, .edge-group");
  if (group) return; // 点击在元素上，不触发删除

  const startPos = { x: e.clientX, y: e.clientY };

  e.preventDefault();
  e.stopImmediatePropagation();

  // 创建删除轨迹 UI
  const deletionTrail: DeletionTrail = {
    id: "deletion-trail",
    type: "ui/deletionTrail",
    updater: atom(0),
    points: [screen2Viewport(startPos)],
  };
  Manager.add(deletionTrail);

  // 阻止默认右键菜单
  const onContextMenu = (e: MouseEvent) => {
    if (startPos.x === e.clientX && startPos.y === e.clientY) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  // 窗口失去焦点时退出删除模式
  const onBlur = () => {
    Manager.deleteId(deletionTrail.id);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseover", onMouseOver, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("blur", onBlur);
  };

  // 鼠标移动时更新轨迹
  const onMouseMove = (e: MouseEvent) => {
    deletionTrail.points.push(screen2Viewport({ x: e.clientX, y: e.clientY }));
    Manager.update(deletionTrail);
  };

  // 鼠标移到节点/边上时立即删除
  const onMouseOver = (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    const g = el.closest(".node-group, .edge-group");
    if (!g) return;

    const id = g.getAttribute("data-id");
    if (!id || !(id in objects)) return;

    Manager.deleteIdWithEdges(id);
  };

  const onMouseUp = () => {
    Manager.saveHistory();
    Manager.deleteId(deletionTrail.id);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseover", onMouseOver, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    window.removeEventListener("blur", onBlur);
    setTimeout(() => {
      window.removeEventListener("contextmenu", onContextMenu, true);
    }, 0);
  };

  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseover", onMouseOver, true);
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("blur", onBlur);
  window.addEventListener("contextmenu", onContextMenu, true);
};

Controllers.push({
  Begin: (canvas: SVGGElement) => canvas.addEventListener("mousedown", onMouseDown),
  End: (canvas: SVGGElement) => canvas.removeEventListener("mousedown", onMouseDown),
});
