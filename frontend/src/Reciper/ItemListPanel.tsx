import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Controllers, topLayer } from "../Globals";
import { MCItemIcon } from "./MCItemNode";
import { coords, recipesLoaded, translations, searchItemsApi } from "./Data";
import { openRecipeModal } from "./RecipeListModal";
import { startDragItem } from "./ItemPointer";

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

// 可拖拽的物品格子组件（保持原样式的item-slot，增加拖拽功能和点击事件）
const DraggableItemSlot: React.FC<{ itemId: string }> = ({ itemId }) => {
  return (
    <div
      className="item-slot"
      title={translations[itemId] || itemId}
      onMouseDown={(e) => {
        // 左键点击显示合成配方，右键点击显示用途
        // if (e.button === 0) {
        //   // 左键 - 合成配方
        //   openRecipeModal(itemId, "result");
        // } else if (e.button === 2) {
        //   // 右键 - 用途，阻止默认行为并打开弹窗
        //   e.stopPropagation();
        //   openRecipeModal(itemId, "usage");
        // } else {
        // 中键或其他按钮 - 拖拽创建节点
        // 将e转换为普通event
        // startDragItem(e.nativeEvent, itemId);

        // }
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
    setSearching(true);
    try {
      const results = await searchItemsApi(query);
      setItems(results);
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
