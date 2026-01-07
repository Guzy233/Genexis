import React, { useState, useRef, useEffect, useCallback } from "react";

interface EditableTextProps {
  text: string;
  size: { x: number; y: number };
  onTextChange: (
    newText: string,
    newSize: { width: number; height: number }
  ) => void;
  onStartEditing?: () => void;
  onEndEditing?: () => void;
  fontSize?: string;
}

let wasUndoIntercepted = false;

export const EditableText: React.FC<EditableTextProps> = ({
  text,
  size,
  onTextChange,
  onStartEditing,
  onEndEditing,
  fontSize = "14px",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. 启动编辑
  const startEditing = useCallback(() => {
    setIsEditing(true);
    onStartEditing?.();
  }, [onStartEditing]);

  const stopEditing = useCallback(() => {
    setIsEditing(false);
    onEndEditing?.();
    window.removeEventListener("mousedown", onMouseDown, true);
  }, [onEndEditing]);

  const measureText = useCallback(
    (val: string) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return { width: 100, height: 50 };
      context.font = `${fontSize} '"PingFang SC", "Microsoft YaHei", sans-serif'`;
      const metrics = context.measureText(val);
      return {
        width: Math.max(100, metrics.width + 30),
        height: Math.max(50, 24 + 20),
      };
    },
    [fontSize]
  );
  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!inputRef.current?.contains(target)) {
      stopEditing();
    }
  };

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

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
          stopEditing();
        }
      }, 0);
    }
    if (!e.shiftKey && e.key === "Enter") stopEditing();
  }, []);

  return (
    <g
      onDoubleClick={(e) => {
        e.stopPropagation();
        window.addEventListener("mousedown", onMouseDown, true);
        startEditing();
      }}
    >
      <foreignObject width={size.x} height={size.y}>
        <div
          className="content-container"
        >
          {isEditing ? (
            <input
              ref={inputRef}
              className="edit-input"
              value={text}
              onMouseDown={(e) => e.stopPropagation()}
              onBeforeInput={beforeInput}
              onKeyDown={onKeyDown}
              onChange={(e) => {
                const newVal = e.target.value;
                onTextChange(newVal, measureText(newVal));
              }}
              style={{
                fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
              }}
            />
          ) : (
            <span className="text-display no-select">{text}</span>
          )}
        </div>
      </foreignObject>
    </g>
  );
};
