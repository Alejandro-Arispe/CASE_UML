// Formato relativo simple para "ultima modificacion" (seccion 7: "hoy",
// "ayer"), sin traer una libreria de fechas solo para esto.
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const diffDays = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);

  if (diffDays === 0) return `hoy, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1) return 'ayer';
  if (diffDays > 1 && diffDays < 7) return `hace ${diffDays} dias`;
  return date.toLocaleDateString();
}
