import React from "react";
import { atom, useAtom } from "jotai";
import Manager from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { setDefaultTool, ToolItems } from "./ToolBar";
import { ObjectFactories } from "../Controllers/Creator";
import { ContextMenuFactories, ContextMenuItem } from "../Controllers/ContextMenu";
import { activedId } from "../Controllers/Selector";
import { EditableText } from "./EditableText";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";

// 定义 category 常量
export const CATEGORY_NODES = "Nodes";
export const CATEGORY_EDGES = "Edges";

export interface TextNode extends Node {
  text: string;
}

// 注册序列化函数
registerSerializer(
  "node/text",
  (obj: Obj) => {
    const node = obj as TextNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      aAncs: serializeAnchors(node.aAncs),
      eAncs: serializeAnchors(node.eAncs),
      text: node.text,
      selected: node.selected,
    };
  },
  (data) => {
    const node: TextNode = {
      id: data.id,
      type: data.type,
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      text: data.text,
      selected: data.selected ?? false,
      updater: atom(0),
    };
    return node;
  }
);


// 注册文本节点特定右键菜单
ContextMenuFactories["node"] = (): ContextMenuItem[] => {
  // 文本节点暂无特定选项
  return [];
};


const getFillColor = (node: TextNode) => {
  if (node.id===activedId) return "#8ce7ab33";
  if (node.selected) return "#e3f2fd33";
  return "rgba(59, 59, 59, 0.15)";
};

const getStrokeColor = (node: TextNode) => {
  if (node.id===activedId) return "#7d6bb4ff";
  if (node.selected) return "#765a80ff";
  return "#805a5a78";
};

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 工厂函数：创建新的文本节点
export const createTextNode = (): TextNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/text",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 100, y: 50 },
    text: "New Node",
    selected: false,
    eAncs: anchors_default,
    aAncs: anchors_rect,
  };
};

// 注册对象工厂
ObjectFactories["node/text"] = createTextNode;

// 注册工具项
ToolItems.push({
  id: "node/text",
  type: "node",
  category: CATEGORY_NODES,
  icon: <span style={{ fontSize: 16 }}>📄</span>,
  createNode: createTextNode,
});

setDefaultTool(CATEGORY_NODES, "node/text");

export const TextNodeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as TextNode;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      <rect
        width={node.size.x}
        height={node.size.y}
        rx="6"
        fill={getFillColor(node)}
        stroke={getStrokeColor(node)}
        strokeWidth="2"
      />

      <EditableText
        text={node.text}
        size={node.size}
        onTextChange={(newText, newSize) => {
          node.text = newText;
          node.size = { x: newSize.width, y: newSize.height };
          Manager.update(node);
        }}
        onStartEditing={() => {
          Manager.update(node);
        }}
        onEndEditing={() => {
          Manager.saveHistory();
        }}
      />
    </g>
  );
};
Coms["node/text"] = TextNodeComponent;
