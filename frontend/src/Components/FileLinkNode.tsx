import { atom, useAtom } from "jotai";
import { Anchor, anchors_rect, Coms, Node, Obj } from "../Globals";
import { ObjectFactories } from "../Controllers/Creator";
import { registerSerializer, serializeAnchors, deserializeAnchors } from "../Serialization";
import { openFileByPath } from "../Workspace";
import { NodeBackground } from "./NodeBackground";

export interface FileLinkNode extends Node {
  text: string;
  workspaceRelativePath: string;
}

const defaultAnchors: Anchor[] = [anchors_rect[1], anchors_rect[2]];

registerSerializer(
  "node/file-link",
  (obj: Obj) => {
    const node = obj as FileLinkNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      aAncs: serializeAnchors(node.aAncs, "rect"),
      eAncs: serializeAnchors(node.eAncs, null),
      text: node.text,
      workspaceRelativePath: node.workspaceRelativePath,
      selected: node.selected,
      z: node.z ?? 0,
    };
  },
  (data) => {
    const node: FileLinkNode = {
      id: data.id,
      type: data.type,
      updater: atom(0),
      pos: { ...data.pos },
      size: { ...data.size },
      aAncs: deserializeAnchors(data.aAncs),
      eAncs: deserializeAnchors(data.eAncs),
      text: data.text || "Linked File",
      workspaceRelativePath: data.workspaceRelativePath || "",
      selected: data.selected ?? false,
      z: data.z ?? 0,
    };
    return node;
  }
);

ObjectFactories["node/file-link"] = (): FileLinkNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/file-link",
    updater: atom(0),
    pos: { x: 0, y: 0 },
    size: { x: 180, y: 44 },
    text: "Linked File",
    workspaceRelativePath: "",
    selected: false,
    z: 0,
    eAncs: defaultAnchors,
    aAncs: anchors_rect,
  };
};

Coms["node/file-link"] = ({ obj }) => {
  useAtom(obj.updater);
  const node = obj as FileLinkNode;

  return (
    <g
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      className="node-group"
      data-id={node.id}
      onDoubleClick={() => {
        if (node.workspaceRelativePath) {
          openFileByPath(node.workspaceRelativePath);
        }
      }}
    >
      <NodeBackground node={node} />
      <text
        x={12}
        y={node.size.y / 2 + 1}
        textAnchor="start"
        dominantBaseline="middle"
        style={{
          fill: "var(--text-primary)",
          fontSize: "12px",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {node.text}
      </text>
    </g>
  );
};
