import React, { useState, useEffect, useRef } from "react";
import { MCItemIcon } from "../Components/MCItemNode";
import { translations } from "../Controllers/Recipes";

// ============================================================================
// 类型定义
// ============================================================================

type ItemOrTag =
  | { item?: string; tag?: string; id?: string; count?: number }
  | string;

export interface Recipe {
  type: string;
  ingredients?: ItemOrTag[];
  pattern?: string[];
  key?: Record<string, ItemOrTag>;
  ingredient?: ItemOrTag;
  input?: ItemOrTag;
  result?: { id?: string; item?: string; count?: number };
  output?: { id?: string; item?: string; count?: number };
  experience?: number;
  cookingtime?: number;
  [key: string]: any;
}

// ============================================================================
// 工具函数
// ============================================================================

const tagItemsCache: Map<string, string[]> = new Map();
let allTagsLoaded = false;
let loadPromise: Promise<void> | null = null;

const loadAllTags = async (): Promise<void> => {
  if (allTagsLoaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const response = await fetch("/reciper/allTags");
      if (!response.ok) return;
      const data: Record<string, string[]> = await response.json();
      Object.entries(data).forEach(([tag, items]) =>
        tagItemsCache.set(tag, items)
      );
      allTagsLoaded = true;
    } catch (error) {
      console.error("获取所有标签失败", error);
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
};

const extractItemInfo = (
  value: any
): { itemId: string; count?: number } | null => {
  if (!value) return null;
  if (typeof value === "string") {
    return { itemId: value.startsWith("#") ? value.slice(1) : value };
  }
  if (typeof value === "object") {
    if (value.tag) return { itemId: value.tag };
    const id = value.id || value.item;
    if (id)
      return {
        itemId: id.startsWith("#") ? id.slice(1) : id,
        count: value.count,
      };
  }
  return null;
};

// ============================================================================
// 组件
// ============================================================================

const TagTooltip: React.FC<{
  items: string[];
  targetRect: DOMRect;
  visible: boolean;
}> = ({ items, targetRect, visible }) => {
  if (!visible || items.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: targetRect.right + 8,
        top: targetRect.top,
        zIndex: 3000,
        background: "rgba(30, 30, 35, 0.98)",
        border: "1px solid rgba(255, 200, 100, 0.3)",
        borderRadius: "8px",
        padding: "8px",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
        maxWidth: "300px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#a1a1aa",
          marginBottom: "6px",
          fontWeight: "600",
        }}
      >
        标签包含 {items.length} 个物品:
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "4px",
          maxHeight: "200px",
          overflowY: "auto",
        }}
      >
        {items.map((itemId, i) => (
          <div
            key={i}
            style={{
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
            }}
            title={translations[itemId] || itemId}
          >
            <MCItemIcon itemId={itemId} size={24} />
          </div>
        ))}
      </div>
    </div>
  );
};

const ItemSlot: React.FC<{
  info: { itemId: string; count?: number } | null;
  isTag?: boolean;
}> = ({ info, isTag = false }) => {
  const [idx, setIdx] = useState(0);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!info || !isTag) {
      setItems(info ? [info.itemId] : []);
      return;
    }
    const load = async () => {
      setLoading(true);
      await loadAllTags();
      const tagItems = getTagItems(info.itemId);
      setItems(tagItems.length > 0 ? tagItems : [info.itemId]);
      setLoading(false);
    };
    load();
  }, [info, isTag]);

  useEffect(() => {
    if (items.length <= 1) return;
    const intv = setInterval(() => setIdx((i) => (i + 1) % items.length), 1000);
    return () => clearInterval(intv);
  }, [items.length]);

  const current = items[idx];

  if (!info || !current)
    return (
      <div
        style={{
          width: "40px",
          height: "40px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "4px",
        }}
        ref={ref}
      />
    );

  return (
    <>
      <div
        ref={ref}
        onClick={() =>
          items.length > 1 && setIdx((i) => (i + 1) % items.length)
        }
        onMouseEnter={() =>
          (isTag &&
            ref.current &&
            setTooltipPos(ref.current.getBoundingClientRect())) ||
          setShowTooltip(isTag)
        }
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: isTag
            ? "rgba(255,200,100,0.1)"
            : "rgba(255,255,255,0.08)",
          border: isTag
            ? "1px solid rgba(255,200,100,0.3)"
            : "1px solid rgba(255,255,255,0.1)",
          borderRadius: "4px",
          cursor: items.length > 1 ? "pointer" : "default",
        }}
        title={
          isTag ? `${items.length} 物品` : translations[current] || current
        }
      >
        {loading ? (
          <div style={{ fontSize: "10px", color: "#888" }}>...</div>
        ) : (
          <MCItemIcon itemId={current} size={32} />
        )}
        {isTag && (
          <div
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              width: "12px",
              height: "12px",
              background: "rgba(255,200,100,0.8)",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          />
        )}
        {info.count! > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "-2px",
              right: "-2px",
              fontSize: "10px",
              fontWeight: "bold",
              color: "#fff",
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
              background: "rgba(0,0,0,0.6)",
              borderRadius: "4px",
              padding: "0 3px",
            }}
          >
            {info.count}
          </div>
        )}
        {items.length > 1 && !isTag && (
          <div
            style={{
              position: "absolute",
              top: "-2px",
              left: "-2px",
              fontSize: "10px",
              fontWeight: "bold",
              color: "#a1a1aa",
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}
          >
            {idx + 1}/{items.length}
          </div>
        )}
      </div>
      {tooltipPos && (
        <TagTooltip
          items={items}
          targetRect={tooltipPos}
          visible={showTooltip && isTag}
        />
      )}
    </>
  );
};

const getTagItems = (tag: string): string[] => tagItemsCache.get(tag) || [];

// 解析输入：返回 { items: [{itemId, count}][], isTag: boolean[], layout: 'grid' | 'row' }
const parseInput = (
  recipe: Recipe
): {
  items: Array<{ itemId: string; count?: number } | null>;
  isTag: boolean[];
  layout: "grid" | "single";
} | null => {
  // ingredients 数组
  if (recipe.ingredients) {
    const parsed = recipe.ingredients.map((v) => {
      const info = extractItemInfo(v);
      return { info, isTag: typeof v === "object" && "tag" in v && !!v.tag };
    });
    return {
      items: parsed.map((p) => p.info),
      isTag: parsed.map((p) => p.isTag),
      layout: "grid",
    };
  }
  // pattern + key
  if (recipe.pattern && recipe.key) {
    const grid: Array<{ itemId: string; count?: number } | null> = [];
    const isTag: boolean[] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const char = recipe.pattern[y]?.[x];
        const val = char ? recipe.key[char] : null;
        const info = extractItemInfo(val);
        grid.push(info);
        isTag.push(
          !!val && typeof val === "object" && "tag" in val && !!val.tag
        );
      }
    }
    return { items: grid, isTag, layout: "grid" };
  }
  // ingredient 或 input
  const single = recipe.ingredient || recipe.input;
  if (single) {
    const info = extractItemInfo(single);
    const isTag = typeof single === "object" && "tag" in single && !!single.tag;
    return { items: [info], isTag: [isTag], layout: "single" };
  }
  return null;
};

// 解析输出
const parseOutput = (
  recipe: Recipe
): { itemId: string; count: number } | null => {
  const out = recipe.result || recipe.output;
  if (!out) return null;
  const id = out.id || out.item;
  if (!id) return null;
  return { itemId: id, count: out.count || 1 };
};

// 输入组件
const InputSection: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const parsed = parseInput(recipe);
  if (!parsed) return null;

  if (parsed.layout === "single") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <ItemSlot info={parsed.items[0]} isTag={parsed.isTag[0]} />
        <div style={{ fontSize: "11px", color: "#71717a" }}>原料</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 40px)",
        gap: "4px",
      }}
    >
      {parsed.items.map((info, i) => (
        <ItemSlot key={i} info={info} isTag={parsed.isTag[i]} />
      ))}
    </div>
  );
};

// 输出组件
const OutputSection: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const parsed = parseOutput(recipe);
  if (!parsed) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(99,102,241,0.15)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: "4px",
        }}
        title={translations[parsed.itemId] || parsed.itemId}
      >
        <MCItemIcon itemId={parsed.itemId} size={32} />
        {parsed.count > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "-2px",
              right: "-2px",
              fontSize: "12px",
              fontWeight: "bold",
              color: "#fff",
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}
          >
            {parsed.count}
          </div>
        )}
      </div>
      <div style={{ fontSize: "11px", color: "#71717a" }}>结果</div>
    </div>
  );
};

// 通用配方预览
export const RecipePreview: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const inputLayout = parseInput(recipe);
  const output = parseOutput(recipe);

  if (!inputLayout || !output) {
    return (
      <div
        style={{
          padding: "12px",
          background: "rgba(40,40,45,0.8)",
          borderRadius: "8px",
          color: "#888",
          fontSize: "13px",
        }}
      >
        暂不支持显示此类型配方: {recipe?.type || "未知"}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "16px",
        padding: "12px",
        background: "rgba(40,40,45,0.8)",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.1)",
        position: "relative",
      }}
    >
      <InputSection recipe={recipe} />
      <div
        style={{
          fontSize: "20px",
          color: "rgba(255,255,255,0.4)",
          padding: "0 4px",
        }}
      >
        →
      </div>
      <OutputSection recipe={recipe} />
      {(recipe.experience !== undefined ||
        recipe.cookingtime !== undefined) && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            fontSize: "11px",
            color: "#a1a1aa",
            paddingTop: "4px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {recipe.experience !== undefined && (
            <div>
              <span style={{ color: "#fbbf24" }}>✦</span> {recipe.experience}{" "}
              经验
            </div>
          )}
          {recipe.cookingtime !== undefined && (
            <div>
              <span style={{ color: "#f97316" }}>⏱</span>{" "}
              {recipe.cookingtime / 20} 秒
            </div>
          )}
        </div>
      )}
    </div>
  );
};
