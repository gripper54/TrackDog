import cors from 'cors'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 3001
const recordsFolder = process.env.TRACKDOG_RECORDS_FOLDER || '/Users/crimmit/Library/CloudStorage/Dropbox/Trackdog Records'
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabasePublishableKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : null
const isSupabaseConfigured = Boolean(supabase)
if (!supabase) {
  throw new Error('Supabase is required for the Trackdog API in hosted mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

const workers = ['Mark Griffin', 'Mike Griffin']
const defaultCustomer = 'White Oaks / Prime Properties'

const toDbEntry = ({
  date,
  worker,
  customer = defaultCustomer,
  property = '',
  serviceName = '',
  hours = 0,
  entryType = 'hourly',
  rate = entryType === 'flat' ? 150 : 30,
  amount,
  workOrder = '',
  jobDescription = '',
  summary = '',
}) => {
  const numericHours = Number(hours || 0)
  const numericRate = Number(rate || 0)
  const numericAmount = Number(amount || (entryType === 'flat' ? numericRate : numericHours * numericRate))

  return {
    date,
    worker,
    customer: (customer || defaultCustomer).trim(),
    property: (property || '').trim(),
    service_name: (serviceName || '').trim(),
    hours: entryType === 'flat' ? 0 : numericHours,
    entry_type: entryType,
    rate: numericRate,
    amount: numericAmount,
    work_order: (workOrder || '').trim(),
    job_description: (jobDescription || '').trim(),
    summary: (summary || '').trim(),
  }
}

const serializeEntry = (row) => ({
  id: row.id,
  date: row.date,
  worker: row.worker,
  customer: row.customer,
  property: row.property,
  serviceName: row.service_name,
  hours: row.hours,
  entryType: row.entry_type,
  rate: row.rate,
  amount: row.amount,
  workOrder: row.work_order,
  jobDescription: row.job_description,
  summary: row.summary,
})

const normalizeMonthlyReport = (row, month) => row || { month, invoice_name: '', invoice_number: '', billing_date: '', finalized_at: '', pdf_path: '', status: 'open' }

const listEntries = async (month) => {
  let query = supabase.from('entries').select('*').order('date', { ascending: true }).order('id', { ascending: false })
  if (month) {
    query = query.gte('date', `${month}-01`).lt('date', `${month}-32`)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

const insertEntry = async (payload) => {
  const { data, error } = await supabase.from('entries').insert(toDbEntry(payload)).select().single()
  if (error) throw error
  return data
}

const updateEntryById = async (id, payload) => {
  const { data, error } = await supabase.from('entries').update(toDbEntry(payload)).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data
}

const deleteEntryById = async (id) => {
  const { error, count } = await supabase.from('entries').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  return count || 0
}

const insertMassEntries = async (items) => {
  if (!items.length) return []
  const payload = items.map((item) => toDbEntry(item))
  const { data, error } = await supabase.from('entries').insert(payload).select()
  if (error) throw error
  return data || []
}

const getMonthlyReport = async (month) => {
  const { data, error } = await supabase.from('monthly_reports').select('*').eq('month', month).maybeSingle()
  if (error) throw error
  return normalizeMonthlyReport(data, month)
}

const saveMonthlyReport = async (month, payload) => {
  const row = {
    month,
    invoice_name: payload.invoiceName || '',
    invoice_number: payload.invoiceNumber || '',
    billing_date: payload.billingDate || '',
    finalized_at: payload.finalizedAt || '',
    pdf_path: payload.pdfPath || '',
    status: payload.status || 'open',
  }
  const { data, error } = await supabase.from('monthly_reports').upsert(row).select().single()
  if (error) throw error
  return data
}

app.use(cors())
app.use(express.json())

const getBearerToken = (authHeader = '') => {
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

const requireAuth = async (req, res, next) => {
  if (!isSupabaseConfigured) {
    req.user = null
    return next()
  }

  const token = getBearerToken(req.headers.authorization)
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired authorization token' })
  }

  req.user = data.user
  return next()
}

const normalizeDateToken = (raw) => {
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slashMatch) {
    const month = Number(slashMatch[1])
    const day = Number(slashMatch[2])
    const yearToken = slashMatch[3]
    const year = yearToken.length === 2 ? 2000 + Number(yearToken) : Number(yearToken)

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseWorkerFromText = (text) => {
  let remainder = text
  let worker = ''

  for (const name of workers) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const workerRegex = new RegExp(`(?:^|\\b)${escapedName}(?:\\b|$)`, 'i')
    const match = remainder.match(workerRegex)
    if (match) {
      worker = name
      remainder = remainder.replace(match[0], ' ').replace(/\s+/g, ' ').trim()
      break
    }
  }

  return {
    worker: worker || 'Mike Griffin',
    remainder,
  }
}

const parseHoursFromText = (text) => {
  let remainder = text
  let hours = null
  const hourPatterns = [
    /(\d+(?:\.\d+)?)\s*hours?\b/i,
    /\bhours?\s*(\d+(?:\.\d+)?)\b/i,
    /(\d+(?:\.\d+)?)\s*hrs?\b/i,
    /\bhrs?\s*(\d+(?:\.\d+)?)\b/i,
  ]

  for (const pattern of hourPatterns) {
    const match = remainder.match(pattern)
    if (match) {
      hours = Number(match[1])
      remainder = remainder.replace(match[0], ' ').replace(/\s+/g, ' ').trim()
      break
    }
  }

  return { hours, remainder }
}

const parseWorkOrderFromText = (text) => {
  let remainder = text
  let workOrder = ''
  const workOrderPatterns = [
    /\bwork\s*order\s*#?\s*(\d+)\b/i,
    /\bwo[-\s#:]*(\d+)\b/i,
    /\b(\d{5})\b/,
  ]

  for (const pattern of workOrderPatterns) {
    const match = remainder.match(pattern)
    if (match) {
      workOrder = `WO-${match[1]}`
      remainder = remainder.replace(match[0], ' ').replace(/\s+/g, ' ').trim()
      break
    }
  }

  return { workOrder, remainder }
}

const parseDescriptionAndSummary = (text, original) => {
  const cleaned = text.replace(/^[-,:;\s]+|[-,:;\s]+$/g, '').trim()
  let summary = ''
  let jobDescription = cleaned

  const summarySplit = cleaned.match(/(.+?)\s+-\s+(.+)/)
  if (summarySplit) {
    jobDescription = summarySplit[1].trim()
    summary = summarySplit[2].trim()
  } else {
    const summaryKeywordSplit = cleaned.match(/(.+?)\s+(?:summary|note|notes|did)\s*:\s*(.+)/i)
    if (summaryKeywordSplit) {
      jobDescription = summaryKeywordSplit[1].trim()
      summary = summaryKeywordSplit[2].trim()
    }
  }

  if (!jobDescription) {
    jobDescription = original
  }

  return { jobDescription, summary }
}

const buildParsedEntry = ({ date, worker, hours, workOrder, jobDescription, summary }) => {
  let nextJobDescription = jobDescription
  if (!workOrder && !nextJobDescription) {
    nextJobDescription = 'Misc on-site maintenance, deliveries, property upkeep, organize and put away materials'
  } else if (!workOrder) {
    nextJobDescription = `Misc: ${nextJobDescription}`
  }

  const lowerRemainder = `${nextJobDescription} ${summary}`.toLowerCase()
  const isGrassCutting = lowerRemainder.includes('grass cutting') || lowerRemainder.includes('lawn cutting')

  return {
    date,
    worker,
    customer: defaultCustomer,
    property: '',
    serviceName: isGrassCutting ? 'Grass Cutting' : '',
    hours,
    entryType: isGrassCutting ? 'flat' : 'hourly',
    rate: isGrassCutting ? 150 : 30,
    amount: isGrassCutting ? 150 : hours * 30,
    workOrder,
    jobDescription: nextJobDescription.trim(),
    summary,
  }
}

const parsePlainLanguageEntry = (text) => {
  if (!text?.trim()) return null

  const original = text.trim()
  let remainder = original
  let parsedDate = null

  const isoDateMatch = remainder.match(/^(\d{4}-\d{2}-\d{2})\s+/)
  if (isoDateMatch) {
    parsedDate = isoDateMatch[1]
    remainder = remainder.slice(isoDateMatch[0].length).trim()
  } else {
    const slashDateMatch = remainder.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+/)
    if (slashDateMatch) {
      const normalized = normalizeDateToken(slashDateMatch[1])
      if (normalized) {
        parsedDate = normalized
        remainder = remainder.slice(slashDateMatch[0].length).trim()
      }
    } else {
      const naturalDateMatch = remainder.match(/^([A-Za-z]+\s+\d{1,2}(?:,\s*\d{4})?)\s+/)
      if (naturalDateMatch) {
        const normalized = normalizeDateToken(naturalDateMatch[1])
        if (normalized) {
          parsedDate = normalized
          remainder = remainder.slice(naturalDateMatch[0].length).trim()
        }
      }
    }
  }

  if (!parsedDate) {
    parsedDate = new Date().toISOString().slice(0, 10)
  }

  const workerResult = parseWorkerFromText(remainder)
  const hoursResult = parseHoursFromText(workerResult.remainder)
  if (!hoursResult.hours || hoursResult.hours <= 0) return null
  const workOrderResult = parseWorkOrderFromText(hoursResult.remainder)
  const detailResult = parseDescriptionAndSummary(workOrderResult.remainder, original)

  return buildParsedEntry({
    date: parsedDate,
    worker: workerResult.worker,
    hours: hoursResult.hours,
    workOrder: workOrderResult.workOrder,
    jobDescription: detailResult.jobDescription,
    summary: detailResult.summary,
  })
}

const addDays = (dateString, dayOffset) => {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + dayOffset)
  return date.toISOString().slice(0, 10)
}

const finalizeMassGeneratedEntry = ({
  date,
  worker,
  customer = defaultCustomer,
  property = '',
  serviceName = 'Hourly Labor',
  entryType = 'hourly',
  hours = 0,
  rate = entryType === 'flat' ? 150 : 30,
  amount,
  workOrder = '',
  jobDescription = '',
  summary = '',
  batchLabel = '',
  sequenceIndex = 1,
}) => {
  const numericHours = Number(hours || 0)
  const numericRate = Number(rate || 0)
  const numericAmount = Number(amount || (entryType === 'flat' ? numericRate : numericHours * numericRate))

  return {
    date,
    worker,
    customer: customer || defaultCustomer,
    property,
    serviceName,
    entryType,
    hours: entryType === 'flat' ? 0 : numericHours,
    rate: numericRate,
    amount: numericAmount,
    workOrder,
    jobDescription,
    summary,
    batchLabel,
    sequenceIndex,
  }
}

const allocateMassEntry = (payload) => {
  const {
    startDate,
    totalHours,
    sequenceHours,
    worker,
    customer = defaultCustomer,
    property = '',
    serviceName = 'Hourly Labor',
    rate = 30,
    workOrder = '',
    jobDescription = '',
    summary = '',
    entryType = 'hourly',
  } = payload

  const parsedTotalHours = Number(totalHours)
  const parsedSequenceHours = Number(sequenceHours)
  const parsedRate = Number(rate || 0)

  if (!startDate || !worker || !parsedTotalHours || parsedTotalHours <= 0) {
    return { error: 'startDate, worker, and totalHours are required' }
  }

  if (!parsedSequenceHours || parsedSequenceHours <= 0) {
    return { error: 'sequenceHours must be greater than zero' }
  }

  const entries = []
  let remainingHours = parsedTotalHours
  let dayOffset = 0

  while (remainingHours > 0) {
    const hoursForDay = Number(Math.min(parsedSequenceHours, remainingHours).toFixed(2))
    entries.push(
      finalizeMassGeneratedEntry({
        date: addDays(startDate, dayOffset),
        worker,
        customer,
        property,
        serviceName,
        entryType,
        hours: hoursForDay,
        rate: parsedRate,
        amount: entryType === 'flat' ? parsedRate : Number((hoursForDay * parsedRate).toFixed(2)),
        workOrder,
        jobDescription,
        summary,
        sequenceIndex: dayOffset + 1,
      }),
    )

    remainingHours = Number((remainingHours - hoursForDay).toFixed(2))
    dayOffset += 1
  }

  return { entries }
}

const splitDelimitedLine = (line) => {
  const trimmed = line.trim()
  if (!trimmed) return []

  if (trimmed.includes('|')) {
    return trimmed.split('|').map((part) => part.trim())
  }

  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map((part) => part.trim())
  }

  if (trimmed.includes(',')) {
    return trimmed.match(/(?:"([^"]*(?:""[^"]*)*)"|[^,])+/g)?.map((part) => part.trim().replace(/^"|"$/g, '').replace(/""/g, '"')) || []
  }

  return [trimmed]
}

const looksLikeHeaderRow = (segments) => {
  const header = segments.join(' ').toLowerCase()
  return header.includes('date') && header.includes('worker') && (header.includes('hours') || header.includes('total'))
}

const parseMixedMassEntryLines = (payload) => {
  const { text = '', sequenceHours = 8, customer = defaultCustomer } = payload
  const parsedSequenceHours = Number(sequenceHours)

  if (!text.trim()) {
    return { error: 'Paste at least one mixed line first.' }
  }

  if (!parsedSequenceHours || parsedSequenceHours <= 0) {
    return { error: 'Default sequence hours must be greater than zero.' }
  }

  const rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!rawLines.length) {
    return { error: 'Paste at least one mixed line first.' }
  }

  const parsedLines = rawLines
    .map((line) => splitDelimitedLine(line))
    .filter((segments) => segments.length)

  const lineItems = parsedLines.filter((segments, index) => !(index === 0 && looksLikeHeaderRow(segments)))

  if (!lineItems.length) {
    return { error: 'Only a header row was detected. Paste at least one data row too.' }
  }

  const entries = []
  const warnings = []

  for (const [index, segments] of lineItems.entries()) {
    const lineNumber = index + 1

    if (segments.length < 4) {
      warnings.push({ lineNumber, level: 'error', message: 'Needs at least date, worker, total hours, and work order or description.' })
      continue
    }

    const [rawDate, rawWorker, rawHours, rawWorkOrder = '', rawDescription = '', rawSummary = '', rawSequence = ''] = segments
    const normalizedDate = normalizeDateToken(rawDate)
    if (!normalizedDate) {
      warnings.push({ lineNumber, level: 'error', message: 'Invalid date.' })
      continue
    }

    const totalHours = Number(rawHours)
    if (!totalHours || totalHours <= 0) {
      warnings.push({ lineNumber, level: 'error', message: 'Total hours must be greater than zero.' })
      continue
    }

    const lineSequenceHours = rawSequence ? Number(rawSequence) : parsedSequenceHours
    if (!lineSequenceHours || lineSequenceHours <= 0) {
      warnings.push({ lineNumber, level: 'error', message: 'Hours per day must be greater than zero.' })
      continue
    }

    if (!rawWorkOrder && !rawDescription) {
      warnings.push({ lineNumber, level: 'warning', message: 'Missing both work order and description. It will be hard to identify later.' })
    }

    if (lineSequenceHours > totalHours) {
      warnings.push({ lineNumber, level: 'warning', message: 'Hours per day is larger than total hours, so this line will stay on one day.' })
    }

    const allocation = allocateMassEntry({
      startDate: normalizedDate,
      totalHours,
      sequenceHours: lineSequenceHours,
      worker: rawWorker || 'Mike Griffin',
      customer,
      workOrder: rawWorkOrder,
      jobDescription: rawDescription,
      summary: rawSummary,
      rate: 30,
      serviceName: 'Hourly Labor',
      entryType: 'hourly',
    })

    if (allocation.error) {
      warnings.push({ lineNumber, level: 'error', message: allocation.error })
      continue
    }

    allocation.entries.forEach((entry) => {
      entries.push({
        ...entry,
        batchLabel: rawDescription || rawWorkOrder || `Line ${lineNumber}`,
        sourceLineNumber: lineNumber,
      })
    })
  }

  const hasErrors = warnings.some((warning) => warning.level === 'error')
  return {
    entries,
    linesParsed: lineItems.length,
    warnings,
    hasErrors,
  }
}

app.get('/api/meta', requireAuth, (req, res) => {
  res.json({ workers, recordsFolder, authRequired: isSupabaseConfigured, user: req.user ? { id: req.user.id, email: req.user.email } : null })
})

app.get('/api/entries', requireAuth, async (req, res) => {
  try {
    const rows = await listEntries(req.query.month)
    res.json(rows.map(serializeEntry))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to load entries' })
  }
})

app.post('/api/entries', requireAuth, async (req, res) => {
  const {
    date,
    worker,
    customer = defaultCustomer,
    property = '',
    serviceName = '',
    hours = 0,
    entryType = 'hourly',
    rate = entryType === 'flat' ? 150 : 30,
    amount,
    workOrder = '',
    jobDescription = '',
    summary = '',
  } = req.body
  if (!date || !worker) {
    return res.status(400).json({ error: 'date and worker are required' })
  }

  try {
    const row = await insertEntry({ date, worker, customer, property, serviceName, hours, entryType, rate, amount, workOrder, jobDescription, summary })
    return res.status(201).json(serializeEntry(row))
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error?.message || 'Failed to save entry' })
  }
})

app.put('/api/entries/:id', requireAuth, async (req, res) => {
  const {
    date,
    worker,
    customer = defaultCustomer,
    property = '',
    serviceName = '',
    hours = 0,
    entryType = 'hourly',
    rate = entryType === 'flat' ? 150 : 30,
    amount,
    workOrder = '',
    jobDescription = '',
    summary = '',
  } = req.body
  try {
    const row = await updateEntryById(req.params.id, { date, worker, customer, property, serviceName, hours, entryType, rate, amount, workOrder, jobDescription, summary })
    if (!row) {
      return res.status(404).json({ error: 'Entry not found' })
    }
    return res.json(serializeEntry(row))
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error?.message || 'Failed to update entry' })
  }
})

app.delete('/api/entries/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await deleteEntryById(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: 'Entry not found' })
    }
    return res.status(204).send()
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Failed to delete entry' })
  }
})

app.post('/api/parse-entry', requireAuth, (req, res) => {
  const parsed = parsePlainLanguageEntry(req.body.text)
  if (!parsed) {
    return res.status(400).json({ error: 'Could not parse entry. Example: 2026-04-14 Mike Griffin 5 hours WO-2201 property clean up - cleaned brush and hauled debris' })
  }
  return res.json(parsed)
})

app.post('/api/mass-entry/preview', requireAuth, (req, res) => {
  const result = allocateMassEntry(req.body)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  return res.json(result)
})

app.post('/api/mass-entry/save', requireAuth, async (req, res) => {
  const result = allocateMassEntry(req.body)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }

  try {
    await insertMassEntries(result.entries)
    return res.status(201).json({ ok: true, count: result.entries.length, entries: result.entries })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error?.message || 'Failed to save mass entry batch' })
  }
})

app.post('/api/mass-entry/mixed/preview', requireAuth, (req, res) => {
  const result = parseMixedMassEntryLines(req.body)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  return res.json(result)
})

app.post('/api/mass-entry/mixed/save', requireAuth, async (req, res) => {
  const result = parseMixedMassEntryLines(req.body)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }

  if (result.hasErrors) {
    return res.status(400).json({ error: 'Fix the highlighted mixed-line errors before saving.', warnings: result.warnings, entries: result.entries, linesParsed: result.linesParsed })
  }

  try {
    await insertMassEntries(result.entries)
    return res.status(201).json({ ok: true, count: result.entries.length, linesParsed: result.linesParsed, warnings: result.warnings, entries: result.entries })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error?.message || 'Failed to save mixed mass entry batch' })
  }
})

app.get('/api/monthly-report/:month', requireAuth, async (req, res) => {
  try {
    const row = await getMonthlyReport(req.params.month)
    return res.json(row)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Failed to load monthly report' })
  }
})

app.post('/api/monthly-report/:month', requireAuth, async (req, res) => {
  try {
    const row = await saveMonthlyReport(req.params.month, req.body)
    return res.json(row)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Failed to save monthly report' })
  }
})

app.post('/api/save-pdf', requireAuth, (req, res) => {
  const { filename, dataUri, folder } = req.body
  const targetFolder = folder || recordsFolder

  if (!filename || !dataUri) {
    return res.status(400).json({ error: 'filename and dataUri are required' })
  }

  const match = dataUri.match(/^data:application\/pdf;filename=.*;base64,(.+)$/)
    || dataUri.match(/^data:application\/pdf;base64,(.+)$/)

  if (!match) {
    return res.status(400).json({ error: 'Invalid PDF payload' })
  }

  fs.mkdirSync(targetFolder, { recursive: true })
  const targetPath = path.join(targetFolder, filename)
  fs.writeFileSync(targetPath, Buffer.from(match[1], 'base64'))
  return res.json({ ok: true, path: targetPath })
})

app.listen(port, () => {
  console.log(`Trackdog API running on http://localhost:${port}`)
})
