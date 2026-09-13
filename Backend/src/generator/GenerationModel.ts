// Modelo intermedio del generador (seccion 31: "Generation Model"). Es el
// puente entre el UML validado y los templates: aqui ya estan resueltos los
// nombres normalizados (seccion 18), el lado que posee cada FK, la herencia
// y las clases asociacion, para que los templates solo tengan que imprimir.

export interface GenAttribute {
  fieldName: string;
  // Nombre de columna tal cual en SQL (sin comillas). Los templates lo
  // escapan con `sqlIdentifier` si es palabra reservada (ej. "user").
  columnName: string;
  javaType: string;
  sqlType: string;
  javaImport?: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

// Referencia simple (muchos-a-uno o uno-a-uno): esta clase posee la FK.
export interface GenSingleRef {
  fieldName: string;
  columnName: string;
  referencedClassName: string;
  referencedPkJavaType: string;
  referencedPkJavaImport?: string;
  referencedPkFieldName: string;
  annotation: 'OneToOne' | 'ManyToOne';
  // false => la FK es NOT NULL y el RequestDTO la exige (@NotNull).
  optional: boolean;
  // true en 1:1: la FK lleva restriccion UNIQUE.
  unique: boolean;
}

// Coleccion muchos-a-muchos: esta clase es el lado "owning" del
// @ManyToMany (unidireccional, con @JoinTable).
export interface GenManyRef {
  fieldName: string;
  referencedClassName: string;
  referencedPkJavaType: string;
  referencedPkJavaImport?: string;
  referencedPkFieldName: string;
  joinTableName: string;
  joinColumnName: string;
  inverseJoinColumnName: string;
}

// Lado "todo" de una composicion: @OneToMany(mappedBy, cascade = ALL,
// orphanRemoval = true), asi borrar el todo borra sus partes.
export interface GenComposedCollection {
  fieldName: string;
  partClassName: string;
  mappedBy: string;
}

export interface GenClass {
  umlClassId: string;
  className: string;
  tableName: string;
  pluralSlug: string;
  // Herencia (JOINED): nombre de la clase padre directa, si la hay.
  parentClassName?: string;
  // true si alguna clase hereda de esta y esta no hereda de nadie.
  isInheritanceRoot: boolean;
  // Clave primaria. En una subclase es la de la raiz de la jerarquia
  // (heredada): la subclase no declara @Id propio.
  pkAttribute: GenAttribute;
  // Campos propios (sin la PK).
  attributes: GenAttribute[];
  singleRefs: GenSingleRef[];
  manyRefs: GenManyRef[];
  composedCollections: GenComposedCollection[];
  // Campos heredados de los ancestros, para aplanar los DTOs y el service.
  inheritedAttributes: GenAttribute[];
  inheritedSingleRefs: GenSingleRef[];
  inheritedManyRefs: GenManyRef[];
}

export interface GenerationModel {
  packageName: string;
  databaseName: string;
  classes: GenClass[];
}

export function allAttributes(klass: GenClass): GenAttribute[] {
  return [...klass.inheritedAttributes, ...klass.attributes];
}

export function allSingleRefs(klass: GenClass): GenSingleRef[] {
  return [...klass.inheritedSingleRefs, ...klass.singleRefs];
}

export function allManyRefs(klass: GenClass): GenManyRef[] {
  return [...klass.inheritedManyRefs, ...klass.manyRefs];
}
