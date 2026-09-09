import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { createProject, joinProjectByInviteCode, listMyProjects } from '../services/projectApi';
import type { Project } from '../types/auth';
import { useAuthStore } from '../store/authStore';
import { formatRelativeDate } from '../utils/formatDate';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ProjectsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newProjectName, setNewProjectName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setProjects(await listMyProjects());
      setError(null);
    } catch {
      setError('No se pudieron cargar los proyectos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      await createProject(newProjectName.trim());
      setNewProjectName('');
      await refresh();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setError(message ?? 'No se pudo crear el proyecto');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      await joinProjectByInviteCode(inviteCode.trim());
      setInviteCode('');
      await refresh();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setError(message ?? 'No se pudo unir al proyecto');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              UML
            </div>
            <span className="font-semibold text-slate-900">CASE_UML</span>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="text-sm text-slate-500">{user.name}</span>}
            <Button variant="ghost" size="sm" onClick={logout}>
              Cerrar sesion
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Mis proyectos</h1>
            <p className="mt-1 text-sm text-slate-500">Elegi un proyecto o crea uno nuevo para empezar a modelar.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <form onSubmit={handleJoin} className="flex gap-2">
              <Input
                type="text"
                placeholder="Codigo (ej. SIS-482)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-40"
              />
              <Button type="submit" disabled={joining}>
                Unirme
              </Button>
            </form>
            <form onSubmit={handleCreate} className="flex gap-2">
              <Input
                type="text"
                placeholder="Nombre del proyecto"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-48"
              />
              <Button type="submit" variant="primary" disabled={creating}>
                + Nuevo proyecto
              </Button>
            </form>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-slate-400">Cargando...</p>
        ) : projects.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">Todavia no tenes proyectos.</p>
            <p className="mt-1 text-sm text-slate-500">Crea uno nuevo o pedile un codigo de invitacion a un companero.</p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}/editor`)}
                  className="group flex w-full flex-col rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  <span className="font-medium text-slate-900 group-hover:text-indigo-700">{project.name}</span>
                  <span className="mt-3 text-xs text-slate-400">
                    Ultima modificacion: {formatRelativeDate(project.updatedAt)}
                  </span>
                  <span className="mt-2 inline-flex w-fit items-center rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                    {project.inviteCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
