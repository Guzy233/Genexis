import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Controllers, topLayer } from "../Globals";
import { MCItemIcon } from "../Components/MCItemNode";
import { coords, recipesLoaded, translations } from "../Controllers/Recipes";
import { screen2Viewport } from "../Controllers/Camera";
import { ObjectFactories } from "../Controllers/Creator";
import Manager from "../Manager";
import { openRecipeModal } from "./RecipeListModal";

// 性能优化配置
const PAGE_SIZE = 100; // 每次渲染的物品数量
const BUFFER_SIZE = 50; // 滚动缓冲区大小
const SEARCH_DEBOUNCE = 500; // 搜索防抖延迟(ms)

// 物品列表面板状态管理
let showItemListPanel = false;
const itemListPanelSubscribers: Set<(show: boolean) => void> = new Set();

// 打开物品列表面板
export const openItemListPanel = () => {
  showItemListPanel = true;
  itemListPanelSubscribers.forEach((cb) => cb(true));
};

// 关闭物品列表面板
export const closeItemListPanel = () => {
  showItemListPanel = false;
  itemListPanelSubscribers.forEach((cb) => cb(false));
};

// 订阅物品列表面板状态变化
export const onItemListPanelChange = (
  callback: (show: boolean) => void
): (() => void) => {
  itemListPanelSubscribers.add(callback);
  return () => {
    itemListPanelSubscribers.delete(callback);
  };
};

// 拖拽放置物品到画布的过程式逻辑
const startDragItem = (e: React.MouseEvent, itemId: string) => {
  e.preventDefault();
  e.stopPropagation();

  // 获取点击的物品格子，克隆其内容用于拖拽预览
  const target = e.currentTarget as HTMLElement;
  const iconElement = target.querySelector("svg");

  // 获取物品的中文名称
  const itemName = translations[itemId] || itemId;

  // 创建临时拖拽元素
  const dragElement = document.createElement("div");
  dragElement.style.position = "fixed";
  dragElement.style.pointerEvents = "none";
  dragElement.style.zIndex = "10000";
  dragElement.style.opacity = "0.8";

  // 创建拖拽预览容器
  const previewContainer = document.createElement("div");
  previewContainer.style.display = "flex";
  previewContainer.style.flexDirection = "column";
  previewContainer.style.alignItems = "center";
  previewContainer.style.gap = "4px";
  previewContainer.style.padding = "8px";
  previewContainer.style.background = "rgba(30, 30, 35, 0.9)";
  previewContainer.style.borderRadius = "8px";
  previewContainer.style.border = "1px solid rgba(255, 255, 255, 0.2)";

  // 克隆图标
  if (iconElement) {
    const clonedIcon = iconElement.cloneNode(true) as SVGElement;
    clonedIcon.setAttribute("width", "32");
    clonedIcon.setAttribute("height", "32");
    previewContainer.appendChild(clonedIcon);
  }

  // 添加名称标签
  const nameLabel = document.createElement("span");
  nameLabel.style.fontSize = "12px";
  nameLabel.style.color = "#e4e4e7";
  nameLabel.style.whiteSpace = "nowrap";
  nameLabel.textContent = itemName;
  previewContainer.appendChild(nameLabel);

  dragElement.appendChild(previewContainer);
  document.body.appendChild(dragElement);

  // 记录起始位置
  const startX = e.clientX;
  const startY = e.clientY;
  let currentX = startX;
  let currentY = startY;

  // 更新拖拽元素位置
  const updateDragPosition = (clientX: number, clientY: number) => {
    dragElement.style.left = clientX + 16 + "px";
    dragElement.style.top = clientY + 16 + "px";
  };

  updateDragPosition(startX, startY);

  // 鼠标移动
  const onMouseMove = (e: MouseEvent) => {
    currentX = e.clientX;
    currentY = e.clientY;
    updateDragPosition(currentX, currentY);
  };

  // 鼠标释放
  const onMouseUp = (e: MouseEvent) => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);

    // 移除拖拽元素
    document.body.removeChild(dragElement);

    // 检查是否在画布区域内释放（简单判断：不在面板内）
    const panelElement = document.querySelector(".item-list-panel");
    const isInPanel = panelElement?.contains(e.target as Node);
    if (isInPanel) return;

    // 创建MC物品节点
    const node = ObjectFactories["node/mcitem"]() as any;
    const viewportPos = screen2Viewport({ x: e.clientX, y: e.clientY });
    node.pos = { x: viewportPos.x - 40, y: viewportPos.y - 50 };
    node.itemId = itemId;
    Manager.add(node);
  };

  // 失去焦点
  const onBlur = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("blur", onBlur);
    if (document.body.contains(dragElement)) {
      document.body.removeChild(dragElement);
    }
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
};

// 可拖拽的物品格子组件（保持原样式的item-slot，增加拖拽功能和点击事件）
const DraggableItemSlot: React.FC<{ itemId: string }> = ({ itemId }) => {
  return (
    <div
      className="item-slot"
      title={translations[itemId] || itemId}
      onMouseDown={(e) => {
        // 左键点击显示合成配方，右键点击显示用途
        if (e.button === 0) {
          // 左键 - 合成配方
          openRecipeModal(itemId, "result");
        } else if (e.button === 2) {
          // 右键 - 用途，阻止默认行为并打开弹窗
          e.stopPropagation();
          openRecipeModal(itemId, "usage");
        } else {
          // 中键或其他按钮 - 拖拽创建节点
          startDragItem(e, itemId);
        }
      }}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <MCItemIcon itemId={itemId} size={32} />
    </div>
  );
};

// 注册物品列表面板到顶层
topLayer.push(() => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visible, setVisible] = useState(showItemListPanel);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const listRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 从后端搜索物品
  const searchItems = useCallback(async (query: string) => {
    if (!query.trim()) {
      // 搜索为空时显示所有物品
      if (recipesLoaded) {
        setItems(Object.keys(coords));
      }
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `/reciper/search/${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error("搜索失败");
      }
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("搜索物品失败:", error);
      // 保持当前列表不变，避免闪烁
    } finally {
      setSearching(false);
    }
  }, []);

  // 订阅状态变化
  useEffect(() => {
    return onItemListPanelChange((show) => {
      setVisible(show);
      // 打开时重新获取物品列表
      if (show) {
        if (recipesLoaded) {
          setItems(Object.keys(coords));
        } else {
          setLoading(true);
          const checkLoaded = setInterval(() => {
            if (recipesLoaded) {
              clearInterval(checkLoaded);
              setItems(Object.keys(coords));
              setLoading(false);
            }
          }, 100);
        }
      } else {
        // 关闭时清空搜索
        setSearchQuery("");
        setItems([]);
      }
    });
  }, []);

  // 搜索防抖处理
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (searchQuery) {
      searchTimerRef.current = setTimeout(() => {
        searchItems(searchQuery);
      }, SEARCH_DEBOUNCE);
    } else if (recipesLoaded) {
      // 搜索为空时显示所有物品
      setItems(Object.keys(coords));
    }

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery]);

  // 重置可见数量当搜索词改变时
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [items]);

  // 计算实际渲染的物品
  const visibleItems = useMemo(() => {
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  // 滚动处理函数
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const scrollBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight;

      // 当滚动到底部附近时加载更多
      if (scrollBottom < BUFFER_SIZE && visibleCount < items.length) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, items.length));
      }
    },
    [visibleCount, items.length]
  );

  if (!visible) return null;

  // 如果正在加载，显示加载提示
  if (loading) {
    return (
      <div className="item-list-panel-container">
        <div className="item-list-panel">
          <div className="item-list" style={{ padding: "16px", color: "#888" }}>
            加载中...
          </div>
        </div>
      </div>
    );
  }

  const hasMore = visibleCount < items.length;
  const showCount = visibleItems.length;
  const totalCount = items.length;

  return (
    <div
      className="item-list-panel-container"
      onContextMenu={(e) => e.preventDefault()} // 禁用右键菜单
    >
      {/* 物品列表面板 */}
      <div className="item-list-panel">
        {/* 物品列表 */}
        <div
          ref={listRef}
          className="item-list item-list-5cols"
          onScroll={handleScroll}
          style={{
            overflowY: "auto",
            maxHeight: "60vh",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {visibleItems.map((itemId) => (
            <DraggableItemSlot key={itemId} itemId={itemId} />
          ))}
          {hasMore && !searching && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "8px",
                color: "#888",
              }}
            >
              已显示 {showCount} / {totalCount} 个物品,继续滚动加载更多...
            </div>
          )}
          {!hasMore && totalCount > 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "8px",
                color: "#666",
              }}
            >
              已显示全部 {totalCount} 个物品
            </div>
          )}
          {totalCount === 0 && searchQuery && !searching && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "16px",
                color: "#888",
              }}
            >
              未找到匹配的物品
            </div>
          )}
        </div>

        {/* 搜索框 */}
        <input
          type="text"
          className="item-search-input"
          placeholder="搜索物品..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
    </div>
  );
});

// 监听打开物品列表面板事件
const toggleItemList = () => {
  showItemListPanel ? closeItemListPanel() : openItemListPanel();
};

Controllers.push({
  Begin: () => {
    window.addEventListener("toggle-item-list", toggleItemList);
  },
  End: () => {
    window.removeEventListener("toggle-item-list", toggleItemList);
  },
});
