"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { getISTTimestamp } from "@/lib/dateUtils"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Search, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react"
import { useNotification } from "@/components/providers/NotificationProvider"
import { groupRowsByPo } from "@/lib/workflowGrouping"

const formatDate = (value) => {
  if (!value) return ""
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return String(value)
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return String(value)
  }
}

const emptyForm = (row) => ({
  orderId: row.id,
  productName: row.productName,
  quantity: row.quantity,
  inStockOrNot: "",
  orderNumberProduction: "",
  qtyTransferred: "",
  batchNumberRemarks: "",
  indentSelfBatchNumber: "",
  gpPercent: "",
})

export default function CheckDeliveryPage({ user }) {
  const { updateCount } = useNotification()
  const { toast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [orderForms, setOrderForms] = useState([])
  const [expandedPO, setExpandedPO] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      let query = supabase
        .from("ORDER RECEIPT")
        .select("*")
        .not("Actual 2", "is", null)
        .order("id", { ascending: false })

      if (user.role !== "ADMIN") {
        const userFirms = user.firm ? user.firm.split(",").map((f) => f.trim()) : []
        if (!userFirms.includes("all")) {
          query = query.in("Firm Name", userFirms)
        }
      }

      const { data, error } = await query
      if (error) throw error

      const mapped = (data || []).map((order) => ({
        id: order.id,
        partyPONumber: order["PARTY PO NO (As Per Po Exact)"] || "",
        partyName: order["Party Names"] || "",
        firmName: order["Firm Name"] || "",
        productName: order["Product Name"] || "",
        quantity: parseFloat(order["Quantity"]) || 0,
        doNumber: order["DO-Delivery Order No."] || "",
        partyPODate: formatDate(order["Party PO Date"]),
        rateOfMaterial: order["Rate Of Material"] || "",
        totalPOValue: order["Total PO Basic Value"] || "",
        transportType: order["Type Of Transporting"] || "",
        paymentTerms: order["Payment to Be Taken"] || "",
        gstNumber: order["Gst Number"] || "",
        contactPersonName: order["Contact Person Name"] || "",
        address: order["Address"] || "",
        specificConcern: order["Specific Concern"] || "",
        checkDeliveryActual: order["check_delivery_actual"] || "",
        inStockOrNot: order["check_delivery_in_stock_or_not"] || "",
      }))

      setRows(mapped)
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({ title: "Error loading data", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const pendingRows = useMemo(
    () => rows.filter((row) => !row.checkDeliveryActual),
    [rows]
  )

  const historyRows = useMemo(
    () => rows.filter((row) => !!row.checkDeliveryActual),
    [rows]
  )

  useEffect(() => {
    updateCount("Check for Delivery", pendingRows.length)
  }, [pendingRows.length, updateCount])

  const displayRows = useMemo(() => {
    const source = activeTab === "pending" ? pendingRows : historyRows
    if (!searchTerm.trim()) return source
    const term = searchTerm.toLowerCase()
    return source.filter((row) =>
      Object.values(row).some((v) => v?.toString().toLowerCase().includes(term))
    )
  }, [activeTab, historyRows, pendingRows, searchTerm])

  const groupedDisplayRows = useMemo(() => groupRowsByPo(displayRows), [displayRows])

  const handleOpen = (group) => {
    setSelectedGroup(group)
    setOrderForms(group.rows.map((row) => emptyForm(row)))
  }

  const handleClose = () => {
    setSelectedGroup(null)
    setOrderForms([])
  }

  const updateForm = (index, field, value) => {
    setOrderForms((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSubmit = async () => {
    for (const form of orderForms) {
      if (!form.inStockOrNot) {
        toast({
          title: "Validation Error",
          description: `Please select "In Stock Or Not" for ${form.productName}.`,
          variant: "destructive",
        })
        return
      }
      if (form.inStockOrNot === "From Purchase" && !form.indentSelfBatchNumber) {
        toast({
          title: "Validation Error",
          description: `Enter Indent/Self Batch Number for ${form.productName}.`,
          variant: "destructive",
        })
        return
      }
    }

    try {
      setSubmitting(true)
      const timestamp = getISTTimestamp()

      await Promise.all(
        orderForms.map((form) => {
          const payload = {
            check_delivery_actual: timestamp,
            check_delivery_in_stock_or_not: form.inStockOrNot,
            check_delivery_production_order_no: form.orderNumberProduction || null,
            check_delivery_qty_transferred: form.qtyTransferred ? parseFloat(form.qtyTransferred) : null,
            check_delivery_batch_number_remarks: form.batchNumberRemarks || null,
            check_delivery_indent_self_batch_number: form.indentSelfBatchNumber || null,
            check_delivery_gp_percent: form.gpPercent ? parseFloat(form.gpPercent) : null,
          }
          return supabase.from("ORDER RECEIPT").update(payload).eq("id", form.orderId)
        })
      )

      toast({ title: "Success", description: "All products marked as checked." })
      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Error updating orders:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading delivery checks...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check for Delivery</h1>
          <p className="text-gray-600">Verify stock availability for POs before arranging logistics</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Products</p>
              <div className="text-2xl font-bold text-blue-900">{rows.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Check</p>
              <div className="text-2xl font-bold text-amber-900">{pendingRows.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Checked</p>
              <div className="text-2xl font-bold text-green-900">{historyRows.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + tabs */}
      <div className="bg-white border rounded-md shadow-sm p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <Button onClick={fetchData} variant="outline" className="h-10 px-3" disabled={loading}>
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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

      {/* Table */}
      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && <TableHead>Action</TableHead>}
                <TableHead>PO Number</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Firm</TableHead>
                <TableHead>Products</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedDisplayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeTab === "pending" ? 5 : 4} className="text-center py-8 text-gray-500">
                    No rows found
                  </TableCell>
                </TableRow>
              ) : (
                groupedDisplayRows.map((group) => {
                  const isExpanded = expandedPO === group.key
                  return (
                    <Fragment key={group.key}>
                      <TableRow
                        className="bg-slate-50 cursor-pointer hover:bg-slate-100"
                        onClick={() => setExpandedPO(isExpanded ? null : group.key)}
                      >
                        {activeTab === "pending" && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => handleOpen(group)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Check
                            </Button>
                          </TableCell>
                        )}
                        <TableCell className="font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            }
                            {group.poNumber}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">{group.partyName}</TableCell>
                        <TableCell className="text-slate-600">{group.rows[0]?.firmName}</TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500">
                            {group.rows.length} product{group.rows.length > 1 ? "s" : ""}
                          </span>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={activeTab === "pending" ? 5 : 4} className="p-0 border-b border-slate-200">
                            <div className="bg-slate-50/80 px-6 py-4 space-y-3">
                              {group.rows.map((row) => (
                                <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-gray-800">{row.productName}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                        Qty: {row.quantity}
                                      </span>
                                      {row.inStockOrNot && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          {row.inStockOrNot}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">DO Number</span>
                                      <p className="font-mono font-medium text-gray-800">{row.doNumber || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Party PO Date</span>
                                      <p className="font-medium text-gray-800">{row.partyPODate || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Rate</span>
                                      <p className="font-medium text-gray-800">{row.rateOfMaterial ? `₹${row.rateOfMaterial}` : "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Total PO Value</span>
                                      <p className="font-medium text-green-700">{row.totalPOValue ? `₹${Number(row.totalPOValue).toLocaleString()}` : "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Transport Type</span>
                                      <p className="font-medium text-gray-800">{row.transportType || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Payment</span>
                                      <p className="font-medium text-gray-800">{row.paymentTerms || "—"}</p>
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
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check for Delivery</DialogTitle>
            <DialogDescription>
              PO: {selectedGroup?.poNumber} · {selectedGroup?.rows[0]?.partyName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {orderForms.map((form, index) => (
              <div key={form.orderId} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{form.productName}</p>
                  <p className="text-xs text-slate-500">Qty: {form.quantity}</p>
                </div>

                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs">In Stock Or Not *</Label>
                    <Select
                      value={form.inStockOrNot}
                      onValueChange={(v) => updateForm(index, "inStockOrNot", v)}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="In Stock">In Stock</SelectItem>
                        <SelectItem value="For Production Planning">For Production Planning</SelectItem>
                        <SelectItem value="From Purchase">From Purchase</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.inStockOrNot === "In Stock" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Order Number Of Production</Label>
                        <Input
                          value={form.orderNumberProduction}
                          onChange={(e) => updateForm(index, "orderNumberProduction", e.target.value)}
                          className="h-9 text-sm"
                          disabled={submitting}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Qty Transferred</Label>
                        <Input
                          type="number"
                          value={form.qtyTransferred}
                          onChange={(e) => updateForm(index, "qtyTransferred", e.target.value)}
                          className="h-9 text-sm"
                          disabled={submitting}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Batch Number Remarks</Label>
                        <Input
                          value={form.batchNumberRemarks}
                          onChange={(e) => updateForm(index, "batchNumberRemarks", e.target.value)}
                          className="h-9 text-sm"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  )}

                  {form.inStockOrNot === "From Purchase" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Indent / Self Batch Number *</Label>
                      <Input
                        value={form.indentSelfBatchNumber}
                        onChange={(e) => updateForm(index, "indentSelfBatchNumber", e.target.value)}
                        className="h-9 text-sm"
                        disabled={submitting}
                      />
                    </div>
                  )}

                  {form.inStockOrNot === "For Production Planning" && (
                    <div className="space-y-1">
                      <Label className="text-xs">GP %</Label>
                      <Input
                        type="number"
                        value={form.gpPercent}
                        onChange={(e) => updateForm(index, "gpPercent", e.target.value)}
                        className="h-9 text-sm"
                        disabled={submitting}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={submitting || orderForms.some((f) => !f.inStockOrNot)}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                "Submit Check"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
