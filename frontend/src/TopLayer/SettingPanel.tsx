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
          <span>设置</span>
          <button className="settings-close" onClick={() => closeSettingsPanel()}>×</button>
        </div>
        <div className="settings-content">
          {categories.map((cat) => (
            <div key={cat.name} className="settings-category">
              <h3 className="settings-category-title">{cat.name}</h3>
              {cat.items.map((item) => (
                <div key={item.id} className="settings-item">
                  <label className="settings-item-label">
                    <span className="settings-item-title">{item.title}</span>
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
                      <input
                        type="checkbox"
                        className="settings-item-input"
                        checked={item.value}
                        onChange={(e) => {
                          setValue(item.id, e.target.checked);
                          forceUpdate();
                        }}
                      />
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
                  </label>
                  {item.description && (
                    <span className="settings-item-desc">{item.description}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
});
