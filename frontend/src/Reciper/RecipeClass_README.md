# RecipeClass 系统重构说明

## 概述

本次重构引入了新的 `RecipeClass` 系统,使用 **mark-based** 标识符而非 **path-based** 路径来处理配方槽位替换逻辑。这简化了对有序合成、无序合成和数组元素的处理。

## 设计原则

### 1. 配方类 (RecipeClass)

每个配方类型对应一个类,包含:
- **属性**: 宽度、高度、布局信息
- **方法**: 
  - `generateLayout()`: 生成带mark的布局
  - `replaceByMark(mark, info)`: 根据mark替换配方内容
  - `getRecipe()`: 获取修改后的配方对象

### 2. 槽位标记 (SlotMark)

每个槽位有唯一的mark标识符:

- `input1`, `input2`, `input3`, ... - 具体的输入槽位
- `emptySlot` - 空槽位 (无序合成中未填充的位置)
- `outputItem` - 物品输出
- `outputFluid` - 流体输出
- `inputFluid` - 流体输入
- `inputChemical` - 化学品输入

### 3. 替换逻辑简化

**旧系统 (Path-based)**:
```typescript
// 需要维护复杂的路径
slotPath: { type: 'array', path: 'ingredients', index: 2 }
slotPath: { type: 'shaped', row: 1, col: 2 }

// 回写时需要处理不同类型
switch (slotPath.type) {
  case 'array': /* 复杂的数组处理 */
  case 'shaped': /* 复杂的有序合成处理 */
}
```

**新系统 (Mark-based)**:
```typescript
// 简单的mark标识
mark: 'input3'
mark: 'emptySlot'

// 回写统一接口
recipeClass.replaceByMark(mark, info);
```

## 实现细节

### 无序合成 (ShapelessRecipeClass)

**空槽位处理**:
- 添加物品到空槽位 → 附加到 `ingredients` 数组末尾
- 不需要关心具体是哪个空槽位

**删除操作**:
- 删除某个输入 → 从数组中移除,后续物品自动补位
- 自动处理数组长度

```typescript
// 示例: 无序合成有3个物品,点击第2个物品删除
// 旧系统: 需要标记为null,数组变为 [item1, null, item3]
// 新系统: 直接移除,数组变为 [item1, item3],自动补位
```

### 事件系统更新

**ItemPointer.ts**:
```typescript
// 拖拽放置
detail: info  // {type: 'item', id: 'minecraft:iron_ingot', amount: 1}

// 删除操作
detail: { id: "" }  // 统一的删除格式
```

**RecipeNode.tsx**:
```typescript
// 优先尝试使用RecipeClass
const recipeClass = createRecipeClass(recipe);
if (recipeClass && markAttr) {
  recipeClass.replaceByMark(markAttr, info);
  node.recipe = recipeClass.getRecipe();
  return;
}

// 回退到旧的path-based系统
applySlotPath(recipe, slotPath, newItem);
```

## 拦截逻辑

为了减轻调试压力,采用**渐进式迁移**:

1. **检测配方类型**: `createRecipeClass(recipe)` 尝试创建RecipeClass
2. **优先新系统**: 如果RecipeClass存在且有mark属性,使用新系统
3. **回退旧系统**: 否则使用原有的path-based逻辑

这样可以:
- ✅ 新配方类型自动使用新系统
- ✅ 旧配方继续正常工作
- ✅ 逐步添加更多RecipeClass实现

## 已支持的配方类型

### ShapelessRecipeClass (无序合成)
- ✅ 3x3网格显示
- ✅ 空槽位标记为 `emptySlot`
- ✅ 填充槽位标记为 `input1` ~ `input9`
- ✅ 输出标记为 `outputItem`
- ✅ 添加到空槽位 → 附加到ingredients末尾
- ✅ 删除操作 → 自动补位

### ShapedRecipeClass (有序合成)
- ✅ 3x3网格显示
- ✅ 槽位标记为 `input_row_col` 格式 (如 `input_0_0`, `input_1_2`)
- ✅ 空槽位标记为 `emptySlot`
- ✅ 输出标记为 `outputItem`
- ✅ **智能字符分配**: 自动为新物品分配未使用的字符 (A-Z, a-z, 0-9)
- ✅ **字符复用检测**: 检测pattern中字符的使用次数
  - 单次使用 → 直接替换key中的物品
  - 多次使用 → 分配新字符,只修改当前位置
- ✅ **删除操作**: 
  - 单次使用 → 清除pattern位置并删除key
  - 多次使用 → 只清除当前pattern位置
- ✅ **添加到空槽位** → 找到第一个空位并分配新字符

**有序合成特性示例**:
```json
// 原配方
{
  "pattern": ["AAA", "ABA", "AAA"],
  "key": {
    "A": {"item": "minecraft:iron_ingot"},
    "B": {"item": "minecraft:diamond"}
  }
}

// 场景1: 替换中心的钻石 (B只用了1次)
// 操作: 点击中心槽位,替换为金锭
// 结果: key["B"] 直接改为金锭

// 场景2: 替换某个铁锭 (A用了8次)
// 操作: 点击左上角,替换为金锭
// 结果: 分配新字符C, pattern变为["CAA", "ABA", "AAA"], 添加key["C"]=金锭

// 场景3: 删除中心钻石
// 操作: 右键删除中心
// 结果: pattern变为["AAA", "A A", "AAA"], 删除key["B"]

// 场景4: 删除某个铁锭
// 操作: 右键删除左上角
// 结果: pattern变为[" AA", "ABA", "AAA"], key["A"]保留(因为还在其他位置使用)
```

## 后续扩展

可以继续添加更多配方类型,例如:

### TODO: 其他模组配方类型
- MekanismMetallurgicInfusingClass (Mekanism冶金灌注)
- ARCFurnaceClass (沉浸工程电弧炉)
- EnderIOAlloySmelting (末影接口合金炉)
- AdvancedAEReaction (高级应用能源反应器)
- ...

## 兼容性

- ✅ 向后兼容: 旧的path-based系统继续工作
- ✅ 事件兼容: 同时支持新旧detail格式
- ✅ 序列化兼容: RecipeClass只在运行时使用,序列化仍使用原始Recipe对象

## 调试

```typescript
// 在控制台查看是否使用新系统
console.log(createRecipeClass(recipe));  // null = 使用旧系统, RecipeClass实例 = 使用新系统

// 查看槽位mark
document.querySelector('[data-slot-mark]').getAttribute('data-slot-mark');
```

## 优势总结

1. **简化逻辑**: 不需要维护复杂的路径系统
2. **易于扩展**: 添加新配方类型只需实现RecipeClass
3. **直观**: mark直接表达槽位的语义 (input1, emptySlot等)
4. **健壮**: 数组操作自动处理补位和扩展
5. **渐进式**: 可以逐步迁移,不影响现有功能
