import { objects } from "../Manager";
import { serializeCanvas, deserializeCanvas } from "../Serialization";
import { SaveFile, LoadFile } from "../../wailsjs/go/main/App";
import { Controllers } from "../Globals";

// 当前文件路径（用于保存时使用相同的文件名）
let currentFilePath: string | null = null;

// 设置当前文件路径
export const setCurrentFilePath = (path: string | null) => {
  currentFilePath = path;
};

// 获取当前文件路径
export const getCurrentFilePath = () => currentFilePath;

// 从文件路径提取文件名
const getFilenameFromPath = (path: string): string => {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || "mindgraph.json";
};

// 保存文件
export const saveFile = async (saveAs: boolean = false): Promise<boolean> => {
  try {
    console.log("开始保存文件...");

    // 序列化画布数据
    const serializedData = serializeCanvas(objects);
    const jsonData = JSON.stringify(serializedData, null, 2);

    console.log("序列化数据长度:", jsonData.length);

    // 确定默认文件名
    const defaultFilename = saveAs || !currentFilePath ? "" : getFilenameFromPath(currentFilePath);

    console.log("默认文件名:", defaultFilename || "(无)");

    // 调用 Wails 后端保存文件
    const result = await SaveFile(jsonData, defaultFilename);

    console.log("保存结果:", result);

    // 用户取消了保存对话框或保存失败
    if (!result) {
      console.log("保存被取消或失败");
      return false;
    }

    // 更新当前文件路径
    currentFilePath = result;
    console.log("文件已保存:", result);
    return true;
  } catch (error) {
    console.error("保存文件失败:", error);
    alert("保存文件失败: " + (error as Error).message);
    return false;
  }
};

// 另存为
export const saveFileAs = async (): Promise<boolean> => {
  return saveFile(true);
};

// 加载文件
export const loadFile = async (): Promise<boolean> => {
  try {
    console.log("开始加载文件...");

    // 调用 Wails 后端加载文件
    const result = await LoadFile();

    console.log("加载结果:", result);

    // 用户取消了加载对话框
    if (!result) {
      console.log("加载被取消");
      return false;
    }

    // 解析 JSON 返回值
    const { path: filePath, content: fileData } = JSON.parse(result);

    if (!filePath || !fileData) {
      console.log("文件路径或内容为空");
      return false;
    }

    // 清空当前对象
    Object.keys(objects).forEach((key) => {
      delete objects[key];
    });

    // 解析 JSON 数据
    const data = JSON.parse(fileData);

    // 反序列化画布数据
    deserializeCanvas(data, objects);

    // 更新当前文件路径
    currentFilePath = filePath;

    // 触发画布更新
    const { updateCanvas } = await import("../Manager");
    updateCanvas();

    console.log("文件已加载:", filePath);
    return true;
  } catch (error) {
    console.error("加载文件失败:", error);
    alert("加载文件失败: " + (error as Error).message);
    return false;
  }
};

// 检查是否有未保存的更改（简单实现）
// 可以根据需要扩展为跟踪画布状态
export const hasUnsavedChanges = (): boolean => {
  // 简单实现：如果有任何对象，就认为有未保存的更改
  // 更复杂的实现可以跟踪修改状态
  return Object.keys(objects).length > 0;
};

// 新建文件
export const newFile = async (): Promise<boolean> => {
  try {
    // 检查是否有未保存的更改
    if (hasUnsavedChanges()) {
      const confirmed = confirm("当前画布有未保存的更改，确定要新建吗？");
      if (!confirmed) {
        return false;
      }
    }

    // 清空当前对象
    Object.keys(objects).forEach((key) => {
      delete objects[key];
    });

    // 清空当前文件路径
    currentFilePath = null;

    // 触发画布更新
    const { updateCanvas } = await import("../Manager");
    updateCanvas();

    // 清空历史记录
    const { saveHistory } = await import("../Manager");
    saveHistory();

    return true;
  } catch (error) {
    console.error("新建文件失败:", error);
    return false;
  }
};

// 注册控制器
Controllers.push({
  Begin: () => {
    // File 控制器不需要全局事件监听
    // 保存和加载通过菜单或快捷键触发
  },
  End: () => {
    // 清理
  },
});
