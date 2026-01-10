import React, { useState, useRef, useEffect, useCallback } from "react";

interface EditableTextProps {
  text: string;
  size: { x: number; y: number };
  onTextChange?: (
    newText: string,
    newSize: { width: number; height: number }
  ) => void;
  onStartEditing?: () => void;
  onEndEditing?: (finalText: string) => void;
  fontSize?: string;
  containerClassName?: string;
  inputClassName?: string;
  displayClassName?: string;
}

const measureText = (val: string, fontSize: string) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { width: 100, height: 50 };
  context.font = `${fontSize} '"PingFang SC", "Microsoft YaHei", sans-serif'`;
  const metrics = context.measureText(val);
  return {
    width: Math.max(100, metrics.width + 30),
    height: Math.max(50, 24 + 20),
  };
};

const startEditing = (
  ref: HTMLInputElement,
  onEndEditing?: (finalText: string) => void,
  setIsEditing?: (isEditing: boolean) => void,
  onTextChange?: (
    newText: string,
    newSize: { width: number; height: number }
  ) => void,
  fontSize?: string
) => {
  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!ref.contains(target)) {
      stopEditing();
    }
  };
  let wasUndoIntercepted = false;

  const beforeInput = (e: InputEvent) => {
    if (e.inputType === "historyUndo") {
      wasUndoIntercepted = true;
    }
  };

  const stopEditing = () => {
    ref.removeEventListener("input", onChange, true);
    ref.removeEventListener("beforeinput", beforeInput, true);
    ref.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("mousedown", onMouseDown, true);
    if (setIsEditing) setIsEditing(false);
    if (onEndEditing) onEndEditing(ref.value);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "z" && e.ctrlKey) {
      wasUndoIntercepted = false;
      setTimeout(() => {
        if (!wasUndoIntercepted) {
          stopEditing();
        }
      }, 0);
    }
    if (!e.shiftKey && e.key === "Enter") stopEditing();
  };

  const onChange = () => {
    if (onTextChange) {
      const newText = ref.value;
      const newSize = measureText(newText, fontSize || "14px");
      onTextChange(newText, newSize);
    }
  };
  ref.addEventListener("input", onChange, true);
  ref.addEventListener("beforeinput", beforeInput, true);
  ref.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("mousedown", onMouseDown, true);
};

export const EditableText: React.FC<EditableTextProps> = ({
  text,
  size,
  onTextChange,
  onStartEditing,
  onEndEditing,
  fontSize = "14px",
  containerClassName,
  inputClassName,
  displayClassName,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editPosition, setEditPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isEditing) {
      // 延迟聚焦，确保 DOM 已更新
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);

      startEditing(
        inputRef.current!,
        onEndEditing,
        setIsEditing,
        onTextChange,
        fontSize
      );
    }
  }, [isEditing]);

  // 处理双击，计算输入框在屏幕上的位置
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    setEditPosition({ x: rect.left, y: rect.top });
    onStartEditing?.();
    setIsEditing(true);
  };

  return (
    <g onDoubleClick={handleDoubleClick}>
      {/* 显示模式：使用纯 SVG text，性能最优 */}
      {!isEditing && (
        <text
          x={size.x / 2}
          y={size.y / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className={displayClassName || "text-display no-select"}
          style={{
            fontSize,
            fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
            pointerEvents: 'none',
          }}
        >
          {text}
        </text>
      )}

      {/* 编辑模式：使用 fixed 定位的 HTML input，渲染在 SVG 之外 */}
      {isEditing && (
        <foreignObject x={0} y={0} width={size.x} height={size.y} style={{ pointerEvents: 'none' }}>
          <input
            ref={inputRef}
            className={inputClassName || "edit-input"}
            defaultValue={text}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            style={{
              fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
              position: 'fixed',
              left: `${editPosition.x}px`,
              top: `${editPosition.y}px`,
              width: `${size.x}px`,
              height: `${size.y}px`,
              pointerEvents: 'auto',
              zIndex: 10000,
            }}
          />
        </foreignObject>
      )}
    </g>
  );
};
