// Modelo intermedio del generador (seccion 31: "Generation Model"). Es el
// puente entre el UML validado y los templates: aqui ya estan resueltos los
// nombres normalizados (seccion 18) y el lado que posee cada relacion
// (seccion 12), para que los templates solo tengan que imprimir texto.

export interface GenAttribute {
  fieldName: string;
  columnName: string;
  javaType: string;
  sqlType: string;
  javaImport?: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

export type RefAnnotation = 'OneToOne' | 'ManyToOne';

// Un campo de referencia simple (uno-a-uno o muchos-a-uno): esta clase
// "posee" la FK y el campo Java correspondiente.
export interface GenSingleRef {
  fieldName: string;
  columnName: string;
  referencedClassName: string;
  referencedPkJavaType: string;
  annotation: RefAnnotation;
}

// Un campo de coleccion muchos-a-muchos: esta clase es el lado "owning"
// del @ManyToMany (unidireccional, sin mappedBy en el otro lado, seccion 12).
export interface GenManyRef {
  fieldName: string;
  referencedClassName: string;
  referencedPkJavaType: string;
  joinTableName: string;
  joinColumnName: string;
  inverseJoinColumnName: string;
}

export interface GenClass {
  umlClassId: string;
  className: string;
  tableName: string;
  pluralSlug: string;
  pkAttribute: GenAttribute;
  attributes: GenAttribute[];
  singleRefs: GenSingleRef[];
  manyRefs: GenManyRef[];
}

export interface GenerationModel {
  packageName: string;
  databaseName: string;
  classes: GenClass[];
}
