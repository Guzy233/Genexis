# MindGraph3 - 思维导图应用架构说明

## 核心概念

### 1. Obj 系统 - 所有图形组件的父类

所有图形元素都继承自 `Obj` 接口：

```typescript
interface Obj {
  id: string;           // 唯一标识
  type: string;         // 类型标识符，如 "node/text", "edge/curve"
  updater: PrimitiveAtom<number>;  // 更新触发器
}
```

**关键设计**：`updater` 是一个 Jotai 原子，其内部数值本身毫无意义，仅用于触发组件重新渲染。

### 2. 更新机制（核心难点）

#### 为什么这样做？
传统 React 需要 `setState` 来触发更新，但思维导图中的边（Edge）需要同时响应源节点和目标节点的变化。如果为每个属性维护独立 state，边的代码会变得极其复杂。

#### 解决方案
采用**直接修改对象 + 原子更新触发**的模式：

```typescript
// 直接修改对象属性
node.pos = { x: 100, y: 200 };

// 调用 Manager.update() 触发订阅者重新渲染
Manager.update(node);
```

`Manager.update()` 的实现：
```typescript
update: (obj: Obj) => {
  store.set(obj.updater, state++);  // 数值递增，触发 useAtom 订阅
}
```

### 3. 订阅模式详解

以 [CurveEdge.tsx](src/Components/CurveEdge.tsx) 为例，边组件同时订阅源节点和目标节点的更新器：

```typescript
const CurveEdgeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  const edge = obj as CurveEdge;
  useAtom(obj.updater);       // 订阅边自身的更新
  useAtom(edge.source.updater);  // 订阅源节点
  useAtom(edge.target.updater);  // 订阅目标节点

  // 当任一 updater 被触发时，组件重新渲染
  // 路径计算使用最新的节点位置
};
```

这种设计的优势：
- 边不需要知道是哪个属性变化，自动响应所有变化
- 新增节点属性时，边无需修改代码

### 4. 选中 (selected) vs 激活 (actived)

| 概念 | 含义 | 用途 |
|------|------|------|
| **selected** | 布尔值，表示节点是否被选中 | 多选操作的基础，支持框选、批量移动 |
| **actived** | 当前唯一激活的节点 | 编辑操作的目标，一次只能激活一个 |

**设计原则**：
- `selected`: 可以多个节点同时为 true
- `actived`: 有且仅有一个节点为 actived（空字符串表示无）

选中高亮使用淡蓝色，激活高亮使用绿色。

### 5. 框选系统

Selector 实现了框选功能，支持以下设置：

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `selector.extendKey` | `"Shift"` | 扩展选中键，按下时保留当前选择 |
| `selector.boxSelectButton` | `1` | 框选触发键（1=中键） |

**框选行为**：
1. 按下配置的中键（在空白处）开始框选
2. 按住 Shift 框选：追加选中框内节点
3. 不按 Shift 框选：清除当前选择后选中框内节点
4. 释放鼠标完成框选

## 模块化架构

### 目录结构

```
src/
├── Components/     # React 渲染组件
│   ├── TextNode.tsx    # 文本节点组件
│   ├── CurveEdge.tsx   # 曲线边组件
│   └── SelectionBox.tsx  # 框选组件（UI层）
├── Controllers/    # 控制器（逻辑层）
│   ├── Dragger.ts      # 拖拽逻辑
│   ├── Creator.ts      # 创建节点逻辑
│   ├── Linker.ts       # 连接节点逻辑
│   ├── Selector.ts     # 选择逻辑（含框选）
│   ├── Editor.ts       # 编辑逻辑
│   └── Keyboard.ts     # 键盘快捷键
├── Globals.ts      # 全局类型定义
├── Manager.ts      # 全局状态管理
├── Option.ts       # 设置系统
└── App.tsx         # 应用入口
```

### 渲染层级

组件按 `type` 前缀分组渲染顺序：
- `edge/*`: 最底层（边）
- `node/*`: 中间层（节点）
- `ui/*`: 最顶层（UI元素如框选框）

### 组件与操作分离

**Components** 只负责渲染：
- 接收 `obj` 数据
- 根据 `obj.type` 从 `Coms` 字典获取对应组件
- 不包含交互逻辑

**Controllers** 只负责处理用户操作：
- 每个 Controller 是一个对象 `{ Begin: () => void, End: () => void }`
- `Begin()`: 注册事件监听器
- `End()`: 移除事件监听器
- 操作完成后直接修改对象并调用 `Manager.update()`

### 生命周期管理

在 [App.tsx](src/App.tsx) 中：

```typescript
useEffect(() => {
  Controllers.map((op) => op.Begin());  // 挂载时启动所有控制器
  return () => Controllers.map((op) => op.End());  // 卸载时清理
}, []);
```

这种方式使功能模块化，可以随时添加/移除控制器。

### 过程式设计 vs 状态式设计

本项目采用**过程式设计**而非状态式设计，核心原则是：**监听器只在需要时临时添加，函数闭包内捕获当前状态，不需要外部变量标记过程**。

**反模式（状态式）**：
```typescript
let isEditing = false;

export const setEditing = (id: string) => {
  isEditing = true;
  editingId = id;
};

// 在 Begin 中注册全局监听器，效率低
Controllers.push({
  Begin: () => window.addEventListener("mousedown", onMouseDown),
  End: () => window.removeEventListener("mousedown", onMouseDown),
});
```

**正模式（过程式）**：
```typescript
// Controllers/Editor.ts
let editingElement = "";

export const setEditing = (id: string) => {
  editingElement = id;
  Manager.updateId(id);

  // 临时注册监听器，闭包内直接捕获 id
  const onMouseDown = (e: MouseEvent) => {
    const clickedId = idFromEvent(e, ".node-group");
    if (clickedId !== id) {
      editingElement = "";
      Manager.updateId(id);
      window.removeEventListener("mousedown", onMouseDown, true);  // 自己移除自己
    }
  };
  window.addEventListener("mousedown", onMouseDown, true);
};
```

**优势**：
1. **非编辑状态下无监听开销**：只在需要时临时注册
2. **无需清理函数**：监听器自己管理生命周期，在适当时机移除自己
3. **闭包捕获当前状态**：不需要外部状态变量，减少同步问题

参考 [Linker.ts](src/Controllers/Linker.ts) 中连接操作的实现：虚拟节点和边在闭包内创建，鼠标事件中直接使用。

## 锚点系统 (Anchor)

锚点定义了节点的连接点位置：

```typescript
type Anchor =
  | { type: "posDir"; pos: Vec2; dir: Vec2 }  // 固定锚点：pos为百分比位置，dir为方向
  | { type: "absPos" }                         // 绝对位置
  | { type: "auto" };                          // 自动选择可用锚点
```

- **posDir**: 相对于节点尺寸的百分比位置 + 出射方向
- **absPos**: 使用节点的绝对坐标，无方向
- **auto**: 自动选择最近的可用水口

## 视图系统

```typescript
export const viewport = {
  x: 0,
  y: 0,      // 视口偏移量
  zoom: 1,   // 缩放比例
};
```

坐标转换：
- `screen2Viewport`: 屏幕坐标 → 视口坐标
- `viewport2Screen`: 视口坐标 → 屏幕坐标

## 设置系统

### 设置注册流程

设置项通过 `registerSetting()` 注册到全局设置系统：

```typescript
// Controllers/Linker.ts
import { registerSetting } from "../Option";

let linkingKey = "Space";

registerSetting({
  id: "linker.startKey",
  category: "Linker",
  title: "开始连接",
  type: "key",
  defaultValue: "Space",
  value: "Space",
  description: "按下此键进入连接模式",
  onChange: (v) => { linkingKey = v; },  // 必须注册回调以响应变化
});
```

### 设置项结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识，如 "linker.startKey" |
| `category` | string | 分类名称，用于UI分组 |
| `title` | string | 显示标题 |
| `type` | `"key"` \| `"toggle"` \| `"number"` \| `"string"` | 设置类型 |
| `defaultValue` | any | 默认值 |
| `value` | any | 当前值 |
| `description` | string | 描述信息 |
| `onChange` | (value: any) => void | **必须注册**，值变化时更新内部状态 |

### 设置系统 API

| 函数 | 用途 |
|------|------|
| `registerSetting(item)` | 注册新设置项 |
| `getSettingsByCategory()` | 获取所有分类及设置项 |
| `getSetting(id)` | 获取单个设置项 |
| `setValue(id, value)` | 修改设置值并触发回调 |
| `resetAll()` | 重置所有设置到默认值 |

### 设置面板

设置面板会自动读取所有已注册的设置项并渲染，无需手动添加 UI。

### 重要：onChange 回调

**必须在注册时提供 `onChange` 回调**，否则设置项的值变化不会影响程序行为。回调在用户修改设置时立即执行。

```typescript
// 错误：没有 onChange，设置值变了但程序不会响应
registerSetting({
  id: "feature.key",
  type: "key",
  defaultValue: "Space",
  value: "Space",
});

// 正确：提供 onChange 回调
let myKey = "Space";
registerSetting({
  id: "feature.key",
  type: "key",
  defaultValue: "Space",
  value: "Space",
  onChange: (v) => { myKey = v; },
});
```

## 序列化系统

### 概述

序列化系统负责将画布内容保存为 JSON 格式，以及从 JSON 恢复画布状态。

### 核心类型

```typescript
interface SerializedCanvas {
  version: number;
  objects: any[];  // 统一存储所有对象，通过 type 前缀区分（如 "node/text", "edge/curve"）
}
```

### 注册序列化器

每种节点/边类型需要注册对应的序列化和反序列化函数：

```typescript
import { registerSerializer, registerAnchorPreset } from "../Serialization";

interface TextNode extends Node {
  text: string;
}

// 注册锚点预设
registerAnchorPreset("rect", [
  { type: "posDir", pos: { x: 0.5, y: 0 }, dir: { x: 0, y: -1 } },
  // ... 其他锚点
]);

// 注册序列化器
registerSerializer(
  "node/text",
  (obj: TextNode) => ({
    id: obj.id,
    type: obj.type,
    pos: obj.pos,
    size: obj.size,
    text: obj.text,
    eAncs: serializeAnchors(obj.eAncs),  // 使用工具函数
  }),
  (data: any) => ({
    ...data,
    eAncs: deserializeAnchors(data.eAncs),
    updater: atom(0),
  })
);
```

### 锚点预设系统

锚点支持预设功能，可以减少重复数据：

```typescript
// 预设锚点会被序列化为 { preset: "rect" } 而不是完整数据
registerAnchorPreset("rect", [...]);
```

### 序列化 API

| 函数 | 用途 |
|------|------|
| `serializeCanvas(objects)` | 将所有对象序列化为 `SerializedCanvas`（统一 objects 数组） |
| `deserializeCanvas(data, objects)` | 从 `SerializedCanvas` 恢复对象到 `objects` |
| `serializeAnchors(anchors)` | 序列化锚点数组，支持预设 |
| `deserializeAnchors(data)` | 反序列化锚点数组 |

### 序列化流程

1. **保存时**：遍历所有对象，统一放入 `objects` 数组，通过 `type` 前缀区分类型
2. **恢复时**：先处理所有 `node/*` 类型建立 id 映射，再处理 `edge/*` 类型通过 id 映射查找源和目标

```typescript
// 保存到 localStorage
const data = serializeCanvas(Manager.objects);
localStorage.setItem("mindgraph", JSON.stringify(data));

// 从 localStorage 恢复
const saved = localStorage.getItem("mindgraph");
if (saved) {
  deserializeCanvas(JSON.parse(saved), Manager.objects);
  Manager.updateCanvas();
}
```

## 撤销/重做系统

### 概述

撤销重做系统使用命令模式，记录画布的完整状态快照。

### 历史记录管理

```typescript
// Manager.ts
const MAX_HISTORY = 50;      // 最大历史记录数
const history: SerializedCanvas[] = [];
let currentIndex = -1;       // 当前历史位置
```

### 核心 API

| 函数 | 用途 |
|------|------|
| `saveHistory()` | 保存当前状态到历史记录 |
| `undo()` | 撤销到上一状态，返回是否成功 |
| `redo()` | 重做到下一状态，返回是否成功 |
| `canUndo()` | 是否有可撤销的历史 |
| `canRedo()` | 是否有可重做的历史 |

### 使用方式

在操作完成后调用 `saveHistory()`：

```typescript
// Controllers/Dragger.ts - 拖拽结束
const onMouseUp = () => {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseMove);
  Manager.saveHistory();  // 保存历史
};
```

### 历史记录行为

- **新操作会删除当前光标之后的所有历史**（如撤销后再做新操作）
- **最多保留 50 条历史记录**，超出时删除最旧的记录
- **初始化时会保存一条空状态**作为起点

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` 或 `Ctrl+Shift+Z` | 重做 |

## 新增功能指南

### 添加新节点类型

节点类型定义在组件文件中，而非 `Globals.ts`。这种方式确保使用节点时必须导入组件文件。

```typescript
// Components/ImageNode.tsx
import { Obj, Node, Coms } from "../Globals";
import { atom } from "jotai";

// 1. 定义接口
interface ImageNode extends Node {
  src: string;
}

// 2. 定义默认数据
const defaultImageNode: ImageNode = {
  id: "base",
  type: "node/image",
  updater: atom(0),
  pos: { x: 0, y: 0 },
  size: { x: 200, y: 150 },
  src: "",
  selected: false,
  eAncs: [],  // 根据需要定义
  aAncs: [],
};

// 3. 创建组件
const ImageNodeComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as ImageNode;
  return <image href={node.src} />;
};
Coms["node/image"] = ImageNodeComponent;

// 4. 导出供 Creator 使用
export { defaultImageNode };
```

### 添加 UI 组件

UI 组件（如 SelectionBox）是纯视觉元素，用于显示临时状态（如框选框）。它们：
- 不处理用户交互（pointerEvents: none）
- 类型前缀为 `ui/`
- 渲染在最顶层

```typescript
// Components/SelectionBox.tsx
import { Obj, Coms } from "../Globals";
import { atom } from "jotai";

interface SelectionBox extends Obj {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const SelectionBoxComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  useAtom(obj.updater);
  const box = obj as SelectionBox;
  const x = Math.min(box.start.x, box.end.x);
  const y = Math.min(box.start.y, box.end.y);
  const width = Math.abs(box.end.x - box.start.x);
  const height = Math.abs(box.end.y - box.start.y);

  return (
    <g className="selection-box">
      <rect
        x={x} y={y} width={width} height={height}
        fill="rgba(33, 150, 243, 0.2)"
        stroke="#2196f3"
        pointerEvents="none"
      />
    </g>
  );
};
Coms["ui/selectionBox"] = SelectionBoxComponent;
```

### 添加新控制器

1. 在 `Controllers/` 下创建文件
2. 定义事件处理函数
3. 注册到 `Controllers` 数组

```typescript
// Controllers/Zoomer.ts
export const onWheel = (e: WheelEvent) => {
  viewport.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
};

Controllers.push({
  Begin: () => window.addEventListener("wheel", onWheel),
  End: () => window.removeEventListener("wheel", onWheel),
});
```

### 添加新设置项

在 Controller 文件中直接注册：

```typescript
// Controllers/MyFeature.ts
import { registerSetting } from "../Option";

let myKey = "Control";

registerSetting({
  id: "myFeature.hotkey",
  category: "My Feature",
  title: "快捷键",
  type: "key",
  defaultValue: "Control",
  value: "Control",
  onChange: (v) => { myKey = v; },
});
```

## 注意事项

1. **不要依赖 updater 的值**：它只用于触发更新，内部数值无意义
2. **对象是可变的**：直接修改 `obj.pos` 等属性是预期行为
3. **修改后必须调用 Manager.update()**：否则 UI 不会更新
4. **Controller 必须在 Begin/End 中配对**：防止内存泄漏
5. **selected 可以多个，actived 只能一个**
6. **节点类型定义在组件文件中**，使用新节点类型时需确保组件已导入
