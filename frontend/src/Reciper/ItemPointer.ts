import { screen2Viewport } from "../Controllers/Camera";
import { ObjectFactories } from "../Controllers/Creator";
import { Controllers, idFromEvent } from "../Globals";
import Manager from "../Manager";
import { translations } from "./Reciper";
import { openRecipeModal } from "./RecipeListModal";

// 拖拽放置物品到画布的过程式逻辑
export const startDragItem = (e: MouseEvent, itemIdorTag: string) => {
  e.preventDefault();
  e.stopPropagation();

  // 获取物品的中文名称
  const itemName = translations[itemIdorTag] || itemIdorTag;

  // 创建临时拖拽元素
  const dragElement = document.createElement("div");
  dragElement.style.position = "fixed";
  dragElement.style.pointerEvents = "none";
  dragElement.style.zIndex = "10000";
  dragElement.style.opacity = "0.8";

  // 创建拖拽预览容器
  const previewContainer = document.createElement("div");
  previewContainer.style.display = "flex";
  previewContainer.style.flexDirection = "column";
  previewContainer.style.alignItems = "center";
  previewContainer.style.gap = "4px";
  previewContainer.style.padding = "8px";
  previewContainer.style.background = "rgba(30, 30, 35, 0.9)";
  previewContainer.style.borderRadius = "8px";
  previewContainer.style.border = "1px solid rgba(255, 255, 255, 0.2)";

  // 添加名称标签
  const nameLabel = document.createElement("span");
  nameLabel.style.fontSize = "12px";
  nameLabel.style.color = "#e4e4e7";
  nameLabel.style.whiteSpace = "nowrap";
  nameLabel.textContent = itemName;
  previewContainer.appendChild(nameLabel);

  dragElement.appendChild(previewContainer);
  document.body.appendChild(dragElement);

  // 记录起始位置
  const startX = e.clientX;
  const startY = e.clientY;
  let currentX = startX;
  let currentY = startY;

  // 更新拖拽元素位置
  const updateDragPosition = (clientX: number, clientY: number) => {
    dragElement.style.left = clientX + 16 + "px";
    dragElement.style.top = clientY + 16 + "px";
  };

  updateDragPosition(startX, startY);

  // 鼠标移动
  const onMouseMove = (e: MouseEvent) => {
    currentX = e.clientX;
    currentY = e.clientY;
    updateDragPosition(currentX, currentY);
  };

  // 鼠标释放
  const onMouseUp = (e: MouseEvent) => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);

    // 移除拖拽元素
    document.body.removeChild(dragElement);

    // 检查是否在画布区域内释放（简单判断：不在面板内）
    const panelElement = document.querySelector(".item-list-panel");
    const isInPanel = panelElement?.contains(e.target as Node);
    if (isInPanel) return;

    // 创建MC物品节点
    const node = ObjectFactories["node/mcitem"]() as any;
    const viewportPos = screen2Viewport({ x: e.clientX, y: e.clientY });
    node.pos = { x: viewportPos.x - 40, y: viewportPos.y - 50 };
    node.itemIdorTag = itemIdorTag;
    Manager.add(node);
  };

  // 失去焦点
  const onBlur = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);
    if (document.body.contains(dragElement)) {
      document.body.removeChild(dragElement);
    }
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
};


function onMouseDown(e: MouseEvent) {
  const id = (e.target as SVGElement).closest(".item-icon")?.id
  const tag = (e.target as SVGElement).closest(".item-icon")?.getAttribute("data-tag")
  if (!id) return;

  if (e.shiftKey)
    return;

  e.stopPropagation()

  if (e.button === 0)
    openRecipeModal(id, "result")
  else if (e.button === 2)
    openRecipeModal(id, "usage")
  else {
    startDragItem(e, tag ? tag : id)
  }
}

Controllers.push({
  Begin: () => {
    window.addEventListener("mousedown", onMouseDown, true)
  },
  End: () => {
    window.removeEventListener("mousedown", onMouseDown, true)
  },
});
