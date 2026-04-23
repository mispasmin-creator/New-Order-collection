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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Search, Loader2, CheckCircle2, Clock, IndianRupee, FileText, ChevronDown, ChevronRight, RefreshCw, FilePlus } from "lucide-react"

/** Parse PI type string into payment slabs */
export const parsePIType = (piType = "") => {
  const t = piType.toLowerCase().trim()
  if (t.includes("100") && t.includes("advance"))
    return [{ label: "Advance (100%)", pct: 100, key: "advance_100" }]
  const advMatch = t.match(/(\d+)%?\s*advance/)
  const balMatch = t.match(/(\d+)%?\s*(balance|on delivery|on dispatch|final)/)
  if (advMatch) {
    const advPct = parseInt(advMatch[1])
    const slabs = [{ label: `Advance (${advPct}%)`, pct: advPct, key: "advance" }]
    if (balMatch) slabs.push({ label: `Balance (${parseInt(balMatch[1])}%)`, pct: parseInt(balMatch[1]), key: "balance" })
    else if (advPct < 100) slabs.push({ label: `Balance (${100 - advPct}%)`, pct: 100 - advPct, key: "balance" })
    return slabs
  }
  if (t.includes("lc")) return [{ label: "LC Payment", pct: 100, key: "lc" }]
  if (t.includes("credit") || t.includes("open")) return [{ label: "On Credit", pct: 100, key: "credit" }]
  return [{ label: "Full Payment", pct: 100, key: "full" }]
}

export const formatCurrency = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const formatDate = (d) => {
  if (!d) return ""
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return d
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
  } catch { return d }
}

const sanitizeAdj = (raw, total) => {
  const r = Number(raw) || 0
  return (r > 0 && r <= total * 10) ? r : total
}

// Generate PI number: PI-YYYYMMDD-XXXX
const generatePINumber = () => {
  const now = new Date()
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  const rand = String(Math.floor(1000 + Math.random() * 9000))
  return `PI-${d}-${rand}`
}

export default function MakePIPage({ user }) {
  const { toast } = useToast()
  const { updateCount } = useNotification()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedPOs, setExpandedPOs] = useState(new Set())

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [piDueDates, setPiDueDates] = useState({})  // { [slabKey]: date }
  const [piNotes, setPiNotes] = useState({}) // { [slabKey]: note }
  const [submitting, setSubmitting] = useState(false)

  // existing PIs for this session (to show "Already Created" badge)
  const [createdPIs, setCreatedPIs] = useState(new Set()) // set of po_numbers that have PIs
  const [piRaisedAmounts, setPiRaisedAmounts] = useState({}) // { po_number: total_raised }
  const [dispatchedQuantities, setDispatchedQuantities] = useState({}) // { do_id: qty }
  const [piToMakeAmounts, setPiToMakeAmounts] = useState({}) // { do_id: amount }
  const [manualDueDate, setManualDueDate] = useState("")
  const [manualNotes, setManualNotes] = useState("")

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [ordersRes, pisRes] = await Promise.all([
        supabase.from("ORDER RECEIPT").select("*").not("Actual 2", "is", null).order("id", { ascending: false }),
        supabase.from("po_pi_records").select("po_number, status, expected_amount")
      ])
      if (ordersRes.error) throw ordersRes.error
      setOrders(ordersRes.data || [])

      if (!pisRes.error && pisRes.data) {
        setCreatedPIs(new Set(pisRes.data.map(r => r.po_number)))
        const raised = {}
        pisRes.data.forEach(r => {
          raised[r.po_number] = (raised[r.po_number] || 0) + (Number(r.expected_amount) || 0)
        })
        setPiRaisedAmounts(raised)
      }
    } catch (err) {
      toast({ title: "Error loading data", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  const ordersTransformed = useMemo(() => orders.map(r => {
    const totalValue = Number(r["Total PO Basic Value"]) || 0
    const adjustedAmount = sanitizeAdj(r["Adjusted Amount"], totalValue)
    return {
      id: r.id,
      partyPONumber: r["PARTY PO NO (As Per Po Exact)"] || "N/A",
      partyName: r["Party Names"] || "",
      firmName: r["Firm Name"] || "",
      productName: r["Product Name"] || "",
      quantity: Number(r["Quantity"]) || 0,
      rate: Number(r["Rate Of Material"]) || 0,
      totalValue, adjustedAmount,
      typeOfPI: r["Type Of PI"] || "—",
      advance: Number(r["Advance"]) || 0,
      basic: Number(r["Basic"]) || 0,
      actual2: r["Actual 2"],
      rawData: r,
    }
  }), [orders])

  const roleFiltered = useMemo(() => {
    if (!user || user.role === "master") return ordersTransformed
    const firms = user.firm ? user.firm.split(",").map(f => f.trim().toLowerCase()) : []
    if (firms.includes("all")) return ordersTransformed
    return ordersTransformed.filter(o => firms.includes((o.firmName || "").toLowerCase()))
  }, [ordersTransformed, user])

  const searched = useMemo(() => {
    if (!searchTerm.trim()) return roleFiltered
    const t = searchTerm.toLowerCase()
    return roleFiltered.filter(o =>
      [o.partyPONumber, o.partyName, o.productName, o.typeOfPI, o.firmName]
        .some(v => v?.toLowerCase().includes(t))
    )
  }, [roleFiltered, searchTerm])

  const groupedOrders = useMemo(() => groupRowsByPo(searched), [searched])

  // POs that still need a PI created
  const pendingGroups = useMemo(() => groupedOrders.filter(g => !createdPIs.has(g.poNumber)), [groupedOrders, createdPIs])
  const doneGroups = useMemo(() => groupedOrders.filter(g => createdPIs.has(g.poNumber)), [groupedOrders, createdPIs])

  useEffect(() => { updateCount("Make PI", pendingGroups.length) }, [pendingGroups.length, updateCount])

  const toggleExpand = (key) => setExpandedPOs(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  })

  const openDialog = async (group) => {
    setSelectedGroup(group)
    const slabs = parsePIType(group.rows[0]?.typeOfPI)
    const dates = {}; const notes = {}
    slabs.forEach(s => { dates[s.key] = ""; notes[s.key] = "" })
    setPiDueDates(dates); setPiNotes(notes)

    const initialPiToMake = {}
    group.rows.forEach(r => { initialPiToMake[r.id] = "" })
    setPiToMakeAmounts(initialPiToMake)
    setManualDueDate("")
    setManualNotes("")

    setDialogOpen(true)

    try {
      const rowIds = group.rows.map(r => r.id)
      const { data: splits } = await supabase.from("po_logistics_splits")
        .select("po_id, allocated_qty, status")
        .in("po_id", rowIds)
        .in("status", ["Dispatched", "Logistic Completed", "Accounts Approved"])
      
      const qtyMap = {}
      if (splits) {
        splits.forEach(s => {
          qtyMap[s.po_id] = (qtyMap[s.po_id] || 0) + (Number(s.allocated_qty) || 0)
        })
      }
      setDispatchedQuantities(qtyMap)
    } catch (e) {
      console.error("Error fetching dispatched quantities", e)
    }
  }

  const totalPOValue = useMemo(() => {
    if (!selectedGroup) return 0
    return selectedGroup.rows.reduce((s, r) => s + (r.adjustedAmount || r.totalValue || 0), 0)
  }, [selectedGroup])

  const piSlabs = useMemo(() => {
    if (!selectedGroup) return []
    return parsePIType(selectedGroup.rows[0]?.typeOfPI)
  }, [selectedGroup])

  const handleCreatePI = async () => {
    const totalPiToMake = selectedGroup.rows.reduce((sum, r) => sum + (Number(piToMakeAmounts[r.id]) || 0), 0)

    if (totalPiToMake <= 0) {
      toast({ title: "No Amount", description: "Please enter at least some PI to make amount.", variant: "destructive" })
      return
    }
    if (!manualDueDate) {
      toast({ title: "Missing due date", description: "Set due date for the PI", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const ts = getISTTimestamp()
      const poNumber = selectedGroup.poNumber
      const partyName = selectedGroup.partyName
      const firmName = selectedGroup.rows[0]?.firmName || ""
      const typeOfPI = selectedGroup.rows[0]?.typeOfPI || ""
      const poIds = selectedGroup.rows.map(r => r.id)

      const record = {
        po_number: poNumber,
        po_ids: poIds,
        pi_number: generatePINumber(),
        party_name: partyName,
        firm_name: firmName,
        pi_type: typeOfPI,
        slab_label: "Manual PI",
        slab_pct: Math.round((totalPiToMake / totalPOValue) * 100),
        total_po_value: totalPOValue,
        expected_amount: totalPiToMake,
        due_date: manualDueDate,
        notes: manualNotes,
        status: "Pending",
        created_at: ts,
      }

      const { error } = await supabase.from("po_pi_records").insert([record])
      if (error) throw error

      toast({
        title: "PI Created",
        description: `PI created for PO ${poNumber}`,
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

  const renderGroup = (group, isPending) => {
    const isExpanded = expandedPOs.has(group.key)
    const totalAdj = group.rows.reduce((s, r) => s + (r.adjustedAmount || 0), 0)
    const piType = group.rows[0]?.typeOfPI || "—"
    const slabs = parsePIType(piType)

    return (
      <Fragment key={group.key}>
        <TableRow className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleExpand(group.key)}>
          <TableCell onClick={e => e.stopPropagation()}>
            {isPending ? (
              <Button size="sm" onClick={() => openDialog(group)} className="bg-violet-600 hover:bg-violet-700 h-7 text-xs gap-1">
                <FilePlus className="w-3 h-3" /> Create PI
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> PI Created
              </span>
            )}
          </TableCell>
          <TableCell>{isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</TableCell>
          <TableCell className="font-semibold text-slate-900">{group.poNumber}</TableCell>
          <TableCell className="text-sm text-slate-700">{group.partyName}</TableCell>
          <TableCell><Badge variant="outline" className="bg-white text-xs">{group.rows[0]?.firmName || "—"}</Badge></TableCell>
          <TableCell>
            <Badge className="text-xs font-medium bg-blue-100 text-blue-800 border-blue-200">{piType}</Badge>
          </TableCell>
          <TableCell className="text-right font-bold text-green-700 text-sm tabular-nums">{formatCurrency(totalAdj)}</TableCell>
        </TableRow>

        {isExpanded && (
          <TableRow>
            <TableCell colSpan={7} className="p-0 bg-slate-50/50 border-b border-slate-200">
              <div className="px-6 py-4 space-y-4">
                {/* Products */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Products in this PO</p>
                  <div className="space-y-2">
                    {group.rows.map(row => (
                      <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap gap-4 text-sm">
                        <div className="min-w-[180px]"><p className="text-xs text-gray-400">Product</p><p className="font-medium">{row.productName}</p></div>
                        <div><p className="text-xs text-gray-400">Qty</p><p className="font-medium">{row.quantity}</p></div>
                        <div><p className="text-xs text-gray-400">Rate</p><p className="font-medium tabular-nums">{formatCurrency(row.rate)}</p></div>
                        <div><p className="text-xs text-gray-400">Basic Value</p><p className="font-medium text-indigo-700 tabular-nums">{formatCurrency(row.totalValue)}</p></div>
                        <div><p className="text-xs text-gray-400">Adj. Amount</p><p className="font-bold text-green-700 tabular-nums">{formatCurrency(row.adjustedAmount)}</p></div>
                        <div><p className="text-xs text-gray-400">Advance %</p><p className="font-medium">{row.advance}%</p></div>
                        <div><p className="text-xs text-gray-400">Basic %</p><p className="font-medium">{row.basic}%</p></div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Payment slabs */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">PI Slabs ({piType})</p>
                  <div className="flex flex-wrap gap-3">
                    {slabs.map(slab => (
                      <div key={slab.key} className="bg-violet-50 border border-violet-200 rounded-lg p-3 min-w-[160px]">
                        <p className="text-xs text-violet-500 font-medium">{slab.label}</p>
                        <p className="text-base font-bold text-violet-800 mt-1 tabular-nums">{formatCurrency((totalAdj * slab.pct) / 100)}</p>
                        <p className="text-[10px] text-violet-400">{slab.pct}% of adj. amount</p>
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
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-violet-600" />
        <span className="text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Make PI</h1>
          <p className="text-gray-600">Create Proforma Invoices for verified POs based on payment terms</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="flex items-center gap-2 w-fit">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-violet-50 border-violet-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-violet-600">PI Pending Creation</p>
              <div className="text-xl font-bold text-violet-900">{pendingGroups.length} POs</div>
            </div>
            <div className="h-10 w-10 bg-violet-500 rounded-full flex items-center justify-center text-white shrink-0"><Clock className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-5 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-600">PI Created</p>
              <div className="text-xl font-bold text-green-900">{doneGroups.length} POs</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0"><CheckCircle2 className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="Search by PO, party, product..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10" />
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
                <TableHead className="text-right min-w-[110px]">Adj. Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedOrders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-2"><FileText className="w-8 h-8 text-gray-300" /><span>No POs found</span></div>
                </TableCell></TableRow>
              ) : (
                <>
                  {pendingGroups.map(g => renderGroup(g, true))}
                  {doneGroups.map(g => renderGroup(g, false))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create PI Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FilePlus className="w-5 h-5 text-violet-600" />Create PI</DialogTitle>
            <DialogDescription>PO: <strong>{selectedGroup?.poNumber}</strong> — {selectedGroup?.partyName}</DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-6 py-2">
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex gap-6">
                <div>
                  <p className="text-xs font-medium text-violet-600 uppercase tracking-wider">Type of PI</p>
                  <p className="font-semibold text-violet-900 mt-1">{selectedGroup.rows[0]?.typeOfPI || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-violet-600 uppercase tracking-wider">Total PO Amount</p>
                  <p className="font-semibold text-violet-900 mt-1 tabular-nums">{formatCurrency(totalPOValue)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-violet-600 uppercase tracking-wider">Total PI Raised</p>
                  <p className="font-semibold text-violet-900 mt-1 tabular-nums">{formatCurrency(piRaisedAmounts[selectedGroup.poNumber] || 0)}</p>
                </div>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="min-w-[120px]">DO Number</TableHead>
                      <TableHead className="min-w-[150px]">Product</TableHead>
                      <TableHead className="text-right">Order Qty</TableHead>
                      <TableHead className="text-right">Dispatched Qty</TableHead>
                      <TableHead className="text-right">Pending Qty</TableHead>
                      <TableHead className="text-right">PI Raised</TableHead>
                      <TableHead className="text-right">Pending to PI</TableHead>
                      <TableHead className="text-right min-w-[120px]">PI to make</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup.rows.map(row => {
                      const dispatchedQty = dispatchedQuantities[row.id] || 0
                      const pendingQty = Math.max(0, row.quantity - dispatchedQty)
                      const totalPIRaised = piRaisedAmounts[selectedGroup.poNumber] || 0
                      // Proportional PI Raised for this DO
                      const proportionalPIRaised = totalPOValue > 0 ? (row.adjustedAmount / totalPOValue) * totalPIRaised : 0
                      const pendingToPIRaised = Math.max(0, row.adjustedAmount - proportionalPIRaised)

                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-xs">{row.rawData["DO-Delivery Order No."] || "N/A"}</TableCell>
                          <TableCell className="text-sm">{row.productName}</TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="text-right font-medium text-blue-600">{dispatchedQty}</TableCell>
                          <TableCell className="text-right">{pendingQty}</TableCell>
                          <TableCell className="text-right tabular-nums text-slate-600">{formatCurrency(proportionalPIRaised)}</TableCell>
                          <TableCell className="text-right tabular-nums text-orange-600 font-medium">{formatCurrency(pendingToPIRaised)}</TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              className="h-8 text-right w-24 ml-auto"
                              value={piToMakeAmounts[row.id] || ""}
                              onChange={e => setPiToMakeAmounts(prev => ({ ...prev, [row.id]: e.target.value }))}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-slate-50 border rounded-lg p-4 space-y-4">
                <p className="text-sm font-medium text-slate-800">PI Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Due Date <span className="text-red-500">*</span></label>
                    <Input type="date" value={manualDueDate} onChange={e => setManualDueDate(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Notes (optional)</label>
                    <Input placeholder="Any remark..." value={manualNotes} onChange={e => setManualNotes(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t mt-4">
                  <span className="text-sm font-semibold text-slate-700">Total PI to Make:</span>
                  <span className="text-lg font-bold text-violet-700 tabular-nums">
                    {formatCurrency(selectedGroup.rows.reduce((sum, r) => sum + (Number(piToMakeAmounts[r.id]) || 0), 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreatePI} disabled={submitting} className="bg-violet-600 hover:bg-violet-700">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : <><FilePlus className="w-4 h-4 mr-2" />Create PI</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
