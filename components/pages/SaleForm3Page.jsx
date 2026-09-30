"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import Portal from "@/components/ui/portal"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { useNotification } from "@/components/providers/NotificationProvider"
import { exportToExcel } from "@/lib/exportUtils"
import { groupRowsByPo } from "@/lib/workflowGrouping"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Building, CheckCircle2, ClipboardCheck, Download, Loader2, RotateCcw, Search, X, XCircle } from "lucide-react"

// Sale Form 3 sits between Invoice and TC / Delivery. Invoice submit creates a "Pending"
// SALE FORM 3 row per dispatch; approving it here is what moves the dispatch forward:
//   * TC Required = No  -> the "Delivery Payload" saved at invoice time is inserted into DELIVERY
//   * TC Required = Yes -> the TC page starts showing the dispatch (it checks SALE FORM 3 itself)
// A rejected dispatch stays here (History) and does not move forward.

const fetchAllRows = async (buildQuery) => {
  const pageSize = 1000
  let from = 0
  let all = []
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

const DISPATCH_COLUMNS = `
  id,
  po_id,
  "D-Sr Number",
  "Party Name",
  "Delivery Order No.",
  "Product Name",
  "Qty To Be Dispatched",
  "Actual Truck Qty",
  "Actual Qty As Per Weighment Slip",
  "Transporter Name",
  "Truck No.",
  "Type Of Transporting",
  "Type Of Transporting  ",
  "TC Required",
  "Bill Number",
  "Bill Date",
  "Bill Copy",
  "Actual4"
`

const STATUS_BADGE = {
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  Approved: "bg-green-100 text-green-800 border-green-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
}

export default function SaleForm3Page({ user }) {
  const [pendingRows, setPendingRows] = useState([])
  const [historyRows, setHistoryRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterFirm, setFilterFirm] = useState("all")
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedRowIds, setSelectedRowIds] = useState(new Set())
  const [form, setForm] = useState({ status: "Approved", remarks: "" })
  const { toast } = useToast()
  const { updateCount } = useNotification()

  const isAdmin = user?.role === "ADMIN"
  const actionBy = user?.name || user?.Username || user?.username || "Unknown"

  useEffect(() => {
    setFilterFirm("all")
    setSearchTerm("")
  }, [activeTab])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const userFirms =
        user?.role !== "ADMIN"
          ? user?.firm
            ? user.firm.split(",").map((f) => f.trim()).filter(Boolean)
            : []
          : null
      const shouldFilter = userFirms && !userFirms.includes("all") && userFirms.length > 0

      let orderQuery = supabase
        .from("ORDER RECEIPT")
        .select('id, "PARTY PO NO (As Per Po Exact)", "Party Names", "Firm Name"')
      if (shouldFilter) orderQuery = orderQuery.in("Firm Name", userFirms)
      const { data: orderData, error: orderError } = await orderQuery
      if (orderError) throw orderError

      const allowedPoIds = (orderData || []).map((row) => row.id)
      const orderMap = new Map((orderData || []).map((row) => [row.id, row]))

      const [saleForm3Data, dispatchData] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from("SALE FORM 3")
            .select('id, dispatch_id, "Status", "Planned", "Actual", "Remarks", "Action By"')
            .order("id", { ascending: true }),
        ),
        fetchAllRows(() => {
          let q = supabase.from("DISPATCH").select(DISPATCH_COLUMNS).not("Actual4", "is", null)
          if (shouldFilter) q = q.in("po_id", allowedPoIds)
          return q
        }),
      ])

      const dispatchMap = new Map(dispatchData.map((row) => [row.id, row]))

      const pending = []
      const history = []

      saleForm3Data.forEach((sf) => {
        const row = dispatchMap.get(sf.dispatch_id)
        if (!row) return
        const po = row.po_id ? orderMap.get(row.po_id) || {} : {}

        const item = {
          id: row.id,
          saleForm3Id: sf.id,
          partyPONumber: po["PARTY PO NO (As Per Po Exact)"] || "",
          partyName: row["Party Name"] || po["Party Names"] || "",
          firmName: po["Firm Name"] || "",
          dSrNumber: row["D-Sr Number"] || "",
          deliveryOrderNo: row["Delivery Order No."] || "",
          productName: row["Product Name"] || "",
          qtyToBeDispatched: row["Qty To Be Dispatched"] ?? "",
          actualTruckQty: row["Actual Truck Qty"] ?? "",
          weighSlipQty: row["Actual Qty As Per Weighment Slip"] ?? "",
          transporter: row["Transporter Name"] || "",
          truckNo: row["Truck No."] || "",
          typeOfTransporting: row["Type Of Transporting  "] || row["Type Of Transporting"] || "",
          tcRequired: row["TC Required"] || "No",
          billNumber: row["Bill Number"] || "",
          billDate: row["Bill Date"] || "",
          billCopy: row["Bill Copy"] || "",
          invoiceAt: row["Actual4"] || "",
          status: sf["Status"] || "Pending",
          remarks: sf["Remarks"] || "",
          actionBy: sf["Action By"] || "",
          actionAt: sf["Actual"] || "",
        }

        if (item.status === "Pending") pending.push(item)
        else history.push(item)
      })

      pending.sort((a, b) => new Date(b.invoiceAt || 0) - new Date(a.invoiceAt || 0))
      history.sort((a, b) => new Date(b.actionAt || 0) - new Date(a.actionAt || 0))

      setPendingRows(pending)
      setHistoryRows(history)
      updateCount?.("Sale Form 3", pending.length)
    } catch (error) {
      console.error("Error fetching Sale Form 3 data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch Sale Form 3 data. Please run the sale_form_3.sql migration if the table is missing.",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (value) => {
    if (!value) return "N/A"
    const date = new Date(value)
    if (isNaN(date.getTime())) return value
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatDateOnly = (value) => {
    if (!value) return "N/A"
    const date = new Date(value)
    if (isNaN(date.getTime())) return value
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const fmtQty = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return "—"
    const number = Number(value)
    if (!Number.isFinite(number)) return String(value)
    return number.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const sourceRows = activeTab === "pending" ? pendingRows : historyRows

  const firmOptions = useMemo(() => {
    const firms = [...new Set(sourceRows.map((row) => row.firmName).filter(Boolean))]
    return ["all", ...firms]
  }, [sourceRows])

  const displayRows = useMemo(() => {
    let source = sourceRows
    if (filterFirm !== "all") {
      source = source.filter((row) => row.firmName === filterFirm)
    }
    if (!searchTerm.trim()) return source
    const term = searchTerm.toLowerCase()
    return source.filter((row) =>
      Object.values(row).some((value) => value?.toString().toLowerCase().includes(term)),
    )
  }, [sourceRows, filterFirm, searchTerm])

  const groupedRows = useMemo(() => groupRowsByPo(displayRows), [displayRows])

  const handleOpen = (group) => {
    setSelectedGroup(group)
    setSelectedRowIds(new Set(group.rows.map((row) => row.id)))
    setForm({ status: "Approved", remarks: "" })
  }

  const handleClose = () => {
    setSelectedGroup(null)
    setSelectedRowIds(new Set())
    setForm({ status: "Approved", remarks: "" })
  }

  const toggleRow = (id) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Inserts the DELIVERY row that Invoice used to insert directly, refreshed with the
  // dispatch's current Bill No. / Bill Date (an admin may have edited the bill since invoicing).
  const moveToDelivery = async (row, payload, now) => {
    const dSr = payload["D-Sr Number"] || row.dSrNumber || ""
    const doNo = payload["Delivery Order No."] || row.deliveryOrderNo || ""
    const billNo = row.billNumber || payload["Bill No."] || ""

    // Guard against a duplicate DELIVERY row (e.g. a retried approval). Column names ending in
    // "." must be double-quoted in filters, otherwise PostgREST parses the dot as a JSON path.
    let existingQuery = supabase
      .from("DELIVERY")
      .select("id")
      .eq("D-Sr Number", dSr)
      .eq('"Delivery Order No."', doNo)
    if (billNo) existingQuery = existingQuery.eq('"Bill No."', billNo)
    const { data: existing, error: existingError } = await existingQuery.limit(1)
    if (existingError) throw existingError
    if (existing && existing.length > 0) return

    const { error } = await supabase.from("DELIVERY").insert([
      {
        ...payload,
        "Timestamp": now,
        "Bill No.": billNo,
        "Bill Date": row.billDate || payload["Bill Date"] || null,
      },
    ])
    if (error) throw error
  }

  const handleSubmit = async () => {
    if (!selectedGroup) return
    const rows = selectedGroup.rows.filter((row) => selectedRowIds.has(row.id))
    if (rows.length === 0) {
      toast({ variant: "destructive", title: "Validation", description: "Please select at least one row." })
      return
    }
    if (form.status === "Rejected" && !form.remarks.trim()) {
      toast({ variant: "destructive", title: "Validation", description: "Remarks are required when rejecting." })
      return
    }

    try {
      setSubmitting(true)
      const now = getISTTimestamp()
      let done = 0
      let skipped = 0

      for (const row of rows) {
        // Only a still-Pending row is updated, so two people acting on the same dispatch
        // can't both push it forward (the second one simply gets 0 rows back).
        const { data: updated, error: updateError } = await supabase
          .from("SALE FORM 3")
          .update({
            "Status": form.status,
            "Actual": now,
            "Remarks": form.remarks.trim() || null,
            "Action By": actionBy,
          })
          .eq("dispatch_id", row.id)
          .eq("Status", "Pending")
          .select('id, "Delivery Payload"')
        if (updateError) throw updateError
        if (!updated || updated.length === 0) {
          skipped++
          continue
        }

        const payload = updated[0]["Delivery Payload"]
        if (form.status === "Approved" && payload) {
          try {
            await moveToDelivery(row, payload, now)
          } catch (deliveryError) {
            // Put the row back to Pending so it can be approved again instead of being
            // marked Approved without ever reaching DELIVERY.
            await supabase
              .from("SALE FORM 3")
              .update({ "Status": "Pending", "Actual": null, "Remarks": null, "Action By": null })
              .eq("id", updated[0].id)
            throw deliveryError
          }
        }
        done++
      }

      toast({
        title: "Success",
        description:
          `${done} row${done === 1 ? "" : "s"} ${form.status === "Approved" ? "approved" : "rejected"}` +
          (skipped ? ` (${skipped} already actioned by someone else).` : "."),
      })
      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Error submitting Sale Form 3:", error)
      toast({ variant: "destructive", title: "Error", description: `Failed to submit: ${error.message}` })
      await fetchData()
    } finally {
      setSubmitting(false)
    }
  }

  // Admin-only: send a rejected dispatch back to Pending so it can be approved later.
  const handleReopen = async (row) => {
    try {
      setSubmitting(true)
      const { error } = await supabase
        .from("SALE FORM 3")
        .update({ "Status": "Pending", "Actual": null, "Remarks": null, "Action By": null })
        .eq("dispatch_id", row.id)
        .eq("Status", "Rejected")
      if (error) throw error
      toast({ title: "Re-opened", description: `${row.dSrNumber || "Row"} moved back to Pending.` })
      await fetchData()
    } catch (error) {
      console.error("Error re-opening Sale Form 3 row:", error)
      toast({ variant: "destructive", title: "Error", description: `Failed to re-open: ${error.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = () => {
    exportToExcel(sourceRows, `SaleForm3_${activeTab}`)
  }

  const columnCount = activeTab === "history" ? (isAdmin ? 18 : 17) : 14

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading Sale Form 3 data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sale Form 3</h1>
          <p className="text-gray-600">Approve or reject invoiced dispatches before they move to TC / Delivery</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending</p>
              <div className="text-2xl font-bold text-amber-900">{pendingRows.length}</div>
            </div>
            <ClipboardCheck className="h-10 w-10 text-amber-600" />
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Approved</p>
              <div className="text-2xl font-bold text-green-900">{historyRows.filter((row) => row.status === "Approved").length}</div>
            </div>
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-red-600">Rejected</p>
              <div className="text-2xl font-bold text-red-900">{historyRows.filter((row) => row.status === "Rejected").length}</div>
            </div>
            <XCircle className="h-10 w-10 text-red-600" />
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-md shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search Sale Form 3 entries..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10 h-10 w-full"
            />
          </div>

          <Select value={filterFirm} onValueChange={setFilterFirm}>
            <SelectTrigger className="h-10 w-[180px]">
              <Building className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Firm" />
            </SelectTrigger>
            <SelectContent>
              {firmOptions.map((firm) => (
                <SelectItem key={firm} value={firm}>
                  {firm === "all" ? "All Firms" : firm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={fetchData} variant="outline" className="h-10 px-3" disabled={loading || submitting}>
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={handleExport} variant="outline" className="h-10 px-3 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Pending ({pendingRows.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            History ({historyRows.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>D-Sr Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Firm Name</TableHead>
                <TableHead>PO / Party</TableHead>
                <TableHead>DO Number</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Dispatch Qty</TableHead>
                <TableHead className="text-right">Truck Qty</TableHead>
                <TableHead>TC Required</TableHead>
                <TableHead>Transporter Name</TableHead>
                <TableHead>Vehicle Number</TableHead>
                {activeTab === "history" && <TableHead>Remarks</TableHead>}
                {activeTab === "history" && <TableHead>Action By</TableHead>}
                {activeTab === "history" && <TableHead>Action Date</TableHead>}
                {activeTab === "history" && isAdmin && <TableHead>Admin</TableHead>}
                <TableHead>Submitted At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="py-8 text-center text-gray-500">
                    No {activeTab} Sale Form 3 entries found
                  </TableCell>
                </TableRow>
              ) : (
                groupedRows.map((group) => (
                  <Fragment key={group.key}>
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={columnCount} className="py-2 px-4">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="font-semibold text-slate-900">{group.poNumber}</span>
                          <span className="text-slate-500">{group.partyName}</span>
                          <Badge variant="outline" className="rounded-sm">{group.rows.length} row{group.rows.length > 1 ? "s" : ""}</Badge>
                          {activeTab === "pending" && (
                            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 ml-auto" onClick={() => handleOpen(group)} disabled={submitting}>
                              Action
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {group.rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-gray-50">
                        <TableCell className="text-sm font-mono text-blue-700">{row.dSrNumber || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-sm ${STATUS_BADGE[row.status] || ""}`}>{row.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className="bg-indigo-500 text-white rounded-sm text-xs">{row.billNumber || "N/A"}</Badge>
                            {row.billCopy && (
                              <a href={row.billCopy} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-600 hover:underline">
                                View Copy
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatDateOnly(row.billDate)}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-700">{row.firmName || "N/A"}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-gray-900">{row.partyPONumber || "N/A"}</div>
                          <div className="text-xs text-gray-500">{row.partyName || "N/A"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{row.deliveryOrderNo || "N/A"}</TableCell>
                        <TableCell className="text-sm">{row.productName || "N/A"}</TableCell>
                        <TableCell className="text-sm text-right">{fmtQty(row.qtyToBeDispatched)}</TableCell>
                        <TableCell className="text-sm text-right">{fmtQty(row.actualTruckQty)}</TableCell>
                        <TableCell className="text-sm">{row.tcRequired}</TableCell>
                        <TableCell className="text-sm">{row.transporter || "N/A"}</TableCell>
                        <TableCell className="text-sm">{row.truckNo || "N/A"}</TableCell>
                        {activeTab === "history" && <TableCell className="text-sm max-w-[220px] break-words">{row.remarks || "—"}</TableCell>}
                        {activeTab === "history" && <TableCell className="text-sm">{row.actionBy || "—"}</TableCell>}
                        {activeTab === "history" && <TableCell className="text-sm">{formatDateTime(row.actionAt)}</TableCell>}
                        {activeTab === "history" && isAdmin && (
                          <TableCell>
                            {row.status === "Rejected" ? (
                              <Button size="sm" variant="outline" className="h-8" onClick={() => handleReopen(row)} disabled={submitting}>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                Re-open
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-sm">{formatDateTime(row.invoiceAt)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedGroup && (
        <Portal>
          <div
            className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 flex items-center justify-center p-4 duration-200 animate-in fade-in-0"
            onClick={(e) => { if (e.target === e.currentTarget && !submitting) handleClose() }}
          >
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl duration-200 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 ease-out">
              <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b z-10">
                <CardTitle className="text-lg">Sale Form 3 Action</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 lg:p-6 space-y-5">
                <div className="bg-gray-50 p-4 rounded-md border text-sm flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-gray-900">{selectedGroup.poNumber}</span>
                  <span className="text-gray-500">{selectedGroup.partyName}</span>
                </div>

                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          <Checkbox
                            checked={selectedRowIds.size === selectedGroup.rows.length}
                            onCheckedChange={(checked) =>
                              setSelectedRowIds(checked ? new Set(selectedGroup.rows.map((row) => row.id)) : new Set())
                            }
                            disabled={submitting}
                          />
                        </th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">D-Sr</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Invoice</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Product</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Dispatch Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Truck Qty</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">TC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGroup.rows.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2">
                            <Checkbox checked={selectedRowIds.has(row.id)} onCheckedChange={() => toggleRow(row.id)} disabled={submitting} />
                          </td>
                          <td className="px-3 py-2 font-mono text-blue-700">{row.dSrNumber || "N/A"}</td>
                          <td className="px-3 py-2">{row.billNumber || "N/A"}</td>
                          <td className="px-3 py-2">{row.productName || "N/A"}</td>
                          <td className="px-3 py-2 text-right">{fmtQty(row.qtyToBeDispatched)}</td>
                          <td className="px-3 py-2 text-right">{fmtQty(row.actualTruckQty)}</td>
                          <td className="px-3 py-2">{row.tcRequired}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))} disabled={submitting}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks {form.status === "Rejected" && <span className="text-red-500">*</span>}</Label>
                    <Input
                      value={form.remarks}
                      onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))}
                      placeholder={form.status === "Rejected" ? "Reason for rejection" : "Optional"}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  {form.status === "Approved"
                    ? "Approved rows move forward: TC Required = Yes goes to the TC page, otherwise straight to Delivery (Bilty Update / Material Receipt / Fullkitting)."
                    : "Rejected rows stay in Sale Form 3 History and do not move forward."}
                </p>

                <div className="border-t pt-4 flex flex-col sm:flex-row justify-end gap-3">
                  <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || selectedRowIds.size === 0}
                    className={form.status === "Approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                    ) : form.status === "Approved" ? (
                      <><CheckCircle2 className="w-4 h-4 mr-2" />Approve ({selectedRowIds.size})</>
                    ) : (
                      <><XCircle className="w-4 h-4 mr-2" />Reject ({selectedRowIds.size})</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </Portal>
      )}
    </div>
  )
}
