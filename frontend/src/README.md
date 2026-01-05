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

以 [CurveEdge.tsx](src/Coms/CurveEdge.tsx) 为例，边组件同时订阅源节点和目标节点的更新器：

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
├── Coms/           # React 渲染组件
│   ├── TextNode.tsx    # 文本节点组件
│   ├── CurveEdge.tsx   # 曲线边组件
│   └── SelectionBox.tsx  # 框选组件（UI层）
├── Operators/      # 操作处理器（逻辑层）
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

**Coms** 只负责渲染：
- 接收 `obj` 数据
- 根据 `obj.type` 从 `Coms` 字典获取对应组件
- 不包含交互逻辑

**Operators** 只负责处理用户操作：
- 每个 Operator 是一个对象 `{ Begin: () => void, End: () => void }`
- `Begin()`: 注册事件监听器
- `End()`: 移除事件监听器
- 操作完成后直接修改对象并调用 `Manager.update()`

### 生命周期管理

在 [App.tsx](src/App.tsx) 中：

```typescript
useEffect(() => {
  Operators.map((op) => op.Begin());  // 挂载时启动所有操作器
  return () => Operators.map((op) => op.End());  // 卸载时清理
}, []);
```

这种方式使功能模块化，可以随时添加/移除操作器。

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
// Operators/Linker.ts
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

## 新增功能指南

### 添加新节点类型

节点类型定义在组件文件中，而非 `Globals.ts`。这种方式确保使用节点时必须导入组件文件。

```typescript
// Coms/ImageNode.tsx
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
// Coms/SelectionBox.tsx
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

### 添加新操作

1. 在 `Operators/` 下创建文件
2. 定义事件处理函数
3. 注册到 `Operators` 数组

```typescript
// Operators/Zoomer.ts
export const onWheel = (e: WheelEvent) => {
  viewport.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
};

Operators.push({
  Begin: () => window.addEventListener("wheel", onWheel),
  End: () => window.removeEventListener("wheel", onWheel),
});
```

### 添加新设置项

在 Operator 文件中直接注册：

```typescript
// Operators/MyFeature.ts
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
4. **Operator 必须在 Begin/End 中配对**：防止内存泄漏
5. **selected 可以多个，actived 只能一个**
6. **节点类型定义在组件文件中**，使用新节点类型时需确保组件已导入
