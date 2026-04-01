import { onSetup } from "@SDK/Globals";
import { registerKeyAction } from "@SDK/Controllers/KeyBinding";
import { objects } from "@SDK/Manager";

console.log("[HelloPlugin] 脚本开始解析...");

onSetup(() => {
  console.log("[HelloPlugin] 正在执行 Setup 初始化 (画布已就位)");

  registerKeyAction({
    action: "plugin.hello_world.toast",
    handler: () => {
      const nodeCount = Object.keys(objects).length;
      alert(`你好！来自插件的问候。\n当前画布上有 ${nodeCount} 个对象。`);
    },
    settings: {
      id: "plugin.hello_world.toast",
      category: "示例插件",
      title: "打个招呼",
      type: "key" as any,
      defaultValue: "Ch",
      value: "Ch",
      description: "按下 Ctrl + H 触发插件弹窗"
    }
  });

  console.log("[HelloPlugin] 快捷键 Ctrl+H 已注册");

  return () => {
    console.log("[HelloPlugin] 插件已卸载清理");
  };
});
