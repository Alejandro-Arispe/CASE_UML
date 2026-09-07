import { Handle, Position } from '@xyflow/react';
import type { UmlClass } from '../../types/uml';

interface ClassNodeProps {
  data: { klass: UmlClass };
  selected?: boolean;
}

export function ClassNode({ data, selected }: ClassNodeProps) {
  const { klass } = data;

  return (
    <div
      style={{
        border: selected ? '2px solid #2563eb' : '1px solid #333',
        borderRadius: 4,
        minWidth: 180,
        background: '#fff',
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #333', padding: '4px 8px' }}>
        {klass.name}
      </div>

      <ul style={{ margin: 0, padding: '4px 8px', listStyle: 'none' }}>
        {klass.attributes.map((attr) => (
          <li key={attr.id}>
            {attr.isPrimaryKey ? 'PK ' : ''}
            {attr.name}: {attr.type}
            {attr.nullable ? '' : ' *'}
          </li>
        ))}
        {klass.attributes.length === 0 && <li style={{ color: '#888' }}>Sin atributos</li>}
      </ul>
    </div>
  );
}
