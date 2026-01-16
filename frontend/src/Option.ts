// 设置管理系统 - 操作器和组件通过注册设置项

import { ReadConfig, WriteConfig } from "../wailsjs/go/main/App";
import { onSetup } from "./Globals";

export type SettingType = "key" | "mousekey" | "toggle" | "number" | "string";

export interface SettingItem {
  id: string;
  category: string;
  title: string;
  type: SettingType;
  defaultValue: any;
  value: any;
  description?: string;
  onChange?: (value: any) => void; // 值变化时通知注册者
}

interface SettingCategory {
  name: string;
  items: SettingItem[];
}

// 配置文件数据结构
interface ConfigData {
  [key: string]: any;
}

// 设置注册表
const settings = new Map<string, SettingItem>();
const categories = new Map<string, SettingCategory>();

// 是否已加载配置
let configLoaded = false;

// 标记配置需要保存
let configNeedsSave = false;

/**
 * 注册设置项
 */
export function registerSetting(item: SettingItem): void {
  settings.set(item.id, item);

  if (!categories.has(item.category)) {
    categories.set(item.category, { name: item.category, items: [] });
  }

  const category = categories.get(item.category)!;
  const existingIndex = category.items.findIndex(i => i.id === item.id);
  if (existingIndex !== -1) {
    category.items[existingIndex] = item;
  } else {
    category.items.push(item);
  }
}

/**
 * 获取所有分类及设置项
 */
export function getSettingsByCategory(): SettingCategory[] {
  return Array.from(categories.values());
}

/**
 * 获取单个设置项
 */
export function getSetting(id: string): SettingItem | undefined {
  return settings.get(id);
}

/**
 * 修改设置值并触发回调
 */
export function setValue(id: string, value: any): void {
  const item = settings.get(id);
  if (item) {
    item.value = value;
    if (item.onChange) {
      item.onChange(value);
    }
    // 标记需要保存配置
    configNeedsSave = true;
    scheduleSaveConfig();
  }
}

/**
 * 重置所有设置到默认值
 */
export function resetAll(): void {
  settings.forEach((item) => {
    item.value = item.defaultValue;
    if (item.onChange) {
      item.onChange(item.defaultValue);
    }
  });
  configNeedsSave = true;
  scheduleSaveConfig();
}

// ==================== 配置文件持久化 ====================

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * 延迟保存配置（防抖）
 */
function scheduleSaveConfig(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveConfig();
    saveTimeout = null;
  }, 500); // 500ms 防抖
}

/**
 * 保存配置到文件
 */
async function saveConfig(): Promise<void> {
  if (!configNeedsSave) return;

  try {
    // 收集所有设置值
    const configData: ConfigData = {};
    settings.forEach((item) => {
      configData[item.id] = item.value;
    });

    const jsonString = JSON.stringify(configData, null, 2);
    await WriteConfig(jsonString);

    configNeedsSave = false;
    console.log("配置已保存");
  } catch (error) {
    console.error("保存配置失败:", error);
  }
}

/**
 * 从配置文件加载设置
 */
async function loadConfigInternal(): Promise<void> {
  if (configLoaded) return;

  try {
    const configString = await ReadConfig();
    const configData: ConfigData = JSON.parse(configString);

    // 应用配置值到已注册的设置项
    Object.entries(configData).forEach(([id, value]) => {
      const item = settings.get(id);
      if (item && value !== undefined) {
        item.value = value;
        // 不触发 onChange，因为在加载配置时我们只想设置值
      }
    });

    configLoaded = true;
    console.log("配置已加载");
  } catch (error) {
    console.error("加载配置失败:", error);
    configLoaded = true; // 即使失败也标记为已加载，避免重复尝试
  }
}

/**
 * 初始化配置系统（在 onSetup 中调用）
 * 必须在所有设置项注册完成后调用
 */
export function initConfig(): () => void {
  // 使用微任务确保在所有设置项注册完成后执行
  const promise = loadConfigInternal();

  // 返回清理函数
  return () => {
    // 保存配置
    promise.then(() => {
      saveConfigNow();
    });
  };
}

/**
 * 获取当前配置的快照（用于显示或调试）
 */
export function getConfigSnapshot(): ConfigData {
  const snapshot: ConfigData = {};
  settings.forEach((item, id) => {
    snapshot[id] = item.value;
  });
  return snapshot;
}

/**
 * 立即保存配置（不使用防抖）
 */
export async function saveConfigNow(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  await saveConfig();
}

// 配置系统控制器
// 负责在应用启动时加载配置，退出时保存配置
onSetup((_canvas: SVGGElement) => {
  return initConfig();
});
