import { atom, useAtom } from "jotai";
import { useRef, useEffect, useCallback } from "react";
import Manager, { objects } from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms, idFromEvent } from "../Globals";
import { isActived } from "../Operators/Selector";
import { EditableText } from "./PlainText";

export interface TextNode extends Node {
  text: string;
}

let editingElement = "";

// export const setEditing = (id: string) => {
//   editingElement = id;
//   Manager.updateId(id);

//   // 临时注册点击监听器，闭包内捕获当前 id
//   const onMouseDown = (e: MouseEvent) => {
//     const clickedId = idFromEvent(e, ".node-group");
//     if (clickedId !== id) {
//       // 清除编辑状态并移除自己
//       editingElement = "";
//       Manager.updateId(id);
//       window.removeEventListener("mousedown", onMouseDown, true);
//     }
//   };
//   const onEndEditing = (e: Event) => {
//     editingElement = "";
//     Manager.updateId(id);
//     window.removeEventListener("mousedown", onMouseDown, true);
//   };
//   window.addEventListener("mousedown", onMouseDown, true);
//   window.addEventListener("end-editing", onEndEditing, true);
// };

// const getFillColor = (node: TextNode) => {
//   if (isActived(node.id)) return "#8ce7ab33";
//   if (node.selected) return "#e3f2fd33";
//   return "rgba(59, 59, 59, 0.15)";
// };

// const getStrokeColor = (node: TextNode) => {
//   if (isActived(node.id)) return "#7d6bb4ff";
//   if (node.selected) return "#765a80ff";
//   return "#805a5a78";
// };

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];
export const defaultTextNode: TextNode = {
  id: "base",
  type: "node/text",
  updater: atom(0),
  pos: { x: 0, y: 0 },
  size: { x: 100, y: 50 },
  text: "New Node",
  selected: false,
  eAncs: anchors_default,
  aAncs: anchors_rect,
};

export const TextNodeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as TextNode;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
    >
      <rect
        width={node.size.x}
        height={node.size.y}
        rx="6"
        fill={node.selected ? "#e3f2fd33" : "rgba(59, 59, 59, 0.15)"}
        stroke={node.selected ? "#765a80ff" : "#805a5a78"}
        strokeWidth="2"
      />

      <EditableText
        text={node.text}
        size={node.size}
        onTextChange={(newText, newSize) => {
          node.text = newText;
          node.size = { x: newSize.width, y: newSize.height };
          Manager.update(node); // 通知全局状态更新，以便持久化或同步
        }}
        onStartEditing={() => {
          Manager.updateId(node.id);
        }}
      />
    </g>
  );
};
Coms["node/text"] = TextNodeComponent;
