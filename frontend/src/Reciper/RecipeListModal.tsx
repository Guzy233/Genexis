import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { topLayer } from "../Globals";
import { RecipePreview, Recipe } from "./RecipePreview";
import { MCItemIcon } from "./MCItemNode";
import { RECIPE_TYPE_NAMES, fetchRecipes as fetchRecipesApi } from "./Reciper";

// ============================================================================
// 配方预览包装器 - 追踪屏幕位置
// ============================================================================

interface RecipePreviewWrapperProps {
  recipe: Recipe;
  onAddedToCanvas?: () => void;
}

const RecipePreviewWrapper: React.FC<RecipePreviewWrapperProps> = ({
  recipe,
  onAddedToCanvas,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const getScreenPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // 返回容器的左上角位置
      return { x: rect.left, y: rect.top };
    }
    // 默认返回屏幕中心
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }, []);

  return (
    <div ref={containerRef} style={{ display: "inline-block" }}>
      <RecipePreview
        recipe={recipe}
        getScreenPosition={getScreenPosition}
        onAddedToCanvas={onAddedToCanvas}
      />
    </div>
  );
};

// 配方列表弹窗配置
let recipesPerPage = 3; // 每页显示的配方数量（可配置）

export const setRecipesPerPage = (count: number) => {
  recipesPerPage = Math.max(1, count);
};

// 配方列表弹窗状态管理
let showRecipeModal = false;
let currentItemId: string | null = null;
let recipeType: "result" | "usage" = "result"; // result=合成配方, usage=用途配方
const recipeModalSubscribers: Set<(show: boolean, itemId: string | null, type: "result" | "usage") => void> = new Set();

// 打开配方弹窗
export const openRecipeModal = (itemId: string, type: "result" | "usage" = "result") => {
  currentItemId = itemId;
  recipeType = type;
  showRecipeModal = true;
  recipeModalSubscribers.forEach((cb) => cb(true, itemId, type));
};

// 关闭配方弹窗
export const closeRecipeModal = () => {
  showRecipeModal = false;
  const prevItemId = currentItemId;
  const prevType = recipeType;
  currentItemId = null;
  recipeModalSubscribers.forEach((cb) => cb(false, prevItemId, prevType));
};



// 获取配方类型显示名称
const getRecipeTypeName = (type: string): string => {
  return RECIPE_TYPE_NAMES[type] || type.replace("minecraft:", "");
};

// 标签栏每页最多显示的标签数量
const TABS_PER_PAGE = 8;

// 注册配方列表弹窗到顶层
topLayer.push(() => {
  const [visible, setVisible] = useState(showRecipeModal);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null); // 当前选中的配方类型
  const [tabPage, setTabPage] = useState(0); // 标签栏当前页码

  // 从后端获取配方数据
  const fetchRecipes = useCallback(async (itemId: string, type: "result" | "usage") => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecipesApi(itemId, type);
      setRecipes(data);
      // 默认选中第一个类型（如果有的话）
      if (data.length > 0) {
        setSelectedType(data[0]?.type || null);
        setTabPage(0); // 重置标签页到第一页
      }
    } catch (err) {
      console.error("获取配方失败:", err);
      setError("获取配方失败，请稍后重试");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 订阅状态变化
  useEffect(() => {
    const handler = (show: boolean, itemId: string | null, type: "result" | "usage") => {
      setVisible(show);
      if (show && itemId) {
        setCurrentItemId(itemId);
        // 打开时获取配方数据
        fetchRecipes(itemId, type);
      } else {
        // 关闭时清空数据
        setRecipes([]);
        setError(null);
        setCurrentPage(0);
        setCurrentItemId(null);
        setSelectedType(null);
        setTabPage(0);
      }
    };

    recipeModalSubscribers.add(handler);
    return () => {
      recipeModalSubscribers.delete(handler);
    };
  }, [fetchRecipes]);

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showRecipeModal) {
        closeRecipeModal();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  // 按类型分组配方
  const recipesByType = useMemo(() => {
    const groups: Record<string, Recipe[]> = {};
    recipes.forEach((recipe) => {
      let type = recipe?.type || "unknown";
      // 如果包含 pattern 和 key，统一归类为有序合成
      if (recipe?.pattern && recipe?.key) {
        type = "minecraft:crafting_shaped";
      }
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(recipe);
    });
    return groups;
  }, [recipes]);

  // 获取所有配方类型并按优先级排序
  const recipeTypes = useMemo(() => {
    const typesSet = new Set<string>();
    recipes.forEach((r) => {
      let t = r?.type || "unknown";
      if (r?.pattern && r?.key) {
        t = "minecraft:crafting_shaped";
      }
      typesSet.add(t);
    });

    const typesArray = Array.from(typesSet);

    // 排序逻辑：有序合成 > 无序合成 > 其他 minecraft: > 其他
    return typesArray.sort((a, b) => {
      const getPriority = (type: string) => {
        if (type === "minecraft:crafting_shaped") return 0;
        if (type === "minecraft:crafting_shapeless") return 1;
        if (type.startsWith("minecraft:")) return 2;
        return 3;
      };

      const pA = getPriority(a);
      const pB = getPriority(b);

      if (pA !== pB) return pA - pB;
      return a.localeCompare(b); // 同优先级的按字母顺序
    });
  }, [recipes]);

  // 标签栏总页数
  const totalTabPages = Math.ceil(recipeTypes.length / TABS_PER_PAGE);

  // 当前页的标签
  const visibleTabTypes = useMemo(() => {
    const startIndex = tabPage * TABS_PER_PAGE;
    const endIndex = Math.min(startIndex + TABS_PER_PAGE, recipeTypes.length);
    return recipeTypes.slice(startIndex, endIndex);
  }, [recipeTypes, tabPage]);

  // 当前选中类型的配方列表
  const currentTypeRecipes = selectedType ? (recipesByType[selectedType] || []) : [];

  // 计算总页数（基于当前选中类型）
  const totalPages = Math.ceil(currentTypeRecipes.length / recipesPerPage);
  const startIndex = currentPage * recipesPerPage;
  const endIndex = Math.min(startIndex + recipesPerPage, currentTypeRecipes.length);
  const displayRecipes = currentTypeRecipes.slice(startIndex, endIndex);

  // 鼠标滚轮翻页
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // e.preventDefault();
    if (totalPages === 0) return;

    if (e.deltaY > 0) {
      // 向下滚动，下一页
      setCurrentPage((prev) => (prev + 1) % totalPages);
    } else {
      // 向上滚动，上一页
      setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
    }
  }, [totalPages]);

  // 切换配方类型时重置页码
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedType]);

  // 切换配方类型
  const handleTypeChange = useCallback((type: string) => {
    setSelectedType(type);
  }, []);

  // 标签栏翻页
  const handleTabPrev = useCallback(() => {
    setTabPage((prev) => (prev - 1 + totalTabPages) % totalTabPages);
  }, [totalTabPages]);

  const handleTabNext = useCallback(() => {
    setTabPage((prev) => (prev + 1) % totalTabPages);
  }, [totalTabPages]);

  // 当选中类型不在当前页时，自动跳转到包含该类型的页
  useEffect(() => {
    if (selectedType && recipeTypes.length > 0) {
      const selectedIndex = recipeTypes.indexOf(selectedType);
      if (selectedIndex >= 0) {
        const targetPage = Math.floor(selectedIndex / TABS_PER_PAGE);
        setTabPage(targetPage);
      }
    }
  }, [selectedType, recipeTypes]);

  if (!visible) return null;

  // 点击外部关闭弹窗
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeRecipeModal();
    }
  };

  return (
    <div
      className="recipe-modal-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        animation: "fadeIn 0.15s ease",
        pointerEvents: "auto",
      }}
    >
      <div
        className="recipe-modal-content"
        onClick={(e) => e.stopPropagation()} // 阻止点击内容区域时关闭弹窗
        style={{
          background: "rgba(30, 30, 35, 0.98)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          maxWidth: "550px",
          width: "calc(90% - 250px)", // 减去物品列表面板的宽度
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.2s ease",
          position: "relative",
          paddingTop: "44px", // 为书签标签留出空间
        }}
      >
        {/* 书签式标签栏 */}
        {recipeTypes.length > 0 && (
          <div
            className="recipe-type-tabs-container"
            style={{
              position: "absolute",
              top: "-48px",
              left: "12px",
              right: "20px",
              display: "flex",
              alignItems: "flex-end", // 对齐到底部，方便连接
              gap: "2px",
              zIndex: 1,
            }}
          >
            {/* 左箭头 */}
            {totalTabPages > 1 && (
              <button
                className="tab-nav-btn prev"
                onClick={handleTabPrev}
                style={{
                  width: "36px",
                  height: "36px",
                  padding: "4px",
                  background: "rgba(30, 30, 35, 0.98)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px 8px 4px 4px",
                  color: "#a1a1aa",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.2)",
                  transform: "translateY(-2px)",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#e4e4e7";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#a1a1aa";
                }}
              >
                ◀
              </button>
            )}

            {/* 标签 */}
            <div
              className="recipe-type-tabs"
              style={{
                display: "flex",
                gap: "4px",
                flex: 1,
              }}
            >
              {visibleTabTypes.map((type) => {
                const isSelected = selectedType === type;
                // 获取该类型的第一个配方作为图标 ID
                const firstRecipe = recipesByType[type]?.[0];
                const iconId = (firstRecipe?.result?.id || firstRecipe?.output?.id || firstRecipe?.result?.item || firstRecipe?.output?.item || "minecraft:crafting_table").replace("#", "");

                return (
                  <button
                    key={type}
                    className={`recipe-type-tab ${isSelected ? "active" : ""}`}
                    onClick={() => handleTypeChange(type)}
                    title={getRecipeTypeName(type)}
                    style={{
                      width: "52px",
                      height: isSelected ? "49px" : "44px",
                      padding: "4px",
                      background: isSelected ? "rgba(30, 30, 35, 0.98)" : "rgba(45, 45, 52, 0.7)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderBottom: isSelected ? "none" : "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "10px 10px 0 0",
                      color: isSelected ? "#e4e4e7" : "#71717a",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      zIndex: isSelected ? 2 : 1,
                      marginTop: isSelected ? "0px" : "5px",
                      boxShadow: isSelected ? "0 -4px 12px rgba(0, 0, 0, 0.2)" : "none",
                    }}
                  >
                    <MCItemIcon itemId={iconId} size={32} />
                    {isSelected && (
                      <div
                        className="active-tab-indicator"
                        style={{
                          position: "absolute",
                          bottom: "0",
                          left: "4px",
                          right: "4px",
                          height: "2px",
                          background: "#6366f1",
                          borderRadius: "2px 2px 0 0",
                          display: "none", // 暂时隐藏指示条，因为我们要用平滑连接
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 右箭头 */}
            {totalTabPages > 1 && (
              <button
                className="tab-nav-btn next"
                onClick={handleTabNext}
                style={{
                  width: "36px",
                  height: "36px",
                  padding: "4px",
                  background: "rgba(30, 30, 35, 0.98)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px 8px 4px 4px",
                  color: "#a1a1aa",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.2)",
                  transform: "translateY(-2px)",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#e4e4e7";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#a1a1aa";
                }}
              >
                ▶
              </button>
            )}
          </div>
        )}

        {/* 页码显示 */}
        <div
          className="recipe-modal-page-info"
          style={{
            position: "absolute",
            top: "12px",
            right: "20px",
            fontSize: "12px",
            color: "#71717a",
            fontWeight: "500",
          }}
        >
          {totalPages > 0 && `${currentPage + 1} / ${totalPages}`}
        </div>

        {/* 当前配方名称 */}
        {selectedType && (
          <div
            className="recipe-modal-type-title"
            style={{
              padding: "4px 24px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#a5b4fc",
              letterSpacing: "0.5px",
              borderLeft: "3px solid #6366f1",
              marginLeft: "20px",
              marginTop: "8px",
              background: "linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, transparent 100%)",
            }}
          >
            {getRecipeTypeName(selectedType)}
          </div>
        )}

        {/* 配方列表 */}
        <div
          className="recipe-modal-body"
          onWheel={handleWheel}
          style={{
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minHeight: `${recipesPerPage * 80 + (recipesPerPage - 1) * 12 + 240}px`, // 3个配方高度 + 间距 + 上下padding
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#71717a",
                fontSize: "14px",
                minHeight: "240px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              加载中...
            </div>
          ) : error ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#ef4444",
                fontSize: "14px",
                minHeight: "240px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {error}
            </div>
          ) : recipes.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#71717a",
                fontSize: "14px",
                minHeight: "320px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {recipeType === "result" ? "暂无合成配方" : "暂无用途"}
            </div>
          ) : displayRecipes.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#71717a",
                fontSize: "14px",
                minHeight: "240px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              该类型暂无配方
            </div>
          ) : (
            <div
              className="recipe-list"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                flex: 1,
              }}
            >
              {displayRecipes.map((recipe, index) => (
                <RecipePreviewWrapper
                  key={`${selectedType}-${currentPage}-${index}`}
                  recipe={recipe}
                  onAddedToCanvas={() => closeRecipeModal()}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 全局样式 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* 选中标签的凹角平滑连接效果 */
        .recipe-type-tab.active::before,
        .recipe-type-tab.active::after {
          content: "";
          position: absolute;
          bottom: 0;
          width: 12px;
          height: 12px;
          pointer-events: none;
          display: block !important;
        }

        .recipe-type-tab.active::before {
          left: -12px;
          border-bottom-right-radius: 12px;
          box-shadow: 5px 5px 0 5px rgba(30, 30, 35, 0.98);
          clip-path: inset(0 0 0 0 round 0 0 12px 0);
        }

        .recipe-type-tab.active::after {
          right: -12px;
          border-bottom-left-radius: 12px;
          box-shadow: -5px 5px 0 5px rgba(30, 30, 35, 0.98);
          clip-path: inset(0 0 0 0 round 0 12px 0 0);
        }
        
        /* 改进 Clip Path 以获得更完美的凹角 */
        .recipe-type-tab.active::before {
          left: -12px;
          width: 12px;
          height: 12px;
          background: radial-gradient(circle at 0 0, transparent 12px, rgba(30, 30, 35, 0.98) 12.5px);
        }
        
        .recipe-type-tab.active::after {
          right: -12px;
          width: 12px;
          height: 12px;
          background: radial-gradient(circle at 100% 0, transparent 12px, rgba(30, 30, 35, 0.98) 12.5px);
        }

        .recipe-type-tab:not(.active):hover {
          background: rgba(60, 60, 68, 0.9) !important;
          color: #e4e4e7 !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
});
