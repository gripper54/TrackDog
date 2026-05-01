import { useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import logo from './assets/trackdog-logo.jpg'
import { isSupabaseConfigured, supabase } from './supabase'
import './App.css'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'
const fallbackWorkers = ['Mark Griffin', 'Mike Griffin']
const dropboxFolder = import.meta.env.VITE_TRACKDOG_RECORDS_FOLDER || 'Trackdog Records'
const hourlyRate = 30
const defaultCustomer = 'White Oaks / Prime Properties'
const isHostedFrontend = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
const isUsingRelativeApiBase = !import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL === '/api'
const needsHostedApiConfig = isHostedFrontend && isUsingRelativeApiBase

const servicePresets = {
  hourly: { serviceName: 'Hourly Labor', entryType: 'hourly', rate: 30, amount: 0 },
  grass: { serviceName: 'Grass Cutting', entryType: 'flat', rate: 150, amount: 150 },
}

const today = new Date().toISOString().slice(0, 10)

const emptyForm = {
  id: null,
  date: today,
  worker: 'Mike Griffin',
  customer: defaultCustomer,
  property: '',
  serviceName: 'Hourly Labor',
  entryType: 'hourly',
  hours: '0',
  rate: '30',
  amount: '0',
  workOrder: '',
  jobDescription: '',
  summary: '',
}

const emptyMassEntryForm = {
  startDate: today,
  totalHours: '0',
  sequenceHours: '8',
  worker: 'Mike Griffin',
  customer: defaultCustomer,
  property: '',
  serviceName: 'Hourly Labor',
  entryType: 'hourly',
  rate: '30',
  workOrder: '',
  jobDescription: '',
  summary: '',
}

const emptyMixedMassEntryForm = {
  text: '',
  sequenceHours: '8',
  customer: defaultCustomer,
}

const formatMonthLabel = (dateString) =>
  new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

const formatDayLabel = (dateString) =>
  new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

const buildMonthDays = (monthValue) => {
  const [year, month] = monthValue.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return `${monthValue}-${day}`
  })
}

const shiftMonth = (monthValue, delta) => {
  const [year, month] = monthValue.split('-').map(Number)
  const nextDate = new Date(year, month - 1 + delta, 1)
  const nextYear = nextDate.getFullYear()
  const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0')
  return `${nextYear}-${nextMonth}`
}

function App() {
  const [activeTab, setActiveTab] = useState('quick-add')
  const [mobileMoreView, setMobileMoreView] = useState('dashboard')
  const [mobileAddExpanded, setMobileAddExpanded] = useState(false)
  const [workers, setWorkers] = useState(fallbackWorkers)
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [plainTextEntry, setPlainTextEntry] = useState('')
  const [massEntryForm, setMassEntryForm] = useState(emptyMassEntryForm)
  const [massEntryPreview, setMassEntryPreview] = useState([])
  const [mixedMassEntryForm, setMixedMassEntryForm] = useState(emptyMixedMassEntryForm)
  const [mixedMassEntryPreview, setMixedMassEntryPreview] = useState([])
  const [mixedMassEntryWarnings, setMixedMassEntryWarnings] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [filters, setFilters] = useState({ worker: 'All workers', workOrder: '', text: '' })
  const [mobileWorkOrderSearch, setMobileWorkOrderSearch] = useState('')
  const [monthlyMeta, setMonthlyMeta] = useState({
    invoiceName: '',
    invoiceNumber: '',
    billingDate: '',
    finalizedAt: '',
    pdfPath: '',
    status: 'open',
  })
  const [status, setStatus] = useState('Loading Trackdog data...')
  const [authLoading, setAuthLoading] = useState(() => isSupabaseConfigured)
  const [session, setSession] = useState(null)
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const apiConfigError = needsHostedApiConfig
    ? 'Trackdog frontend is deployed, but no hosted API base URL is configured yet. Set VITE_API_BASE_URL in Vercel to your deployed backend URL.'
    : ''

  const getAuthHeaders = useCallback(async () => {
    if (!isSupabaseConfigured || !session?.access_token) {
      return {}
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    }
  }, [session])

  const apiFetch = useCallback(async (url, options = {}) => {
    const headers = await getAuthHeaders()
    const mergedHeaders = {
      ...headers,
      ...(options.headers || {}),
    }

    const response = await fetch(url, {
      ...options,
      headers: mergedHeaders,
    })

    if (response.status === 401) {
      setStatus('Your session expired. Please sign in again.')
      setAuthError('Your session expired. Please sign in again.')
      if (isSupabaseConfigured) {
        await supabase.auth.signOut()
      }
    }

    return response
  }, [getAuthHeaders])

  const loadEntries = useCallback(async (month = selectedMonth) => {
    const response = await apiFetch(`${apiBase}/entries?month=${month}`)
    const data = await response.json()
    setEntries(data)
  }, [apiFetch, selectedMonth])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error) {
        setAuthError(error.message)
      }
      setSession(data.session ?? null)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (needsHostedApiConfig || (isSupabaseConfigured && !session)) {
      return
    }

    const loadInitialData = async () => {
      try {
        const [metaResponse, entriesResponse, monthlyReportResponse] = await Promise.all([
          apiFetch(`${apiBase}/meta`),
          apiFetch(`${apiBase}/entries?month=${selectedMonth}`),
          apiFetch(`${apiBase}/monthly-report/${selectedMonth}`),
        ])
        const meta = await metaResponse.json()
        const entryData = await entriesResponse.json()
        const monthlyReport = await monthlyReportResponse.json()
        setWorkers(meta.workers || fallbackWorkers)
        setEntries(entryData)
        setMonthlyMeta({
          invoiceName: monthlyReport.invoice_name || '',
          invoiceNumber: monthlyReport.invoice_number || '',
          billingDate: monthlyReport.billing_date || '',
          finalizedAt: monthlyReport.finalized_at || '',
          pdfPath: monthlyReport.pdf_path || '',
          status: monthlyReport.status || 'open',
        })
        setStatus(`Trackdog database connected. Records folder configured as ${meta.recordsFolder || dropboxFolder}.`)
      } catch {
        setStatus(
          isHostedFrontend
            ? 'Could not reach the hosted Trackdog API. Check VITE_API_BASE_URL and make sure the backend is deployed.'
            : 'Could not reach the Trackdog API. Check your API base URL and backend server.',
        )
      }
    }

    loadInitialData()
  }, [apiFetch, selectedMonth, session])

  const monthEntries = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries])

  const filteredEntries = useMemo(() => {
    return monthEntries.filter((entry) => {
      const workerMatch = filters.worker === 'All workers' || entry.worker === filters.worker
      const workOrderMatch =
        !filters.workOrder || (entry.workOrder || '').toLowerCase().includes(filters.workOrder.toLowerCase())
      const textNeedle = filters.text.trim().toLowerCase()
      const textMatch =
        !textNeedle ||
        [entry.jobDescription, entry.summary, entry.workOrder, entry.worker]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(textNeedle))

      return workerMatch && workOrderMatch && textMatch
    })
  }, [monthEntries, filters])

  const monthlyTotals = useMemo(
    () =>
      workers
        .map((worker) => {
          const workerEntries = filteredEntries.filter((entry) => entry.worker === worker)
          const hours = workerEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
          const revenue = workerEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
          return { worker, hours, revenue }
        }),
    [filteredEntries, workers],
  )

  const overallTotal = monthlyTotals.reduce((sum, entry) => sum + entry.hours, 0)
  const overallRevenue = monthlyTotals.reduce((sum, entry) => sum + entry.revenue, 0)
  const rollingHoursTotal = monthEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
  const rollingRevenueTotal = monthEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const defaultBillingDate = `${selectedMonth}-01`
  const monthDays = buildMonthDays(selectedMonth)
  const recentEntries = [...monthEntries].slice(-5).reverse()
  const todayDate = new Date().toISOString().slice(0, 10)
  const todayEntries = filteredEntries.filter((entry) => entry.date === todayDate)
  const thisWeekEntries = filteredEntries.slice(-12).reverse()
  const goToPreviousMonth = () => setSelectedMonth((current) => shiftMonth(current, -1))
  const goToNextMonth = () => setSelectedMonth((current) => shiftMonth(current, 1))
  const workOrderGroups = Object.values(
    filteredEntries.reduce((acc, entry) => {
      const key = entry.workOrder || 'No Work Order'
      if (!acc[key]) {
        acc[key] = { key, hours: 0, revenue: 0, entries: 0, jobs: new Set(), latestEntry: entry }
      }
      acc[key].hours += Number(entry.hours || 0)
      acc[key].revenue += Number(entry.amount || 0)
      acc[key].entries += 1
      if (entry.jobDescription) acc[key].jobs.add(entry.jobDescription)
      if (!acc[key].latestEntry || entry.date > acc[key].latestEntry.date) {
        acc[key].latestEntry = entry
      }
      return acc
    }, {}),
  ).map((group) => ({ ...group, jobs: Array.from(group.jobs) }))

  const mobileFilteredWorkOrders = workOrderGroups.filter((group) => {
    const needle = mobileWorkOrderSearch.trim().toLowerCase()
    if (!needle) return true
    return [group.key, ...group.jobs].filter(Boolean).some((value) => value.toLowerCase().includes(needle))
  })

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const resetForm = () => setForm({ ...emptyForm, worker: workers[1] || workers[0] || 'Mike Griffin' })

  const toggleMobileAddExpanded = () => setMobileAddExpanded((current) => !current)

  const handleSave = async (event) => {
    event.preventDefault()

    try {
      const parsedHours = Number(form.hours)
      if (!form.date || !form.worker || !parsedHours || parsedHours <= 0) {
        setStatus('Date, worker, and hours are required.')
        return
      }

      const numericRate = Number(form.rate || (form.entryType === 'flat' ? 150 : hourlyRate))
      const numericAmount =
        form.entryType === 'flat'
          ? Number(form.amount || numericRate)
          : parsedHours * numericRate

      const payload = {
        date: form.date,
        worker: form.worker,
        customer: form.customer || defaultCustomer,
        property: form.property,
        serviceName: form.serviceName,
        entryType: form.entryType,
        hours: form.entryType === 'flat' ? 0 : parsedHours,
        rate: numericRate,
        amount: numericAmount,
        workOrder: form.workOrder,
        jobDescription: form.jobDescription,
        summary: form.summary,
      }

      const method = form.id ? 'PUT' : 'POST'
      const url = form.id ? `${apiBase}/entries/${form.id}` : `${apiBase}/entries`

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        setStatus(result.error || 'Could not save entry.')
        return
      }

      await loadEntries(form.date.slice(0, 7))
      setSelectedMonth(form.date.slice(0, 7))
      setStatus(form.id ? 'Entry updated in Trackdog database.' : 'Entry saved to Trackdog database.')
      resetForm()
    } catch (error) {
      setStatus(error?.message || 'Could not save entry.')
    }
  }

  const handleEdit = (entry) => {
    setActiveTab('quick-add')
    setMobileMoreView('dashboard')
    setForm({
      id: entry.id,
      date: entry.date,
      worker: entry.worker,
      customer: entry.customer || defaultCustomer,
      property: entry.property || '',
      serviceName: entry.serviceName || '',
      entryType: entry.entryType || 'hourly',
      hours: String(entry.hours),
      rate: String(entry.rate ?? hourlyRate),
      amount: String(entry.amount ?? 0),
      workOrder: entry.workOrder,
      jobDescription: entry.jobDescription,
      summary: entry.summary,
    })
    setStatus(`Editing ${entry.worker} on ${formatDayLabel(entry.date)}.`)
  }

  const handleDelete = async (id) => {
    const response = await apiFetch(`${apiBase}/entries/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setStatus('Could not delete entry.')
      return
    }
    await loadEntries(selectedMonth)
    if (form.id === id) resetForm()
    setStatus('Entry deleted from Trackdog database.')
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const handleMonthlyMetaChange = (event) => {
    const { name, value } = event.target
    setMonthlyMeta((current) => ({ ...current, [name]: value }))
  }

  const handleMassEntryChange = (event) => {
    const { name, value } = event.target
    setMassEntryForm((current) => ({ ...current, [name]: value }))
  }

  const handleMixedMassEntryChange = (event) => {
    const { name, value } = event.target
    setMixedMassEntryForm((current) => ({ ...current, [name]: value }))
  }

  const applyPreset = (presetKey) => {
    const preset = servicePresets[presetKey]
    if (!preset) return
    setForm((current) => ({
      ...current,
      serviceName: preset.serviceName,
      entryType: preset.entryType,
      rate: String(preset.rate),
      amount: String(preset.amount),
      hours: preset.entryType === 'flat' ? '0' : current.hours,
      jobDescription: current.jobDescription || preset.serviceName,
    }))
    setStatus(`${preset.serviceName} preset applied.`)
  }

  const handleParse = async () => {
    if (!plainTextEntry.trim()) {
      setStatus('Type a plain-language entry first.')
      return
    }

    const response = await apiFetch(`${apiBase}/parse-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: plainTextEntry }),
    })

    const result = await response.json()
    if (!response.ok) {
      setStatus(result.error)
      return
    }

    setForm((current) => ({
      ...current,
      date: result.date || current.date,
      worker: result.worker,
      customer: result.customer || defaultCustomer,
      property: result.property || '',
      serviceName: result.serviceName || '',
      entryType: result.entryType || 'hourly',
      hours: String(result.hours),
      rate: String(result.rate ?? hourlyRate),
      amount: String(result.amount ?? 0),
      workOrder: result.workOrder || '',
      jobDescription: result.jobDescription,
      summary: result.summary || '',
    }))
    setActiveTab('quick-add')
    setStatus(`Parsed into form: ${result.worker}, ${result.hours} hour(s)${result.workOrder ? `, ${result.workOrder}` : ''}.`)
  }

  const triggerDownload = (filename, content, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const buildPdfDoc = () => {
    const doc = new jsPDF()
    const monthLabel = formatMonthLabel(`${selectedMonth}-01`)
    let y = 20

    doc.setFontSize(18)
    doc.text('Trackdog Monthly Report', 14, y)
    y += 8
    doc.setFontSize(12)
    doc.text(`Northern Property Services`, 14, y)
    y += 6
    doc.text(monthLabel, 14, y)
    y += 10

    doc.setFontSize(11)
    doc.text('Worker Totals', 14, y)
    y += 7
    monthlyTotals.forEach((item) => {
      doc.text(`${item.worker}: ${item.hours.toFixed(2)} hrs`, 18, y)
      y += 6
    })
    doc.text(`Overall Total: ${overallTotal.toFixed(2)} hrs`, 18, y)
    y += 10

    doc.text('Entry Details', 14, y)
    y += 7

    filteredEntries.forEach((entry) => {
      const entryHours = entry.entryType === 'flat' ? '0.00 hrs' : `${Number(entry.hours || 0).toFixed(2)} hrs`
      const lines = doc.splitTextToSize(
        `${entry.date} | ${entry.worker} | ${entry.workOrder || 'No WO'} | ${entryHours} | ${entry.jobDescription || ''} | ${entry.summary || ''}`,
        180,
      )
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      doc.text(lines, 14, y)
      y += lines.length * 6 + 2
    })

    y += 4
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.setFontSize(12)
    doc.text(`Total Hours: ${overallTotal.toFixed(2)}`, 14, y)

    return doc
  }

  const handleExportCsv = () => {
    const summaryLines = monthlyTotals.map((item) => `${item.worker},${item.hours.toFixed(2)},${item.revenue.toFixed(2)}`)
    const entryLines = filteredEntries.map((entry) =>
      [
        entry.date,
        entry.worker,
        entry.entryType,
        entry.hours,
        entry.rate,
        Number(entry.amount || 0).toFixed(2),
        entry.workOrder || '',
        `"${(entry.jobDescription || '').replaceAll('"', '""')}"`,
        `"${(entry.summary || '').replaceAll('"', '""')}"`,
      ].join(','),
    )

    const csv = [
      `Trackdog Monthly Report,${formatMonthLabel(`${selectedMonth}-01`)}`,
      '',
      'Worker,Hours,Revenue',
      ...summaryLines,
      `Overall Total,${overallTotal.toFixed(2)},${overallRevenue.toFixed(2)}`,
      '',
      'Date,Worker,Entry Type,Hours,Rate,Revenue,Work Order,Job Description,Summary',
      ...entryLines,
    ].join('\n')

    triggerDownload(`trackdog-${selectedMonth}.csv`, csv, 'text/csv;charset=utf-8')
    setStatus('CSV exported.')
  }

  const handleExportPdf = () => {
    const doc = buildPdfDoc()
    doc.save(`trackdog-${selectedMonth}.pdf`)
    setStatus('PDF exported from Trackdog.')
  }

  const saveMonthlyMeta = async (overrides = {}) => {
    const payload = {
      invoiceName: monthlyMeta.invoiceName,
      invoiceNumber: monthlyMeta.invoiceNumber,
      billingDate: monthlyMeta.billingDate || defaultBillingDate,
      finalizedAt: monthlyMeta.finalizedAt,
      pdfPath: monthlyMeta.pdfPath,
      status: monthlyMeta.status || 'open',
      ...overrides,
    }

    const response = await apiFetch(`${apiBase}/monthly-report/${selectedMonth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json()
    setMonthlyMeta({
      invoiceName: result.invoice_name || '',
      invoiceNumber: result.invoice_number || '',
      billingDate: result.billing_date || '',
      finalizedAt: result.finalized_at || '',
      pdfPath: result.pdf_path || '',
      status: result.status || 'open',
    })
    return result
  }

  const handleSavePdfToDropbox = async (finalize = false) => {
    const doc = buildPdfDoc()
    const dataUri = doc.output('datauristring')

    const response = await apiFetch(`${apiBase}/save-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: `Trackdog-${selectedMonth}.pdf`,
        dataUri,
        folder: dropboxFolder,
      }),
    })

    if (!response.ok) {
      setStatus('PDF export worked, but Dropbox save failed.')
      return
    }

    const result = await response.json()
    const finalizedAt = finalize ? new Date().toISOString() : monthlyMeta.finalizedAt
    await saveMonthlyMeta({
      billingDate: monthlyMeta.billingDate || defaultBillingDate,
      finalizedAt,
      pdfPath: result.path,
      status: finalize ? 'finalized' : result.path ? 'archived' : monthlyMeta.status,
    })
    setStatus(
      finalize
        ? `Month finalized and PDF saved to Dropbox: ${result.path}`
        : `Monthly PDF saved to Dropbox: ${result.path}`,
    )
  }

  const handleFinalizeMonth = async () => {
    await handleSavePdfToDropbox(true)
  }

  const applyQuickAdd = (hours) => {
    setForm((current) => ({ ...current, hours: String(hours) }))
  }

  const resetMassEntryForm = () => {
    setMassEntryForm({ ...emptyMassEntryForm, worker: workers[1] || workers[0] || 'Mike Griffin' })
    setMassEntryPreview([])
  }

  const resetMixedMassEntryForm = () => {
    setMixedMassEntryForm({ ...emptyMixedMassEntryForm })
    setMixedMassEntryPreview([])
    setMixedMassEntryWarnings([])
  }

  const handleMassEntryPreview = async () => {
    const response = await apiFetch(`${apiBase}/mass-entry/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(massEntryForm),
    })

    const result = await response.json()
    if (!response.ok) {
      setStatus(result.error || 'Could not preview mass entry allocation.')
      setMassEntryPreview([])
      return
    }

    setMassEntryPreview(result.entries || [])
    setStatus(`Mass entry preview ready: ${result.entries.length} split entr${result.entries.length === 1 ? 'y' : 'ies'}.`)
  }

  const handleMassEntrySave = async () => {
    const response = await apiFetch(`${apiBase}/mass-entry/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(massEntryForm),
    })

    const result = await response.json()
    if (!response.ok) {
      setStatus(result.error || 'Could not save mass entry allocation.')
      return
    }

    const nextMonth = (result.entries?.[0]?.date || massEntryForm.startDate).slice(0, 7)
    setSelectedMonth(nextMonth)
    await loadEntries(nextMonth)
    setMassEntryPreview(result.entries || [])
    setStatus(`Mass entry saved. ${result.count} entries were created.`)
  }

  const handleMixedMassEntryPreview = async () => {
    const response = await apiFetch(`${apiBase}/mass-entry/mixed/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mixedMassEntryForm),
    })

    const result = await response.json()
    if (!response.ok) {
      setStatus(result.error || 'Could not preview mixed-line mass entry.')
      setMixedMassEntryPreview([])
      setMixedMassEntryWarnings(result.warnings || [])
      return
    }

    setMixedMassEntryPreview(result.entries || [])
    setMixedMassEntryWarnings(result.warnings || [])
    setStatus(`Mixed-line preview ready: ${result.linesParsed} lines expanded into ${result.entries.length} entries.`)
  }

  const handleMixedMassEntrySave = async () => {
    const response = await apiFetch(`${apiBase}/mass-entry/mixed/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mixedMassEntryForm),
    })

    const result = await response.json()
    if (!response.ok) {
      setMixedMassEntryWarnings(result.warnings || [])
      setMixedMassEntryPreview(result.entries || [])
      setStatus(result.error || 'Could not save mixed-line mass entry.')
      return
    }

    const nextMonth = (result.entries?.[0]?.date || today).slice(0, 7)
    setSelectedMonth(nextMonth)
    await loadEntries(nextMonth)
    setMixedMassEntryPreview(result.entries || [])
    setMixedMassEntryWarnings(result.warnings || [])
    setStatus(`Mixed-line mass entry saved. ${result.linesParsed} lines created ${result.count} entries.`)
  }

  const handleAuthInputChange = (event) => {
    const { name, value } = event.target
    setAuthForm((current) => ({ ...current, [name]: value }))
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    if (!supabase) return

    setAuthError('')
    setAuthLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    })

    if (error) {
      setAuthError(error.message)
      setAuthLoading(false)
      return
    }

    setStatus('Signed in to Trackdog.')
  }

  const handleLogout = async () => {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
      return
    }

    setStatus('Signed out of Trackdog.')
  }

  const handleParseAndSave = async () => {
    if (!plainTextEntry.trim()) {
      setStatus('Type a plain-language entry first.')
      return
    }

    const parseResponse = await apiFetch(`${apiBase}/parse-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: plainTextEntry }),
    })

    const parsed = await parseResponse.json()
    if (!parseResponse.ok) {
      setStatus(parsed.error)
      return
    }

    const payload = {
      date: parsed.date || form.date,
      worker: parsed.worker,
      customer: parsed.customer || defaultCustomer,
      property: parsed.property || '',
      serviceName: parsed.serviceName || '',
      entryType: parsed.entryType || 'hourly',
      hours: parsed.entryType === 'flat' ? 0 : parsed.hours,
      rate: parsed.rate ?? hourlyRate,
      amount: parsed.amount ?? parsed.hours * hourlyRate,
      workOrder: parsed.workOrder || '',
      jobDescription: parsed.jobDescription || '',
      summary: parsed.summary || '',
    }

    const saveResponse = await apiFetch(`${apiBase}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!saveResponse.ok) {
      const result = await saveResponse.json().catch(() => ({}))
      setStatus(result.error || 'Parsed entry worked, but save failed.')
      return
    }

    const nextMonth = payload.date.slice(0, 7)
    setSelectedMonth(nextMonth)
    await loadEntries(nextMonth)
    setPlainTextEntry('')
    setStatus('Plain-language entry parsed and saved.')
  }

  const renderDashboard = () => (
    <section className="panel wide-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Dashboard</p>
          <h2>{formatMonthLabel(`${selectedMonth}-01`)}</h2>
        </div>
        <div className="month-nav">
          <button type="button" className="secondary month-nav-button" onClick={goToPreviousMonth}>
            ← Prev month
          </button>
          <button type="button" className="secondary month-nav-button" onClick={goToNextMonth}>
            Next month →
          </button>
          <span className="status-pill success">Overview</span>
        </div>
      </div>
      <div className="totals-grid dashboard-totals-grid">
        {monthlyTotals.map((item) => (
          <article key={item.worker} className="total-card">
            <span>{item.worker}</span>
            <strong>{item.hours.toFixed(1)} hrs</strong>
            <small>${item.revenue.toFixed(2)}</small>
          </article>
        ))}
        <article className="total-card total-card-accent">
          <span>Overall total</span>
          <strong>{overallTotal.toFixed(1)} hrs</strong>
          <small>${overallRevenue.toFixed(2)}</small>
        </article>
      </div>

      <div className="dashboard-highlight-grid">
        <article className="panel inset-panel highlight-panel">
          <p className="section-kicker">Month snapshot</p>
          <h3>{filteredEntries.length} logged entries</h3>
          <p>
            {workOrderGroups.length} active work order groups, with {recentEntries.length} recent records ready for review.
          </p>
        </article>
        <article className="panel inset-panel highlight-panel">
          <p className="section-kicker">Billing posture</p>
          <h3>{monthlyMeta.status || 'open'}</h3>
          <p>
            PDF saved: {monthlyMeta.pdfPath ? 'Yes' : 'No'} • Billing date: {monthlyMeta.billingDate || defaultBillingDate}
          </p>
        </article>
      </div>
      <div className="dashboard-grid">
        <div className="panel inset-panel">
          <h3>Recent entries</h3>
          <div className="entry-list compact-list">
            {recentEntries.map((entry) => (
              <article key={entry.id} className="entry-item">
                <div className="entry-topline">
                  <strong>{formatDayLabel(entry.date)}</strong>
                  <span>{entry.worker}</span>
                  <span>{entry.customer || 'No customer'}</span>
                  <span>{entry.entryType === 'flat' ? 'Flat Rate' : `${entry.hours} hrs`}</span>
                  <span>${Number(entry.amount || 0).toFixed(2)}</span>
                </div>
                <p>{entry.serviceName || entry.jobDescription || 'No job description'}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="panel inset-panel">
          <h3>Work orders this month</h3>
          <div className="entry-list compact-list">
            {workOrderGroups.map((group) => (
              <article key={group.key} className="entry-item">
                <div className="entry-topline">
                  <strong>{group.key}</strong>
                  <span>{group.entries} entries</span>
                  <span>{group.hours.toFixed(1)} hrs</span>
                  <span>${group.revenue.toFixed(2)}</span>
                </div>
                <p>{group.jobs.join(', ') || 'General work'}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )

  const renderQuickAdd = () => (
    <section className="panel form-panel wide-panel quick-add-shell">
      <div className="panel-heading quick-add-heading">
        <div>
          <p className="section-kicker">Quick entry</p>
          <h2>{form.id ? 'Edit work entry' : 'Add work entry'}</h2>
          <p className="mobile-add-copy">Fast field logging first. Extra details stay tucked away until you need them.</p>
        </div>
        <span className="status-pill">Database enabled</span>
      </div>

      <div className="mobile-add-summary no-print">
        <article>
          <span>Worker</span>
          <strong>{form.worker}</strong>
        </article>
        <article>
          <span>Hours</span>
          <strong>{form.entryType === 'flat' ? 'Flat' : `${form.hours || 0}h`}</strong>
        </article>
        <article>
          <span>WO</span>
          <strong>{form.workOrder || 'Pending'}</strong>
        </article>
      </div>

      <div className="quick-add-layout">
        <aside className="quick-add-sidebar desktop-sidebar-only">
          <div className="info-card">
            <p className="section-kicker">Smart entry</p>
            <h3>Write it how you’d say it.</h3>
            <p>Trackdog can parse plain-language entries and prefill the form, so you spend less time on repetitive typing.</p>
          </div>

          <div className="plain-input-block">
            <strong>Tip: Trackdog currently defaults every entry to White Oaks / Prime Properties.</strong>
            <label>
              Plain-language entry
              <textarea
                rows="4"
                value={plainTextEntry}
                onChange={(event) => setPlainTextEntry(event.target.value)}
                placeholder="2026-04-14 Mike Griffin 5 hours WO-2201 property clean up - cleaned brush and hauled debris"
              />
            </label>
            <div className="plain-actions">
              <button type="button" className="secondary" onClick={handleParse}>
                Parse into form
              </button>
              <button type="button" onClick={handleParseAndSave}>
                Parse and save
              </button>
            </div>
            <small>
              Example: 2026-04-14 Mike Griffin 5 hours WO-2201 property clean up - cleaned brush and hauled debris
            </small>
          </div>

          <div className="preset-row">
            <span>Service presets</span>
            <div className="quick-add-buttons">
              <button type="button" className="secondary quick-chip" onClick={() => applyPreset('hourly')}>
                Hourly Labor
              </button>
              <button type="button" className="secondary quick-chip" onClick={() => applyPreset('grass')}>
                Grass Cutting $150
              </button>
              <button
                type="button"
                className="secondary quick-chip"
                onClick={() => setForm((current) => ({ ...current, customer: defaultCustomer }))}
              >
                Set Customer: White Oaks / Prime Properties
              </button>
            </div>
          </div>
        </aside>

        <form className="entry-form entry-form-premium mobile-first-form" onSubmit={handleSave}>
          <div className="mobile-core-fields">
            <label>
              Date
              <input type="date" name="date" value={form.date} onChange={handleChange} />
            </label>

            <label>
              Worker
              <select name="worker" value={form.worker} onChange={handleChange}>
                {workers.map((worker) => (
                  <option key={worker} value={worker}>
                    {worker}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Hours worked
              <input
                type="number"
                min="0"
                step="0.25"
                name="hours"
                value={form.hours}
                onChange={handleChange}
                disabled={form.entryType === 'flat'}
              />
            </label>

            <label>
              Work order number
              <input type="text" name="workOrder" value={form.workOrder} onChange={handleChange} placeholder="WO-1042" />
            </label>

            <label className="full-width">
              Job description
              <input type="text" name="jobDescription" value={form.jobDescription} onChange={handleChange} placeholder="Property clean up" />
            </label>
          </div>

          <div className="quick-add-row full-width quick-hour-row">
            <span>Quick hour buttons</span>
            <div className="quick-add-buttons">
              {[1, 2, 4, 6, 8].map((hours) => (
                <button key={hours} type="button" className="secondary quick-chip" onClick={() => applyQuickAdd(hours)}>
                  {hours}h
                </button>
              ))}
            </div>
          </div>

          <div className="mobile-advanced-toggle full-width no-print">
            <button type="button" className="secondary" onClick={toggleMobileAddExpanded}>
              {mobileAddExpanded ? 'Hide more details' : 'Show more details'}
            </button>
          </div>

          <div className={mobileAddExpanded ? 'mobile-advanced-fields expanded' : 'mobile-advanced-fields'}>
            <label>
              Customer
              <input type="text" name="customer" value={form.customer} onChange={handleChange} placeholder="Customer name" />
            </label>

            <label>
              Property
              <input type="text" name="property" value={form.property} onChange={handleChange} placeholder="Property or location" />
            </label>

            <label>
              Service name
              <input type="text" name="serviceName" value={form.serviceName} onChange={handleChange} placeholder="Service label" />
            </label>

            <label>
              Entry type
              <select name="entryType" value={form.entryType} onChange={handleChange}>
                <option value="hourly">Hourly</option>
                <option value="flat">Flat Rate</option>
              </select>
            </label>

            <label>
              Rate
              <input type="number" min="0" step="0.01" name="rate" value={form.rate} onChange={handleChange} />
            </label>

            <label>
              Amount
              <input type="number" min="0" step="0.01" name="amount" value={form.amount} onChange={handleChange} />
            </label>

            <label>
              Report month
              <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
            </label>

            <label className="full-width">
              Work summary
              <textarea rows="4" name="summary" value={form.summary} onChange={handleChange} placeholder="Describe what was done for work-order jobs" />
            </label>
          </div>

          <div className="form-actions full-width desktop-form-actions">
            <button type="submit">{form.id ? 'Update entry' : 'Save entry'}</button>
            <button type="button" className="secondary" onClick={resetForm}>
              Clear
            </button>
          </div>

          <div className="mobile-save-bar no-print full-width">
            <button type="submit">{form.id ? 'Update entry' : 'Save entry'}</button>
            <button type="button" className="secondary" onClick={resetForm}>
              Clear
            </button>
          </div>
        </form>
      </div>
    </section>
  )

  const renderReports = () => (
    <section className="panel report-panel wide-panel print-panel">
      <div className="filter-bar no-print report-filter-bar">
        <label>
          Worker
          <select name="worker" value={filters.worker} onChange={handleFilterChange}>
            <option>All workers</option>
            {workers.map((worker) => (
              <option key={worker} value={worker}>
                {worker}
              </option>
            ))}
          </select>
        </label>
        <label>
          Work order
          <input type="text" name="workOrder" value={filters.workOrder} onChange={handleFilterChange} placeholder="Filter by work order" />
        </label>
        <label>
          Search text
          <input type="text" name="text" value={filters.text} onChange={handleFilterChange} placeholder="Search description or summary" />
        </label>
      </div>
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Proof reports</p>
          <h2>{formatMonthLabel(`${selectedMonth}-01`)}</h2>
        </div>
        <div className="panel-heading-actions">
          <div className="month-nav no-print">
            <button type="button" className="secondary month-nav-button" onClick={goToPreviousMonth}>
              ← Prev month
            </button>
            <button type="button" className="secondary month-nav-button" onClick={goToNextMonth}>
              Next month →
            </button>
          </div>
          <div className="report-actions no-print">
            <button type="button" className="secondary" onClick={handleExportCsv}>
              Export CSV
            </button>
            <button type="button" className="secondary" onClick={handleExportPdf}>
              Export PDF
            </button>
            <button type="button" className="secondary" onClick={() => saveMonthlyMeta()}>
              Save report settings
            </button>
            <button type="button" className="secondary" onClick={() => handleSavePdfToDropbox(false)}>
              Save monthly PDF to Dropbox
            </button>
            <button type="button" onClick={handleFinalizeMonth}>
              Finalize month
            </button>
          </div>
        </div>
      </div>

      <div className="invoice-header premium-header">
        <div>
          <p className="section-kicker">Client-ready report</p>
          <h3>White Oaks Account Proof Report</h3>
          <p>Northern Property Services monthly work summary for billing backup</p>
        </div>
        <div className="report-summary-stack">
          <strong>{formatMonthLabel(`${selectedMonth}-01`)}</strong>
          <p>Billing date: {monthlyMeta.billingDate || defaultBillingDate}</p>
          <p>Monthly revenue: ${overallRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="invoice-meta-grid no-print report-meta-grid">
        <label>
          Customer / invoice name
          <input type="text" name="invoiceName" value={monthlyMeta.invoiceName} onChange={handleMonthlyMetaChange} placeholder="Customer or billing label" />
        </label>
        <label>
          Invoice number
          <input type="text" name="invoiceNumber" value={monthlyMeta.invoiceNumber} onChange={handleMonthlyMetaChange} placeholder="Optional invoice number" />
        </label>
        <label>
          Billing date
          <input type="date" name="billingDate" value={monthlyMeta.billingDate || defaultBillingDate} onChange={handleMonthlyMetaChange} />
        </label>
      </div>

      <div className="totals-grid report-totals-grid">
        {monthlyTotals.map((item) => (
          <article key={item.worker} className="total-card">
            <span>{item.worker}</span>
            <strong>{item.hours.toFixed(1)} hrs</strong>
            <small>${item.revenue.toFixed(2)}</small>
          </article>
        ))}
        <article className="total-card total-card-accent">
          <span>Overall total</span>
          <strong>{overallTotal.toFixed(1)} hrs</strong>
          <small>${overallRevenue.toFixed(2)}</small>
        </article>
      </div>

      <div className="report-list entry-list">
        {filteredEntries.length === 0 ? (
          <article className="entry-item">
            <p>No entries saved for this month yet.</p>
          </article>
        ) : (
          filteredEntries.map((entry) => (
            <article key={entry.id} className="entry-item">
              <div className="entry-topline">
                <strong>{formatDayLabel(entry.date)}</strong>
                <span>{entry.worker}</span>
                <span>{entry.entryType === 'flat' ? 'Flat Rate' : `${entry.hours} hrs`}</span>
                <span>${Number(entry.amount || 0).toFixed(2)}</span>
              </div>
              <p>
                {entry.customer ? `${entry.customer}` : 'No customer'}
                {entry.property ? ` • ${entry.property}` : ''}
                {entry.workOrder ? ` • Work order ${entry.workOrder}` : ''}
                {entry.jobDescription ? ` • ${entry.jobDescription}` : ''}
              </p>
              {entry.summary ? <small>{entry.summary}</small> : null}
              <div className="entry-actions no-print">
                <button type="button" className="secondary" onClick={() => handleEdit(entry)}>
                  Edit
                </button>
                <button type="button" className="secondary danger" onClick={() => handleDelete(entry.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )

  const renderCalendar = () => (
    <section className="panel calendar-panel wide-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Calendar view</p>
          <h2>{formatMonthLabel(`${selectedMonth}-01`)}</h2>
        </div>
        <div className="month-nav">
          <button type="button" className="secondary month-nav-button" onClick={goToPreviousMonth}>
            ← Prev month
          </button>
          <button type="button" className="secondary month-nav-button" onClick={goToNextMonth}>
            Next month →
          </button>
          <span className="status-pill">Database entries</span>
        </div>
      </div>
      <div className="calendar-grid">
        {monthDays.map((date) => {
          const dailyEntries = filteredEntries.filter((entry) => entry.date === date)
          return (
            <article key={date} className="calendar-day">
              <div className="calendar-day-header">{new Date(`${date}T12:00:00`).getDate()}</div>
              <div className="calendar-day-body">
                {dailyEntries.length === 0 ? (
                  <span className="empty-day">No jobs</span>
                ) : (
                  dailyEntries.map((entry) => (
                    <button key={entry.id} type="button" className="calendar-chip" onClick={() => handleEdit(entry)}>
                      <strong>{entry.worker.split(' ')[0]}</strong>
                      <span>{entry.hours}h</span>
                    </button>
                  ))
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )

  const renderWorkOrders = () => (
    <section className="panel wide-panel mobile-work-order-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Work orders</p>
          <h2>Grouped job history</h2>
        </div>
        <span className="status-pill">Filtered view</span>
      </div>

      <div className="mobile-wo-search no-print">
        <label>
          Search work orders
          <input
            type="text"
            value={mobileWorkOrderSearch}
            onChange={(event) => setMobileWorkOrderSearch(event.target.value)}
            placeholder="WO number or job text"
          />
        </label>
      </div>

      <div className="entry-list desktop-wo-list">
        {workOrderGroups.map((group) => (
          <article key={group.key} className="entry-item">
            <div className="entry-topline">
              <strong>{group.key}</strong>
              <span>{group.entries} entries</span>
              <span>{group.hours.toFixed(1)} hrs</span>
              <span>${group.revenue.toFixed(2)}</span>
            </div>
            <p>{group.jobs.join(', ') || 'General labor / no assigned work order'}</p>
          </article>
        ))}
      </div>

      <div className="mobile-wo-card-list">
        {mobileFilteredWorkOrders.map((group) => (
          <article key={`mobile-${group.key}`} className="mobile-wo-card">
            <div className="mobile-entry-card-top">
              <strong>{group.key}</strong>
              <span>{group.hours.toFixed(1)} hrs</span>
            </div>
            <div className="mobile-entry-meta">
              <span>{group.entries} entries</span>
              <span>${group.revenue.toFixed(2)}</span>
              <span>{group.latestEntry ? formatDayLabel(group.latestEntry.date) : 'No recent date'}</span>
            </div>
            <p>{group.jobs[0] || 'General labor / no assigned work order'}</p>
            <div className="mobile-entry-actions no-print">
              <button
                type="button"
                onClick={() => {
                  setForm((current) => ({ ...current, workOrder: group.key === 'No Work Order' ? '' : group.key }))
                  setActiveTab('quick-add')
                }}
              >
                Add under WO
              </button>
              {group.latestEntry ? (
                <button type="button" className="secondary" onClick={() => handleEdit(group.latestEntry)}>
                  Edit latest
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const billingQueue = Object.values(
    entries.reduce((acc, entry) => {
      const month = entry.date.slice(0, 7)
      if (!acc[month]) {
        acc[month] = {
          month,
          hours: 0,
          revenue: 0,
          count: 0,
          status: month === selectedMonth ? monthlyMeta.status || 'open' : 'open',
          pdfSaved: month === selectedMonth ? Boolean(monthlyMeta.pdfPath) : false,
          invoiceNumber: month === selectedMonth ? monthlyMeta.invoiceNumber || '' : '',
        }
      }
      acc[month].hours += Number(entry.hours || 0)
      acc[month].revenue += Number(entry.amount || 0)
      acc[month].count += 1
      return acc
    }, {}),
  ).sort((a, b) => b.month.localeCompare(a.month))

  const renderBillingQueue = () => (
    <section className="panel wide-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Billing Queue</p>
          <h2>Month-by-month billing status</h2>
        </div>
        <span className="status-pill success">Queue view</span>
      </div>
      <div className="entry-list billing-queue-list">
        {billingQueue.map((item) => (
          <article key={item.month} className="entry-item">
            <div className="entry-topline">
              <strong>{item.month}</strong>
              <span>{item.count} entries</span>
              <span>{item.hours.toFixed(1)} hrs</span>
              <span>${item.revenue.toFixed(2)}</span>
              <span>Status: {item.status}</span>
            </div>
            <p>
              Billing date: {item.month}-01
              {' • '}
              PDF saved: {item.pdfSaved ? 'Yes' : 'No'}
              {' • '}
              Invoice #: {item.invoiceNumber || 'Not set'}
            </p>
          </article>
        ))}
      </div>
    </section>
  )

  const renderEntriesHub = () => (
    <section className="panel wide-panel mobile-entries-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Entries</p>
          <h2>Today and recent work</h2>
        </div>
        <span className="status-pill success">Field review</span>
      </div>

      <div className="mobile-entry-groups">
        <div className="mobile-entry-group">
          <div className="mobile-group-heading">
            <h3>Today</h3>
            <span>{todayEntries.length} entries</span>
          </div>
          <div className="mobile-entry-card-list">
            {todayEntries.length ? (
              todayEntries.map((entry) => (
                <article key={`today-${entry.id}`} className="mobile-entry-card">
                  <div className="mobile-entry-card-top">
                    <strong>{entry.workOrder || 'No WO'}</strong>
                    <span>{entry.entryType === 'flat' ? 'Flat rate' : `${entry.hours} hrs`}</span>
                  </div>
                  <p>{entry.jobDescription || entry.serviceName || 'No job description'}</p>
                  <div className="mobile-entry-meta">
                    <span>{entry.worker}</span>
                    <span>{formatDayLabel(entry.date)}</span>
                    <span>${Number(entry.amount || 0).toFixed(2)}</span>
                  </div>
                  {entry.summary ? <small>{entry.summary}</small> : null}
                  <div className="mobile-entry-actions no-print">
                    <button type="button" onClick={() => handleEdit(entry)}>
                      Edit entry
                    </button>
                    <button type="button" className="secondary" onClick={() => setActiveTab('quick-add')}>
                      New like this
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <article className="mobile-empty-card">
                <strong>No entries yet today</strong>
                <p>Use Add to log the next field visit quickly.</p>
              </article>
            )}
          </div>
        </div>

        <div className="mobile-entry-group">
          <div className="mobile-group-heading">
            <h3>Recent entries</h3>
            <span>{thisWeekEntries.length} shown</span>
          </div>
          <div className="mobile-entry-card-list">
            {thisWeekEntries.map((entry) => (
              <article key={`recent-${entry.id}`} className="mobile-entry-card compact-mobile-entry-card">
                <div className="mobile-entry-card-top">
                  <strong>{entry.jobDescription || entry.serviceName || entry.workOrder || 'Entry'}</strong>
                  <span>{entry.entryType === 'flat' ? 'Flat' : `${entry.hours} hrs`}</span>
                </div>
                <div className="mobile-entry-meta">
                  <span>{entry.worker}</span>
                  <span>{formatDayLabel(entry.date)}</span>
                  <span>{entry.workOrder || 'No WO'}</span>
                </div>
                <div className="mobile-entry-actions no-print">
                  <button type="button" className="secondary" onClick={() => handleEdit(entry)}>
                    Edit
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )

  const renderImportHub = () => (
    <section className="mobile-stack import-hub-shell">
      <div className="info-card mobile-priority-card">
        <p className="section-kicker">Import hub</p>
        <h3>Batch tools, separated cleanly.</h3>
        <p>Use plain-language parsing, one-job split entry, or mixed-line import here without crowding the main Add flow.</p>
      </div>

      <div className="import-tool-card">
        <div className="mass-entry-header">
          <div>
            <p className="section-kicker">Smart entry</p>
            <h3>Parse one spoken-style entry</h3>
          </div>
          <span className="status-pill">Quick parser</span>
        </div>
        <label>
          Plain-language entry
          <textarea
            rows="4"
            value={plainTextEntry}
            onChange={(event) => setPlainTextEntry(event.target.value)}
            placeholder="2026-04-14 Mike Griffin 5 hours WO-2201 property clean up - cleaned brush and hauled debris"
          />
        </label>
        <div className="plain-actions">
          <button type="button" className="secondary" onClick={handleParse}>
            Parse into Add
          </button>
          <button type="button" onClick={handleParseAndSave}>
            Parse and save
          </button>
        </div>
      </div>

      <div className="import-tool-card">
        <div className="mass-entry-header">
          <div>
            <p className="section-kicker">Mass entry tool</p>
            <h3>Split one job across days</h3>
          </div>
          <span className="status-pill">Single work order</span>
        </div>

        <div className="mass-entry-grid">
          <label>
            Start date
            <input type="date" name="startDate" value={massEntryForm.startDate} onChange={handleMassEntryChange} />
          </label>

          <label>
            Worker
            <select name="worker" value={massEntryForm.worker} onChange={handleMassEntryChange}>
              {workers.map((worker) => (
                <option key={worker} value={worker}>
                  {worker}
                </option>
              ))}
            </select>
          </label>

          <label>
            Total hours
            <input type="number" min="0" step="0.25" name="totalHours" value={massEntryForm.totalHours} onChange={handleMassEntryChange} />
          </label>

          <label>
            Hours per sequence/day
            <input type="number" min="0.25" step="0.25" name="sequenceHours" value={massEntryForm.sequenceHours} onChange={handleMassEntryChange} />
          </label>

          <label>
            Work order
            <input type="text" name="workOrder" value={massEntryForm.workOrder} onChange={handleMassEntryChange} placeholder="WO-12345" />
          </label>

          <label>
            Rate
            <input type="number" min="0" step="0.01" name="rate" value={massEntryForm.rate} onChange={handleMassEntryChange} />
          </label>

          <label className="full-width">
            Job description
            <input type="text" name="jobDescription" value={massEntryForm.jobDescription} onChange={handleMassEntryChange} placeholder="Clean up, hauling, maintenance, etc." />
          </label>

          <label className="full-width">
            Summary
            <textarea rows="3" name="summary" value={massEntryForm.summary} onChange={handleMassEntryChange} placeholder="Optional note carried across every created entry" />
          </label>
        </div>

        <div className="plain-actions mass-entry-actions">
          <button type="button" className="secondary" onClick={handleMassEntryPreview}>
            Preview split
          </button>
          <button type="button" onClick={handleMassEntrySave}>
            Save mass entry
          </button>
          <button type="button" className="secondary" onClick={resetMassEntryForm}>
            Clear
          </button>
        </div>

        {massEntryPreview.length > 0 ? (
          <div className="mass-preview-list mobile-import-preview-list">
            {massEntryPreview.map((entry, index) => (
              <article key={`${entry.date}-${index}`} className="mass-preview-item mobile-import-preview-item">
                <strong>{formatDayLabel(entry.date)}</strong>
                <span>{entry.worker}</span>
                <span>{entry.hours} hrs</span>
                <span>{entry.workOrder || 'No WO'}</span>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="import-tool-card">
        <div className="mass-entry-header">
          <div>
            <p className="section-kicker">Mixed line importer</p>
            <h3>Paste many jobs at once</h3>
          </div>
          <span className="status-pill success">Batch parser</span>
        </div>

        <label>
          Mixed lines
          <textarea
            rows="8"
            name="text"
            value={mixedMassEntryForm.text}
            onChange={handleMixedMassEntryChange}
            placeholder={[
              'Date | Worker | Total Hours | Work Order | Description | Summary | Hours Per Day',
              '2026-04-29 | Mike Griffin | 16 | WO-2201 | Property cleanup | hauled brush | 8',
              '2026-04-29\tMark Griffin\t12\tWO-2207\tFence repair\treset posts\t6',
              '2026-04-30,Mike Griffin,5,WO-2210,Delivery and material pickup,loaded supplies',
            ].join('\n')}
          />
        </label>

        <div className="mass-entry-grid compact-mass-grid">
          <label>
            Default hours per sequence/day
            <input type="number" min="0.25" step="0.25" name="sequenceHours" value={mixedMassEntryForm.sequenceHours} onChange={handleMixedMassEntryChange} />
          </label>

          <label>
            Customer
            <input type="text" name="customer" value={mixedMassEntryForm.customer} onChange={handleMixedMassEntryChange} />
          </label>
        </div>

        <small>
          Accepted formats: pipe, spreadsheet paste, or CSV. Order: date, worker, total hours, work order, description, optional summary, optional hours per day.
        </small>

        <div className="plain-actions mass-entry-actions">
          <button type="button" className="secondary" onClick={handleMixedMassEntryPreview}>
            Preview mixed lines
          </button>
          <button type="button" onClick={handleMixedMassEntrySave}>
            Save mixed lines
          </button>
          <button type="button" className="secondary" onClick={resetMixedMassEntryForm}>
            Clear
          </button>
        </div>

        {mixedMassEntryWarnings.length > 0 ? (
          <div className="warning-list mobile-warning-list">
            {mixedMassEntryWarnings.map((warning, index) => (
              <article
                key={`${warning.lineNumber}-${warning.level}-${index}`}
                className={warning.level === 'error' ? 'warning-item error' : 'warning-item'}
              >
                <strong>Line {warning.lineNumber}</strong>
                <span>{warning.message}</span>
              </article>
            ))}
          </div>
        ) : null}

        {mixedMassEntryPreview.length > 0 ? (
          <div className="mass-preview-list mobile-import-preview-list">
            {mixedMassEntryPreview.map((entry, index) => (
              <article key={`${entry.date}-${entry.worker}-${index}`} className="mass-preview-item mixed-preview-item mobile-import-preview-item">
                <strong>{formatDayLabel(entry.date)}</strong>
                <span>{entry.worker}</span>
                <span>{entry.hours} hrs</span>
                <span>{entry.workOrder || 'No WO'}</span>
                <span className="full-width-preview">Line {entry.sourceLineNumber}: {entry.batchLabel || entry.jobDescription || 'Batch item'}</span>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )

  const renderMoreHub = () => {
    const moreViews = [
      ['dashboard', 'Dashboard', 'Month snapshot and recent totals'],
      ['reports', 'Reports', 'Proof reports and exports'],
      ['calendar', 'Calendar', 'Month-by-month work view'],
      ['records', 'Records', 'PDF archive and Dropbox save tools'],
      ['billing-queue', 'Billing', 'Invoice status and monthly queue'],
    ]

    return (
      <section className="panel wide-panel more-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">More</p>
            <h2>Admin and reporting tools</h2>
          </div>
          <span className="status-pill success">Secondary tools</span>
        </div>

        <div className="more-card-grid no-print">
          {moreViews.map(([key, label, description]) => (
            <button
              key={key}
              type="button"
              className={mobileMoreView === key ? 'more-card active' : 'more-card'}
              onClick={() => setMobileMoreView(key)}
            >
              <strong>{label}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>

        <div className="more-active-label no-print">
          <span className="status-pill">Viewing</span>
          <strong>{moreViews.find(([key]) => key === mobileMoreView)?.[1] || 'Dashboard'}</strong>
        </div>

        <div className="more-body more-mobile-body">
          {{
            dashboard: renderDashboard(),
            reports: renderReports(),
            calendar: renderCalendar(),
            records: renderRecords(),
            'billing-queue': renderBillingQueue(),
          }[mobileMoreView]}
        </div>
      </section>
    )
  }

  const renderRecords = () => (
    <section className="panel wide-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Records</p>
          <h2>Monthly PDF archive</h2>
        </div>
        <span className="status-pill success">Dropbox connected</span>
      </div>
      <div className="record-card">
        <p>
          Current month status: <strong>{monthlyMeta.status || 'open'}</strong>
          <br />
          Monthly PDFs can be saved to:
          <br />
          <strong>{dropboxFolder}</strong>
        </p>
        <p>
          Billing happens on the first of the following month.
          <br />
          Current billing date: <strong>{monthlyMeta.billingDate || defaultBillingDate}</strong>
        </p>
        <p>
          Finalized at: <strong>{monthlyMeta.finalizedAt || 'Not finalized yet'}</strong>
          <br />
          PDF path: <strong>{monthlyMeta.pdfPath || 'No PDF saved yet'}</strong>
          <br />
          Rolling revenue total: <strong>${rollingRevenueTotal.toFixed(2)}</strong>
        </p>
        <div className="record-actions">
          <button type="button" className="secondary" onClick={() => handleSavePdfToDropbox(false)}>
            Save current month PDF to Dropbox
          </button>
          <button type="button" onClick={handleFinalizeMonth}>
            Finalize month and archive PDF
          </button>
        </div>
      </div>
    </section>
  )

  const desktopViews = {
    dashboard: renderDashboard(),
    'quick-add': renderQuickAdd(),
    reports: renderReports(),
    calendar: renderCalendar(),
    'work-orders': renderWorkOrders(),
    'billing-queue': renderBillingQueue(),
    records: renderRecords(),
  }

  const mobileViews = {
    'quick-add': renderQuickAdd(),
    dashboard: renderEntriesHub(),
    'work-orders': renderWorkOrders(),
    import: renderImportHub(),
    more: renderMoreHub(),
  }

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card panel">
          <p className="section-kicker">Trackdog access</p>
          <h1>Checking your session…</h1>
          <p className="status-text">Hold on while Trackdog verifies access.</p>
        </div>
      </div>
    )
  }

  if (isSupabaseConfigured && !session) {
    return (
      <div className="auth-shell">
        <form className="auth-card panel" onSubmit={handleLogin}>
          <p className="section-kicker">Trackdog access</p>
          <h1>Sign in to Trackdog</h1>
          <p className="hero-copy auth-copy">This app is private. Only invited users can access Trackdog.</p>
          {apiConfigError ? <p className="auth-error">{apiConfigError}</p> : null}
          <label>
            Email
            <input type="email" name="email" value={authForm.email} onChange={handleAuthInputChange} autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" value={authForm.password} onChange={handleAuthInputChange} autoComplete="current-password" required />
          </label>
          {authError ? <p className="auth-error">{authError}</p> : null}
          <button type="submit" disabled={Boolean(apiConfigError)}>Sign in</button>
        </form>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-shell-inner">
        <header className="hero desktop-hero">
          <div className="hero-main panel">
            <div className="brand-lockup">
              <img src={logo} alt="Northern Property Services logo" className="brand-logo" />
              <div>
                <div className="hero-topbar">
                  <div>
                    <p className="eyebrow">Project Trackdog</p>
                    <h1>Work Order Hourly Tracking</h1>
                  </div>
                  {session?.user ? (
                    <div className="session-badge no-print">
                      <span>{session.user.email}</span>
                      <button type="button" className="secondary" onClick={handleLogout}>
                        Log out
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="hero-copy">
                  Trackdog keeps White Oaks field work clean, billable, and easy to prove, with faster entry, clearer month totals, and better-looking support reports.
                </p>
                <p className="status-text">{apiConfigError || status}</p>
                {apiConfigError ? <p className="auth-error">{apiConfigError}</p> : null}
              </div>
            </div>
          </div>
          <div className="hero-card">
            <span className="hero-stat-label">Selected month total</span>
            <strong>{overallTotal.toFixed(1)}</strong>
            <span className="hero-stat-note">Tracked across {workers.join(' and ')}</span>
            <span className="hero-stat-note">Revenue: ${overallRevenue.toFixed(2)}</span>
            <span className="hero-stat-note">Rolling total: {rollingHoursTotal.toFixed(1)} hrs | ${rollingRevenueTotal.toFixed(2)}</span>
          </div>
        </header>

        <header className="mobile-header panel no-print">
          <div className="mobile-header-top">
            <div>
              <p className="eyebrow">Trackdog mobile</p>
              <h2>Trackdog</h2>
            </div>
            <span className="status-pill success">{formatMonthLabel(`${selectedMonth}-01`)}</span>
          </div>
          {session?.user ? (
            <div className="mobile-session-row">
              <span>{session.user.email}</span>
              <button type="button" className="secondary" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : null}
          <div className="mobile-header-stats">
            <article>
              <span>Total hours</span>
              <strong>{overallTotal.toFixed(1)}</strong>
            </article>
            <article>
              <span>Revenue</span>
              <strong>${overallRevenue.toFixed(0)}</strong>
            </article>
            <article>
              <span>Status</span>
              <strong>{monthlyMeta.status || 'open'}</strong>
            </article>
          </div>
          <p className="status-text">{status}</p>
        </header>

        <nav className="tabs no-print desktop-tabs">
          {[
            ['quick-add', 'Quick Add + Mass Entry'],
            ['reports', 'Proof Reports'],
            ['calendar', 'Calendar'],
            ['records', 'Records'],
            ['dashboard', 'Dashboard'],
            ['work-orders', 'Work Orders'],
            ['billing-queue', 'Billing Queue'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? 'tab-button active' : 'tab-button secondary'}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <nav className="mobile-bottom-nav no-print">
          {[
            ['quick-add', 'Add'],
            ['dashboard', 'Entries'],
            ['work-orders', 'Work Orders'],
            ['import', 'Import'],
            ['more', 'More'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? 'mobile-nav-button active' : 'mobile-nav-button'}
              onClick={() => setActiveTab(key)}
            >
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <main className="dashboard single-column desktop-main">{desktopViews[activeTab] || desktopViews['quick-add']}</main>
        <main className="dashboard single-column mobile-main">{mobileViews[activeTab] || mobileViews['quick-add']}</main>
      </div>
    </div>
  )
}

export default App
