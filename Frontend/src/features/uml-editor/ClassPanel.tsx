import { UML_DATA_TYPES } from '../../types/uml';
import { useUmlStore } from '../../store/umlStore';

export function ClassPanel({ classId }: { classId: string }) {
  const klass = useUmlStore((state) => state.classes.find((c) => c.id === classId));
  const renameClass = useUmlStore((state) => state.renameClass);
  const removeClass = useUmlStore((state) => state.removeClass);
  const addAttribute = useUmlStore((state) => state.addAttribute);
  const updateAttribute = useUmlStore((state) => state.updateAttribute);
  const removeAttribute = useUmlStore((state) => state.removeAttribute);

  if (!klass) return null;

  return (
    <aside>
      <h3>Clase</h3>
      <label htmlFor="class-name">Nombre</label>
      <input
        id="class-name"
        type="text"
        value={klass.name}
        onChange={(e) => renameClass(klass.id, e.target.value)}
      />

      <h4>Atributos</h4>
      <ul>
        {klass.attributes.map((attr) => (
          <li key={attr.id}>
            <input
              type="text"
              aria-label="nombre del atributo"
              value={attr.name}
              onChange={(e) => updateAttribute(klass.id, attr.id, { name: e.target.value })}
            />
            <select
              aria-label="tipo del atributo"
              value={attr.type}
              onChange={(e) => updateAttribute(klass.id, attr.id, { type: e.target.value as typeof attr.type })}
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
                onChange={(e) => updateAttribute(klass.id, attr.id, { isPrimaryKey: e.target.checked })}
              />
              PK
            </label>
            <label>
              <input
                type="checkbox"
                checked={attr.nullable}
                onChange={(e) => updateAttribute(klass.id, attr.id, { nullable: e.target.checked })}
              />
              Nullable
            </label>
            <button type="button" onClick={() => removeAttribute(klass.id, attr.id)}>
              Eliminar
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => addAttribute(klass.id)}>
        + Atributo
      </button>

      <hr />
      <button type="button" onClick={() => removeClass(klass.id)}>
        Eliminar clase
      </button>
    </aside>
  );
}
