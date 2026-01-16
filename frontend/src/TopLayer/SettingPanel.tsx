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
  const [recordingId, setRecordingId] = useState<string | null>(null);

  // 当面板打开且没有选中分类时，默认选中第一个
  useEffect(() => {
    if (visible && (!activeCategory || !categories.find(c => c.name === activeCategory))) {
      setActiveCategory(categories[0]?.name ?? "");
    }
    if (!visible) setRecordingId(null);
  }, [visible, categories]);

  // 按键/鼠标录制逻辑
  useEffect(() => {
    if (!recordingId) return;

    const item = categories.flatMap(c => c.items).find(i => i.id === recordingId);
    if (!item) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (item.type !== 'key') return;
      e.preventDefault();
      e.stopPropagation();

      const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);

      if (!isModifier) {
        let key = e.key;
        // 保持与 Keyboard.ts 一致的简写格式：Ctrl=C, Alt=A, Shift=S
        const query =
          (e.ctrlKey ? "C" : "") +
          (e.altKey ? "A" : "") +
          (e.shiftKey ? "S" : "") +
          (key === " " ? "Space" : key);

        setValue(item.id, query);
        setRecordingId(null);
        forceUpdate();
      } else {
        // 更新实时显示
        forceUpdate();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (item.type !== 'key') return;
      const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
      if (isModifier && recordingId === item.id) {
        // 如果松开了修饰键且还没保存（即还没按下普通键），则保存该修饰键
        setValue(item.id, e.key);
        setRecordingId(null);
        forceUpdate();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (item.type !== 'mousekey') return;

      // 阻止浏览器默认动作（如侧键前进后退）
      e.preventDefault();
      e.stopPropagation();

      const query =
        (e.ctrlKey ? "C" : "") +
        (e.altKey ? "A" : "") +
        (e.shiftKey ? "S" : "") +
        "M" + e.button;

      setValue(item.id, query);
      setRecordingId(null);
      forceUpdate();
    };

    // 使用捕获阶段确保拦截所有输入
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('mousedown', handleMouseDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [recordingId]);

  // 格式化按键显示
  const formatKey = (value: string | number) => {
    if (value === undefined || value === null || value === "") return "未绑定";
    const str = String(value);

    // 处理单功能键全称
    const fullNames: Record<string, string> = {
      "Control": "Ctrl",
      "Shift": "Shift",
      "Alt": "Alt",
      "Meta": "Win",
      "Space": "空格"
    };
    if (fullNames[str]) return fullNames[str];

    // 处理组合键
    const parts = [];
    let pos = 0;
    if (str.startsWith("C")) { parts.push("Ctrl"); pos++; }
    if (str.startsWith("A", pos)) { parts.push("Alt"); pos++; }
    if (str.startsWith("S", pos)) { parts.push("Shift"); pos++; }

    const remaining = str.substring(pos);
    if (remaining) {
      parts.push(fullNames[remaining] || remaining.toUpperCase());
    }

    return parts.join("+");
  };

  // 格式化正在录制的按键
  const formatRecordingKey = (e: KeyboardEvent | null) => {
    if (!e) return "等待输入...";
    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Win");

    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
    if (!isModifier && e.key) {
      parts.push(e.key === " " ? "空格" : e.key.toUpperCase());
    }

    return parts.length > 0 ? parts.join("+") : "等待输入...";
  };

  // 状态辅助：获取当前录制的实时事件（通过 ref 或闭包其实很难在 React 中实时更新 UI 除非存 state）
  // 简单起见，我们还是在 keydown 时更新一个特定的 state
  const [currentKbdEvent, setCurrentKbdEvent] = useState<KeyboardEvent | null>(null);

  // 拦截全局键盘事件来更新 UI
  useEffect(() => {
    if (!recordingId) {
      setCurrentKbdEvent(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => setCurrentKbdEvent(e);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [recordingId]);

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

  // 获取鼠标按键名称
  const getMouseButtonName = (value: string | number) => {
    if (value === undefined || value === null || value === "") return "未绑定";
    const str = String(value);

    const parts = [];
    let pos = 0;
    if (str.startsWith("C")) { parts.push("Ctrl"); pos++; }
    if (str.startsWith("A", pos)) { parts.push("Alt"); pos++; }
    if (str.startsWith("S", pos)) { parts.push("Shift"); pos++; }

    const remaining = str.substring(pos);
    if (remaining.startsWith("M")) {
      const buttonNum = parseInt(remaining.substring(1));
      let btnName = "";
      switch (buttonNum) {
        case 0: btnName = "左键"; break;
        case 1: btnName = "中键"; break;
        case 2: btnName = "右键"; break;
        case 3: btnName = "后退键 (M3)"; break;
        case 4: btnName = "前进键 (M4)"; break;
        default: btnName = `按键 ${buttonNum}`;
      }
      parts.push(btnName);
    } else if (!isNaN(parseInt(str))) {
      // 兼容旧的纯数字格式
      switch (parseInt(str)) {
        case 0: return "左键";
        case 1: return "中键";
        case 2: return "右键";
        case 3: return "后退键";
        case 4: return "前进键";
        default: return `按键 ${str}`;
      }
    } else {
      return str;
    }

    return parts.join("+");
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
                          <button
                            className={`settings-recorder-btn ${recordingId === item.id ? "recording" : ""}`}
                            onClick={() => setRecordingId(item.id)}
                          >
                            <span className="settings-recorder-value">
                              {recordingId === item.id ? formatRecordingKey(currentKbdEvent) : formatKey(item.value)}
                            </span>
                            {recordingId === item.id && <span className="settings-recorder-hint">录制中...</span>}
                          </button>
                        )}
                        {item.type === "mousekey" && (
                          <button
                            className={`settings-recorder-btn ${recordingId === item.id ? "recording" : ""}`}
                            onClick={() => setRecordingId(item.id)}
                          >
                            <span className="settings-recorder-value">
                              {recordingId === item.id ? "等待点击..." : getMouseButtonName(item.value)}
                            </span>
                            {recordingId === item.id && <span className="settings-recorder-hint">录制中...</span>}
                          </button>
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
