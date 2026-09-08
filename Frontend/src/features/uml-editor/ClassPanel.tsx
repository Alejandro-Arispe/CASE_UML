import { UML_DATA_TYPES } from '../../types/uml';
import { useUmlStore } from '../../store/umlStore';
import * as collaboration from './collaboration';

export function ClassPanel({ classId }: { classId: string }) {
  const klass = useUmlStore((state) => state.classes.find((c) => c.id === classId));

  if (!klass) return null;

  return (
    <aside>
      <h3>Clase</h3>
      <label htmlFor="class-name">Nombre</label>
      <input
        id="class-name"
        type="text"
        value={klass.name}
        onChange={(e) => collaboration.renameClass(klass.id, e.target.value)}
      />

      <h4>Atributos</h4>
      <ul>
        {klass.attributes.map((attr) => (
          <li key={attr.id}>
            <input
              type="text"
              aria-label="nombre del atributo"
              value={attr.name}
              onChange={(e) => collaboration.updateAttribute(klass.id, attr.id, { name: e.target.value })}
            />
            <select
              aria-label="tipo del atributo"
              value={attr.type}
              onChange={(e) =>
                collaboration.updateAttribute(klass.id, attr.id, { type: e.target.value as typeof attr.type })
              }
            >
              {UML_DATA_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={attr.isPrimaryKey}
                onChange={(e) => collaboration.updateAttribute(klass.id, attr.id, { isPrimaryKey: e.target.checked })}
              />
              PK
            </label>
            <label>
              <input
                type="checkbox"
                checked={attr.nullable}
                onChange={(e) => collaboration.updateAttribute(klass.id, attr.id, { nullable: e.target.checked })}
              />
              Nullable
            </label>
            <button type="button" onClick={() => collaboration.removeAttribute(klass.id, attr.id)}>
              Eliminar
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => collaboration.addAttribute(klass.id)}>
        + Atributo
      </button>

      <hr />
      <button type="button" onClick={() => collaboration.deleteClass(klass.id)}>
        Eliminar clase
      </button>
    </aside>
  );
}
