import { Anchor } from "./Globals";

// ==================== 序列化类型定义 ====================

export type SerializedAnchor =
  | { preset: string } // 使用锚点预设
  | Anchor; // 完整存储

export interface SerializedCanvas {
  version: number;
  nodes: any[];
  edges: any[];
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

export type Serializer = (obj: any) => any;
export type Deserializer = (obj: any) => any;

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

export const serializeCanvas = (objects: Record<string, any>): SerializedCanvas => {
  const nodes: any[] = [];
  const edges: any[] = [];

  Object.values(objects).forEach((obj) => {
    const serializer = Serializers[obj.type];
    const data = serializer ? serializer(obj) : { ...obj };

    if (obj.type.startsWith("node/")) {
      nodes.push(data);
    } else if (obj.type.startsWith("edge/")) {
      edges.push(data);
    }
  });

  return {
    version: 1,
    nodes,
    edges,
  };
};

export const deserializeCanvas = (
  data: SerializedCanvas,
  Objects: Record<string, any>
): void => {
  // 先创建所有节点
  const nodeMap: Record<string, any> = {};
  data.nodes.forEach((nodeData) => {
    const deserializer = Deserializers[nodeData.type];
    const node = deserializer ? deserializer(nodeData) : { ...nodeData };
    nodeMap[nodeData.id] = node;
    Objects[nodeData.id] = node;
  });

  // 再创建所有边
  data.edges.forEach((edgeData) => {
    const source = nodeMap[edgeData.sourceId];
    const target = nodeMap[edgeData.targetId];

    if (!source || !target) {
      console.warn(`Cannot find nodes for edge ${edgeData.id}`);
      return;
    }

    const baseEdge = {
      ...edgeData,
      source,
      target,
    };

    const deserializer = Deserializers[edgeData.type];
    const edge = deserializer ? deserializer(baseEdge) : baseEdge;
    Objects[edgeData.id] = edge;
  });
};