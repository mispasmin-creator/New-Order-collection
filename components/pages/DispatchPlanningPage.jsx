"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, Truck, FileText, LayoutDashboard, ChevronDown, ChevronRight, PackageCheck, Trash2, RotateCcw } from "lucide-react"
import { useNotification } from "@/components/providers/NotificationProvider"
import { supabase } from "@/lib/supabaseClient"
import { groupRowsByPo } from "@/lib/workflowGrouping"

// ── Workflow stage definitions ────────────────────────────────────────────────
const STAGES = [
  { key: "order_received",     label: "Order Received",     bg: "bg-gray-100",   text: "text-gray-700",   dot: "bg-gray-400"   },
  { key: "check_delivery",     label: "Check Delivery",     bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  { key: "arrange_logistics",  label: "Arrange Logistics",  bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500"   },
  { key: "logistics_approval", label: "Logistics Approval", bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  { key: "dispatch_planning",  label: "Dispatch Planning",  bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500"  },
  { key: "accounts_approval",  label: "Accounts Approval",  bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" },
  { key: "logistic",           label: "Logistic",           bg: "bg-cyan-100",   text: "text-cyan-700",   dot: "bg-cyan-500"   },
  { key: "load_material",      label: "Load Material",      bg: "bg-teal-100",   text: "text-teal-700",   dot: "bg-teal-500"   },
  { key: "wetman_entry",       label: "Wetman Entry",       bg: "bg-lime-100",   text: "text-lime-700",   dot: "bg-lime-500"   },
  { key: "invoice",            label: "Invoice",            bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400" },
  { key: "completed",          label: "Completed",          bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
]
const STAGE_KEYS = STAGES.map((s) => s.key)
const getStageMeta = (key) => STAGES.find((s) => s.key === key) || STAGES[0]

const getOrderRowStage = (order, splits, dispatches) => {
  const dArr = dispatches || []
  const sArr = splits || []
  if (dArr.some((d) => d.Actual4)) return "completed"
  if (dArr.some((d) => d.Actual3)) return "invoice"
  if (dArr.some((d) => d.Actual2)) return "wetman_entry"
  if (dArr.some((d) => d.Actual1)) return "load_material"
  // "Approved" here covers old-flow splits; "Checked" covers new-flow splits
  const splitStatusRank = ["Approved", "Checked", "Dispatched", "Accounts Approved", "Logistic Completed"]
  let bestRank = -1
  for (const s of sArr) {
    const r = splitStatusRank.indexOf(s.status)
    if (r > bestRank) bestRank = r
  }
  if (bestRank >= 4) return "logistic"
  if (bestRank >= 3) return "logistic"
  if (bestRank >= 2) return "accounts_approval"
  if (bestRank >= 0) return "dispatch_planning"  // Approved or Checked → ready for dispatch
  const ls = order.logistics_status
  if (ls === "Pending Approval") return "logistics_approval"
  // New flow: check_delivery happens before arrange_logistics
  if (order.check_delivery_actual) return "arrange_logistics"
  return "check_delivery"
}

// ── Misc ──────────────────────────────────────────────────────────────────────
const STATUS_CHECKED = "Checked"
const STATUS_DISPATCHED = "Dispatched"

const formatDate = (value) => {
  if (!value) return ""
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return String(value)
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`
  } catch { return String(value) }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DispatchPlanningPage({ user }) {
  const { updateCount } = useNotification()
  const { toast } = useToast()

  // Table data
  const [splitRows, setSplitRows] = useState([])
  const [dispatchHistory, setDispatchHistory] = useState([])
  const [dashboardGroups, setDashboardGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Tab + search
  const [activeTab, setActiveTab] = useState("overview")
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedPOs, setExpandedPOs] = useState(new Set())

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState(null)   // PO group from groupedDisplayRows
  const [dispatchLines, setDispatchLines] = useState([])     // per-split editable rows
  const [commonForm, setCommonForm] = useState({             // shared across all splits
    typeOfTransporting: "",
    dateOfDispatch: "",
    testCertificateMade: "No",
    testCertificateFile: null,
  })

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      let orderQuery = supabase.from("ORDER RECEIPT").select("*").order("id", { ascending: false })
      if (user.role !== "master") {
        const userFirms = user.firm ? user.firm.split(",").map((f) => f.trim()) : []
        if (!userFirms.includes("all")) orderQuery = orderQuery.in("Firm Name", userFirms)
      }

      const [
        { data: orderData, error: orderError },
        { data: splitData, error: splitError },
        { data: allSplitsData },
        { data: dispatchData, error: dispatchError },
      ] = await Promise.all([
        orderQuery,
        supabase.from("po_logistics_splits").select("*").in("status", [STATUS_CHECKED, STATUS_DISPATCHED, "Logistic Completed"]).order("id", { ascending: false }),
        supabase.from("po_logistics_splits").select("po_id, status, allocated_qty, transporter_name, dispatch_record_id"),
        supabase.from("DISPATCH").select("*").order("id", { ascending: false }),
      ])

      if (orderError) throw orderError
      if (splitError) throw splitError
      if (dispatchError) throw dispatchError

      const orderMap = new Map()
      ;(orderData || []).forEach((row) => orderMap.set(row.id, row))

      // Pending + history split rows
      const mergedSplits = (splitData || []).map((split) => {
        const order = orderMap.get(split.po_id)
        if (!order) return null
        return {
          id: split.id,
          poId: split.po_id,
          planId: split.plan_id,
          splitStatus: split.status || "",
          dispatchRecordId: split.dispatch_record_id || null,
          allocatedQty: parseFloat(split.allocated_qty) || 0,
          transporterName: split.transporter_name || "",
          transporterRate: split.rate || "",
          rate: order["Rate Of Material"] || "",
          totalPOValue: order["Total PO Basic Value"] || "",
          partyPODate: order["Party PO Date"] || "",
          paymentToBeTaken: order["Payment to Be Taken"] || "",
          gstNumber: order["Gst Number"] || "",
          contactPersonName: order["Contact Person Name"] || "",
          address: order["Address"] || "",
          specificConcern: order["Specific Concern"] || "",
          checkDeliveryActual: split.check_delivery_actual || "",
          doNumber: order["DO-Delivery Order No."] || "",
          partyPONumber: order["PARTY PO NO (As Per Po Exact)"] || "",
          partyName: order["Party Names"] || "",
          productName: order["Product Name"] || "",
          firmName: order["Firm Name"] || "",
          quantity: parseFloat(order["Quantity"]) || 0,
          quantityDelivered: parseFloat(order["Delivered"]) || 0,
          pendingQty: parseFloat(order["Pending Qty"]) || 0,
          typeOfTransporting: order["Type Of Transporting"] || "",
        }
      }).filter(Boolean)

      setSplitRows(mergedSplits)

      setDispatchHistory((dispatchData || []).map((row) => {
        const order = row.po_id ? orderMap.get(row.po_id) : null
        return {
          id: row.id,
          dSrNumber: row["D-Sr Number"] || "",
          deliveryOrderNo: row["Delivery Order No."] || order?.["DO-Delivery Order No."] || "",
          partyPONumber: order?.["PARTY PO NO (As Per Po Exact)"] || "",
          partyName: row["Party Name"] || order?.["Party Names"] || "",
          productName: row["Product Name"] || order?.["Product Name"] || "",
          qtyToBeDispatched: row["Qty To Be Dispatched"] || 0,
          transporterName: row["Transporter Name"] || "",
          dateOfDispatch: formatDate(row["Date Of Dispatch"]),
          timestamp: formatDate(row["Timestamp"]),
        }
      }))

      // Dashboard
      const splitsByPoId = new Map()
      ;(allSplitsData || []).forEach((s) => {
        if (!splitsByPoId.has(s.po_id)) splitsByPoId.set(s.po_id, [])
        splitsByPoId.get(s.po_id).push(s)
      })
      const dispatchesByPoId = new Map()
      ;(dispatchData || []).forEach((d) => {
        if (d.po_id) {
          if (!dispatchesByPoId.has(d.po_id)) dispatchesByPoId.set(d.po_id, [])
          dispatchesByPoId.get(d.po_id).push(d)
        }
      })
      const poGroupMap = new Map()
      for (const order of orderMap.values()) {
        const key = order["PARTY PO NO (As Per Po Exact)"] || `__no_po_${order.id}`
        if (!poGroupMap.has(key)) poGroupMap.set(key, { poNumber: order["PARTY PO NO (As Per Po Exact)"] || "—", partyName: order["Party Names"] || "", firmName: order["Firm Name"] || "", orders: [] })
        poGroupMap.get(key).orders.push(order)
      }
      const dash = []
      for (const group of poGroupMap.values()) {
        const receivedAccountsDone = group.orders.every(o => o["Actual 2"] && String(o["Actual 2"]).trim() !== "")
        if (!receivedAccountsDone) continue

        const totalQty = group.orders.reduce((s, o) => s + (Number(o.Quantity) || 0), 0)
        const deliveredQty = group.orders.reduce((s, o) => s + (Number(o.Delivered) || 0), 0)
        const orderStages = group.orders.map((o) => getOrderRowStage(o, splitsByPoId.get(o.id) || [], dispatchesByPoId.get(o.id) || []))
        const minStageIdx = Math.min(...orderStages.map((s) => STAGE_KEYS.indexOf(s)))
        dash.push({ ...group, totalQty, deliveredQty, pendingQty: Math.max(0, totalQty - deliveredQty), currentStage: STAGE_KEYS[Math.max(0, minStageIdx)], orderStages, maxOrderId: Math.max(...group.orders.map((o) => o.id)) })
      }
      dash.sort((a, b) => b.maxOrderId - a.maxOrderId)
      setDashboardGroups(dash)
    } catch (error) {
      console.error("Fetch error:", error)
      toast({ title: "Error loading data", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, user])

  useEffect(() => { fetchData() }, [fetchData])

  // Derived
  const pendingRows = useMemo(() => splitRows.filter((r) => r.splitStatus === STATUS_CHECKED && !r.dispatchRecordId), [splitRows])
  useEffect(() => { updateCount("Dispatch Planning", pendingRows.length) }, [pendingRows.length, updateCount])

  const displayRows = useMemo(() => {
    const source = activeTab === "pending" ? pendingRows : dispatchHistory
    if (!searchTerm.trim()) return source
    const term = searchTerm.toLowerCase()
    return source.filter((row) => Object.values(row).some((v) => v?.toString().toLowerCase().includes(term)))
  }, [activeTab, dispatchHistory, pendingRows, searchTerm])

  const groupedDisplayRows = useMemo(() => groupRowsByPo(displayRows), [displayRows])

  const filteredDashboard = useMemo(() => {
    // Only POs with actionable pending splits (dispatchable) remain visible
    let result = dashboardGroups.filter(g => pendingRows.some(r => r.partyPONumber === g.poNumber))
    
    if (!searchTerm.trim()) return result
    const term = searchTerm.toLowerCase()
    return result.filter((g) => g.poNumber.toLowerCase().includes(term) || g.partyName.toLowerCase().includes(term) || g.firmName.toLowerCase().includes(term))
  }, [dashboardGroups, searchTerm, pendingRows])

  const stageCounts = useMemo(() => {
    const c = {}
    for (const g of filteredDashboard) c[g.currentStage] = (c[g.currentStage] || 0) + 1
    return c
  }, [filteredDashboard])

  const toggleExpand = (poNumber) => setExpandedPOs((prev) => { const n = new Set(prev); n.has(poNumber) ? n.delete(poNumber) : n.add(poNumber); return n })

  // ── D-Sr number generation ───────────────────────────────────────────────────
  const generateDSrNumbers = async (count) => {
    const { data } = await supabase.from("DISPATCH").select('"D-Sr Number"').order("id", { ascending: false }).limit(1)
    let lastNum = 0
    if (data?.[0]?.["D-Sr Number"]) {
      const match = data[0]["D-Sr Number"].match(/D-(\d+)/i)
      if (match) lastNum = parseInt(match[1], 10)
    }
    return Array.from({ length: count }, (_, i) => `D-${String(lastNum + i + 1).padStart(2, "0")}`)
  }

  // ── Modal: open group ────────────────────────────────────────────────────────
  const handleOpenGroup = (group) => {
    setSelectedGroup(group)
    setDispatchLines(
      group.rows.map((row) => ({
        splitId: row.id,
        planId: row.planId,
        poId: row.poId,
        doNumber: row.doNumber,
        partyName: row.partyName,
        productName: row.productName,
        transporterName: row.transporterName,
        allocatedQty: row.allocatedQty,
        quantityDelivered: row.quantityDelivered || 0,
        quantity: row.quantity,
        dispatchQty: "",
        included: true, // can be toggled off to skip this row
      }))
    )
    setCommonForm({
      typeOfTransporting: group.rows[0]?.typeOfTransporting || "",
      dateOfDispatch: "",
      testCertificateMade: "No",
      testCertificateFile: null,
    })
  }

  const handleClose = () => {
    setSelectedGroup(null)
    setDispatchLines([])
    setCommonForm({ typeOfTransporting: "", dateOfDispatch: "", testCertificateMade: "No", testCertificateFile: null })
  }

  const updateLineQty = (idx, value) =>
    setDispatchLines((prev) => {
      const n = [...prev]
      const maxQty = Math.max(0, (n[idx].quantity || 0) - (n[idx].quantityDelivered || 0))
      const clamped = value === "" ? "" : String(Math.min(parseFloat(value) || 0, maxQty))
      n[idx] = { ...n[idx], dispatchQty: clamped }
      return n
    })

  const toggleLine = (idx) =>
    setDispatchLines((prev) => { const n = [...prev]; n[idx] = { ...n[idx], included: !n[idx].included }; return n })

  // ── Modal: submit all rows ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    const activeLines = dispatchLines.filter((l) => l.included)

    // Validate at least one row is included
    if (activeLines.length === 0) {
      toast({ variant: "destructive", title: "Validation", description: "At least one product must be included in the dispatch." }); return
    }
    // Validate common form
    if (!commonForm.typeOfTransporting) {
      toast({ variant: "destructive", title: "Validation", description: "Transport Type is required." }); return
    }
    if (!commonForm.dateOfDispatch) {
      toast({ variant: "destructive", title: "Validation", description: "Dispatch Date is required." }); return
    }
    if (commonForm.testCertificateMade === "Yes" && !commonForm.testCertificateFile) {
      toast({ variant: "destructive", title: "Validation", description: "Please upload the test certificate." }); return
    }
    // Validate per-row quantities (only included rows)
    for (const line of activeLines) {
      const qty = parseFloat(line.dispatchQty) || 0
      if (qty <= 0) {
        toast({ variant: "destructive", title: "Validation", description: `Dispatch qty must be > 0 for "${line.productName}".` }); return
      }
      const maxDispatchable = line.quantity - line.quantityDelivered
      if (qty > maxDispatchable + 0.0001) {
        toast({ variant: "destructive", title: "Validation", description: `Dispatch qty for "${line.productName}" cannot exceed pending qty (${maxDispatchable}).` }); return
      }
    }

    try {
      setSubmitting(true)
      const timestamp = getISTTimestamp()

      // Generate sequential D-Sr numbers upfront (only for active lines)
      const dSrNumbers = await generateDSrNumbers(activeLines.length)

      // Upload test cert once (shared for all rows)
      let testCertUrl = null
      if (commonForm.testCertificateMade === "Yes" && commonForm.testCertificateFile) {
        const file = commonForm.testCertificateFile
        const fileExt = file.name.split(".").pop()
        const fileName = `dispatch/test-certificates/${dSrNumbers[0]}_${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from("images").upload(fileName, file, { cacheControl: "3600", upsert: false })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(fileName)
        testCertUrl = publicUrl
      }

      // Each split has its own ORDER RECEIPT row (different products), safe to run in parallel
      await Promise.all(
        activeLines.map(async (line, idx) => {
          const dispatchQty = parseFloat(line.dispatchQty) || 0

          // Fresh pending qty for this ORDER RECEIPT row
          const { data: latestOrder, error: loErr } = await supabase
            .from("ORDER RECEIPT")
            .select('id, "Quantity", "Delivered", "Pending Qty"')
            .eq("id", line.poId)
            .single()
          if (loErr) throw loErr

          const latestDelivered = parseFloat(latestOrder?.Delivered) || 0
          const totalQty = parseFloat(latestOrder?.Quantity) || 0
          const latestPending = parseFloat(latestOrder?.["Pending Qty"]) || Math.max(totalQty - latestDelivered, 0)
          if (dispatchQty - latestPending > 0.0001) throw new Error(`Dispatch qty for "${line.productName}" exceeds current pending qty (${latestPending}).`)

          // Insert DISPATCH row
          const { data: inserted, error: dispErr } = await supabase
            .from("DISPATCH")
            .insert([{
              Timestamp: timestamp,
              "D-Sr Number": dSrNumbers[idx],
              "Delivery Order No.": line.doNumber,
              "Party Name": line.partyName,
              "Product Name": line.productName,
              "Qty To Be Dispatched": dispatchQty,
              "Type Of Transporting": commonForm.typeOfTransporting,
              "Date Of Dispatch": commonForm.dateOfDispatch,
              "Trust Certificate Made": testCertUrl,
              "Transporter Name": line.transporterName,
              po_id: line.poId,
              logistics_plan_id: line.planId,
              logistics_split_id: line.splitId,
            }])
            .select("id")
            .single()
          if (dispErr) throw dispErr

          // Update split → Dispatched
          const { error: splitErr } = await supabase
            .from("po_logistics_splits")
            .update({ status: STATUS_DISPATCHED, dispatch_record_id: inserted.id, allocated_qty: dispatchQty })
            .eq("id", line.splitId)
          if (splitErr) throw splitErr

          // If partial dispatch, create a new Checked split for the remaining qty
          const remainingQty = line.allocatedQty - dispatchQty
          if (remainingQty > 0.001) {
            const { error: remainErr } = await supabase
              .from("po_logistics_splits")
              .insert([{
                plan_id: line.planId,
                po_id: line.poId,
                transporter_name: line.transporterName,
                allocated_qty: remainingQty,
                status: STATUS_CHECKED,
              }])
            if (remainErr) throw remainErr
          }

          // Update ORDER RECEIPT delivered + pending
          const newDelivered = latestDelivered + dispatchQty
          const newPending = Math.max(totalQty - newDelivered, 0)
          const orderUpdate = { Delivered: newDelivered, "Pending Qty": newPending }
          if (newPending <= 0.01) orderUpdate["Actual 4"] = timestamp
          const { error: orErr } = await supabase.from("ORDER RECEIPT").update(orderUpdate).eq("id", line.poId)
          if (orErr) throw orErr
        })
      )

      toast({ title: "Dispatched", description: `${activeLines.length} record${activeLines.length > 1 ? "s" : ""} dispatched (${dSrNumbers.join(", ")}).` })
      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Dispatch error:", error)
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading dispatch planning rows...</span>
      </div>
    )
  }

  // ── Sub-components ────────────────────────────────────────────────────────────
  const renderOrderDetails = (order, meta) => {
    return (
      <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-2 pb-2 border-b">
           <h4 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
             <PackageCheck className="w-4 h-4 text-blue-600" />
             DO: {order["DO-Delivery Order No."] || "—"}
           </h4>
           <div className="flex gap-4 items-center">
             <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${meta.bg} ${meta.text}`}><span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />{meta.label}</span>
           </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h5 className="font-medium text-xs text-gray-500 uppercase tracking-wider">Product Info</h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Product:</span><span className="font-medium text-right">{order["Product Name"]}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Total Qty:</span><span className="font-medium text-right">{order.Quantity}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Delivered:</span><span className="font-medium text-right text-green-700">{order.Delivered || 0}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Pending Qty:</span><span className="font-medium text-right text-amber-600">{order["Pending Qty"] != null ? order["Pending Qty"] : Math.max(0, (Number(order.Quantity) || 0) - (Number(order.Delivered) || 0))}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Rate:</span><span className="font-medium text-right">₹{Number(order["Rate Of Material"] || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Transport:</span><span className="font-medium text-right">{order["Type Of Transporting"]}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="font-medium text-xs text-gray-500 uppercase tracking-wider">Technical Specs</h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Alumina %:</span><span className="font-medium text-right">{order["Alumina%"]}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Iron %:</span><span className="font-medium text-right">{order["Iron%"]}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Measurement:</span><span className="font-medium text-right">{order["Type Of Measurement"]}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Application:</span><span className="font-medium text-right">{order["Type Of Application"]}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="font-medium text-xs text-gray-500 uppercase tracking-wider">Payment & Party</h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Total Value:</span><span className="font-bold text-green-600 text-right">₹{Number(order["Total PO Basic Value"] || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Advance:</span><span className="font-medium text-right">₹{Number(order["Advance"] || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Retention:</span><span className="font-medium text-right">{order["Retention Percentage"]}%</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">GST:</span><span className="font-medium text-right">{order["Gst Number"]}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const StageProgressBar = ({ currentStage }) => {
    const idx = STAGE_KEYS.indexOf(currentStage)
    return (
      <div className="flex gap-0.5 items-center">
        {STAGES.map((s, i) => (
          <div key={s.key} title={s.label} className={`h-2 rounded-full transition-all ${i <= idx ? s.dot : "bg-gray-200"}`} style={{ width: i <= idx ? "10px" : "6px" }} />
        ))}
      </div>
    )
  }

  const StageBadge = ({ stageKey }) => {
    const meta = getStageMeta(stageKey)
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch Planning</h1>
          <p className="text-gray-600">Plan and dispatch approved logistics splits per PO</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div><p className="text-sm font-medium text-blue-600">Total Splits</p><div className="text-2xl font-bold text-blue-900">{splitRows.length}</div></div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white"><FileText className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div><p className="text-sm font-medium text-amber-600">Pending Dispatch</p><div className="text-2xl font-bold text-amber-900">{pendingRows.length}</div></div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white"><Truck className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div><p className="text-sm font-medium text-green-600">Dispatch History</p><div className="text-2xl font-bold text-green-900">{dispatchHistory.length}</div></div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white"><CheckCircle2 className="h-6 w-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Tabs */}
      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder={activeTab === "overview" ? "Search PO, party or firm..." : "Search rows..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10 w-full" />
          </div>
          <Button onClick={fetchData} variant="outline" className="h-10 px-3" disabled={loading || submitting}>
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit gap-1">
          {[
            { key: "overview", label: `PO Overview (${dashboardGroups.length})`, icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
            { key: "history", label: `History (${dispatchHistory.length})` },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PO OVERVIEW ───────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAGES.filter((s) => stageCounts[s.key]).map((s) => (
              <div key={s.key} className={`rounded-xl border p-3 ${s.bg}`}>
                <div className={`text-xl font-bold ${s.text}`}>{stageCounts[s.key]}</div>
                <div className={`text-xs mt-0.5 ${s.text} opacity-80`}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border rounded-md shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-8" />
                    <TableHead>PO Number</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Firm</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead className="text-right">Dispatched</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDashboard.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">No POs found.</TableCell></TableRow>
                  ) : filteredDashboard.map((group) => {
                    const isExpanded = expandedPOs.has(group.poNumber)
                    return (
                      <Fragment key={group.poNumber}>
                        <TableRow className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(group.poNumber)}>
                          <TableCell className="text-gray-400">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</TableCell>
                          <TableCell className="font-semibold text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{group.poNumber}</span>
                              {(() => {
                                const poPendingSplits = pendingRows.filter(r => r.partyPONumber === group.poNumber)
                                if (poPendingSplits.length === 0) return null
                                const pendingGroup = { key: `__po_group_${group.poNumber}`, poNumber: group.poNumber, partyName: group.partyName, rows: poPendingSplits }
                                return (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <Button size="sm" onClick={() => handleOpenGroup(pendingGroup)} className="bg-blue-600 hover:bg-blue-700 h-6 px-2 text-[10px] shrink-0" disabled={submitting}>
                                      <PackageCheck className="w-3 h-3 mr-1" />
                                      Dispatch ({poPendingSplits.length})
                                    </Button>
                                  </div>
                                )
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">{group.partyName}</TableCell>
                          <TableCell className="text-sm text-slate-600">{group.firmName}</TableCell>
                          <TableCell className="text-sm text-right text-slate-600">{group.orders.length}</TableCell>
                          <TableCell className="text-sm text-right font-medium">{group.totalQty}</TableCell>
                          <TableCell className="text-sm text-right text-green-700 font-medium">{group.deliveredQty}</TableCell>
                          <TableCell className="text-sm text-right"><span className={`font-medium ${group.pendingQty > 0 ? "text-amber-600" : "text-green-600"}`}>{group.pendingQty}</span></TableCell>
                          <TableCell><StageBadge stageKey={group.currentStage} /></TableCell>
                          <TableCell>
                            <StageProgressBar currentStage={group.currentStage} />
                            <p className="text-xs text-gray-400 mt-1">Step {STAGE_KEYS.indexOf(group.currentStage) + 1} of {STAGES.length}</p>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-slate-50/50 p-4 border-b border-gray-200">
                              <div className="space-y-3">
                                {group.orders.map((order, idx) => {
                                  const meta = getStageMeta(group.orderStages[idx])
                                  return (
                                    <Fragment key={order.id}>
                                      {renderOrderDetails(order, meta)}
                                    </Fragment>
                                  )
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ── PENDING / HISTORY TABS ────────────────────────────────────────────── */}
      {activeTab !== "overview" && (
        <div className="bg-white border rounded-md shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="w-8" />
                  <TableHead>DO Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Transporter</TableHead>
                  <TableHead>Qty</TableHead>
                  {activeTab === "pending" ? <TableHead>Checked On</TableHead> : <><TableHead>D-Sr</TableHead><TableHead>Date</TableHead></>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No rows found.</TableCell></TableRow>
                ) : groupedDisplayRows.map((group) => {
                  const isExpanded = expandedPOs.has(group.key)
                  return (
                    <Fragment key={group.key}>
                      {/* PO group header — clickable to expand + Dispatch button */}
                      <TableRow
                        className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => toggleExpand(group.key)}
                      >
                        <TableCell colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {activeTab === "pending" && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" onClick={() => handleOpenGroup(group)} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs shrink-0" disabled={submitting}>
                                  <PackageCheck className="w-3 h-3 mr-1" />
                                  Dispatch ({group.rows.length})
                                </Button>
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-1">
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              }
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-900">PO: {group.poNumber}</span>
                                <span className="text-xs text-slate-600">{group.partyName}</span>
                              </div>
                            </div>
                            <span className="text-xs text-slate-500 ml-auto">{group.rows.length} split{group.rows.length > 1 ? "s" : ""}</span>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded: ORDER RECEIPT detail cards */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0 border-b border-slate-200">
                            <div className="bg-slate-50/80 px-6 py-4 space-y-3">
                              {group.rows.map((row) => (
                                <div key={row.id ?? row.splitId} className="bg-white border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-gray-800">{row.productName}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                        Ordered: {row.quantity}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Allocated: {row.allocatedQty ?? row.qtyToBeDispatched}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">DO Number</span>
                                      <p className="font-mono font-medium text-gray-800">{row.doNumber || row.deliveryOrderNo || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Party PO Date</span>
                                      <p className="font-medium text-gray-800">{row.partyPODate || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Rate</span>
                                      <p className="font-medium text-gray-800">{row.rate ? `₹${row.rate}` : "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Total PO Value</span>
                                      <p className="font-medium text-green-700">{row.totalPOValue ? `₹${Number(row.totalPOValue).toLocaleString()}` : "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Transport Type</span>
                                      <p className="font-medium text-gray-800">{row.typeOfTransporting || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Payment</span>
                                      <p className="font-medium text-gray-800">{row.paymentToBeTaken || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">GST Number</span>
                                      <p className="font-medium text-gray-800">{row.gstNumber || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Contact Person</span>
                                      <p className="font-medium text-gray-800">{row.contactPersonName || "—"}</p>
                                    </div>
                                    {row.address && (
                                      <div className="col-span-2">
                                        <span className="text-gray-500">Address</span>
                                        <p className="font-medium text-gray-800">{row.address}</p>
                                      </div>
                                    )}
                                    {row.specificConcern && (
                                      <div className="col-span-2">
                                        <span className="text-gray-500">Specific Concern</span>
                                        <p className="font-medium text-orange-700">{row.specificConcern}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}


                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── DISPATCH MODAL (Lift-style) ───────────────────────────────────────── */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">

            {/* Modal header */}
            <div className="px-6 py-5 border-b flex items-start justify-between shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-blue-600" />
                  Dispatch PO
                </h2>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  {[
                    { label: "PO Number", value: selectedGroup.poNumber },
                    { label: "Party", value: selectedGroup.partyName },
                    { label: "Splits", value: `${dispatchLines.length} product${dispatchLines.length > 1 ? "s" : ""}` },
                  ].map((item) => (
                    <div key={item.label} className="px-3 py-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="font-medium text-gray-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}><X className="h-5 w-5" /></Button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Products to dispatch table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full" />
                  Products to Dispatch
                </h3>
                {/* Excluded rows badge */}
                {dispatchLines.some((l) => !l.included) && (
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-xs text-gray-500">
                      <span className="font-medium text-red-600">{dispatchLines.filter((l) => !l.included).length}</span> product{dispatchLines.filter((l) => !l.included).length > 1 ? "s" : ""} excluded from this batch.
                    </span>
                    <button onClick={() => setDispatchLines((p) => p.map((l) => ({ ...l, included: true })))} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Restore All
                    </button>
                  </div>
                )}

                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold">DO Number</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Product</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Product Order Qty</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Dispatched Quantity</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Pending</th>
                        <th className="text-right px-4 py-2.5 font-semibold min-w-[120px]">Dispatch *</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dispatchLines.map((line, idx) => (
                        <tr key={line.splitId} className={`transition-colors ${line.included ? "bg-white" : "bg-gray-50 opacity-60"}`}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{line.doNumber || "—"}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {!line.included && <span className="inline-block mr-2 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-normal">Excluded</span>}
                            {line.productName}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{line.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{line.quantityDelivered}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            {(() => {
                              const pending = Math.max(0, line.quantity - line.quantityDelivered - (parseFloat(line.dispatchQty) || 0))
                              return <span className={pending > 0 ? "text-amber-600" : "text-green-600"}>{pending}</span>
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={line.quantity - line.quantityDelivered}
                              value={line.dispatchQty}
                              onChange={(e) => updateLineQty(idx, e.target.value)}
                              className="h-8 w-28 text-right ml-auto"
                              disabled={submitting || !line.included}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {line.included ? (
                              <button
                                onClick={() => toggleLine(idx)}
                                disabled={submitting}
                                title="Exclude from this dispatch batch"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleLine(idx)}
                                disabled={submitting}
                                title="Restore to this dispatch batch"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Common dispatch form */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full" />
                  Dispatch Details
                  <span className="text-xs font-normal text-gray-500 ml-1">(applies to all rows above)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Transport Type <span className="text-red-500">*</span></Label>
                    <Select value={commonForm.typeOfTransporting} onValueChange={(v) => setCommonForm((p) => ({ ...p, typeOfTransporting: v }))} disabled={submitting}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="For">For</SelectItem>
                        <SelectItem value="Ex Factory">Ex Factory</SelectItem>
                        <SelectItem value="Ex Factory But Paid By US">Ex Factory But Paid By US</SelectItem>
                        <SelectItem value="direct Suply">direct Suply</SelectItem>
                        <SelectItem value="Owned Truck">Owned Truck</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Dispatch Date <span className="text-red-500">*</span></Label>
                    <Input type="date" value={commonForm.dateOfDispatch} onChange={(e) => setCommonForm((p) => ({ ...p, dateOfDispatch: e.target.value }))} className="h-10" disabled={submitting} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Test Certificate Made <span className="text-red-500">*</span></Label>
                    <Select value={commonForm.testCertificateMade} onValueChange={(v) => setCommonForm((p) => ({ ...p, testCertificateMade: v, testCertificateFile: v === "No" ? null : p.testCertificateFile }))} disabled={submitting}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {commonForm.testCertificateMade === "Yes" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Upload Test Certificate <span className="text-red-500">*</span></Label>
                      <Input type="file" accept="image/*,.pdf" className="h-10"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setCommonForm((p) => ({ ...p, testCertificateFile: f })) }}
                        disabled={submitting}
                      />
                      {commonForm.testCertificateFile && <p className="text-xs text-green-600">✓ {commonForm.testCertificateFile.name}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary note */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                <PackageCheck className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Submitting will create <strong>{dispatchLines.filter((l) => l.included).length} DISPATCH record{dispatchLines.filter((l) => l.included).length > 1 ? "s" : ""}</strong> with sequential D-Sr numbers.
                  {dispatchLines.some((l) => !l.included) && (
                    <span className="text-amber-700"> {dispatchLines.filter((l) => !l.included).length} excluded product{dispatchLines.filter((l) => !l.included).length > 1 ? "s" : ""} will remain in Pending for a future dispatch.</span>
                  )}
                </span>
              </div>
            </div>

            {/* Sticky footer */}
            <div className="border-t px-6 py-4 flex justify-end gap-3 shrink-0 bg-white">
              <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 px-6"
                disabled={
                  submitting ||
                  dispatchLines.every((l) => !l.included) ||
                  dispatchLines.some((l) => l.included && (!l.dispatchQty || parseFloat(l.dispatchQty) <= 0)) ||
                  !commonForm.typeOfTransporting ||
                  !commonForm.dateOfDispatch ||
                  (commonForm.testCertificateMade === "Yes" && !commonForm.testCertificateFile)
                }>
                {submitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                  : <><PackageCheck className="w-4 h-4 mr-2" />Dispatch {dispatchLines.filter((l) => l.included).length} Row{dispatchLines.filter((l) => l.included).length > 1 ? "s" : ""}</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
