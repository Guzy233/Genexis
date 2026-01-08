import { Vec2, Node, Obj } from "./Globals";
import { objects } from "./Manager";

// ==================== 节点关系记录 ====================

/**
 * 节点的上游（父）节点记录
 * 一个节点可能有多个上游节点
 */
const upstreamMap: Map<string, Set<string>> = new Map();

/**
 * 节点的下游（子）节点记录
 * 一个节点可能有多个下游节点
 */
const downstreamMap: Map<string, Set<string>> = new Map();

/**
 * 获取节点的上游节点集合
 */
export const getUpstream = (nodeId: string): Set<string> => {
  if (!upstreamMap.has(nodeId)) {
    upstreamMap.set(nodeId, new Set());
  }
  return upstreamMap.get(nodeId)!;
};

/**
 * 获取节点的下游节点集合
 */
export const getDownstream = (nodeId: string): Set<string> => {
  if (!downstreamMap.has(nodeId)) {
    downstreamMap.set(nodeId, new Set());
  }
  return downstreamMap.get(nodeId)!;
};

/**
 * 添加边的关系记录
 * @param sourceId 源节点ID（上游）
 * @param targetId 目标节点ID（下游）
 */
export const addEdgeRelation = (sourceId: string, targetId: string): void => {
  // 下游表：sourceId -> targetId
  const downstream = getDownstream(sourceId);
  downstream.add(targetId);

  // 上游表：targetId -> sourceId
  const upstream = getUpstream(targetId);
  upstream.add(sourceId);
};

/**
 * 移除边的关系记录
 */
export const removeEdgeRelation = (sourceId: string, targetId: string): void => {
  const downstream = downstreamMap.get(sourceId);
  if (downstream) {
    downstream.delete(targetId);
  }

  const upstream = upstreamMap.get(targetId);
  if (upstream) {
    upstream.delete(sourceId);
  }
};

/**
 * 清除节点的关系记录（删除节点时调用）
 */
export const clearNodeRelations = (nodeId: string): void => {
  // 从所有上游节点的下游表中移除
  const upstream = upstreamMap.get(nodeId);
  if (upstream) {
    upstream.forEach((parentId) => {
      const parentDownstream = downstreamMap.get(parentId);
      if (parentDownstream) {
        parentDownstream.delete(nodeId);
      }
    });
    upstreamMap.delete(nodeId);
  }

  // 从所有下游节点的上游表中移除
  const downstream = downstreamMap.get(nodeId);
  if (downstream) {
    downstream.forEach((childId) => {
      const childUpstream = upstreamMap.get(childId);
      if (childUpstream) {
        childUpstream.delete(nodeId);
      }
    });
    downstreamMap.delete(nodeId);
  }
};

/**
 * 根据边更新节点关系
 */
export const updateRelationsFromEdge = (edgeId: string): void => {
  const edge = objects[edgeId];
  if (!edge || !edge.type.startsWith("edge/")) return;

  const typedEdge = edge as unknown as { source: Node; target: Node };
  addEdgeRelation(typedEdge.source.id, typedEdge.target.id);
};

// ==================== 布局算法 ====================

/**
 * 计算新节点的位置
 * @param parentId 父节点ID（上游节点）
 * @param defaultPos 默认位置（没有父节点时使用）
 * @returns 新节点的位置
 */
export const calculateChildPosition = (
  parentId: string | null,
  defaultPos: Vec2
): Vec2 => {
  if (!parentId) {
    return defaultPos;
  }

  const parentNode = objects[parentId] as Node;
  if (!parentNode) {
    return defaultPos;
  }

  // 获取父节点的所有下游节点
  const children = getDownstream(parentId);

  if (children.size > 0) {
    // 有子节点，找到最后一个子节点
    const childArray = Array.from(children);
    const lastChildId = childArray[childArray.length - 1];
    const lastChild = objects[lastChildId] as Node;

    if (lastChild) {
      // 计算父节点到最后一个子节点的偏移
      const dx = lastChild.pos.x - parentNode.pos.x;
      const dy = lastChild.pos.y - parentNode.pos.y;

      // 在最后一个子节点的基础上继续偏移
      return {
        x: lastChild.pos.x + dx,
        y: lastChild.pos.y + dy,
      };
    }
  }

  // 没有子节点，默认向右300个单位
  return {
    x: parentNode.pos.x + 300,
    y: parentNode.pos.y,
  };
};

/**
 * 获取节点相对位置
 */
export const getRelativePosition = (from: Node, to: Node): Vec2 => {
  return {
    x: to.pos.x - from.pos.x,
    y: to.pos.y - from.pos.y,
  };
};
