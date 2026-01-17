import { objects, managerAdd, managerDeleteId, managerDeleteIdWithEdges, managerUpdate } from "../Manager";
import { Obj, Vec2, onSetup } from "../Globals";
import { screen2Viewport } from "./Camera";
import { atom } from "jotai";
import { registerSetting } from "../Option";
import { saveHistory } from "../Manager";

let deletionKey: number = 2;

registerSetting({
  id: "deleter.key",
  category: "Deleter",
  title: "删除模式",
  type: "mousekey",
  defaultValue: 2,
  value: 2,
  description: "鼠标按键进入删除模式，默认为右键",
  onChange: (v) => (deletionKey = v),
});

// 删除轨迹接口
interface DeletionTrail extends Obj {
  points: Vec2[];
}

// 右键按下时进入删除模式
export const onMouseDown = (e: MouseEvent) => {
  if (e.button !== deletionKey) return; // 使用配置的按键

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
  managerAdd(deletionTrail);

  // 阻止默认右键菜单
  const onContextMenu = (e: MouseEvent) => {
    if (startPos.x === e.clientX && startPos.y === e.clientY) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  // 窗口失去焦点时退出删除模式
  const onBlur = () => {
    managerDeleteId(deletionTrail.id);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseover", onMouseOver, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("blur", onBlur);
  };

  // 鼠标移动时更新轨迹
  const onMouseMove = (e: MouseEvent) => {
    deletionTrail.points.push(screen2Viewport({ x: e.clientX, y: e.clientY }));
    managerUpdate(deletionTrail);
  };

  // 鼠标移到节点/边上时立即删除
  const onMouseOver = (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    const g = el.closest(".node-group, .edge-group");
    if (!g) return;

    const id = g.getAttribute("data-id");
    if (!id || !(id in objects)) return;

    managerDeleteIdWithEdges(id);
  };

  const onMouseUp = () => {
    saveHistory();
    managerDeleteId(deletionTrail.id);
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

onSetup((canvas: SVGSVGElement) => {
  canvas.addEventListener("mousedown", onMouseDown);
  return () => canvas.removeEventListener("mousedown", onMouseDown);
});
