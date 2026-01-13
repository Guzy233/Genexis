import { Controllers } from "../Globals";
import { openItemListPanel, toggleItemList } from "./ItemListPanel";
import { openInitializationModal } from "./InitializationModal";
import { Recipe } from "./RecipePreview";

export var coords: Record<string, any> = {}
export var translations: Record<string, string> = {}
export var recipesLoaded = false;

async function getCoords() {
  coords = await fetch("/reciper/rects").then(res => res.json())
}

async function getTranslations() {
  translations = await fetch("/reciper/translations").then(res => res.json())
}

export async function loadRecipes() {
  await Promise.all([
    getCoords(),
    getTranslations()
  ]);
  recipesLoaded = true;
}

// 配方类型名称映射
export const RECIPE_TYPE_NAMES: Record<string, string> = {
  "minecraft:crafting_shaped": "有序合成",
  "crafting_shaped": "有序合成",
  "minecraft:crafting_shapeless": "无序合成",
  "crafting_shapeless": "无序合成",
  "minecraft:smelting": "熔炼",
  "smelting": "熔炼",
  "minecraft:blasting": "高温熔炼",
  "blasting": "高温熔炼",
  "minecraft:smoking": "烟熏",
  "smoking": "烟熏",
  "minecraft:campfire_cooking": "营火烹饪",
  "campfire_cooking": "营火烹饪",
  "stonecutting": "切石",
  "minecraft:stonecutting": "切石",
  "smithing": "锻造",
  "minecraft:smithing": "锻造",
  "smithing_trim": "锻造模具",
  "minecraft:smithing_trim": "锻造模具",
  "enderio:alloy_smelting": "合金熔炼 (EnderIO)",
  "actuallyadditions:empowering": "原子强化 (AA)",
  "immersiveengineering:arc_furnace": "电弧炉 (IE)",
  "immersiveengineering:crusher": "粉碎机 (IE)",
  "immersiveengineering:squeezer": "工业压榨 (IE)",
  "immersiveengineering:fermenter": "发酵池 (IE)",
  "immersiveengineering:metal_press": "金属冲压 (IE)",
  "immersiveengineering:blast_furnace": "粗制焦炉 (IE)",
  "immersiveengineering:coke_oven": "焦炭炉 (IE)",
  "immersiveengineering:alloy": "合金窑 (IE)",
  "thermal:smelter": "感应熔炉 (Thermal)",
  "thermal:pulverizer": "磨粉机 (Thermal)",
  "thermal:sawmill": "锯木厂 (Thermal)",
  "thermal:press": "多功能压机 (Thermal)",
  "thermal:crucible": "熔化炉 (Thermal)",
  "thermal:chiller": "流体转注机 (Thermal)",
  "thermal:refinery": "精炼厂 (Thermal)",
  "thermal:centrifuge": "离心机 (Thermal)",
  "thermal:brewer": "炼药机 (Thermal)",
  "mekanism:crushing": "粉碎 (Mekanism)",
  "mekanism:enriching": "富集 (Mekanism)",
  "mekanism:smelting": "熔炼 (Mekanism)",
  "mekanism:purifying": "净化 (Mekanism)",
  "mekanism:injecting": "注入 (Mekanism)",
  "mekanism:compressing": "压缩 (Mekanism)",
  "mekanism:sawing": "锯木 (Mekanism)",
};

// 从后端获取配方数据
export async function fetchRecipes(itemId: string, type: "result" | "usage"): Promise<Recipe[]> {
  const endpoint = type === "result"
    ? `/reciper/result?id=${encodeURIComponent(itemId)}`
    : `/reciper/usage?id=${encodeURIComponent(itemId)}`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error("获取配方失败");
  }
  return await response.json();
}

// 从后端搜索物品
export async function searchItemsApi(query: string): Promise<string[]> {
  if (!query.trim()) {
    return recipesLoaded ? Object.keys(coords) : [];
  }

  const response = await fetch(`/reciper/search/${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error("搜索失败");
  }
  const data = await response.json();
  return data.items || [];
}

// 标签缓存
const tagItems: Map<string, string[]> = new Map();

export const loadAllTags = async () => {
  try {
    const response = await fetch("/reciper/allTags");
    if (!response.ok) return;
    const data: Record<string, string[]> = await response.json();
    Object.entries(data).forEach(([tag, items]) =>
      tagItems.set(tag, items)
    );
  } catch (error) {
    console.error("获取所有标签失败", error);
  }
}


export const getTagItems = (tag: string): string[] => tagItems.get(tag) || [];

let reciperInitialized = false;

const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'e' || !e.ctrlKey)
    return

  if (!recipesLoaded) {
    openInitializationModal()
  } else {
    toggleItemList()
  }
}


Controllers.push({
  Begin: (_canvas: SVGGElement) => {
    window.addEventListener("keydown", onKeydown)

  },
  End: (_canvas: SVGGElement) => {
    window.removeEventListener("keydown", onKeydown)
  },
});
