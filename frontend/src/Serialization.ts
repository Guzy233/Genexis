import { atom } from "jotai";
import { Anchor, Obj, Node } from "./Globals";

// ==================== 序列化类型定义 ====================

export type SerializedAnchor =
  | { preset: string } // 使用锚点预设
  | Anchor; // 完整存储

export interface SerializedCanvas {
  version: number;
  objects: SerializedObj[];
}

export interface SerializedObj {
  id: string;
  type: string;
  [key: string]: any;
}

// ==================== 锚点预设系统 ====================

export type AnchorPreset = Anchor[];

export const AnchorPresets: Record<string, AnchorPreset> = {
  rect: [
    { type: "posDir", pos: { x: 0.5, y: 0 }, dir: { x: 0, y: -1 } },
    { type: "posDir", pos: { x: 0, y: 0.5 }, dir: { x: -1, y: 0 } },
    { type: "posDir", pos: { x: 1, y: 0.5 }, dir: { x: 1, y: 0 } },
    { type: "posDir", pos: { x: 0.5, y: 1 }, dir: { x: 0, y: 1 } },
  ],
};

export const registerAnchorPreset = (name: string, anchors: Anchor[]): void => {
  AnchorPresets[name] = anchors;
};

// ==================== 注册表 ====================

export type Serializer = (obj: Obj) => SerializedObj;
export type Deserializer = (data: SerializedObj) => Obj & { sourceId?: string; targetId?: string };

export const Serializers: Record<string, Serializer> = {};
export const Deserializers: Record<string, Deserializer> = {};

export const registerSerializer = (
  type: string,
  serializer: Serializer,
  deserializer: Deserializer
): void => {
  Serializers[type] = serializer;
  Deserializers[type] = deserializer;
};

// ==================== 锚点序列化工具 ====================

export const serializeAnchors = (anchors: Anchor[]): SerializedAnchor[] => {
  return anchors.map((anchor) => {
    for (const [presetName, preset] of Object.entries(AnchorPresets)) {
      if (JSON.stringify(anchor) === JSON.stringify(preset[0])) {
        return { preset: presetName };
      }
    }
    return { ...anchor };
  });
};

export const deserializeAnchors = (serialized: SerializedAnchor[]): Anchor[] => {
  return serialized.map((sa) => {
    if ("preset" in sa) {
      const preset = AnchorPresets[sa.preset];
      return preset ? preset[0] : { type: "auto" };
    }
    return sa as Anchor;
  });
};

// ==================== 画布序列化/反序列化 ====================

export const serializeCanvas = (objects: Record<string, Obj>): SerializedCanvas => {
  const serializedObjects: SerializedObj[] = [];

  Object.values(objects).forEach((obj) => {
    const serializer = Serializers[obj.type];
    const data = serializer ? serializer(obj) : { ...obj };
    serializedObjects.push(data);
  });

  return {
    version: 1,
    objects: serializedObjects,
  };
};

export const deserializeCanvas = (
  data: SerializedCanvas,
  Objects: Record<string, Obj>
): void => {
  // 先创建所有节点（建立 id 映射）
  const nodeMap: Record<string, Node> = {};
  data.objects
    .filter((obj) => obj.type.startsWith("node/"))
    .forEach((nodeData) => {
      const deserializer = Deserializers[nodeData.type];
      const node = deserializer
        ? (deserializer(nodeData) as unknown as Node)
        : ({ ...nodeData, updater: atom(0) } as unknown as Node);
      nodeMap[nodeData.id] = node;
      Objects[nodeData.id] = node;
    });

  // 再处理边（通过 id 映射查找源和目标）
  data.objects
    .filter((obj) => obj.type.startsWith("edge/"))
    .forEach((edgeData) => {
      const source = nodeMap[edgeData.sourceId];
      const target = nodeMap[edgeData.targetId];

      if (!source || !target) {
        console.warn(`Cannot find nodes for edge ${edgeData.id}`);
        return;
      }

      const deserializer = Deserializers[edgeData.type];
      // 先调用 deserializer 处理额外属性
      let edge = deserializer(edgeData);

      // 再设置 source 和 target
      (edge as any).source = source;
      (edge as any).target = target;

      Objects[edgeData.id] = edge as Obj;
    });
};
