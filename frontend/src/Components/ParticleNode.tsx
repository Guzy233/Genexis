
import React from "react";
import { atom, useAtom } from "jotai";
import { Coms, Node, Obj, onSetup, Vec2 } from "../Globals";
import { ObjectFactories } from "../Controllers/Creator";
import { registerSerializer } from "../Serialization";

// ==================== ParticleNode Definition ====================

export interface ParticleNode extends Node {
  type: "node/particle";
  // Particles might not need extra resize or text properties
}

// ==================== Component ====================

Coms["node/particle"] = ({ obj }) => {
  const node = obj as ParticleNode;
  useAtom(node.updater);

  return (
    <g
      className="node-group"
      data-id={node.id}
      transform={`translate(${node.pos.x}, ${node.pos.y})`}
      style={{ pointerEvents: "none" }}
    >
      <circle
        cx={node.size.x / 2}
        cy={node.size.y / 2}
        r={Math.min(node.size.x, node.size.y) / 2}
        fill="#6366f1"
        opacity="0.8"
      />
    </g>
  );
};

// ==================== Serialization ====================

registerSerializer(
  "node/particle",
  (obj: Obj) => {
    const node = obj as ParticleNode;
    return {
      id: node.id,
      type: node.type,
      pos: { ...node.pos },
      size: { ...node.size },
      selected: node.selected,
      z: node.z,
    };
  },
  (data: any) => ({
    id: data.id,
    type: data.type,
    updater: atom(0),
    pos: data.pos || { x: 0, y: 0 },
    size: data.size || { x: 10, y: 10 },
    aAncs: [], // Particles might not need complex anchors, or default ones
    eAncs: [],
    selected: data.selected || false,
    z: data.z,
  })
);

// ==================== Factory ====================

export const newParticleNode = (pos: Vec2 = { x: 0, y: 0 }): ParticleNode => {
  return {
    id: crypto.randomUUID(),
    type: "node/particle",
    updater: atom(0),
    pos,
    size: { x: 10, y: 10 }, // Small size
    selected: false,
    aAncs: [
      { type: "posDir", pos: { x: 0.5, y: 0.5 }, dir: { x: 0, y: 0 } } // Center anchor
    ],
    eAncs: [
      { type: "posDir", pos: { x: 0.5, y: 0.5 }, dir: { x: 0, y: 0 } }
    ],
  };
};

ObjectFactories["node/particle"] = () => newParticleNode();
