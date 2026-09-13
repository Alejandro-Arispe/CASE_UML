import { useReactFlow, useViewport } from '@xyflow/react';
import { RELATIONSHIP_KIND_LABEL, RELATIONSHIP_KINDS } from '../../types/uml';
import type { RelationshipKind } from '../../types/uml';
import { ToolButton, ToolbarDivider } from '../../components/ui/IconButton';
import {
  IconClass,
  IconDownload,
  IconFit,
  IconHistory,
  IconLayout,
  IconPanelLeft,
  IconPanelRight,
  IconSparkles,
  IconUpload,
  IconZoomIn,
  IconZoomOut,
  RelationGlyph,
} from '../../components/ui/icons';

const KIND_HINT: Record<RelationshipKind, string> = {
  ASSOCIATION: 'Asociacion: arrastra desde el borde de una clase hasta otra',
  AGGREGATION: 'Agregacion: arrastra de la PARTE al TODO',
  COMPOSITION: 'Composicion: arrastra de la PARTE al TODO',
  GENERALIZATION: 'Herencia: arrastra de la SUBCLASE al PADRE',
};

interface EditorToolbarProps {
  connectKind: RelationshipKind;
  onConnectKindChange: (kind: RelationshipKind) => void;
  onAddClass: () => void;
  onOrganize: () => void;
  canOrganize: boolean;
  xmi: { exportXmi: () => void; openImport: () => void; importing: boolean; canExport: boolean };
  aiOpen: boolean;
  onToggleAi: () => void;
  onOpenHistory: () => void;
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  propertiesOpen: boolean;
  onToggleProperties: () => void;
}

// Barra de herramientas del editor, agrupada como en una herramienta CASE:
// elementos | relaciones (el tipo con que se crea la proxima conexion) |
// disposicion | vista | intercambio de archivos | asistentes | paneles.
export function EditorToolbar(props: EditorToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="relative z-20 flex h-11 shrink-0 items-center gap-0.5 border-b border-slate-200 bg-white px-2">
      <ToolButton
        label={props.explorerOpen ? 'Ocultar explorador' : 'Mostrar explorador'}
        icon={<IconPanelLeft />}
        tooltipAlign="start"
        active={props.explorerOpen}
        onClick={props.onToggleExplorer}
      />
      <ToolbarDivider />

      <ToolButton label="Agregar una clase al diagrama" icon={<IconClass />} text="Clase" onClick={props.onAddClass} />
      <ToolbarDivider />

      <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Tipo de relacion al conectar">
        {RELATIONSHIP_KINDS.map((kind) => (
          <ToolButton
            key={kind}
            role="radio"
            aria-checked={props.connectKind === kind}
            label={KIND_HINT[kind]}
            icon={<RelationGlyph kind={kind} />}
            text={RELATIONSHIP_KIND_LABEL[kind]}
            textFrom="lg"
            active={props.connectKind === kind}
            onClick={() => props.onConnectKindChange(kind)}
          />
        ))}
      </div>
      <ToolbarDivider />

      <ToolButton
        label="Organizar automaticamente el diagrama"
        icon={<IconLayout />}
        text="Organizar"
        textFrom="2xl"
        onClick={props.onOrganize}
        disabled={!props.canOrganize}
      />
      <ToolbarDivider />

      <ToolButton label="Alejar" shortcut="Ctrl -" icon={<IconZoomOut />} onClick={() => zoomOut({ duration: 150 })} />
      <button
        type="button"
        onClick={() => fitView({ duration: 250, padding: 0.15 })}
        className="h-8 w-12 shrink-0 rounded-md text-center text-xs tabular-nums text-slate-700 transition-colors hover:bg-slate-100"
        title="Ajustar a la pantalla"
      >
        {Math.round(zoom * 100)}%
      </button>
      <ToolButton label="Acercar" shortcut="Ctrl +" icon={<IconZoomIn />} onClick={() => zoomIn({ duration: 150 })} />
      <ToolButton label="Ajustar diagrama a la pantalla" icon={<IconFit />} onClick={() => fitView({ duration: 250, padding: 0.15 })} />

      <div className="ml-auto flex items-center gap-0.5 pl-2">
        <ToolButton
          label="Importar diagrama desde XMI (Enterprise Architect)"
          icon={<IconUpload />}
          text={props.xmi.importing ? 'Importando...' : 'Importar'}
          textFrom="2xl"
          onClick={props.xmi.openImport}
          disabled={props.xmi.importing}
        />
        <ToolButton
          label="Exportar diagrama como XMI 2.1 (Enterprise Architect)"
          icon={<IconDownload />}
          text="Exportar"
          textFrom="2xl"
          tooltipAlign="end"
          onClick={props.xmi.exportXmi}
          disabled={!props.xmi.canExport}
        />
        <ToolbarDivider />
        <ToolButton label="Historial de cambios" icon={<IconHistory />} text="Historial" textFrom="2xl" tooltipAlign="end" onClick={props.onOpenHistory} />
        <ToolButton
          label="Asistente IA: crear o modificar el diagrama con texto, voz o imagen"
          icon={<IconSparkles />}
          text="Asistente IA"
          textFrom="xl"
          tooltipAlign="end"
          active={props.aiOpen}
          onClick={props.onToggleAi}
        />
        <ToolbarDivider />
        <ToolButton
          label={props.propertiesOpen ? 'Ocultar propiedades' : 'Mostrar propiedades'}
          icon={<IconPanelRight />}
          tooltipAlign="end"
          active={props.propertiesOpen}
          onClick={props.onToggleProperties}
        />
      </div>
    </div>
  );
}
