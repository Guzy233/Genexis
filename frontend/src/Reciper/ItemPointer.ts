import { screen2Viewport } from "../Controllers/Camera";
import { ObjectFactories } from "../Controllers/Creator";
import { onSetup, idFromEvent } from "../Globals";
import { managerAdd } from "../Manager";
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

    if (e.target instanceof SVGRectElement && e.target.id === "background") {
      // 创建MC物品节点
      const node = ObjectFactories["node/mcitem"]() as any;
      const viewportPos = screen2Viewport({ x: e.clientX, y: e.clientY });
      node.pos = { x: viewportPos.x - 40, y: viewportPos.y - 50 };
      node.itemIdorTag = itemIdorTag;
      managerAdd(node);
    } else {
      const target = e.target as SVGElement;
      const slot = target.closest("[data-slot-role]");
      if (!slot) return;

      target.dispatchEvent(
        new CustomEvent("replace-item", {
          bubbles: true,
          detail: { x: e.clientX, y: e.clientY, idorTag: itemIdorTag }
        }))
    }
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


import { registerSetting, getSetting } from "../Option";

// 注册设置项
registerSetting({
  id: "reciper.ignore_item_op",
  category: "Interaction",
  title: "忽略物品操作",
  type: "key",
  defaultValue: "S",
  value: "S",
  description: "按住此键时忽略物品拖拽或打开配方操作",
});

registerSetting({
  id: "reciper.delete_item_slot",
  category: "Interaction",
  title: "移除插槽物品",
  type: "mousekey",
  defaultValue: "M1",
  value: "M1",
  description: "在物品插槽上点击此键以移除物品",
});

registerSetting({
  id: "reciper.open_recipe_result",
  category: "Interaction",
  title: "打开合成表 (产出)",
  type: "mousekey",
  defaultValue: "M3",
  value: "M3",
  description: "在物品上点击此键以查看产出该物品的配方",
});

registerSetting({
  id: "reciper.open_recipe_usage",
  category: "Interaction",
  title: "打开合成表 (用途)",
  type: "mousekey",
  defaultValue: "M4",
  value: "M4",
  description: "在物品上点击此键以查看该物品的用途配方",
});

function getMouseQuery(e: MouseEvent) {
  let query = "";
  if (e.ctrlKey) query += "C";
  if (e.altKey) query += "A";
  if (e.shiftKey) query += "S";
  query += "M" + e.button;
  return query;
}

function onMouseDown(e: MouseEvent) {
  const target = e.target as SVGElement;
  const itemIcon = target.closest(".item-icon");
  const mouseQuery = getMouseQuery(e);

  // 1. 处理删除 (默认中键)
  if (getSetting("reciper.delete_item_slot")?.value === mouseQuery) {
    const slot = target.closest("[data-slot-role]");
    if (slot) {
      e.preventDefault();
      e.stopPropagation();
      target.dispatchEvent(
        new CustomEvent("replace-item", {
          bubbles: true,
          detail: { idorTag: "" }
        })
      );
    }
    return;
  }

  const id = itemIcon?.id;
  if (!id) return;

  // 2. 处理忽略操作
  const ignoreVal = getSetting("reciper.ignore_item_op")?.value;
  if (ignoreVal === "S" && e.shiftKey) return;
  if (ignoreVal === "C" && e.ctrlKey) return;
  if (ignoreVal === "A" && e.altKey) return;

  e.stopPropagation()

  // 3. 处理打开配方
  if (getSetting("reciper.open_recipe_result")?.value === mouseQuery)
    openRecipeModal(id, "result")
  else if (getSetting("reciper.open_recipe_usage")?.value === mouseQuery)
    openRecipeModal(id, "usage")
  else if (e.button === 0) { // 左键拖拽
    const tag = (e.target as SVGElement).closest(".item-icon")?.getAttribute("data-tag")
    startDragItem(e, tag ? tag : id)
  }
}

onSetup(() => {
  window.addEventListener("mousedown", onMouseDown, true);
  return () => window.removeEventListener("mousedown", onMouseDown, true);
});
