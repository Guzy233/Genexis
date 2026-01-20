import { atom, getDefaultStore, useAtom } from "jotai";
import { useMemo } from "react";

import { ContextMenuFactories, ContextMenuItem } from "../Controllers/ContextMenu";
import { setDefaultTool, ToolItems, CATEGORY_NODES } from "../TopLayer/ToolBar";
import { Obj, Anchor, anchors_rect, Node, Coms } from "../Globals";
import { ObjectFactories } from "../Controllers/Creator";
import { activedId } from "../Controllers/Selector";
import { EditableText } from "./EditableText";
import { saveHistory, managerUpdate } from "../Manager";
import {
  registerSerializer,
  serializeAnchors,
  deserializeAnchors,
} from "../Serialization";

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
      aAncs: serializeAnchors(node.aAncs, "rect"),
      eAncs: serializeAnchors(node.eAncs, null),
      text: node.text,
      selected: node.selected,
      z: node.z,
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
      z: data.z ?? 0,
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
  if (node.id === activedId) return "rgba(139, 92, 246, 0.25)";  // 紫色激活
  if (node.selected) return "rgba(99, 102, 241, 0.2)";          // 靛蓝选中
  return "rgba(255, 255, 255, 0.05)";                           // 默认半透明白
};

const getStrokeColor = (node: TextNode) => {
  if (node.id === activedId) return "#8b5cf6";  // 紫色激活边框
  if (node.selected) return "#6366f1";          // 靛蓝选中边框
  return "rgba(255, 255, 255, 0.15)";          // 默认边框
};

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

// 注册对象工厂
ObjectFactories["node/text"] = (): TextNode => {
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

// 注册工具项
ToolItems.push({
  id: "node/text",
  type: "node",
  category: CATEGORY_NODES,
  icon: (
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
      <text
        x="30"
        y="35"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e4e4e7"
        fontSize="28"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        T
      </text>
    </svg>
  ),
});

setDefaultTool(CATEGORY_NODES, "node/text");

Coms["node/text"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as TextNode;

  const isEditingAtom = useMemo(() => atom(false), [node.id]);

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
      onDoubleClick={() => getDefaultStore().set(isEditingAtom, true)}
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
          managerUpdate(node);
        }}
        onEndEditing={() => {
          saveHistory();
        }}
        isEditingAtom={isEditingAtom}
      />
    </g>
  );
};
