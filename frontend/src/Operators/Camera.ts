import { viewport, idFromEvent, Operators } from "../Globals";
import { updateCanvas } from "../Manager";

// 开始拖动视角
const onMouseDown = (e: MouseEvent) => {
  // 只响应左键
  if (e.button !== 0) return;

  // 点击到节点时不移动视角
  if (idFromEvent(e, ".node-group")) return;

  // 捕获当前偏移量
  const startX = e.clientX;
  const startY = e.clientY;
  const startViewportX = viewport.x;
  const startViewportY = viewport.y;

  // 窗口失去焦点时清理所有临时监听器
  const onBlur = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);
  };

  const onMouseMove = (e: MouseEvent) => {
    viewport.x = startViewportX + (e.clientX - startX);
    viewport.y = startViewportY + (e.clientY - startY);
    updateCanvas();
  };

  const onMouseUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
};

// 缩放视角
const onWheel = (e: WheelEvent) => {
  e.preventDefault();

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = viewport.zoom * zoomFactor;

  // 限制缩放范围
  if (newZoom < 0.1 || newZoom > 10) return;

  // 以鼠标位置为中心缩放
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  // 计算缩放前鼠标在视口世界的位置
  const worldX = (mouseX - viewport.x) / viewport.zoom;
  const worldY = (mouseY - viewport.y) / viewport.zoom;

  // 应用新缩放
  viewport.zoom = newZoom;

  // 调整 viewport 使鼠标位置保持不变
  viewport.x = mouseX - worldX * newZoom;
  viewport.y = mouseY - worldY * newZoom;

  updateCanvas();
};

Operators.push({
  Begin: () => {
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("wheel", onWheel, { passive: false });
  },
  End: () => {
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("wheel", onWheel);
  },
});
