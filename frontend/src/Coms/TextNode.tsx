import { atom, useAtom } from "jotai";
import { useRef, useEffect, useCallback } from "react";
import Manager, { objects } from "../Manager";
import { Obj, Anchor, anchors_rect, Node, Coms, idFromEvent } from "../Globals";
import { isActived } from "../Operators/Selector";

export interface TextNode extends Node {
  text: string;
}

const endEditing = new CustomEvent("end-editing", {
  bubbles: true,
});

let editingElement = "";

export const setEditing = (id: string) => {
  editingElement = id;
  Manager.updateId(id);

  // 临时注册点击监听器，闭包内捕获当前 id
  const onMouseDown = (e: MouseEvent) => {
    const clickedId = idFromEvent(e, ".node-group");
    if (clickedId !== id) {
      // 清除编辑状态并移除自己
      editingElement = "";
      Manager.updateId(id);
      window.removeEventListener("mousedown", onMouseDown, true);
    }
  };
  const onEndEditing = (e: Event) => {
    editingElement = "";
    Manager.updateId(id);
    window.removeEventListener("mousedown", onMouseDown, true);
  };
  window.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("end-editing", onEndEditing, true);
};

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];
export const defaultTextNode: TextNode = {
  id: "base",
  type: "node/text",
  updater: atom<number>(0),
  pos: { x: 0, y: 0 },
  size: { x: 100, y: 50 },
  text: "New Node",
  selected: false,
  eAncs: anchors_default,
  aAncs: anchors_rect,
};

export const TextNodeComponent: React.FC<{
  obj: Obj;
}> = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as TextNode;

  const nodeRef = useRef<SVGGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNodeEditing = editingElement === node.id;

  useEffect(() => {
    if (isNodeEditing && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [isNodeEditing]);

  // 计算文本边界尺寸
  const textBoundSize = useCallback((text: string, fontSize = "14px") => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return { width: 0, height: 0 };
    }
    context.font = `${fontSize} '"PingFang SC", "Microsoft YaHei", sans-serif'`;

    const metrics = context.measureText(text);

    const paddingH = 30; // 左右内边距之和
    const paddingV = 20; // 上下内边距之和

    return {
      width: Math.max(100, metrics.width + paddingH), // 最小宽度 100
      height: Math.max(50, 24 + paddingV), // 这里的 24 是大概的行高
    };
  }, []);

  const onInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement;
      if (node) {
        node.text = target.value;
        const size = textBoundSize(target.value);
        if (size.width > 0 && size.height > 0) {
          node.size = { x: size.width, y: size.height };
        }
        Manager.update(node);
      }
    },
    [node, textBoundSize]
  );

  let wasUndoIntercepted = false;

  const beforeInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const inputEvent = e as unknown as InputEvent;
    if (inputEvent.inputType === "historyUndo") {
      wasUndoIntercepted = true;
    }
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "z" && e.ctrlKey) {
      wasUndoIntercepted = false;
      setTimeout(() => {
        if (!wasUndoIntercepted) {
          // 按下撤销键但没撤销，退出编辑
          window.dispatchEvent(endEditing);
        }
      }, 0);
    }
    if (!e.shiftKey && e.key === "Enter") window.dispatchEvent(endEditing);
  }, []);

  const getFillColor = () => {
    if (isActived(node.id)) return "#8ce7ab33";
    if (node.selected) return "#e3f2fd33";
    return "rgba(59, 59, 59, 0.15)";
  };

  const getStrokeColor = () => {
    if (isActived(node.id)) return "#7d6bb4ff";
    if (node.selected) return "#765a80ff";
    return "#805a5a78";
  };

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
      ref={nodeRef}
      onDoubleClick={(e) => {
        setEditing(node.id);
      }}
    >
      {/* 背景矩形 */}
      <rect
        width={node.size.x}
        height={node.size.y}
        rx="6"
        fill={getFillColor()}
        stroke={getStrokeColor()}
        strokeWidth="2"
      />

      {/* 内容区域 */}
      <foreignObject width={node.size.x} height={node.size.y}>
        <div className="content-container">
          {isNodeEditing ? (
            <input
              ref={inputRef}
              className="edit-input"
              value={node.text || ""}
              onMouseDown={(e) => e.stopPropagation()}
              onBeforeInput={beforeInput}
              onKeyDown={onKeyDown}
              onChange={onInput}
              style={{
                fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
              }}
            />
          ) : (
            <span className="text-display no-select">{node.text}</span>
          )}
        </div>
      </foreignObject>
    </g>
  );
};

Coms["node/text"] = TextNodeComponent;
