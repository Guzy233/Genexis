import { atom } from "jotai";
import { Anchor, Obj, Node } from "./Globals";

// ==================== 序列化类型定义 ====================

export interface SerializedCanvas {
  version: number;
  metadata: Record<string, Record<string, any>>;
  objects: SerializedObj[];
}

export interface SerializedObj {
  id: string;
  type: string;
  [key: string]: any;
}

// ==================== 锚点方向编码系统 ====================

// 方向编码：使用短字符串表示锚点方向
// u = up (上), d = down (下), l = left (左), r = right (右)
// c = center (中心), a = auto (自动)
// 第二个字符表示相对方向：相同用相同字母，相反用相反字母
// 例如：uu = 上方出射向上, ud = 上方出射向下, ll = 左侧出射向左

// 方向向量映射
const DIR_VECTORS: Record<string, { x: number; y: number }> = {
  u: { x: 0, y: -1 },   // up
  d: { x: 0, y: 1 },    // down
  l: { x: -1, y: 0 },   // left
  r: { x: 1, y: 0 },    // right
  c: { x: 0, y: 0 },    // center
};

// 位置映射（相对于节点尺寸的百分比）
const POS_OFFSETS: Record<string, { x: number; y: number }> = {
  u: { x: 0.5, y: 0 },   // 上边中点
  d: { x: 0.5, y: 1 },   // 下边中点
  l: { x: 0, y: 0.5 },   // 左边中点
  r: { x: 1, y: 0.5 },   // 右边中点
  c: { x: 0.5, y: 0.5 }, // 中心
};

// 可用锚点预设（4个基本方向）
export const AVAILABLE_PRESETS = {
  rect: ["uu", "dd", "ll", "rr"], // 上、下、左、右四个锚点
  cross: ["uu", "dd", "ll", "rr"], // 十字方向
};

// 将锚点数组编码为字符串
// 例如：[{type:"posDir", pos:{x:0.5, y:0}, dir:{x:0, y:-1}}, ...] => ["uu", "dd", "ll", "rr"]
export const encodeAnchors = (anchors: Anchor[]): string => {
  return anchors.map((anchor) => {
    if (anchor.type === "posDir") {
      // 查找位置对应的字符
      let posChar = "c";
      let dirChar = "c";

      // 匹配位置
      for (const [char, pos] of Object.entries(POS_OFFSETS)) {
        if (anchor.pos.x === pos.x && anchor.pos.y === pos.y) {
          posChar = char;
          break;
        }
      }

      // 匹配方向
      for (const [char, dir] of Object.entries(DIR_VECTORS)) {
        if (anchor.dir.x === dir.x && anchor.dir.y === dir.y) {
          dirChar = char;
          break;
        }
      }

      return posChar + dirChar;
    }
    return "aa"; // auto
  }).join(",");
};

// 将字符串解码为锚点数组
// 例如：["uu", "dd", "ll", "rr"] => [{type:"posDir", pos:{x:0.5, y:0}, dir:{x:0, y:-1}}, ...]
export const decodeAnchors = (encoded: string): Anchor[] => {
  if (!encoded) return [];

  return encoded.split(",").map((code) => {
    if (code === "aa") {
      return { type: "auto" };
    }

    const posChar = code[0] || "c";
    const dirChar = code[1] || "c";

    return {
      type: "posDir",
      pos: POS_OFFSETS[posChar] || { x: 0.5, y: 0.5 },
      dir: DIR_VECTORS[dirChar] || { x: 0, y: 0 },
    };
  });
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

/**
 * 序列化锚点数组
 * @param anchors 锚点数组
 * @param availablePreset 可用锚点预设名称（如 "rect"），如果为 null 则完整编码
 * @returns 序列化结果，格式为 { preset: "rect" } 或 { encoded: "uu,dd,ll,rr" }
 */
export const serializeAnchors = (
  anchors: Anchor[],
  availablePreset: string | null = "rect"
): { preset?: string; encoded?: string } => {
  // 如果有可用锚点预设，使用预设
  if (availablePreset) {
    return { preset: availablePreset };
  }

  // 否则编码为字符串
  const encoded = encodeAnchors(anchors);
  return { encoded };
};

/**
 * 反序列化锚点数组
 * @param data 序列化数据
 * @returns 锚点数组
 */
export const deserializeAnchors = (
  data: { preset?: string; encoded?: string }
): Anchor[] => {
  if (data.encoded) {
    return decodeAnchors(data.encoded);
  }

  // 使用预设（目前都返回标准的四方向锚点）
  // data.preset 可以在未来扩展支持不同的预设配置
  return [
    { type: "posDir", pos: { x: 0.5, y: 0 }, dir: { x: 0, y: -1 } },   // 上
    { type: "posDir", pos: { x: 0, y: 0.5 }, dir: { x: -1, y: 0 } },    // 左
    { type: "posDir", pos: { x: 1, y: 0.5 }, dir: { x: 1, y: 0 } },     // 右
    { type: "posDir", pos: { x: 0.5, y: 1 }, dir: { x: 0, y: 1 } },     // 下
  ];
};

// ==================== 画布序列化/反序列化 ====================

export const serializeCanvas = (objects: Record<string, Obj>, metadata: SerializedCanvas["metadata"]): SerializedCanvas => {
  const serializedObjects: SerializedObj[] = [];

  Object.values(objects).forEach((obj) => {
    const serializer = Serializers[obj.type];
    const data = serializer ? serializer(obj) : { ...obj };
    serializedObjects.push(data);
  });

  return {
    version: 2, // 更新版本号以使用新的锚点编码
    metadata,
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

  // 再处理边（通过 sourceId 和 targetId 映射查找源和目标）
  data.objects
    .filter((obj) => obj.type.startsWith("edge/"))
    .forEach((edgeData) => {
      // 使用 sourceId 和 targetId
      const sourceId = (edgeData as any).sourceId;
      const targetId = (edgeData as any).targetId;

      const source = nodeMap[sourceId];
      const target = nodeMap[targetId];

      if (!source || !target) {
        console.warn(`Cannot find nodes for edge ${edgeData.id}: source=${sourceId}, target=${targetId}`);
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
