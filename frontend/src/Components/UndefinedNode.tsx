import { useAtom } from "jotai";
import React from "react";
import { Coms, Node, Obj } from "../Globals";
import { activedId } from "../Controllers/Selector";
import { NodeBackground } from "./NodeBackground";


Coms["node/undefined"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as Node;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
    >
      <NodeBackground
        node={node}
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
