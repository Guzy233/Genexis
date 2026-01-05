export default {
  // 节点的默认大小
  nodeDefaultSize: { width: 100, height: 50 },

  // 节点的最小大小
  nodeMinSize: { width: 50, height: 25 },

  // 节点的最大大小
  nodeMaxSize: { width: 200, height: 100 },
  Dragging: 0,
  Linking: 2,

  keyBingding: {
    addNode: "N", // 添加节点
    addEdge: "E", // 添加边
    removeNode: ["Delete", "X"], // 删除节点
    selectNode: "S", // 选择节点

    // 移动选择
    up: "O",
    down: "K",
    left: "J",
    right: "L",

    // 移动节点
    moveUp: "ArrowUp",
    moveDown: "ArrowDown",
    moveLeft: "ArrowLeft",
    moveRight: "ArrowRight",

    // 缩放节点
    zoomIn: "]", // 放大
    zoomOut: "[", // 缩小

    jumpGrowth: "G", // 跳跃增长

    undo: "Control Z", // 撤销
    redo: "Control Shift Z", // 重做
    save: "Control S", // 保存
    load: "Control O", // 加载
  },
};
