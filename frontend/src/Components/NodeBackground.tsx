import React from 'react';
import { Node } from '../Globals';
import { activedId } from '../Controllers/Selector';

interface NodeBackgroundProps {
  node: Node;
}

export const NodeBackground: React.FC<NodeBackgroundProps> = ({
  node
}) => {
  // 生成类名，方便在 CSS 中针对不同类型或状态进行定制
  const baseType = node.type.replace(/\//g, '-');
  const classNames = [
    'node-rect',
    `node-rect-${baseType}`,
    node.selected ? 'selected' : '',
    node.id === activedId ? 'activated' : ''
  ].filter(Boolean).join(' ');

  return (
    <rect
      className={classNames}
      width={node.size.x}
      height={node.size.y}
    />
  );
};
