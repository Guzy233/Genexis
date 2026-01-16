import { onSetup } from "../Globals";
import { objects, registerOnFileLoaded, updateCanvas, managerUpdateAtom } from "../Manager";
import { openItemListPanel, toggleItemList } from "./ItemListPanel";
import { Recipe } from "./RecipePreview";
import { registerKeyAction } from "../Controllers/Keyboard";
import { openInitializationModal } from "./InitializationModal";

import "./MCFluidNode";
import "./MCChemicalNode"

export var coords: Record<string, any> = {}
export var translations: Record<string, string> = {}
export var recipesLoaded = false;
export var currentConfig: { gameFolder: string; version: string; datapackName: string; language: string; exportPath?: string; exportType?: "kubejs" | "datapack" | "custom" } | null = null;
export var atlasUrl: string = "";

export async function fetchWithFolder(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (currentConfig?.gameFolder) {
    headers.set("X-Game-Folder", currentConfig.gameFolder);
  }
  return fetch(url, { ...init, headers });
}

async function getCoords() {
  coords = await fetchWithFolder("/reciper/rects").then(res => res.json())
}

async function getTranslations() {
  translations = await fetchWithFolder("/reciper/translations").then(res => res.json())
}

async function getAtlas() {
  const res = await fetchWithFolder("/reciper/atlas");
  if (!res.ok) return;
  const blob = await res.blob();
  if (atlasUrl) URL.revokeObjectURL(atlasUrl);
  atlasUrl = URL.createObjectURL(blob);
}

export async function loadRecipes(config?: { gameFolder: string; version: string; datapackName: string; language: string; exportPath?: string; exportType?: "kubejs" | "datapack" | "custom" }) {
  if (config) {
    currentConfig = config;
  }
  await Promise.all([
    getCoords(),
    getTranslations(),
    getAtlas()
  ]);
  recipesLoaded = true;
}

export async function initializeReciperApi(
  config: {
    gameFolder: string;
    version: string;
    datapackName: string;
    language: string;
    exportPath?: string;
    exportType?: "kubejs" | "datapack" | "custom";
    forceReload?: boolean
  }) {
  const response = await fetch("reciper/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error("初始化失败");
  }

  const { forceReload, ...rest } = config;
  await loadRecipes(rest);
  await loadAllTags();
  openItemListPanel();

  updateCanvas()
  Object.values(objects).forEach((obj) => {
    if ("contentUpdater" in obj) {
      const recipeNode = obj as RecipeNode
      managerUpdateAtom(recipeNode.contentUpdater)
    }
  })
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
  "advanced_ae:reaction": "高级反应",
  "mekanism:metallurgic_infusing": "冶金灌注",
  "mekanism:combining": "压缩",
  "mekanism:chemical_infusing": "化学注入",
  "mekanism:dissolution": "溶解",
  "mekanism:washing": "化学清洗",
  "mekanism:crystallizing": "结晶",
  "mekanism:reaction": "加压反应",
  "mekanism:centrifuging": "同位素离心",
  "mekanism:nucleosynthesizing": "反物质核合成",
  "create:mixing": "动力搅拌",
  "create:crushing": "粉碎轮",
  "create:pressing": "压片",
  "create:cutting": "切割",
  "create:milling": "石磨",
  "create:compacting": "压块",
  "create:haunting": "缠魂",
  "create:splashing": "洗涤",
  "create:deploying": "机械手",
  "create:filling": "流体填充",
  "create:emptying": "流体排空",
  "create:sequenced_assembly": "动力装配",
};

// 从后端获取配方数据
export async function fetchRecipes(itemId: string, type: "result" | "usage"): Promise<Recipe[]> {
  const endpoint = type === "result"
    ? `/reciper/result?id=${encodeURIComponent(itemId)}`
    : `/reciper/usage?id=${encodeURIComponent(itemId)}`;

  const response = await fetchWithFolder(endpoint);
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

  const response = await fetchWithFolder(`/reciper/search/${encodeURIComponent(query)}`);
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
    const response = await fetchWithFolder("/reciper/allTags");
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


onSetup((_canvas: SVGGElement) => {
  registerKeyAction({
    action: "reciper.open_item_list",
    handler: () => {
      if (!recipesLoaded) {
        openInitializationModal();
      } else {
        toggleItemList();
      }
    },
    settings: {
      id: "reciper.open_item_list",
      category: "Keyboard",
      title: "物品列表",
      type: "key" as any,
      defaultValue: "Ce",
      value: "Ce",
      description: "打开物品列表面板",
    }
  });
  return () => { };
});

registerOnFileLoaded(async (tab) => {
  const metadata = tab.metadata["reciper"];
  if (!metadata) return;

  // 1. 如果尚未初始化，尝试使用文件中的元数据自动初始化
  if (!recipesLoaded) {
    try {
      console.log("检测到文件元数据，尝试自动初始化 Reciper...", metadata);
      await initializeReciperApi(metadata as any);
    } catch (err) {
      console.error("自动初始化失败:", err);
    }
    return;
  }

  // 2. 检查配置一致性
  if (currentConfig && metadata.datapackName !== currentConfig.datapackName) {
    const confirmReinit = confirm(`当前文件的数据包 (${metadata.datapackName}) 与系统已初始化的数据包 (${currentConfig.datapackName}) 不一致。\n是否重新初始化？`);
    if (confirmReinit) {
      try {
        await initializeReciperApi(metadata as any);
      } catch (err) {
        alert("重新初始化失败: " + err);
      }
    }
  }

  // 3. 自动打开物品面板
  if (recipesLoaded && metadata.datapackName === currentConfig?.datapackName) {
    openItemListPanel();
  }
});

import { registerOnBeforeSave, registerOnTabCreated, registerOnFileSaved } from "../Manager";
import { RecipeNode } from "./RecipeNode";

// 自动为新标签注入当前配置元数据
registerOnTabCreated((tab) => {
  if (currentConfig) {
    tab.metadata["reciper"] = { ...currentConfig };
  }
});

// 保存前确保元数据是最新的
registerOnBeforeSave((tab) => {
  if (currentConfig) {
    tab.metadata["reciper"] = { ...tab.metadata["reciper"], ...currentConfig };
  }
});

// 文件保存后自动导出数据包
registerOnFileSaved(async (tab) => {
  if (!currentConfig?.exportPath || !recipesLoaded) return;

  const recipesToExport: any[] = [];
  const recipeNodes = Object.values(objects).filter(obj => obj.type === "node/recipe") as RecipeNode[];

  for (const node of recipeNodes) {
    const mode = node.modifyMode || "override";
    if (mode === "none") continue;

    let exportRecipe: any;
    if (mode === "delete") {
      // 写入无效配方以实现“删除”效果
      exportRecipe = {
        id: node.recipe.id,
        type: "minecraft:crafting_shapeless",
        ingredients: [
          { "item": "minecraft:air" }
        ],
        result: { "id": "minecraft:air", "count": 0 }
      };
    } else {
      exportRecipe = { ...node.recipe };
      if (mode === "add") {
        // 增加模式下使用节点 ID 前 6 位生成持久且唯一的 ID
        const randomSuffix = node.id.substring(0, 6);
        exportRecipe.id = `test:${randomSuffix}`;
      }
      // override 模式下不修改 id，直接使用原 id 覆盖
    }
    recipesToExport.push(exportRecipe);
  }

  if (recipesToExport.length === 0) {
    console.log("没有需要导出的配方变化");
    return;
  }

  try {
    const response = await fetchWithFolder("/reciper/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exportPath: currentConfig.exportPath,
        recipes: recipesToExport
      }),
    });

    if (!response.ok) {
      throw new Error(`导出失败: ${response.statusText}`);
    }

    console.log(`成功导出 ${recipesToExport.length} 个配方到: ${currentConfig.exportPath}`);
  } catch (err) {
    console.error("自动导出数据包时出错:", err);
  }
});
