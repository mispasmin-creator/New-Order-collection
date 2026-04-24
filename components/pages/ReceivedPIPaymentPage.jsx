"use client"

import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { useNotification } from "@/components/providers/NotificationProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Search, Loader2, CheckCircle2, Clock, IndianRupee, AlertCircle,
  ChevronDown, ChevronRight, RefreshCw, CalendarClock, History,
  AlertTriangle, BadgeCheck, CircleDollarSign, FileText, Package,
  ExternalLink,
} from "lucide-react"
import { formatCurrency } from "./MakePIPage"

const formatDate = (d) => {
  if (!d) return "—"
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return d
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
  } catch { return d }
}

const isOverdue = (slab) => {
  if (slab.status === "Received") return false
  if (!slab.due_date) return false
  return new Date(slab.due_date) < new Date(new Date().toDateString())
}

const slabStatus = (slab) => {
  if (slab.status === "Received") return "received"
  if (isOverdue(slab)) return "overdue"
  if (slab.status === "Partial") return "partial"
  return "pending"
}

const StatusPill = ({ slab }) => {
  const s = slabStatus(slab)
  const remaining = (slab.expected_amount || 0) - (slab.actual_amount || 0)
  if (s === "received")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Received</span>
  if (s === "overdue")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />Overdue</span>
  if (s === "partial")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><CircleDollarSign className="w-3 h-3" />Partial · {formatCurrency(remaining)} rem.</span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pending</span>
}

const parsePiCopy = (piCopy) => {
  if (!piCopy) return []
  try {
    const parsed = typeof piCopy === "string" ? JSON.parse(piCopy) : piCopy
    return Object.values(parsed).filter(Boolean)
  } catch { return [] }
}

// Shared block shown inside action modals
const SlabDetailsBlock = ({ slab }) => {
  const piCopyUrls = parsePiCopy(slab.pi_copy)
  const products = Array.isArray(slab.product_names) ? slab.product_names : []

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {slab.party_name && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Party</p>
            <p className="font-medium text-gray-800 text-xs">{slab.party_name}</p>
          </div>
        )}
        {slab.firm_name && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Firm</p>
            <p className="font-medium text-gray-800 text-xs">{slab.firm_name}</p>
          </div>
        )}
        {slab.pi_type && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-semibold">PI Type</p>
            <p className="font-medium text-gray-800 text-xs">{slab.pi_type}</p>
          </div>
        )}
        {slab.pi_quantity > 0 && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Quantity</p>
            <p className="font-medium text-gray-800 text-xs">{slab.pi_quantity} t</p>
          </div>
        )}
        {slab.total_po_value > 0 && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Total PO Value</p>
            <p className="font-medium text-gray-800 text-xs tabular-nums">{formatCurrency(slab.total_po_value)}</p>
          </div>
        )}
        {slab.slab_pct > 0 && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Slab %</p>
            <p className="font-medium text-gray-800 text-xs">{slab.slab_pct}%</p>
          </div>
        )}
      </div>

      {products.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1"><Package className="w-3 h-3" />Products</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {products.map((p, i) => (
              <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded">{p}</span>
            ))}
          </div>
        </div>
      )}

      {slab.notes && (
        <div>
          <p className="text-[10px] text-gray-400 uppercase font-semibold">Notes</p>
          <p className="text-xs text-gray-600 italic">"{slab.notes}"</p>
        </div>
      )}

      {piCopyUrls.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1"><FileText className="w-3 h-3" />PI Copy</p>
          <div className="flex flex-col gap-1 mt-0.5">
            {piCopyUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 truncate">
                <ExternalLink className="w-3 h-3 shrink-0" />PI Copy {piCopyUrls.length > 1 ? i + 1 : ""}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReceivedPIPaymentPage({ user }) {
  const { toast } = useToast()
  const { updateCount } = useNotification()

  const [piRecords, setPiRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [expandedPOs, setExpandedPOs] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)

  // ─── Dialog modes ─────────────────────────────────────────────────
  const [dialog, setDialog] = useState(null) // null | "receive" | "partial" | "reschedule"
  const [selectedSlab, setSelectedSlab] = useState(null)

  // Receive dialog state
  const [amountReceived, setAmountReceived] = useState("")
  const [receivedDate, setReceivedDate] = useState("")
  const [remarks, setRemarks] = useState("")

  // Reschedule dialog state
  const [newDueDate, setNewDueDate] = useState("")
  const [rescheduleNote, setRescheduleNote] = useState("")

  const closeDialog = () => { setDialog(null); setSelectedSlab(null) }

  const openDialog = (mode, slab) => {
    setSelectedSlab(slab)
    const remaining = (slab.expected_amount || 0) - (slab.actual_amount || 0)
    setAmountReceived(String(mode === "partial" ? "" : remaining))
    setReceivedDate("")
    setRemarks("")
    setNewDueDate("")
    setRescheduleNote("")
    setDialog(mode)
  }

  // ─── Fetch ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase.from("po_pi_records").select("*").order("created_at", { ascending: false })

      if (user?.role !== "master") {
        const firms = user?.firm ? user.firm.split(",").map(f => f.trim()) : []
        if (!firms.includes("all") && firms.length > 0) query = query.in("firm_name", firms)
      }

      const { data, error } = await query
      if (error) throw error
      setPiRecords(data || [])
    } catch (err) {
      toast({ title: "Error loading data", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, user])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Derived state ────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map(); const order = []
    piRecords.forEach(r => {
      if (!map.has(r.po_number)) {
        map.set(r.po_number, { poNumber: r.po_number, partyName: r.party_name, firmName: r.firm_name, piType: r.pi_type, slabs: [] })
        order.push(r.po_number)
      }
      map.get(r.po_number).slabs.push(r)
    })
    return order.map(k => map.get(k))
  }, [piRecords])

  const searched = useMemo(() => {
    if (!searchTerm.trim()) return grouped
    const t = searchTerm.toLowerCase()
    return grouped.filter(g => [g.poNumber, g.partyName, g.firmName, g.piType].some(v => v?.toLowerCase().includes(t)))
  }, [grouped, searchTerm])

  const overdueGroups = useMemo(() => searched.filter(g => g.slabs.some(s => isOverdue(s))), [searched])
  const pendingGroups = useMemo(() => searched.filter(g => g.slabs.some(s => s.status !== "Received") && !g.slabs.some(s => isOverdue(s))), [searched])
  const receivedGroups = useMemo(() => searched.filter(g => g.slabs.every(s => s.status === "Received")), [searched])

  useEffect(() => {
    updateCount("Received PI Payment", overdueGroups.length + pendingGroups.length)
  }, [overdueGroups.length, pendingGroups.length, updateCount])

  const displayGroups = activeTab === "overdue" ? overdueGroups : activeTab === "pending" ? pendingGroups : receivedGroups

  const toggleExpand = (key) => setExpandedPOs(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  })

  // ─── Stats ────────────────────────────────────────────────────────
  const totalPending = useMemo(() => piRecords.filter(r => r.status !== "Received").reduce((s, r) => s + ((r.expected_amount || 0) - (r.actual_amount || 0)), 0), [piRecords])
  const totalReceived = useMemo(() => piRecords.filter(r => r.status === "Received").reduce((s, r) => s + (r.actual_amount || 0), 0), [piRecords])

  // ─── Actions ──────────────────────────────────────────────────────
  const handleMarkReceived = async () => {
    if (!amountReceived) return toast({ title: "Enter amount", variant: "destructive" })
    if (!receivedDate) return toast({ title: "Enter date received", variant: "destructive" })

    setSubmitting(true)
    try {
      const ts = getISTTimestamp()
      const amt = parseFloat(amountReceived)
      const existingLog = Array.isArray(selectedSlab.payment_log) ? selectedSlab.payment_log : []
      const newLog = [...existingLog, { amount: amt, date: receivedDate, remarks, recorded_at: ts, type: "final" }]

      const { error } = await supabase.from("po_pi_records").update({
        status: "Received",
        actual_amount: (selectedSlab.actual_amount || 0) + amt,
        received_date: receivedDate,
        received_at: ts,
        remarks: remarks || selectedSlab.remarks,
        payment_log: newLog,
      }).eq("id", selectedSlab.id)

      if (error) throw error
      toast({ title: "Payment Received ✓", description: `${selectedSlab.slab_label} fully settled`, className: "bg-green-50 border-green-200 text-green-800" })
      closeDialog(); fetchData()
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }) }
    finally { setSubmitting(false) }
  }

  const handlePartialPayment = async () => {
    if (!amountReceived) return toast({ title: "Enter partial amount", variant: "destructive" })
    if (!receivedDate) return toast({ title: "Enter date", variant: "destructive" })

    const amt = parseFloat(amountReceived)
    const newTotal = (selectedSlab.actual_amount || 0) + amt
    const remaining = (selectedSlab.expected_amount || 0) - newTotal

    if (remaining < 0) return toast({ title: "Amount exceeds expected", description: "Use Mark Received for the final payment", variant: "destructive" })

    setSubmitting(true)
    try {
      const ts = getISTTimestamp()
      const existingLog = Array.isArray(selectedSlab.payment_log) ? selectedSlab.payment_log : []
      const newLog = [...existingLog, { amount: amt, date: receivedDate, remarks, recorded_at: ts, type: "partial" }]

      const { error } = await supabase.from("po_pi_records").update({
        status: remaining === 0 ? "Received" : "Partial",
        actual_amount: newTotal,
        received_date: remaining === 0 ? receivedDate : selectedSlab.received_date,
        received_at: remaining === 0 ? ts : selectedSlab.received_at,
        payment_log: newLog,
      }).eq("id", selectedSlab.id)

      if (error) throw error
      toast({
        title: remaining === 0 ? "Fully Settled ✓" : `Partial Recorded · ${formatCurrency(remaining)} remaining`,
        className: remaining === 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-blue-50 border-blue-200 text-blue-800",
      })
      closeDialog(); fetchData()
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }) }
    finally { setSubmitting(false) }
  }

  const handleReschedule = async () => {
    if (!newDueDate) return toast({ title: "Pick a new due date", variant: "destructive" })

    setSubmitting(true)
    try {
      const ts = getISTTimestamp()
      const existingLog = Array.isArray(selectedSlab.reschedule_log) ? selectedSlab.reschedule_log : []
      const newLog = [
        ...existingLog,
        { from_date: selectedSlab.due_date, to_date: newDueDate, note: rescheduleNote, rescheduled_at: ts },
      ]

      const { error } = await supabase.from("po_pi_records").update({
        due_date: newDueDate,
        reschedule_log: newLog,
      }).eq("id", selectedSlab.id)

      if (error) throw error
      toast({ title: "Due Date Updated", description: `New due date: ${formatDate(newDueDate)}`, className: "bg-blue-50 border-blue-200 text-blue-800" })
      closeDialog(); fetchData()
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }) }
    finally { setSubmitting(false) }
  }

  // ─── Render slab card ─────────────────────────────────────────────
  const renderSlabCard = (slab) => {
    const st = slabStatus(slab)
    const received = slab.actual_amount || 0
    const remaining = (slab.expected_amount || 0) - received
    const payLog = Array.isArray(slab.payment_log) ? slab.payment_log : []
    const reschedLog = Array.isArray(slab.reschedule_log) ? slab.reschedule_log : []
    const piCopyUrls = parsePiCopy(slab.pi_copy)
    const products = Array.isArray(slab.product_names) ? slab.product_names : []

    return (
      <div key={slab.id} className={`rounded-xl border p-4 space-y-3 ${st === "overdue" ? "border-red-200 bg-red-50/40" : st === "received" ? "border-green-200 bg-green-50/30" : st === "partial" ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-white"}`}>
        {/* Slab header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800">{slab.slab_label}</p>
              <StatusPill slab={slab} />
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{slab.pi_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Expected</p>
            <p className="font-bold text-indigo-700 tabular-nums">{formatCurrency(slab.expected_amount)}</p>
          </div>
        </div>

        {/* Products */}
        {products.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {products.map((p, i) => (
              <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Package className="w-3 h-3" />{p}
              </span>
            ))}
          </div>
        )}

        {/* Dates & amounts grid */}
        <div className="flex flex-wrap gap-4 text-sm">
          {slab.pi_type && (
            <div>
              <p className="text-xs text-gray-400">PI Type</p>
              <p className="font-medium text-gray-700">{slab.pi_type}</p>
            </div>
          )}
          {slab.pi_quantity > 0 && (
            <div>
              <p className="text-xs text-gray-400">Quantity</p>
              <p className="font-medium text-gray-700">{slab.pi_quantity} t</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">Due Date</p>
            <p className={`font-medium ${st === "overdue" ? "text-red-600" : "text-gray-700"}`}>
              {formatDate(slab.due_date)}
              {st === "overdue" && <span className="ml-1 text-xs text-red-500">(Overdue)</span>}
            </p>
          </div>
          {received > 0 && (
            <div>
              <p className="text-xs text-gray-400">Received</p>
              <p className="font-bold text-green-700 tabular-nums">{formatCurrency(received)}</p>
            </div>
          )}
          {remaining > 0 && (
            <div>
              <p className="text-xs text-gray-400">Remaining</p>
              <p className="font-semibold text-amber-700 tabular-nums">{formatCurrency(remaining)}</p>
            </div>
          )}
          {slab.total_po_value > 0 && (
            <div>
              <p className="text-xs text-gray-400">Total PO Value</p>
              <p className="font-medium text-gray-700 tabular-nums">{formatCurrency(slab.total_po_value)}</p>
            </div>
          )}
          {slab.received_date && st === "received" && (
            <div>
              <p className="text-xs text-gray-400">Settled On</p>
              <p className="font-medium text-green-700">{formatDate(slab.received_date)}</p>
            </div>
          )}
        </div>

        {/* Notes */}
        {slab.notes && (
          <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">"{slab.notes}"</p>
        )}

        {/* PI Copy links */}
        {piCopyUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {piCopyUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 underline bg-indigo-50 border border-indigo-100 px-2 py-1 rounded">
                <FileText className="w-3 h-3" />PI Copy{piCopyUrls.length > 1 ? ` ${i + 1}` : ""}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}

        {/* Payment log */}
        {payLog.length > 0 && (
          <div className="bg-white/70 border border-gray-100 rounded-lg p-2 space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1"><History className="w-3 h-3" />Payment History</p>
            {payLog.map((p, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-600">
                <span>{formatDate(p.date)} — {formatCurrency(p.amount)} <span className="text-gray-400">{p.type === "partial" ? "(partial)" : "(final)"}</span></span>
                {p.remarks && <span className="text-gray-400 italic truncate max-w-[200px]">{p.remarks}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Reschedule log */}
        {reschedLog.length > 0 && (
          <div className="bg-white/70 border border-gray-100 rounded-lg p-2 space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1"><CalendarClock className="w-3 h-3" />Reschedule History</p>
            {reschedLog.map((r, i) => (
              <div key={i} className="text-xs text-gray-600">
                {formatDate(r.from_date)} → {formatDate(r.to_date)}
                {r.note && <span className="text-gray-400 italic ml-2">"{r.note}"</span>}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {st !== "received" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => openDialog("receive", slab)} className="bg-green-600 hover:bg-green-700 h-7 text-xs gap-1">
              <BadgeCheck className="w-3 h-3" /> Mark Received
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDialog("partial", slab)} className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50">
              <CircleDollarSign className="w-3 h-3" /> Partial Payment
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDialog("reschedule", slab)} className="h-7 text-xs gap-1 border-orange-300 text-orange-700 hover:bg-orange-50">
              <CalendarClock className="w-3 h-3" /> Reschedule
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
        <span className="text-gray-600">Loading PI payments...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Received PI Payment</h1>
          <p className="text-gray-600">Track & follow up on PI payment collection</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="flex items-center gap-2 w-fit">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-red-50 border-red-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-600">Overdue</p>
              <div className="text-xl font-bold text-red-900">{overdueGroups.length} POs</div>
            </div>
            <div className="h-10 w-10 bg-red-500 rounded-full flex items-center justify-center text-white shrink-0"><AlertTriangle className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-600">Pending</p>
              <div className="text-xl font-bold text-amber-900">{pendingGroups.length} POs</div>
              <p className="text-xs text-amber-500 mt-1 truncate">{formatCurrency(totalPending)} due</p>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white shrink-0"><Clock className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-600">Fully Received</p>
              <div className="text-xl font-bold text-green-900">{receivedGroups.length} POs</div>
              <p className="text-xs text-green-500 mt-1 truncate">{formatCurrency(totalReceived)} collected</p>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0"><CheckCircle2 className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-indigo-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-indigo-600">Total Outstanding</p>
              <div className="text-base font-bold text-indigo-900 truncate">{formatCurrency(totalPending)}</div>
            </div>
            <div className="h-10 w-10 bg-indigo-500 rounded-full flex items-center justify-center text-white shrink-0"><IndianRupee className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white border rounded-md shadow-sm p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="Search by PO, party..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10" />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-md w-fit gap-1">
          {[
            { key: "overdue", label: `Overdue (${overdueGroups.length})`, color: overdueGroups.length > 0 ? "text-red-600" : "" },
            { key: "pending", label: `Pending (${pendingGroups.length})` },
            { key: "received", label: `Received (${receivedGroups.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : `text-gray-600 hover:text-gray-900 ${tab.color || ""}`}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* PO Groups */}
      <div className="space-y-3">
        {displayGroups.length === 0 ? (
          <div className="bg-white border rounded-md p-12 text-center text-gray-500">No records found</div>
        ) : (
          displayGroups.map(group => {
            const isExpanded = expandedPOs.has(group.poNumber)
            const totalExpected = group.slabs.reduce((s, r) => s + (r.expected_amount || 0), 0)
            const totalRec = group.slabs.reduce((s, r) => s + (r.actual_amount || 0), 0)
            const hasOverdue = group.slabs.some(s => isOverdue(s))

            return (
              <div key={group.poNumber} className={`bg-white border rounded-xl shadow-sm overflow-hidden ${hasOverdue ? "border-red-200" : ""}`}>
                {/* PO header */}
                <div
                  className={`flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${hasOverdue ? "bg-red-50/40" : "bg-slate-50"}`}
                  onClick={() => toggleExpand(group.poNumber)}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{group.poNumber}</span>
                      {hasOverdue && <span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">⚠ Overdue</span>}
                      <Badge variant="outline" className="bg-white text-xs">{group.firmName}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{group.partyName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Expected</p>
                    <p className="font-bold text-indigo-700 tabular-nums">{formatCurrency(totalExpected)}</p>
                    {totalRec > 0 && <p className="text-xs text-green-600 tabular-nums">Rec: {formatCurrency(totalRec)}</p>}
                  </div>
                </div>

                {/* Slab cards */}
                {isExpanded && (
                  <div className="px-5 py-4 space-y-3 border-t border-gray-100">
                    {group.slabs.map(slab => renderSlabCard(slab))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Mark Received Dialog ─────────────────────────────────────── */}
      <Dialog open={dialog === "receive"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-green-600" />Mark Payment Received</DialogTitle>
            <DialogDescription>
              {selectedSlab?.po_number} — {selectedSlab?.slab_label}
              <br /><span className="font-mono text-xs">{selectedSlab?.pi_number}</span>
            </DialogDescription>
          </DialogHeader>
          {selectedSlab && (
            <div className="space-y-4 py-2">
              <SlabDetailsBlock slab={selectedSlab} />
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-500">Remaining to Receive</p>
                <p className="text-lg font-bold text-green-800 tabular-nums">{formatCurrency((selectedSlab.expected_amount || 0) - (selectedSlab.actual_amount || 0))}</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Amount Received (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Date Received <span className="text-red-500">*</span></label>
                  <Input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Remarks (NEFT ref, cheque no., etc.)</label>
                  <Input placeholder="Optional..." value={remarks} onChange={e => setRemarks(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>Cancel</Button>
            <Button onClick={handleMarkReceived} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><BadgeCheck className="w-4 h-4 mr-2" />Confirm Receipt</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Partial Payment Dialog ───────────────────────────────────── */}
      <Dialog open={dialog === "partial"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CircleDollarSign className="w-5 h-5 text-blue-600" />Record Partial Payment</DialogTitle>
            <DialogDescription>{selectedSlab?.po_number} — {selectedSlab?.slab_label}</DialogDescription>
          </DialogHeader>
          {selectedSlab && (
            <div className="space-y-4 py-2">
              <SlabDetailsBlock slab={selectedSlab} />
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-xs text-indigo-400">Expected Total</p>
                  <p className="font-bold text-indigo-700 tabular-nums">{formatCurrency(selectedSlab.expected_amount)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-400">Already Received</p>
                  <p className="font-bold text-blue-700 tabular-nums">{formatCurrency(selectedSlab.actual_amount || 0)}</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-500">Still Remaining</p>
                <p className="text-lg font-bold text-amber-800 tabular-nums">{formatCurrency((selectedSlab.expected_amount || 0) - (selectedSlab.actual_amount || 0))}</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Partial Amount Received (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" placeholder="Enter partial amount..." value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="h-9" />
                  {amountReceived && <p className="text-xs text-gray-500">After this: {formatCurrency((selectedSlab.expected_amount || 0) - (selectedSlab.actual_amount || 0) - parseFloat(amountReceived || 0))} will remain</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Date Received <span className="text-red-500">*</span></label>
                  <Input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Remarks</label>
                  <Input placeholder="Optional..." value={remarks} onChange={e => setRemarks(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>Cancel</Button>
            <Button onClick={handlePartialPayment} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><CircleDollarSign className="w-4 h-4 mr-2" />Record Partial</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reschedule Dialog ────────────────────────────────────────── */}
      <Dialog open={dialog === "reschedule"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-orange-600" />Reschedule Due Date</DialogTitle>
            <DialogDescription>{selectedSlab?.po_number} — {selectedSlab?.slab_label}</DialogDescription>
          </DialogHeader>
          {selectedSlab && (
            <div className="space-y-4 py-2">
              <SlabDetailsBlock slab={selectedSlab} />
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-500">Current Due Date</p>
                <p className="font-bold text-orange-800">{formatDate(selectedSlab.due_date)}</p>
                {isOverdue(selectedSlab) && <p className="text-xs text-red-500 mt-1">⚠ This is overdue</p>}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">New Due Date <span className="text-red-500">*</span></label>
                  <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Reason for Rescheduling</label>
                  <Input placeholder="e.g. Party requested extension, pending LC approval..." value={rescheduleNote} onChange={e => setRescheduleNote(e.target.value)} className="h-9" />
                </div>
              </div>
              {selectedSlab.reschedule_log?.length > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Past Reschedules</p>
                  {(Array.isArray(selectedSlab.reschedule_log) ? selectedSlab.reschedule_log : []).map((r, i) => (
                    <p key={i} className="text-xs text-gray-600">{formatDate(r.from_date)} → {formatDate(r.to_date)} {r.note && <span className="text-gray-400 italic">"{r.note}"</span>}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>Cancel</Button>
            <Button onClick={handleReschedule} disabled={submitting} className="bg-orange-500 hover:bg-orange-600">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><CalendarClock className="w-4 h-4 mr-2" />Update Due Date</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
