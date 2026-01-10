import { Vec2, Node, Obj } from "./Globals";

// ==================== 类型定义 ====================

/**
 * 节点关系图
 * 存储所有节点之间的连接关系
 */
export interface NodeRelationGraph {
  // 上游（父）节点映射：nodeId -> Set<parentIds>
  upstream: Map<string, Set<string>>;
  // 下游（子）节点映射：nodeId -> Set<childIds>
  downstream: Map<string, Set<string>>;
}

/**
 * 创建新的空关系图
 */
export const createRelationGraph = (): NodeRelationGraph => ({
  upstream: new Map(),
  downstream: new Map(),
});

// ==================== 节点关系查询 ====================

/**
 * 获取节点的上游节点集合
 * @param graph 关系图
 * @param nodeId 节点ID
 * @returns 上游节点ID集合
 */
export const getUpstream = (
  graph: NodeRelationGraph,
  nodeId: string
): Set<string> => {
  if (!graph.upstream.has(nodeId)) {
    graph.upstream.set(nodeId, new Set());
  }
  return graph.upstream.get(nodeId)!;
};

/**
 * 获取节点的下游节点集合
 * @param graph 关系图
 * @param nodeId 节点ID
 * @returns 下游节点ID集合
 */
export const getDownstream = (
  graph: NodeRelationGraph,
  nodeId: string
): Set<string> => {
  if (!graph.downstream.has(nodeId)) {
    graph.downstream.set(nodeId, new Set());
  }
  return graph.downstream.get(nodeId)!;
};

/**
 * 获取节点的所有上游节点（递归）
 * @param graph 关系图
 * @param nodeId 节点ID
 * @param visited 已访问节点（防止循环）
 * @returns 所有上游节点ID集合
 */
export const getAllUpstream = (
  graph: NodeRelationGraph,
  nodeId: string,
  visited?: Set<string>
): Set<string> => {
  const result = new Set<string>();
  const visitedSet = visited || new Set();

  if (visitedSet.has(nodeId)) {
    return result;
  }
  visitedSet.add(nodeId);

  const parents = getUpstream(graph, nodeId);
  for (const parentId of parents) {
    result.add(parentId);
    const ancestors = getAllUpstream(graph, parentId, visitedSet);
    for (const ancestor of ancestors) {
      result.add(ancestor);
    }
  }

  return result;
};

/**
 * 获取节点的所有下游节点（递归）
 * @param graph 关系图
 * @param nodeId 节点ID
 * @param visited 已访问节点（防止循环）
 * @returns 所有下游节点ID集合
 */
export const getAllDownstream = (
  graph: NodeRelationGraph,
  nodeId: string,
  visited?: Set<string>
): Set<string> => {
  const result = new Set<string>();
  const visitedSet = visited || new Set();

  if (visitedSet.has(nodeId)) {
    return result;
  }
  visitedSet.add(nodeId);

  const children = getDownstream(graph, nodeId);
  for (const childId of children) {
    result.add(childId);
    const descendants = getAllDownstream(graph, childId, visitedSet);
    for (const descendant of descendants) {
      result.add(descendant);
    }
  }

  return result;
};

// ==================== 节点关系修改 ====================

/**
 * 添加边的关系记录
 * @param graph 关系图
 * @param sourceId 源节点ID（上游）
 * @param targetId 目标节点ID（下游）
 */
export const addEdgeRelation = (
  graph: NodeRelationGraph,
  sourceId: string,
  targetId: string
): void => {
  // 下游表：sourceId -> targetId
  const downstream = getDownstream(graph, sourceId);
  downstream.add(targetId);

  // 上游表：targetId -> sourceId
  const upstream = getUpstream(graph, targetId);
  upstream.add(sourceId);
};

/**
 * 移除边的关系记录
 * @param graph 关系图
 * @param sourceId 源节点ID（上游）
 * @param targetId 目标节点ID（下游）
 */
export const removeEdgeRelation = (
  graph: NodeRelationGraph,
  sourceId: string,
  targetId: string
): void => {
  const downstream = graph.downstream.get(sourceId);
  if (downstream) {
    downstream.delete(targetId);
  }

  const upstream = graph.upstream.get(targetId);
  if (upstream) {
    upstream.delete(sourceId);
  }
};

/**
 * 清除节点的关系记录（删除节点时调用）
 * @param graph 关系图
 * @param nodeId 要删除的节点ID
 */
export const clearNodeRelations = (
  graph: NodeRelationGraph,
  nodeId: string
): void => {
  // 从所有上游节点的下游表中移除
  const upstream = graph.upstream.get(nodeId);
  if (upstream) {
    for (const parentId of upstream) {
      const parentDownstream = graph.downstream.get(parentId);
      if (parentDownstream) {
        parentDownstream.delete(nodeId);
      }
    }
    graph.upstream.delete(nodeId);
  }

  // 从所有下游节点的上游表中移除
  const downstream = graph.downstream.get(nodeId);
  if (downstream) {
    for (const childId of downstream) {
      const childUpstream = graph.upstream.get(childId);
      if (childUpstream) {
        childUpstream.delete(nodeId);
      }
    }
    graph.downstream.delete(nodeId);
  }
};

/**
 * 根据边更新节点关系
 * @param graph 关系图
 * @param objects 对象集合
 * @param edgeId 边ID
 */
export const updateRelationsFromEdge = (
  graph: NodeRelationGraph,
  objects: Record<string, Obj>,
  edgeId: string
): void => {
  const edge = objects[edgeId];
  if (!edge || !edge.type.startsWith("edge/")) return;

  const typedEdge = edge as unknown as { source: Node; target: Node };
  addEdgeRelation(graph, typedEdge.source.id, typedEdge.target.id);
};

/**
 * 从对象集合重建完整关系图
 * @param objects 对象集合
 * @returns 重建的关系图
 */
export const rebuildRelationGraph = (
  objects: Record<string, Obj>
): NodeRelationGraph => {
  const graph = createRelationGraph();

  for (const obj of Object.values(objects)) {
    if (obj.type.startsWith("edge/")) {
      const edge = obj as unknown as { source: Node; target: Node };
      if (edge.source && edge.target) {
        addEdgeRelation(graph, edge.source.id, edge.target.id);
      }
    }
  }

  return graph;
};

// ==================== 布局算法 ====================

/**
 * 计算新节点的位置
 * @param graph 关系图
 * @param objects 对象集合
 * @param parentId 父节点ID（上游节点）
 * @param defaultPos 默认位置（没有父节点时使用）
 * @returns 新节点的位置
 */
export const calculateChildPosition = (
  graph: NodeRelationGraph,
  objects: Record<string, Obj>,
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
  const children = getDownstream(graph, parentId);

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

// ==================== 序列化支持 ====================

/**
 * 序列化关系图
 * @param graph 关系图
 * @returns 可序列化的对象
 */
export const serializeRelationGraph = (
  graph: NodeRelationGraph
): { upstream: [string, string[]][]; downstream: [string, string[]][] } => {
  return {
    upstream: Array.from(graph.upstream.entries()).map(([k, v]) => [
      k,
      Array.from(v),
    ]),
    downstream: Array.from(graph.downstream.entries()).map(([k, v]) => [
      k,
      Array.from(v),
    ]),
  };
};

/**
 * 反序列化关系图
 * @param data 序列化的数据
 * @returns 关系图
 */
export const deserializeRelationGraph = (
  data: { upstream: [string, string[]][]; downstream: [string, string[]][] }
): NodeRelationGraph => {
  const graph: NodeRelationGraph = {
    upstream: new Map(
      data.upstream.map(([k, v]) => [k, new Set(v)] as [string, Set<string>])
    ),
    downstream: new Map(
      data.downstream.map(
        ([k, v]) => [k, new Set(v)] as [string, Set<string>]
      )
    ),
  };
  return graph;
};
