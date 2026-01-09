import React, { useState, useMemo, useEffect } from "react";
import { getSettingsByCategory, setValue, SettingItem } from "../Option";

const SettingsPanel: React.FC<{ onClose: () => void; visible?: boolean }> = ({ onClose, visible = true }) => {
  const categories = getSettingsByCategory();

  // 处理数字类型输入变化
  const handleNumberChange = (item: SettingItem, newValue: string) => {
    const num = parseFloat(newValue);
    if (!isNaN(num)) {
      setValue(item.id, num);
    }
  };

  // 处理字符串类型输入变化
  const handleStringChange = (item: SettingItem, newValue: string) => {
    setValue(item.id, newValue);
  };

  return (
    <div className={`settings-panel ${visible ? "visible" : ""}`}>
      <div className="settings-header">
        <span>设置</span>
        <button className="settings-close" onClick={onClose}>×</button>
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
                        // TODO: 实现按键录制
                        const newKey = prompt(`输入新的按键绑定 (当前: ${item.value}):`);
                        if (newKey) {
                          setValue(item.id, newKey);
                        }
                      }}
                    />
                  )}
                  {item.type === "toggle" && (
                    <input
                      type="checkbox"
                      className="settings-item-input"
                      checked={item.value}
                      onChange={(e) => setValue(item.id, e.target.checked)}
                    />
                  )}
                  {item.type === "number" && (
                    <input
                      type="number"
                      className="settings-item-input"
                      value={item.value}
                      step={0.05}
                      min={0}
                      max={10}
                      onChange={(e) => handleNumberChange(item, e.target.value)}
                    />
                  )}
                  {item.type === "string" && (
                    <input
                      type="text"
                      className="settings-item-input"
                      value={item.value}
                      onChange={(e) => handleStringChange(item, e.target.value)}
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
  );
};

export default SettingsPanel