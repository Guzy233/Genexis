import React, { useState, useEffect } from "react";
import { onSetup, topLayer } from "../Globals";
import { getSettingsByCategory, setValue, SettingItem } from "../Option";

// 设置面板状态管理
let showSettingsPanel = false;
const settingsPanelSubscribers: Set<(show: boolean) => void> = new Set();

// 打开设置面板
export const openSettingsPanel = () => {
  showSettingsPanel = true;
  settingsPanelSubscribers.forEach((cb) => cb(true));
};

onSetup(() => {
  window.addEventListener("open-settings", openSettingsPanel);
  return () => window.removeEventListener("open-settings", openSettingsPanel);
});


// 关闭设置面板
export const closeSettingsPanel = () => {
  showSettingsPanel = false;
  settingsPanelSubscribers.forEach((cb) => cb(false));
};

// 订阅设置面板状态变化
export const onSettingsPanelChange = (
  callback: (show: boolean) => void
): (() => void) => {
  settingsPanelSubscribers.add(callback);
  return () => {
    settingsPanelSubscribers.delete(callback);
  };
};

// 注册设置面板到顶层
topLayer.push(() => {
  const [visible, setVisible] = useState(showSettingsPanel);
  const [, updateCounter] = useState(0);
  const [editingValues, setEditingValues] = useState<Map<string, string>>(new Map());
  const categories = getSettingsByCategory();

  // 订阅状态变化
  useEffect(() => {
    return onSettingsPanelChange((show) => {
      setVisible(show);
    });
  }, []);

  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.name ?? "");

  // 当面板打开且没有选中分类时，默认选中第一个
  useEffect(() => {
    if (visible && (!activeCategory || !categories.find(c => c.name === activeCategory))) {
      setActiveCategory(categories[0]?.name ?? "");
    }
  }, [visible, categories]);

  // 强制组件重新渲染
  const forceUpdate = () => {
    updateCounter(prev => prev + 1);
  };

  // 处理数字类型输入变化
  const handleNumberInputChange = (itemId: string, newValue: string) => {
    setEditingValues(prev => new Map(prev).set(itemId, newValue));
  };

  // 数字输入框失去焦点时提交值
  const handleNumberBlur = (item: SettingItem) => {
    const inputValue = editingValues.get(item.id);
    if (inputValue !== undefined) {
      const num = parseFloat(inputValue);
      if (!isNaN(num)) {
        setValue(item.id, num);
        forceUpdate();
      }
      setEditingValues(prev => {
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // 处理字符串类型输入变化
  const handleStringInputChange = (itemId: string, newValue: string) => {
    setEditingValues(prev => new Map(prev).set(itemId, newValue));
  };

  // 字符串输入框失去焦点时提交值
  const handleStringBlur = (item: SettingItem) => {
    const inputValue = editingValues.get(item.id);
    if (inputValue !== undefined) {
      setValue(item.id, inputValue);
      forceUpdate();
      setEditingValues(prev => {
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // 获取显示值
  const getDisplayValue = (item: SettingItem) => {
    return editingValues.get(item.id) ?? String(item.value);
  };

  if (!visible) return null;

  const currentCategory = categories.find(c => c.name === activeCategory);

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="settings-backdrop visible"
        onClick={() => closeSettingsPanel()}
      />
      {/* 设置面板 */}
      <div className="settings-panel visible">
        <div className="settings-header">
          <span className="settings-title">设置</span>
          <button className="settings-close" onClick={() => closeSettingsPanel()}>×</button>
        </div>
        <div className="settings-body">
          <div className="settings-sidebar">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className={`settings-sidebar-item ${activeCategory === cat.name ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.name)}
              >
                {cat.name}
              </div>
            ))}
          </div>
          <div className="settings-content">
            {currentCategory && (
              <div className="settings-category-group">
                <h3 className="settings-category-header">{currentCategory.name}</h3>
                {currentCategory.items.map((item) => (
                  <div key={item.id} className="settings-item">
                    <div className="settings-item-main">
                      <div className="settings-item-info">
                        <span className="settings-item-title">{item.title}</span>
                        {item.description && (
                          <span className="settings-item-desc">{item.description}</span>
                        )}
                      </div>
                      <div className="settings-item-control">
                        {item.type === "key" && (
                          <input
                            type="text"
                            className="settings-item-input"
                            value={item.value}
                            readOnly
                            onClick={() => {
                              const newKey = prompt(`输入新的按键绑定 (当前: ${item.value}):`);
                              if (newKey) {
                                setValue(item.id, newKey);
                                forceUpdate();
                              }
                            }}
                          />
                        )}
                        {item.type === "toggle" && (
                          <div className={`settings-switch ${item.value ? "active" : ""}`}
                            onClick={() => {
                              setValue(item.id, !item.value);
                              forceUpdate();
                            }}
                          >
                            <div className="settings-switch-thumb" />
                          </div>
                        )}
                        {item.type === "number" && (
                          <input
                            type="number"
                            className="settings-item-input"
                            value={getDisplayValue(item)}
                            step={0.05}
                            min={0}
                            max={10}
                            onChange={(e) => handleNumberInputChange(item.id, e.target.value)}
                            onBlur={() => handleNumberBlur(item)}
                          />
                        )}
                        {item.type === "string" && (
                          <input
                            type="text"
                            className="settings-item-input"
                            value={getDisplayValue(item)}
                            onChange={(e) => handleStringInputChange(item.id, e.target.value)}
                            onBlur={() => handleStringBlur(item)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
