import { screen2Viewport } from "../Controllers/Camera";
import { ObjectFactories } from "../Controllers/Creator";
import { onSetup, idFromEvent, Node } from "../Globals";
import { managerAdd } from "../Manager";
import { translations } from "./Reciper";
import { openRecipeModal } from "./RecipeListModal";

// 拖拽放置物品到画布的过程式逻辑
// export interface DragInfo {
//   type: string;
//   id: string;
//   amount?: number;
//   [key: string]: any;
// }

export const startDragItem = (e: MouseEvent, info: any) => {
  e.preventDefault();
  e.stopPropagation();

  // 获取物品的名称
  const itemName = translations[info.id] || info.id;

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

  // 如果有数量，显示数量
  if (info.amount && info.amount > 1) {
    const amountLabel = document.createElement("span");
    amountLabel.style.fontSize = "10px";
    amountLabel.style.color = "#a1a1aa";
    if (info.type === 'item') {
      amountLabel.textContent = `x${info.amount}`;
    } else {
      amountLabel.textContent = info.amount >= 1000 ? `${(info.amount / 1000).toFixed(1)}B` : `${info.amount}mb`;
    }
    previewContainer.appendChild(amountLabel);
  }

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
      const viewportPos = screen2Viewport({ x: e.clientX, y: e.clientY });

      // let node: any;
      let node = ObjectFactories["node/mc/" + info.type](info) as Node;
      node.pos = viewportPos
      if (node) {
        managerAdd(node);
      }
    } else {
      const target = e.target as SVGElement;
      const slot = target.closest("[data-slot-role]");
      if (!slot) return;

      target.dispatchEvent(
        new CustomEvent("replace-item", {
          bubbles: true,
          detail: info
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
  const source = target.closest("[data-type]") as SVGElement;
  const mouseQuery = getMouseQuery(e);

  // 1. 处理删除 (只有物品插槽可以删除)
  if (getSetting("reciper.delete_item_slot")?.value === mouseQuery) {
    const slot = target.closest("[data-slot-role]");
    if (slot && slot.getAttribute("data-slot-role") !== "output") {
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

  if (!source) return;

  const info = source.dataset

  // 2. 处理忽略操作
  const ignoreVal = getSetting("reciper.ignore_item_op")?.value;
  if (ignoreVal === "S" && e.shiftKey) return;
  if (ignoreVal === "C" && e.ctrlKey) return;
  if (ignoreVal === "A" && e.altKey) return;

  e.stopPropagation()

  // 3. 处理打开配方 (目前主要支持物品, 未来可扩展流体和化学品)
  if (getSetting("reciper.open_recipe_result")?.value === mouseQuery)
    openRecipeModal(info?.id!, "result")
  else if (getSetting("reciper.open_recipe_usage")?.value === mouseQuery)
    openRecipeModal(info?.id!, "usage")
  else if (e.button === 0) { // 左键拖拽
    startDragItem(e, info)
  }
}

onSetup(() => {
  window.addEventListener("mousedown", onMouseDown, true);
  return () => window.removeEventListener("mousedown", onMouseDown, true);
});
