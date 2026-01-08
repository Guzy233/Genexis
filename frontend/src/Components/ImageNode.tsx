import React, { useState, useRef, useEffect } from "react";
import { atom, useAtom } from "jotai";
import Manager from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ToolItems } from "./ToolBar";
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
import { CATEGORY_NODES } from "./TextNode";

export interface ImageNode extends Node {
  src: string;
  imageSize: { width: number; height: number };
}

const getFillColor = (node: ImageNode) => {
  if (node.id === activedId) return "#8ce7ab33";
  if (node.selected) return "#e3f2fd33";
  return "rgba(59, 59, 59, 0.15)";
};

const getStrokeColor = (node: ImageNode) => {
  if (node.id === activedId) return "#7d6bb4ff";
  if (node.selected) return "#765a80ff";
  return "#805a5a78";
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

// 注册工具项
ToolItems.push({
  id: "node/image",
  type: "node",
  category: CATEGORY_NODES,
  icon: <span style={{ fontSize: 16 }}>🖼️</span>,
  createNode: createImageNode,
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
      aAncs: serializeAnchors(node.aAncs),
      eAncs: serializeAnchors(node.eAncs),
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
        Manager.saveHistory();
      },
    });
  }

  return items;
};

// 图片节点组件
export const ImageNodeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as ImageNode;
  const [isEditing, setIsEditing] = useState(false);
  const [tempSrc, setTempSrc] = useState(node.src);
  const [imageNaturalSize, setImageNaturalSize] = useState({
    width: 0,
    height: 0,
  });
  const imgRef = useRef<SVGImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        Manager.update(node);
      }
    }
  };

  // 离开编辑模式
  const finishEditing = () => {
    setIsEditing(false);
    node.src = tempSrc;
    Manager.update(node);
    Manager.saveHistory();
  };

  // 输入框变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempSrc(e.target.value);
  };

  // 输入框失焦
  const handleBlur = () => {
    finishEditing();
  };

  // 按 Enter 完成
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      finishEditing();
    }
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
      <foreignObject
        x="4"
        y="2"
        width={node.size.x - 8}
        height="26"
        style={{ overflow: "visible" }}
      >
        <input
          ref={inputRef}
          className="node-url-input"
          style={{
            width: "100%",
            height: "22px",
            border: "none",
            background: isEditing ? "white" : "transparent",
            fontSize: "12px",
            color: "#666",
            textAlign: "center",
            outline: "none",
            cursor: isEditing ? "text" : "pointer",
            pointerEvents: "auto",
          }}
          value={isEditing ? tempSrc : node.src}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsEditing(true)}
          placeholder="输入图片URL..."
        />
      </foreignObject>

      {/* 图片区域 */}
      <g
        transform={`translate(${
          (node.size.x - (node.imageSize.width || 100)) / 2
        }, 28)`}
      >
        {node.src ? (
          <image
            ref={imgRef}
            href={node.src}
            width={node.imageSize.width || 100}
            height={node.imageSize.height || 100}
            preserveAspectRatio="xMidYMid meet"
            onLoad={onImageLoad}
            style={{ opacity: 0.8 }}
          />
        ) : (
          <text
            x={(node.imageSize.width || 100) / 2}
            y={(node.imageSize.height || 100) / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#999"
            fontSize="12"
          >
            预览区
          </text>
        )}
      </g>
    </g>
  );
};
Coms["node/image"] = ImageNodeComponent;
