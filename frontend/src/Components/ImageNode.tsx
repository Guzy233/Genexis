import React, { useState, useRef, useEffect, useMemo } from "react";
import { atom, getDefaultStore, useAtom } from "jotai";
import Manager from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ToolItems, CATEGORY_NODES } from "./ToolBar";
import { ObjectFactories } from "../Controllers/Creator";
import {
  ContextMenuFactories,
  ContextMenuItem,
} from "../Controllers/ContextMenu";
import { activedId } from "../Controllers/Selector";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";
import { EditableText } from "./EditableText";
import { saveHistory } from "../Manager";

export interface ImageNode extends Node {
  src: string;
  imageSize: { width: number; height: number };
}

const getFillColor = (node: ImageNode) => {
  if (node.id === activedId) return "rgba(139, 92, 246, 0.25)"; // 紫色激活
  if (node.selected) return "rgba(99, 102, 241, 0.2)"; // 靛蓝选中
  return "rgba(255, 255, 255, 0.05)"; // 默认半透明白
};

const getStrokeColor = (node: ImageNode) => {
  if (node.id === activedId) return "#8b5cf6"; // 紫色激活边框
  if (node.selected) return "#6366f1"; // 靛蓝选中边框
  return "rgba(255, 255, 255, 0.15)"; // 默认边框
};

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 工厂函数：创建新的图片节点
export const createImageNode = (): ImageNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/image",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 200, y: 150 },
    src: "",
    imageSize: { width: 192, height: 116 },
    selected: false,
    eAncs: anchors_default,
    aAncs: anchors_rect,
  };
};

// 注册对象工厂
ObjectFactories["node/image"] = createImageNode;

const icon = (
  <svg viewBox="0 0 60 60" style={{ width: "100%", height: "100%" }}>
    <rect
      x="4"
      y="8"
      width="52"
      height="44"
      rx="8"
      fill="rgba(255, 255, 255, 0.05)"
      stroke="rgba(255, 255, 255, 0.15)"
      strokeWidth="2"
    />
    {/* 山峰 */}
    <path
      d="M 13 42 L 23 28 L 33 38 L 40 30 L 46 36 L 46 42 Z"
      fill="none"
      stroke="#6366f1"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {/* 太阳 */}
    <circle
      cx="40"
      cy="20"
      r="6"
      fill="none"
      stroke="#f472b6"
      strokeWidth="2"
    />
  </svg>
);

// 注册工具项
ToolItems.push({
  id: "node/image",
  type: "node",
  category: CATEGORY_NODES,
  icon: icon,
});

// 注册序列化函数
registerSerializer(
  "node/image",
  (obj: Obj) => {
    const node = obj as ImageNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      // 可用锚点使用预设 "rect"（四方向锚点）
      aAncs: serializeAnchors(node.aAncs, "rect"),
      // 启用锚点使用编码字符串
      eAncs: serializeAnchors(node.eAncs, null),
      src: node.src,
      imageSize: { ...node.imageSize },
      selected: node.selected,
    };
  },
  (data) => {
    const node: ImageNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      src: data.src,
      imageSize: { ...data.imageSize },
      selected: data.selected ?? false,
      updater: atom(0),
    };
    return node;
  }
);

// 注册图片节点特定右键菜单
ContextMenuFactories["node"] = (target: Obj): ContextMenuItem[] => {
  const node = target as ImageNode;
  const items: ContextMenuItem[] = [];

  // 清除图像选项（仅当有图像时显示）
  if (node.src) {
    items.push({
      id: "clearImage",
      label: "清除图像",
      icon: "🗑️",
      onClick: (t: Obj) => {
        const n = t as ImageNode;
        n.src = "";
        Manager.update(n);
        saveHistory();
      },
    });
  }

  return items;
};

// 图片节点组件
export const ImageNodeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as ImageNode;
  const imgRef = useRef<SVGImageElement>(null);

  const [isError, setIsError] = useState(false);

  const isEditingAtom = useMemo(() => atom(false), [node.id]);

  // 图片加载完成后的尺寸回调
  const onImageLoad = () => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const width = rect.width || 0;
      const height = rect.height || 0;
      if (width > 0 && height > 0) {
        // 保持宽高比，调整节点尺寸
        const maxWidth = node.size.x - 4;
        const maxHeight = node.size.y - 30;
        let newWidth = width;
        let newHeight = height;

        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = height * (maxWidth / width);
        }
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = width * (maxHeight / height);
        }

        node.imageSize = { width: newWidth, height: newHeight };
        // Manager.update(node);
      }
    }
  };

  // 处理 URL 变化
  const handleUrlChange = (newSrc: string) => {
    setIsError(false);
    node.src = newSrc;
    Manager.update(node);
    saveHistory();
  };

  // 自动调整节点高度
  const nodeHeight = 30 + (node.imageSize.height || 100);

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      {/* 背景框 */}
      <rect
        width={node.size.x}
        height={nodeHeight}
        rx="6"
        fill={getFillColor(node)}
        stroke={getStrokeColor(node)}
        strokeWidth="2"
      />

      {/* URL 输入框区域 */}
      <g
        transform="translate(8, 4)"
        onDoubleClick={() => getDefaultStore().set(isEditingAtom, true)}
      >
        {/* 输入框背景 */}
        <rect
          width={node.size.x - 16}
          height={28}
          rx="6"
          fill="rgba(0, 0, 0, 0.3)"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1.5"
          style={{ cursor: 'text' }}
        />
        {/* 编辑状态高亮边框 */}
        <rect
          width={node.size.x - 16}
          height={28}
          rx="6"
          fill="none"
          stroke={node.id === activedId ? "rgba(139, 92, 246, 0.6)" : "rgba(255, 255, 255, 0.05)"}
          strokeWidth="2"
          style={{ pointerEvents: 'none' }}
        />
        {/* URL 图标 */}
        <text
          x="10"
          y="18"
          fill="rgba(255, 255, 255, 0.4)"
          fontSize="12"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          🔗
        </text>
        <g transform="translate(28, 0)">
          <EditableText
            text={node.src}
            size={{ x: node.size.x - 50, y: 28 }}
            onEndEditing={handleUrlChange}
            isEditingAtom={isEditingAtom}
            inputClassName="node-url-input"
            displayClassName="url-display"
            fontSize="12px"
            textAlign="left"
            placeholder="输入图片URL..."
          />
        </g>
      </g>

      {/* 图片区域 */}
      <g
        transform={`translate(${
          (node.size.x - (node.imageSize.width || 100)) / 2
        }, 28)`}
      >
        {node.src && !isError ? (
          <image
            ref={imgRef}
            href={node.src}
            width={node.imageSize.width || 100}
            height={node.imageSize.height || 100}
            preserveAspectRatio="xMidYMid meet"
            onLoad={onImageLoad}
            style={{ opacity: 0.8 }}
            onError={() => setIsError(true)}
          />
        ) : (
          <text
            x={(node.imageSize.width || 100) / 2}
            y={(node.imageSize.height || 100) / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#a1a1aa"
            fontSize="12"
          >
            {isError ? "加载失败" : "预览区"}
          </text>
        )}
      </g>
    </g>
  );
};
Coms["node/image"] = ImageNodeComponent;
