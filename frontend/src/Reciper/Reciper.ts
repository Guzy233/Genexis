import { onSetup } from "../Globals";
import { objects, registerOnFileLoaded, updateCanvas, managerUpdateAtom, managerUpdate } from "../Manager";
import { openItemListPanel, toggleItemList } from "./ItemListPanel";
import { Recipe } from "./RecipePreview";
import { registerKeyAction } from "../Controllers/Keyboard";
import { openInitializationModal } from "./InitializationModal";
import { createRecipeNode, RecipeNode } from "./RecipeNode";

import "./MCFluidNode";
import "./Classes/Mekanism";
import "./Classes/Ae2";
import "./Classes/IntegratedDynamics";
import "./Classes/Avaritia";

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
    forceReload?: boolean;
    importExisting?: boolean;
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

  const { forceReload, importExisting, ...rest } = config;
  await loadRecipes(rest);
  await loadAllTags();
  openItemListPanel();

  if (importExisting) {
    try {
      const existingRecipes = await fetchExistingRecipes();
      const COLS = 5;
      const GAP = 300;

      existingRecipes.forEach((recipe, index) => {
        const node = createRecipeNode(recipe);
        node.pos = {
          x: (index % COLS) * GAP,
          y: Math.floor(index / COLS) * GAP
        };
        node.modifyMode = "override";
        objects[node.id] = node;
      });
      console.log(`成功导入 ${existingRecipes.length} 个现有配方`);
    } catch (err) {
      console.error("导入现有配方失败:", err);
    }
  }

  updateCanvas();
  Object.values(objects).forEach((obj) => {
    if ("contentUpdater" in obj) {
      const recipeNode = obj as RecipeNode;
      managerUpdateAtom(recipeNode.contentUpdater);
    }
  });
}

// 获取现有配方
export async function fetchExistingRecipes(): Promise<Recipe[]> {
  const response = await fetchWithFolder("/reciper/existingRecipes");
  if (!response.ok) {
    throw new Error("获取现有配方失败");
  }
  return await response.json();
}

import { RECIPE_TYPE_NAMES } from "./Constants";
export { RECIPE_TYPE_NAMES };

// 获取配方类型的中文名称
export const getRecipeTypeName = (type: string): string => {
  if (RECIPE_TYPE_NAMES[type]) {
    return RECIPE_TYPE_NAMES[type];
  }

  // 尝试模糊匹配
  const lowerType = type.toLowerCase();
  if (lowerType.includes('shaped')) return '有序合成';
  if (lowerType.includes('shapeless')) return '无序合成';
  if (lowerType.includes('smelting')) return '熔炼';
  if (lowerType.includes('blasting')) return '高炉冶炼';
  if (lowerType.includes('crushing')) return '粉碎';
  if (lowerType.includes('mixing')) return '搅拌';
  if (lowerType.includes('pressing')) return '压制';
  if (lowerType.includes('infusing')) return '灌注';

  // 返回原始类型（去掉命名空间前缀）
  const shortType = type.split(':').pop() || type;
  return shortType.replace(/_/g, ' ');
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
