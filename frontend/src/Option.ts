// 设置管理系统 - 操作器和组件通过注册设置项

export type SettingType = "key" | "toggle" | "number" | "string";

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

// 设置注册表
const settings = new Map<string, SettingItem>();
const categories = new Map<string, SettingCategory>();

/**
 * 注册设置项
 */
export function registerSetting(item: SettingItem): void {
  settings.set(item.id, item);

  if (!categories.has(item.category)) {
    categories.set(item.category, { name: item.category, items: [] });
  }
  categories.get(item.category)!.items.push(item);
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
}