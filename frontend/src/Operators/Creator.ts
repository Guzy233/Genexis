import Manager from "../Manager";
import { screen2Viewport, Operators, Node } from "../Globals";
import { atom } from "jotai";
import { Anchor, anchors_rect } from "../Globals";

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];

interface TextNode extends Node {
  text: string;
}

const defaultTextNode: TextNode = {
  id: "base",
  type: "node/text",
  updater: atom<number>(0),
  pos: { x: 0, y: 0 },
  size: { x: 200, y: 100 },
  text: "New Node",
  selected: false,
  eAncs: anchors_default,
  aAncs: anchors_rect,
};

const onDblClick = (e: MouseEvent) => {
  // 检查点击的是否是节点（如果点到节点就不创建）
  const target = e.target as HTMLElement;
  if (target.closest(".node-group")) return;

  const pos = screen2Viewport({ x: e.clientX, y: e.clientY });

  const node: TextNode = {
    ...defaultTextNode,
    id: crypto.randomUUID(),
    pos: { x: pos.x - 100, y: pos.y - 50 },
    selected: true,
  };

  Manager.add(node);
};

Operators.push({
  Begin: () => window.addEventListener("dblclick", onDblClick),
  End: () => window.removeEventListener("dblclick", onDblClick),
});