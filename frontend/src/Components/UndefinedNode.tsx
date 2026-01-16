import { useAtom } from "jotai";
import React from "react";
import { Coms, Node, Obj } from "../Globals";
import { activedId } from "../Controllers/Selector";

const getFillColor = (node: Node) => {
  if (node.id === activedId) return "rgba(239, 68, 68, 0.25)";  // 红色激活
  if (node.selected) return "rgba(239, 68, 68, 0.2)";          // 红色选中
  return "rgba(239, 68, 68, 0.1)";                           // 默认红色半透明
};

const getStrokeColor = (node: Node) => {
  if (node.id === activedId) return "#ef4444";  // 红色激活边框
  if (node.selected) return "#ef4444";          // 红色选中边框
  return "rgba(239, 68, 68, 0.4)";              // 默认边框
};

Coms["node/undefined"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as Node;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      <rect
        width={node.size.x}
        height={node.size.y}
        rx="6"
        fill={getFillColor(node)}
        stroke={getStrokeColor(node)}
        strokeWidth="2"
        strokeDasharray="4 2"
      />
      <text
        x={node.size.x / 2}
        y={node.size.y / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ef4444"
        fontSize="12"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        未知类型节点：{node.type}
      </text>
    </g>
  );
};
