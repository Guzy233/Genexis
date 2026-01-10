import { Controllers, idFromEvent } from "../Globals";
import { registerSetting } from "../Option";

// ==================== Viewport 相关 ====================
export const viewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

// 平滑缩放状态
const smoothZoom = {
  target: 1,          // 目标缩放值
  current: 1,         // 当前缩放值
  targetX: 0,         // 目标 viewport.x
  targetY: 0,         // 目标 viewport.y
  isAnimating: false, // 是否正在动画中
  animationId: null as number | null,
};

let smoothFactor = 0.3; // 平滑因子 (0-1)，越大越快

registerSetting({
  id: "camera.smoothFactor",
  category: "Camera",
  title: "缩放平滑度",
  type: "number",
  defaultValue: 0.3,
  value: 0.3,
  description: "缩放动画的平滑度，值越大缩放越快，范围 0.05-1",
  onChange: (v) => { smoothFactor = Math.max(0.05, Math.min(1, v)); },
});

let wheelSensitivity = 1.0; // 滚轮灵敏度

registerSetting({
  id: "camera.wheelSensitivity",
  category: "Camera",
  title: "滚轮灵敏度",
  type: "number",
  defaultValue: 1.0,
  value: 1.0,
  description: "滚轮缩放的灵敏度，值越大缩放越快，范围 0.1-3",
  onChange: (v) => { wheelSensitivity = Math.max(0.1, Math.min(3, v)); },
});

export const screen2Viewport = (point: {
  x: number;
  y: number;
}): { x: number; y: number } => {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
};

export const viewport2Screen = (point: {
  x: number;
  y: number;
}): { x: number; y: number } => {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
};

let canvasEl: SVGGElement | null = null;

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

  let rafId: number | null = null;

  const onMouseMove = (e: MouseEvent) => {
    viewport.x = startViewportX + (e.clientX - startX);
    viewport.y = startViewportY + (e.clientY - startY);

    // 使用 rAF 节流，避免每帧多次更新导致丢帧
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        updateViewport();
        rafId = null;
      });
    }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
};

// 平滑缩放动画循环
function animateSmoothZoom() {
  // 使用线性插值 (Lerp) 逐步接近目标值
  const diff = smoothZoom.target - smoothZoom.current;

  // 如果差异很小，直接设置为目标值并停止动画
  if (Math.abs(diff) < 0.0001) {
    smoothZoom.current = smoothZoom.target;
    viewport.zoom = smoothZoom.target;
    viewport.x = smoothZoom.targetX;
    viewport.y = smoothZoom.targetY;
    smoothZoom.isAnimating = false;
    updateViewport();
    return;
  }

  // 应用平滑因子
  smoothZoom.current += diff * smoothFactor;
  viewport.zoom = smoothZoom.current;

  // 同步平移位置
  viewport.x += (smoothZoom.targetX - viewport.x) * smoothFactor;
  viewport.y += (smoothZoom.targetY - viewport.y) * smoothFactor;

  updateViewport();

  // 继续下一帧
  smoothZoom.animationId = requestAnimationFrame(animateSmoothZoom);
}

// 缩放视角
const onWheel = (e: WheelEvent) => {
  e.preventDefault();

  // 基础缩放因子，0.9（缩小）或 1.1（放大）
  const baseFactor = e.deltaY > 0 ? 0.9 : 1.1;
  // 应用灵敏度调整，灵敏度越高，缩放幅度越大
  const zoomFactor = 1 + (baseFactor - 1) * wheelSensitivity;
  const newZoom = viewport.zoom * zoomFactor;

  // 限制缩放范围
  if (newZoom < 0.1 || newZoom > 10) return;

  // 以鼠标位置为中心缩放
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  // 计算缩放前鼠标在视口世界的位置
  const worldX = (mouseX - viewport.x) / viewport.zoom;
  const worldY = (mouseY - viewport.y) / viewport.zoom;

  // 计算目标位置
  const targetX = mouseX - worldX * newZoom;
  const targetY = mouseY - worldY * newZoom;

  // 更新平滑缩放目标
  smoothZoom.target = newZoom;
  smoothZoom.targetX = targetX;
  smoothZoom.targetY = targetY;

  // 如果没有动画在运行，启动动画
  if (!smoothZoom.isAnimating) {
    smoothZoom.isAnimating = true;
    smoothZoom.current = viewport.zoom;
    smoothZoom.animationId = requestAnimationFrame(animateSmoothZoom);
  }
};

let canvas: SVGGElement | null = null;

function updateViewport() {
  if (canvas) {
    // 使用 CSS transform 代替 SVG transform 属性，提高性能
    // CSS transform 由 GPU 加速，而 SVG transform 属性需要重新渲染整个子树
    const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
    canvas.style.transform = transform;
    canvas.style.transformOrigin = "0 0";
  } else {
    canvas = document.querySelector("#canvas");
    updateViewport();
  }
}

Controllers.push({
  Begin: (canvas: SVGGElement) => {
    canvasEl = canvas;
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
  },
  End: (canvas: SVGGElement) => {
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("wheel", onWheel);
  },
});
