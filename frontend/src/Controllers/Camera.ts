import { onSetup, idFromEvent } from "../Globals";
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

let wheelSensitivity = 2.5; // 滚轮灵敏度

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

let draggingKey: number = 0;

registerSetting({
  id: "camera.dragKey",
  category: "Camera",
  title: "拖动视角",
  type: "mousekey",
  defaultValue: 0,
  value: 0,
  description: "鼠标按键拖动视角，默认为左键",
  onChange: (v) => (draggingKey = v),
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

// 开始拖动视角
const onMouseDown = (e: MouseEvent) => {
  // 只响应配置的按键
  if (e.button !== draggingKey) return;

  // 点击到节点时不移动视角
  if (idFromEvent(e, ".node-group")) return;

  // 停止平滑缩放动画，避免与拖动冲突
  if (smoothZoom.isAnimating) {
    smoothZoom.isAnimating = false;
    if (smoothZoom.animationId !== null) {
      cancelAnimationFrame(smoothZoom.animationId);
      smoothZoom.animationId = null;
    }
    // 直接应用最终值，避免抖动
    viewport.zoom = smoothZoom.target;
    viewport.x = smoothZoom.targetX;
    viewport.y = smoothZoom.targetY;
    smoothZoom.current = smoothZoom.target;
  }

  // 捕获当前偏移量
  const startX = e.clientX;
  const startY = e.clientY;
  const startViewportX = viewport.x;
  const startViewportY = viewport.y;

  const onMouseMove = (e: MouseEvent) => {
    viewport.x = startViewportX + (e.clientX - startX);
    viewport.y = startViewportY + (e.clientY - startY);
    updateViewport();
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
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

let gridPattern: SVGPatternElement | null = null;
let gridPath: SVGPathElement | null = null;

function updateViewport() {
  if (canvas) {
    const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
    canvas.style.transform = transform;
    canvas.style.transformOrigin = "0 0";

    // 更新适应性网格
    if (!gridPattern) gridPattern = document.getElementById("grid") as any;
    if (gridPattern && !gridPath) gridPath = gridPattern.querySelector("path");

    if (gridPattern && gridPath) {
      const baseGridSize = 25;
      let worldGridSize = baseGridSize;

      // 保持视觉网格大小在 20px 到 200px 之间
      if (viewport.zoom > 0) {
        while (worldGridSize * viewport.zoom < 20) worldGridSize *= 10;
        while (worldGridSize * viewport.zoom > 200) worldGridSize /= 10;
      }

      const visualGridSize = worldGridSize * viewport.zoom;

      gridPattern.setAttribute("width", visualGridSize.toString());
      gridPattern.setAttribute("height", visualGridSize.toString());
      gridPath.setAttribute("d", `M ${visualGridSize} 0 L 0 0 0 ${visualGridSize}`);

      // 偏移网格以对齐世界坐标原点
      const offsetX = viewport.x % visualGridSize;
      const offsetY = viewport.y % visualGridSize;
      gridPattern.setAttribute("patternTransform", `translate(${offsetX}, ${offsetY})`);
    }
  } else {
    canvas = document.querySelector("#vp");
    if (canvas) updateViewport();
  }
}

onSetup((_canvas: SVGSVGElement) => {
  // 将监听器移动到全局 SVG，以便在背景上点击也能平移
  _canvas.addEventListener("mousedown", onMouseDown);
  _canvas.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    _canvas.removeEventListener("mousedown", onMouseDown);
    _canvas.removeEventListener("wheel", onWheel);
  };
});
