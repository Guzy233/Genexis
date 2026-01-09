import React, { useState, useRef, useEffect, useCallback } from "react";

interface EditableTextProps {
  text: string;
  size: { x: number; y: number };
  onTextChange: (
    newText: string,
    newSize: { width: number; height: number }
  ) => void;
  onStartEditing?: () => void;
  onEndEditing?: (finalText: string) => void;
  fontSize?: string;
  containerClassName?: string;
  inputClassName?: string;
  displayClassName?: string;
  clickToEdit?: boolean;
}

let wasUndoIntercepted = false;

const beforeInput=(e: React.FormEvent<HTMLInputElement>) => {
    const inputEvent = e as unknown as InputEvent;
    if (inputEvent.inputType === "historyUndo") {
      wasUndoIntercepted = true;
    }
  }

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
  clickToEdit = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. 启动编辑
  const startEditing = useCallback(() => {
    setIsEditing(true);
    setEditingText(text);
    onStartEditing?.();
  }, [onStartEditing, text]);

  const stopEditing = useCallback(() => {
    setIsEditing(false);
    onEndEditing?.(editingText);
    window.removeEventListener("mousedown", onMouseDown, true);
  }, [onEndEditing, editingText]);

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

  const onMouseDown = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!inputRef.current?.contains(target)) {
      stopEditing();
    }
  }, [stopEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

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
  }, [stopEditing]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isEditing && clickToEdit) {
      e.stopPropagation();
      window.addEventListener("mousedown", onMouseDown, true);
      startEditing();
    }
  }, [isEditing, clickToEdit, onMouseDown, startEditing]);

  return (
    <g
      onClick={clickToEdit ? handleClick : undefined}
      onDoubleClick={(e) => {
        if (!clickToEdit) {
          e.stopPropagation();
          window.addEventListener("mousedown", onMouseDown, true);
          startEditing();
        }
      }}
    >
      <foreignObject width={size.x} height={size.y}>
        <div className={containerClassName || "content-container"}>
          {isEditing ? (
            <input
              ref={inputRef}
              className={inputClassName || "edit-input"}
              value={editingText}
              onMouseDown={(e) => e.stopPropagation()}
              onBeforeInput={beforeInput}
              onKeyDown={onKeyDown}
              onChange={(e) => {
                const newVal = e.target.value;
                setEditingText(newVal);
                onTextChange(newVal, measureText(newVal));
              }}
              style={{
                fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
              }}
              onMouseDownCapture={(e)=>e.stopPropagation() }
            />
          ) : (
            <span className={displayClassName || "text-display no-select"}>{text}</span>
          )}
        </div>
      </foreignObject>
    </g>
  );
};
