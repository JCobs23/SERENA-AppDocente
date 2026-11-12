import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import type { SessionReport, SessionReportListItem } from '../lib/reports'
import SessionSummary from './SessionSummary'

export default function ReportHistory({ onClose }: { onClose: () => void }) {
  const [reports, setReports] = useState<SessionReportListItem[]>([])
  const [selected, setSelected] = useState<SessionReport | null>(null)
  const [loadingId, setLoadingId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest<SessionReportListItem[]>('/reports')
      .then((result) => { if (!cancelled) setReports(result) })
      .catch(() => { if (!cancelled) setError('No se pudieron cargar los reportes anteriores.') })
    return () => { cancelled = true }
  }, [])

  async function openReport(reportId: string) {
    setLoadingId(reportId)
    setError('')
    try { setSelected(await apiRequest<SessionReport>('/reports/' + reportId)) }
    catch { setError('No se pudo abrir este reporte. Comprueba tu conexión y vuelve a intentarlo.') }
    finally { setLoadingId('') }
  }

  if (selected) return <SessionSummary report={selected} finishLabel="Volver a reportes" onFinish={() => setSelected(null)} />

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-gray-950 sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4"><div><h1 className="text-3xl font-extrabold">Reportes anteriores</h1><p className="mt-1 text-sm text-gray-600">Consulta los resultados grupales guardados.</p></div><button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold hover:bg-gray-100">Volver al catálogo</button></header>
    {error && <p role="alert" className="mx-auto mt-4 max-w-5xl rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <section className="mx-auto mt-5 max-w-5xl overflow-hidden rounded-xl bg-white shadow-sm"><ul className="divide-y divide-gray-100">
      {reports.length === 0 && !error && <li className="p-6 text-sm text-gray-600">Todavía no hay reportes guardados.</li>}
      {reports.map((report) => <li key={report.reportId} className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h2 className="font-bold">Sesión {report.sessionCode}</h2><p className="mt-1 text-sm text-gray-600">{new Date(report.createdAt).toLocaleString()} · {report.participantCount} participantes · {report.status === 'completed' ? 'Completada' : 'Parcial'}</p></div>
        <button type="button" onClick={() => void openReport(report.reportId)} disabled={loadingId === report.reportId} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white hover:bg-blue-950 disabled:opacity-60">{loadingId === report.reportId ? 'Abriendo…' : 'Abrir reporte'}</button>
      </li>)}
    </ul></section>
  </main>
}
