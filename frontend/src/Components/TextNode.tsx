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
import { NodeBackground } from "./NodeBackground";

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
        fill="var(--node-fill)"
        stroke="var(--node-stroke)"
        strokeWidth="2"
      />
      <text
        x="30"
        y="35"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text-primary)"
        fontSize="28"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        style={{ userSelect: "none" }}
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
      {/* 背景框 */}
      <NodeBackground
        node={node}
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
