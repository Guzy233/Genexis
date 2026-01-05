import React from "react";
import { atom, useAtom } from "jotai";
import Manager from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms, NodeFactories, ToolItems } from "../Globals";
import { activedId } from "../Operators/Selector";
import { EditableText } from "./EditableText";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";

export interface TextNode extends Node {
  text: string;
}

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

// 注册节点工厂
NodeFactories["node/text"] = createTextNode;

// 注册工具项
ToolItems.push({
  id: "node/text",
  category: "Nodes",
  icon: <span style={{ fontSize: 16 }}>📄</span>,
  createNode: createTextNode,
});

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

// 注册序列化函数
registerSerializer(
  "node/text",
  (node: TextNode) => {
    return {
      id: node.id,
      type: node.type,
      pos: node.pos,
      size: node.size,
      aAncs: serializeAnchors(node.aAncs),
      eAncs: serializeAnchors(node.eAncs),
      text: node.text,
    };
  },
  (data: any) => {
    const node = data as TextNode;
    node.updater = atom(0);
    node.aAncs = deserializeAnchors(data.aAncs);
    node.eAncs = deserializeAnchors(data.eAncs);
    return node;
  }
);
