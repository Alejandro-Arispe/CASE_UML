import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project, ProjectMember } from '../../types/auth';
import { IconArrowLeft, IconCheckCircle, IconCopy, IconServer } from '../../components/ui/icons';

const AVATAR_COLORS = ['bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-sky-600', 'bg-violet-600'];

function avatarColor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

interface EditorTopBarProps {
  project: Project | null;
  members: ProjectMember[];
  onlineUserIds: string[];
  onValidate: () => void;
  onGenerate: () => void;
}

export function EditorTopBar({ project, members, onlineUserIds, onValidate, onGenerate }: EditorTopBarProps) {
  const [membersOpen, setMembersOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const membersRef = useRef<HTMLDivElement>(null);

  // Integrantes en linea primero: son los que estan editando ahora.
  const sortedMembers = [...members].sort(
    (a, b) => Number(onlineUserIds.includes(b.userId)) - Number(onlineUserIds.includes(a.userId)),
  );
  const onlineCount = members.filter((m) => onlineUserIds.includes(m.userId)).length;

  useEffect(() => {
    if (!membersOpen) return;
    const close = (event: MouseEvent) => {
      if (!membersRef.current?.contains(event.target as Node)) setMembersOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [membersOpen]);

  async function copyInviteCode() {
    if (!project) return;
    await navigator.clipboard.writeText(project.inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3">
      <Link
        to="/projects"
        className="flex h-8 items-center gap-2 rounded-md pl-1 pr-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        title="Volver a mis proyectos"
      >
        <IconArrowLeft />
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-[9px] font-bold tracking-tight text-white">UML</span>
      </Link>

      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-sm font-semibold text-slate-900">{project ? project.name : 'Cargando proyecto...'}</h1>
        {project && (
          <button
            type="button"
            onClick={copyInviteCode}
            className="flex h-6 shrink-0 items-center gap-1 rounded border border-slate-200 px-1.5 font-mono text-[11px] text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
            title="Copiar codigo de invitacion"
          >
            {copied ? 'Copiado' : project.inviteCode}
            <IconCopy size={12} />
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative" ref={membersRef}>
          <button
            type="button"
            onClick={() => setMembersOpen((open) => !open)}
            className="flex h-8 items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-slate-100"
            aria-expanded={membersOpen}
            aria-label={`${onlineCount} de ${members.length} integrantes en linea`}
          >
            <span className="flex -space-x-1.5">
              {sortedMembers.slice(0, 4).map((m) => {
                const online = onlineUserIds.includes(m.userId);
                return (
                  <span
                    key={m.id}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white ${
                      online ? avatarColor(m.userId) : 'bg-slate-300'
                    }`}
                  >
                    {initials(m.userName)}
                  </span>
                );
              })}
            </span>
            <span className="text-xs text-slate-600">
              {onlineCount}/{members.length}
            </span>
          </button>

          {membersOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg">
              <p className="px-3 pb-1.5 text-xs font-medium text-slate-500">Integrantes del proyecto</p>
              {sortedMembers.map((m) => {
                const online = onlineUserIds.includes(m.userId);
                return (
                  <div key={m.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
                        online ? avatarColor(m.userId) : 'bg-slate-300'
                      }`}
                    >
                      {initials(m.userName)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-800">{m.userName}</span>
                    <span className={`text-[11px] ${online ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {online ? 'En linea' : m.role === 'OWNER' ? 'Propietario' : 'Desconectado'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          onClick={onValidate}
          className="flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          <IconCheckCircle />
          Validar
        </button>
        <button
          type="button"
          onClick={onGenerate}
          className="flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <IconServer />
          Generar backend
        </button>
      </div>
    </header>
  );
}
