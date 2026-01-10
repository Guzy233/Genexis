import { getDefaultStore, PrimitiveAtom, useAtom } from "jotai";
import React, { useState, useRef, useEffect, useCallback } from "react";

interface EditableTextProps {
  text: string;
  size: { x: number; y: number };
  isEditingAtom: PrimitiveAtom<boolean>;
  onTextChange?: (
    newText: string,
    newSize: { width: number; height: number }
  ) => void;
  onEndEditing?: (finalText: string) => void;
  fontSize?: string;
  inputClassName?: string;
  displayClassName?: string;
  textAlign?: "left" | "center" | "right";
  placeholder?: string;
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
  setIsEditing?: PrimitiveAtom<boolean>,
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
    ref.removeEventListener("keydown", onKeyDown, true);
    ref.removeEventListener("beforeinput", beforeInput, true);
    window.removeEventListener("mousedown", onMouseDown, true);
    if (setIsEditing) getDefaultStore().set(setIsEditing, false);
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
  ref.addEventListener("keydown", onKeyDown, true);
  ref.addEventListener("beforeinput", beforeInput, true);
  window.addEventListener("mousedown", onMouseDown, true);
};

export const EditableText: React.FC<EditableTextProps> = ({
  text,
  size,
  isEditingAtom,
  onTextChange,
  onEndEditing,
  fontSize = "14px",
  inputClassName,
  displayClassName,
  textAlign = "center",
  placeholder,
}) => {
  // const [isEditing, setIsEditing] = useState(false);
  const [isEditing] = useAtom(isEditingAtom);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);

      startEditing(
        inputRef.current!,
        onEndEditing,
        isEditingAtom,
        onTextChange,
        fontSize
      );
    }
  }, [isEditing]);

  // 根据 textAlign 计算 textAnchor 和 x 位置
  const getTextAnchor = () => {
    switch (textAlign) {
      case "left":
        return "start";
      case "right":
        return "end";
      default:
        return "middle";
    }
  };

  const getTextX = () => {
    switch (textAlign) {
      case "left":
        return 4;
      case "right":
        return size.x - 4;
      default:
        return size.x / 2;
    }
  };

  // 显示的文本（空时显示占位符）
  const displayText = text || placeholder;
  // 是否是占位符
  const isPlaceholder = !text;

  return (
    <>
      {!isEditing && (
        <text
          x={getTextX()}
          y={size.y / 2+1}
          textAnchor={getTextAnchor()}
          dominantBaseline="middle"
          className={displayClassName || "text-display no-select"}
          style={{
            fontSize,
            fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
            pointerEvents: "none",
            fill: isPlaceholder
              ? "var(--text-tertiary)"
              : "var(--text-primary)",
          }}
        >
          {displayText}
        </text>
      )}
      {isEditing && (
        <foreignObject x={0} y={-1} width={size.x} height={size.y}>
          <input
            ref={inputRef}
            className={inputClassName || "edit-input"}
            defaultValue={text}
            placeholder={placeholder}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            style={{
              fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              fontSize,
              textAlign,
              border: "none",
              outline: "none",
              background: "transparent",
              paddingLeft:
                textAlign === "left"
                  ? "4px"
                  : textAlign === "right"
                  ? "0"
                  : "0",
              paddingRight: textAlign === "right" ? "4px" : "0",
            }}
          />
        </foreignObject>
      )}
    </>
  );
};
