import React, { useState, useRef, useEffect, useMemo } from "react";
import { atom, getDefaultStore, useAtom } from "jotai";
import { managerUpdate } from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ToolItems, CATEGORY_NODES } from "../TopLayer/ToolBar";
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
import { NodeBackground } from "./NodeBackground";

export interface ImageNode extends Node {
  src: string;
  imageSize: { width: number; height: number };
}

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 注册对象工厂
ObjectFactories["node/image"] = (): ImageNode => {
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
};;

const icon = (
  <svg viewBox="0 0 60 60" style={{ width: "100%", height: "100%" }}>
    <rect
      x="4"
      y="8"
      width="52"
      height="44"
      rx="8"
      fill="var(--node-fill)"
      stroke="var(--node-stroke)"
      strokeWidth="2"
    />
    {/* 山峰 */}
    <path
      d="M 13 42 L 23 28 L 33 38 L 40 30 L 46 36 L 46 42 Z"
      fill="none"
      style={{ stroke: "var(--edge-stroke)" }}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {/* 太阳 */}
    <circle
      cx="40"
      cy="20"
      r="6"
      fill="none"
      style={{ stroke: "var(--edge-selected)" }}
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
      z: node.z,
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
      z: data.z ?? 0,
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
        managerUpdate(n);
        saveHistory();
      },
    });
  }

  return items;
};

// 图片节点组件
Coms["node/image"] = ({ obj }) => {
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
        node.size.y = 30 + newHeight; // 同步节点高度
        managerUpdate(node);
      }
    }
  };

  // 处理 URL 变化
  const handleUrlChange = (newSrc: string) => {
    setIsError(false);
    node.src = newSrc;
    managerUpdate(node);
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
      <NodeBackground
        node={node}
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
          className={`url-group-bg ${node.id === activedId ? 'activated' : ''}`}
          style={{ cursor: "text" }}
        />
        {/* URL 图标 */}
        <text
          x="10"
          y="18"
          className="url-icon"
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
        transform={`translate(${(node.size.x - (node.imageSize.width || 100)) / 2
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
            className="image-preview-placeholder"
          >
            {isError ? "加载失败" : "预览区"}
          </text>
        )}
      </g>
    </g>
  );
};
