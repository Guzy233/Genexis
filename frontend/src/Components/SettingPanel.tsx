import React, { useState, useMemo, useEffect } from "react";
import { getSettingsByCategory, setValue } from "../Option";

const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const categories = getSettingsByCategory();

  return (
    <div className="settings-panel">
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