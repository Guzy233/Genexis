import React from "react";
import { useAtom } from "jotai";
import { topLayer } from "../Globals";
import {
  tabsUpdater,
  getAllTabs,
  getActiveTab,
  switchTabById,
  closeTabById,
} from "../Manager";

interface FileTab {
  id: string;
  filePath: string | null;
  fileName: string;
  objects: Record<string, any>;
  isModified: boolean;
}

topLayer.push(() => {
  const [, forceUpdate] = useAtom(tabsUpdater);
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null);

  // 获取标签列表
  const tabs = getAllTabs();
  const activeTab = getActiveTab();

  // 处理标签点击
  const handleTabClick = (tabId: string) => {
    if (tabId !== activeTab?.id) {
      switchTabById(tabId);
      forceUpdate(Math.random());
    }
  };

  // 处理关闭按钮点击
  const handleCloseClick = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    await closeTabById(tabId);
    forceUpdate(Math.random());
  };

  // 处理鼠标滚轮，实现标签上下滚动
  const handleWheel = (e: React.WheelEvent) => {
    const container = e.currentTarget;
    e.preventDefault();
    container.scrollTop += e.deltaY;
  };

  return (
    <div className="file-tab-bar">
      <div
        className={`file-tab-list ${tabs.length <= 1 ? "single-tab" : ""}`}
        onWheel={handleWheel}
      >
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`file-tab ${tab.id === activeTab?.id ? "active" : ""}`}
            onClick={() => handleTabClick(tab.id)}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
            style={{
              animationDelay: `${index * 0.05}s`,
            }}
          >
            <span className="file-tab-name">
              {tab.fileName}
              {tab.isModified && <span className="modified-indicator">*</span>}
            </span>
            <button
              className={`file-tab-close ${
                hoveredTab === tab.id || tab.id === activeTab?.id
                  ? "visible"
                  : ""
              }`}
              onClick={(e) => handleCloseClick(e, tab.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
