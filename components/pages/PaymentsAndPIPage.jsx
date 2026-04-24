"use client"

import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { useNotification } from "@/components/providers/NotificationProvider"
import { groupRowsByPo } from "@/lib/workflowGrouping"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Search, Loader2, CheckCircle2, Clock, IndianRupee, FileText, AlertCircle, ChevronDown, ChevronRight, RefreshCw,
} from "lucide-react"

/** Map a PI type string to the payment slabs expected */
const parsePIType = (piType = "") => {
  const t = piType.toLowerCase().trim()

  // 100% advance
  if (t.includes("100") && t.includes("advance")) {
    return [{ label: "Advance (100%)", pct: 100, key: "advance_100" }]
  }

  // pure advance + balance patterns like "30% advance, 70% on delivery"
  const advMatch = t.match(/(\d+)%?\s*advance/)
  const balMatch = t.match(/(\d+)%?\s*(balance|on delivery|on dispatch|final)/)
  if (advMatch) {
    const advPct = parseInt(advMatch[1])
    const slabs = [{ label: `Advance (${advPct}%)`, pct: advPct, key: "advance" }]
    if (balMatch) {
      const balPct = parseInt(balMatch[1])
      slabs.push({ label: `Balance (${balPct}%)`, pct: balPct, key: "balance" })
    } else if (advPct < 100) {
      slabs.push({ label: `Balance (${100 - advPct}%)`, pct: 100 - advPct, key: "balance" })
    }
    return slabs
  }

  // against LC / LC at sight
  if (t.includes("lc")) {
    return [{ label: "LC Payment", pct: 100, key: "lc" }]
  }

  // credit / open — still need to record when received
  if (t.includes("credit") || t.includes("open")) {
    return [{ label: "On Credit", pct: 100, key: "credit" }]
  }

  // fallback — single full payment
  return [{ label: "Full Payment", pct: 100, key: "full" }]
}

const formatDate = (d) => {
  if (!d) return ""
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return d
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
  } catch { return d }
}

const formatCurrency = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function PaymentsAndPIPage({ user }) {
  const { toast } = useToast()
  const { updateCount } = useNotification()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [expandedPOs, setExpandedPOs] = useState(new Set())

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [paymentInputs, setPaymentInputs] = useState({}) // { [key]: amountReceived }
  const [paymentDates, setPaymentDates] = useState({})   // { [key]: date string }
  const [submitting, setSubmitting] = useState(false)

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("ORDER RECEIPT")
        .select("*")
        .not("Actual 2", "is", null)   // only POs that cleared Received Accounts
        .order("id", { ascending: false })
      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      toast({ title: "Error loading data", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  // ── derived state ──────────────────────────────────────────────────────────
  const ordersTransformed = useMemo(() => orders.map(r => {
    const totalValue = Number(r["Total PO Basic Value"]) || 0
    const rawAdj = Number(r["Adjusted Amount"]) || 0
    // Sanity check: Adjusted Amount must be between 0 and 10× basic value.
    // If it's 0 or absurdly large (corrupt data), fall back to totalValue.
    const adjustedAmount = (rawAdj > 0 && rawAdj <= totalValue * 10) ? rawAdj : totalValue

    return {
      id: r.id,
      partyPONumber: r["PARTY PO NO (As Per Po Exact)"] || "N/A",
      partyName: r["Party Names"] || "",
      firmName: r["Firm Name"] || "",
      productName: r["Product Name"] || "",
      quantity: Number(r["Quantity"]) || 0,
      rate: Number(r["Rate Of Material"]) || 0,
      totalValue,
      adjustedAmount,
      typeOfPI: r["Type Of PI"] || "—",
      advance: Number(r["Advance"]) || 0,
      basic: Number(r["Basic"]) || 0,
      retentionPct: Number(r["Retention Percentage"]) || 0,
      leadTimeFinal: r["Lead Time For Collection Of Final Payment"] || "",
      paymentReceived: r["payment_received"] || null,
      paymentReceivedAt: r["payment_received_at"] || null,
      paymentStatus: r["payment_status"] || "Pending",
      actual2: r["Actual 2"],
      rawData: r,
    }
  }), [orders])

  // filter by role
  const roleFiltered = useMemo(() => {
    if (!user || user.role === "ADMIN") return ordersTransformed
    const firms = user.firm ? user.firm.split(",").map(f => f.trim().toLowerCase()) : []
    if (firms.includes("all")) return ordersTransformed
    return ordersTransformed.filter(o => firms.includes((o.firmName || "").toLowerCase()))
  }, [ordersTransformed, user])

  // search
  const searched = useMemo(() => {
    if (!searchTerm.trim()) return roleFiltered
    const t = searchTerm.toLowerCase()
    return roleFiltered.filter(o =>
      [o.partyPONumber, o.partyName, o.productName, o.typeOfPI, o.firmName]
        .some(v => v?.toLowerCase().includes(t))
    )
  }, [roleFiltered, searchTerm])

  // split into pending / received
  const pendingOrders = useMemo(() => searched.filter(o => o.paymentStatus !== "Received"), [searched])
  const receivedOrders = useMemo(() => searched.filter(o => o.paymentStatus === "Received"), [searched])

  useEffect(() => { updateCount("Payments & PI", pendingOrders.length) }, [pendingOrders.length, updateCount])

  const displayOrders = activeTab === "pending" ? pendingOrders : receivedOrders
  const groupedOrders = useMemo(() => groupRowsByPo(displayOrders), [displayOrders])

  const toggleExpand = (key) =>
    setExpandedPOs(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })

  // ── dialog helpers ────────────────────────────────────────────────────────
  const openDialog = (group) => {
    setSelectedGroup(group)
    const slabs = parsePIType(group.rows[0]?.typeOfPI)
    const inputs = {}
    const dates = {}
    slabs.forEach(s => {
      inputs[s.key] = ""
      dates[s.key] = ""
    })
    setPaymentInputs(inputs)
    setPaymentDates(dates)
    setDialogOpen(true)
  }

  const totalPOValue = useMemo(() => {
    if (!selectedGroup) return 0
    return selectedGroup.rows.reduce((s, r) => s + (r.adjustedAmount || r.totalValue || 0), 0)
  }, [selectedGroup])

  const piSlabs = useMemo(() => {
    if (!selectedGroup) return []
    return parsePIType(selectedGroup.rows[0]?.typeOfPI)
  }, [selectedGroup])

  const handleRecord = async () => {
    // basic validation
    for (const slab of piSlabs) {
      if (!paymentInputs[slab.key]) {
        toast({ title: "Missing amount", description: `Enter amount for "${slab.label}"`, variant: "destructive" })
        return
      }
      if (!paymentDates[slab.key]) {
        toast({ title: "Missing date", description: `Enter date for "${slab.label}"`, variant: "destructive" })
        return
      }
    }

    setSubmitting(true)
    try {
      const ts = getISTTimestamp()
      const totalRecorded = piSlabs.reduce((s, sl) => s + (parseFloat(paymentInputs[sl.key]) || 0), 0)
      const updates = selectedGroup.rows.map(row =>
        supabase.from("ORDER RECEIPT").update({
          payment_received: totalRecorded,
          payment_received_at: ts,
          payment_status: "Received",
        }).eq("id", row.id)
      )
      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed) throw failed.error

      toast({
        title: "Payment Recorded",
        description: `Payment marked as received for PO ${selectedGroup.poNumber}`,
        className: "bg-green-50 border-green-200 text-green-800",
      })
      setDialogOpen(false)
      fetchData()
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ── stats ─────────────────────────────────────────────────────────────────
  const totalPending = useMemo(() =>
    pendingOrders.reduce((s, o) => s + (o.adjustedAmount || o.totalValue || 0), 0), [pendingOrders])
  const totalReceived = useMemo(() =>
    receivedOrders.reduce((s, o) => s + (o.paymentReceived || 0), 0), [receivedOrders])

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
        <span className="text-gray-600">Loading payment data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments & PI</h1>
          <p className="text-gray-600">Track payment collection based on PI type for each verified PO</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="flex items-center gap-2 w-fit">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-indigo-50 border-indigo-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-indigo-600">Pending Collection</p>
              <div className="text-xl font-bold text-indigo-900">{pendingOrders.length} POs</div>
              <p className="text-xs text-indigo-500 mt-1 truncate">{formatCurrency(totalPending)} outstanding</p>
            </div>
            <div className="h-10 w-10 bg-indigo-500 rounded-full flex items-center justify-center text-white shrink-0">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-600">Received Payments</p>
              <div className="text-xl font-bold text-green-900">{receivedOrders.length} POs</div>
              <p className="text-xs text-green-500 mt-1 truncate">{formatCurrency(totalReceived)} collected</p>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-600">Total PO Value (pending)</p>
              <div className="text-base font-bold text-amber-900 truncate">{formatCurrency(totalPending)}</div>
              <p className="text-xs text-amber-500 mt-1">Across {pendingOrders.length} order lines</p>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Tabs */}
      <div className="bg-white border rounded-md shadow-sm p-4 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by PO, party, product..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-md w-fit gap-1">
          {[
            { key: "pending", label: `Pending (${pendingOrders.length})` },
            { key: "received", label: `Received (${receivedOrders.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="min-w-[130px]">Action</TableHead>
                <TableHead className="w-10" />
                <TableHead className="min-w-[120px]">PO Number</TableHead>
                <TableHead className="min-w-[130px]">Party</TableHead>
                <TableHead className="min-w-[100px]">Firm</TableHead>
                <TableHead className="min-w-[120px]">Type of PI</TableHead>
                <TableHead className="text-right min-w-[110px]">PO Value</TableHead>
                <TableHead className="text-right min-w-[110px]">Adj. Amount</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                {activeTab === "received" && <TableHead className="min-w-[100px]">Received On</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-gray-300" />
                      <span>No POs found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groupedOrders.map(group => {
                  const isExpanded = expandedPOs.has(group.key)
                  const totalVal = group.rows.reduce((s, r) => s + (r.totalValue || 0), 0)
                  const totalAdj = group.rows.reduce((s, r) => s + (r.adjustedAmount || 0), 0)
                  const piType = group.rows[0]?.typeOfPI || "—"
                  const status = group.rows[0]?.paymentStatus || "Pending"
                  const receivedAt = group.rows[0]?.paymentReceivedAt
                  const slabs = parsePIType(piType)

                  return (
                    <Fragment key={group.key}>
                      {/* PO group header row */}
                      <TableRow
                        className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => toggleExpand(group.key)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          {activeTab === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => openDialog(group)}
                              className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs"
                            >
                              Record Payment
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-slate-400" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">{group.poNumber}</TableCell>
                        <TableCell className="text-sm text-slate-700">{group.partyName}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          <Badge variant="outline" className="bg-white text-xs">{group.rows[0]?.firmName || "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs font-medium ${piType.toLowerCase().includes("100") && piType.toLowerCase().includes("advance") ? "bg-violet-100 text-violet-800 border-violet-200" : "bg-blue-100 text-blue-800 border-blue-200"}`}>
                            {piType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm tabular-nums">{formatCurrency(totalVal)}</TableCell>
                        <TableCell className="text-right font-bold text-green-700 text-sm tabular-nums">{formatCurrency(totalAdj)}</TableCell>
                        <TableCell>
                          {status === "Received"
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Received</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pending</span>
                          }
                        </TableCell>
                        {activeTab === "received" && (
                          <TableCell className="text-sm text-gray-600">{formatDate(receivedAt)}</TableCell>
                        )}
                      </TableRow>

                      {/* Expanded: product rows + PI breakdown */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={10} className="p-0 bg-slate-50/50 border-b border-slate-200">
                            <div className="px-6 py-4 space-y-4">
                              {/* Products */}
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Products in this PO</p>
                                <div className="space-y-2">
                                  {group.rows.map(row => (
                                    <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap gap-4 text-sm">
                                      <div className="min-w-[200px]">
                                        <p className="text-xs text-gray-400">Product</p>
                                        <p className="font-medium text-gray-800">{row.productName}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Qty</p>
                                        <p className="font-medium">{row.quantity}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Rate</p>
                                        <p className="font-medium">{formatCurrency(row.rate)}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Basic Value</p>
                                        <p className="font-medium text-indigo-700 text-sm tabular-nums">{formatCurrency(row.totalValue)}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Adj. with Tax</p>
                                        <p className="font-bold text-green-700 text-sm tabular-nums">{formatCurrency(row.adjustedAmount)}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Advance %</p>
                                        <p className="font-medium">{row.advance}%</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Basic %</p>
                                        <p className="font-medium">{row.basic}%</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* PI Payment structure */}
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Payment Schedule ({piType})</p>
                                <div className="flex flex-wrap gap-3">
                                  {slabs.map(slab => (
                                    <div key={slab.key} className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 min-w-[160px]">
                                      <p className="text-xs text-indigo-500 font-medium">{slab.label}</p>
                                      <p className="text-base font-bold text-indigo-800 mt-1">
                                        {formatCurrency((totalAdj * slab.pct) / 100)}
                                      </p>
                                      <p className="text-[10px] text-indigo-400">Expected ({slab.pct}% of adj. amount)</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-indigo-600" />
              Record Payment Received
            </DialogTitle>
            <DialogDescription>
              PO: <strong>{selectedGroup?.poNumber}</strong> — {selectedGroup?.partyName}
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-5 py-2">
              {/* PI info */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Type of PI</p>
                <p className="font-semibold text-indigo-900 mt-1">{selectedGroup.rows[0]?.typeOfPI || "—"}</p>
                <p className="text-sm text-indigo-700 mt-1">
                  Total Adj. Amount: <strong>{formatCurrency(totalPOValue)}</strong>
                </p>
              </div>

              {/* Slab inputs */}
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">Enter amounts received for each payment slab:</p>
                {piSlabs.map(slab => {
                  const expected = (totalPOValue * slab.pct) / 100
                  return (
                    <div key={slab.key} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">{slab.label}</p>
                        <span className="text-xs text-gray-500">Expected: {formatCurrency(expected)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500">Amount Received (₹)</label>
                          <Input
                            type="number"
                            placeholder={`e.g. ${Math.round(expected)}`}
                            value={paymentInputs[slab.key] || ""}
                            onChange={e => setPaymentInputs(prev => ({ ...prev, [slab.key]: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500">Date Received</label>
                          <Input
                            type="date"
                            value={paymentDates[slab.key] || ""}
                            onChange={e => setPaymentDates(prev => ({ ...prev, [slab.key]: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                      </div>
                      {paymentInputs[slab.key] && (
                        <div className={`text-xs flex items-center gap-1 ${Math.abs(parseFloat(paymentInputs[slab.key]) - expected) < 1 ? "text-green-600" : "text-amber-600"}`}>
                          <AlertCircle className="w-3 h-3" />
                          {parseFloat(paymentInputs[slab.key]) < expected
                            ? `Short by ${formatCurrency(expected - parseFloat(paymentInputs[slab.key]))}`
                            : parseFloat(paymentInputs[slab.key]) > expected
                              ? `Excess of ${formatCurrency(parseFloat(paymentInputs[slab.key]) - expected)}`
                              : "Exact amount ✓"}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleRecord} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recording...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Mark as Received</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
