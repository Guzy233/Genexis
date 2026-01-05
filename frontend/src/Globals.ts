import { PrimitiveAtom } from "jotai";

export interface Vec2 {
  x: number;
  y: number;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function multiply(a: Vec2, b: number): Vec2 {
  return { x: a.x * b, y: a.y * b };
}
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}
export function normalize(a: Vec2): Vec2 {
  const len = Math.sqrt(a.x * a.x + a.y * a.y);
  return { x: a.x / len, y: a.y / len };
}

export type Anchor =
  | { type: "posDir"; pos: Vec2; dir: Vec2 } //固定锚点
  | { type: "absPos" } //取目标节点的绝对位置
  | { type: "auto" }; //自动选择可用锚点

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

export const viewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

export const screen2Viewport = (point: Vec2): Vec2 => {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
};
export const viewport2Screen = (point: Vec2): Vec2 => {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
};

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

export const Coms: Record<
  string,
  React.FC<{
    obj: Obj;
  }>
> = {};

export const Operators: { Begin: () => any, End: () => any }[] = [];

// 工具注册表（由各模块注册）
export interface ToolItem {
  id: string;
  category: string;
  icon: React.ReactNode;
  createNode: () => Node;
}

// 节点工厂字典：用于从类型创建虚拟节点预览
export const NodeFactories: Record<string, () => Node> = {};

// 工具项注册表
export const ToolItems: ToolItem[] = [];

export default {
  distance,
  subtract,
  add,
  multiply,
  dot,
  cross,
  normalize,
};
