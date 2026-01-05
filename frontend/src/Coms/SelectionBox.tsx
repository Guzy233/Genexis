import { atom, useAtom } from "jotai";
import { Obj, Coms } from "../Globals";

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
        x={x}
        y={y}
        width={width}
        height={height}
        fill="rgba(33, 150, 243, 0.2)"
        stroke="#2196f3"
        strokeWidth="1"
        strokeDasharray="4 2"
        pointerEvents="none"
      />
    </g>
  );
};

Coms["ui/selectionBox"] = SelectionBoxComponent;
