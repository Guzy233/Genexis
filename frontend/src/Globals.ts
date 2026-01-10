import { PrimitiveAtom } from "jotai";
import React from "react";

export interface Vec2 {
  x: number;
  y: number;
}

export type Anchor =
  | { type: "posDir"; pos: Vec2; dir: Vec2 } //固定锚点
  | { type: "absPos" } //取目标节点的绝对位置
  | { type: "auto" } //自动选择可用锚点
  | { type: "center" }; //中心锚点：位置在节点中心，方向指向目标

export const anchors_rect: Anchor[] = [
  {
    type: "posDir",
    pos: { x: 0.5, y: 0 },
    dir: { x: 0, y: -1 },
  },
  {
    type: "posDir",
    pos: { x: 0, y: 0.5 },
    dir: { x: -1, y: 0 },
  },
  {
    type: "posDir",
    pos: { x: 1, y: 0.5 },
    dir: { x: 1, y: 0 },
  },
  {
    type: "posDir",
    pos: { x: 0.5, y: 1 },
    dir: { x: 0, y: 1 },
  },
];

export function idFromEvent(e: MouseEvent, group: string): string {
  return ((e.target as HTMLElement).closest(group) as HTMLElement)?.dataset.id!;
}

export interface Obj {
  id: string;
  type: string;
  updater: PrimitiveAtom<number>;
}

export interface Node extends Obj {
  pos: Vec2; // 节点的位置
  size: Vec2; // 节点的大小
  aAncs: Anchor[]; // 节点的锚点
  eAncs: Anchor[]; // 节点的锚点
  selected: boolean; // 节点是否被选中
}

export interface Edge extends Obj {
  source: Node;
  target: Node;
  anchorSource: Anchor;
  anchorTarget: Anchor;
  isSelected: boolean;
  label?: string;
}

export const Coms: Record<
  string,
  React.FC<{
    obj: Obj;
  }>
> = {};

export const topLayer: Array<React.FC> = [];

export const Controllers: {
  Begin: (canvas: SVGGElement) => any;
  End: (canvas: SVGGElement) => any;
}[] = [];
