import { atom, useAtom } from "jotai";
import { Obj, Coms } from "../Globals";

// 删除轨迹点接口
interface TrailPoint {
  x: number;
  y: number;
}

// 删除轨迹 UI 对象接口
interface DeletionTrail extends Obj {
  points: TrailPoint[];
}

const DeletionTrailComponent: React.FC<{ obj: Obj }> = ({ obj }) => {
  useAtom(obj.updater);
  const trail = obj as DeletionTrail;

  if (trail.points.length < 2) {
    return null;
  }

  // 创建路径数据
  const pathData = trail.points
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `L ${point.x} ${point.y}`;
    })
    .join(" ");

  return (
    <g className="deletion-trail" pointerEvents="none">
      {/* 绘制轨迹线 */}
      <path
        d={pathData}
        stroke="#ff4444"
        strokeWidth="3"
        fill="none"
        strokeOpacity="0.6"
        strokeDasharray="8 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 绘制轨迹点 */}
      {trail.points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#ff4444"
          opacity="0.8"
        />
      ))}
    </g>
  );
};

Coms["ui/deletionTrail"] = DeletionTrailComponent;
