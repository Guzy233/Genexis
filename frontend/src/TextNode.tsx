import { atom, useAtom } from "jotai";
import { useRef, useEffect, useCallback } from "react";
import Manager, { actived, objects } from "./Manager";
import { Obj, Anchor, anchors_rect, Node, Coms } from "./Globals";
import { isEditing } from "./Editor";

export interface TextNode extends Node {
  text: string;
}

const anchors_default: Anchor[] = [anchors_rect[1], anchors_rect[2]];
export const defaultTextNode: TextNode = {
  id: "base",
  type: "node/text",
  updater: atom<number>(0),
  pos: { x: 0, y: 0 },
  size: { x: 200, y: 100 },
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
  const isNodeEditing = isEditing(node.id);

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
    // TODO: 撤销处理，待键盘操作器实现后对接
    if (e.key === "z" && e.ctrlKey) {
      wasUndoIntercepted = false;
    }
  }, []);

  const getFillColor = () => {
    if (actived === node.id) return "#8ce7ab33";
    if (node.selected) return "#e3f2fd33";
    return "rgba(59, 59, 59, 0.15)";
  };

  const getStrokeColor = () => {
    if (actived === node.id) return "#7d6bb4ff";
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
        // e.stopPropagation();
        // actionBus.despacth({
        //   type: "POINTER_DBCLICK",
        //   target: node,
        //   pos: screen2Viewport({ x: e.clientX, y: e.clientY }),
        // });
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
              onInput={onInput}
              onBeforeInput={beforeInput}
              onKeyDown={onKeyDown}
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