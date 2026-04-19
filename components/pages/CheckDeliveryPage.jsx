"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getISTTimestamp } from "@/lib/dateUtils"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Search, CheckCircle2, X } from "lucide-react"
import { useNotification } from "@/components/providers/NotificationProvider"

const STATUS_APPROVED = "Approved"
const STATUS_CHECKED = "Checked"

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

export default function CheckDeliveryPage({ user }) {
  const { updateCount } = useNotification()
  const { toast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [selectedRow, setSelectedRow] = useState(null)
  const [formData, setFormData] = useState({
    inStockOrNot: "",
    orderNumberProduction: "",
    qtyTransferred: "",
    batchNumberRemarks: "",
    indentSelfBatchNumber: "",
    gpPercent: "",
  })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      let orderQuery = supabase
        .from("ORDER RECEIPT")
        .select("*")
        .order("id", { ascending: false })

      if (user.role !== "master") {
        const userFirms = user.firm ? user.firm.split(",").map((firm) => firm.trim()) : []
        if (!userFirms.includes("all")) {
          orderQuery = orderQuery.in("Firm Name", userFirms)
        }
      }

      const { data: orderData, error: orderError } = await orderQuery
      if (orderError) throw orderError

      const orderMap = new Map()
      ;(orderData || []).forEach((row) => {
        orderMap.set(row.id, row)
      })

      const { data: splitData, error: splitError } = await supabase
        .from("po_logistics_splits")
        .select("*")
        .in("status", [STATUS_APPROVED, STATUS_CHECKED, "Dispatched", "Logistic Completed"])
        .order("id", { ascending: false })

      if (splitError) throw splitError

      const mergedRows = (splitData || [])
        .map((split) => {
          const order = orderMap.get(split.po_id)
          if (!order) return null

          return {
            id: split.id,
            poId: split.po_id,
            planId: split.plan_id,
            splitStatus: split.status || "",
            allocatedQty: parseFloat(split.allocated_qty) || 0,
            transporterName: split.transporter_name || "",
            contactNumber: split.contact_number || "",
            rate: split.rate || "",
            availability: split.availability || "",
            remarks: split.remarks || "",
            checkDeliveryActual: split.check_delivery_actual || "",
            inStockOrNot: split.check_delivery_in_stock_or_not || "",
            orderNumberProduction: split.production_order_no || "",
            qtyTransferred: split.qty_transferred || "",
            batchNumberRemarks: split.batch_number_remarks || "",
            indentSelfBatchNumber: split.indent_self_batch_number || "",
            gpPercent: split.gp_percent || "",
            doNumber: order["DO-Delivery Order No."] || "",
            partyPONumber: order["PARTY PO NO (As Per Po Exact)"] || "",
            partyPODate: formatDate(order["Party PO Date"]),
            partyName: order["Party Names"] || "",
            productName: order["Product Name"] || "",
            firmName: order["Firm Name"] || "",
            contactPersonName: order["Contact Person Name"] || "",
            transportType: order["Type Of Transporting"] || "",
            address: order["Address"] || "",
            gstNumber: order["Gst Number"] || "",
          }
        })
        .filter(Boolean)

      setRows(mergedRows)
    } catch (error) {
      console.error("Error fetching split delivery rows:", error)
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const pendingRows = useMemo(
    () => rows.filter((row) => row.splitStatus === STATUS_APPROVED),
    [rows]
  )

  const historyRows = useMemo(
    () => rows.filter((row) => row.splitStatus !== STATUS_APPROVED),
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
      Object.values(row).some((value) =>
        value?.toString().toLowerCase().includes(term)
      )
    )
  }, [activeTab, historyRows, pendingRows, searchTerm])

  const handleOpen = (row) => {
    setSelectedRow(row)
    setFormData({
      inStockOrNot: row.inStockOrNot || "",
      orderNumberProduction: row.orderNumberProduction || "",
      qtyTransferred: row.qtyTransferred || "",
      batchNumberRemarks: row.batchNumberRemarks || "",
      indentSelfBatchNumber: row.indentSelfBatchNumber || "",
      gpPercent: row.gpPercent || "",
    })
  }

  const handleClose = () => {
    setSelectedRow(null)
    setFormData({
      inStockOrNot: "",
      orderNumberProduction: "",
      qtyTransferred: "",
      batchNumberRemarks: "",
      indentSelfBatchNumber: "",
      gpPercent: "",
    })
  }

  const handleSubmit = async () => {
    if (!selectedRow) return

    try {
      setSubmitting(true)
      const timestamp = getISTTimestamp()

      const updatePayload = {
        status: STATUS_CHECKED,
        check_delivery_actual: timestamp,
        check_delivery_in_stock_or_not: formData.inStockOrNot,
        production_order_no: formData.orderNumberProduction || null,
        qty_transferred: formData.qtyTransferred ? parseFloat(formData.qtyTransferred) : null,
        batch_number_remarks: formData.batchNumberRemarks || null,
        indent_self_batch_number: formData.indentSelfBatchNumber || null,
        gp_percent: formData.gpPercent ? parseFloat(formData.gpPercent) : null,
      }

      const { error } = await supabase
        .from("po_logistics_splits")
        .update(updatePayload)
        .eq("id", selectedRow.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Split row moved to dispatch planning.",
      })

      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Error updating split row:", error)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading split delivery rows...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check for Delivery</h1>
          <p className="text-gray-600">Verify approved logistics splits before dispatch</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Rows</p>
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

      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search split rows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full"
              />
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" className="h-10 px-3" disabled={loading}>
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
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

      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && <TableHead>Action</TableHead>}
                <TableHead>DO Number</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Transporter</TableHead>
                <TableHead>Allocated Qty</TableHead>
                <TableHead>Status</TableHead>
                {activeTab === "history" && <TableHead>Checked On</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeTab === "pending" ? 7 : 8} className="text-center py-8 text-gray-500">
                    No rows found
                  </TableCell>
                </TableRow>
              ) : (
                displayRows.map((row) => (
                  <TableRow key={row.id}>
                    {activeTab === "pending" && (
                      <TableCell>
                        <Button size="sm" onClick={() => handleOpen(row)} className="bg-blue-600 hover:bg-blue-700">
                          Check
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>{row.doNumber}</TableCell>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.partyName}</TableCell>
                    <TableCell>{row.transporterName}</TableCell>
                    <TableCell>{row.allocatedQty}</TableCell>
                    <TableCell>{row.splitStatus}</TableCell>
                    {activeTab === "history" && <TableCell>{formatDate(row.checkDeliveryActual)}</TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Check Split for Delivery</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs">DO Number</Label>
                  <Input value={selectedRow.doNumber} disabled className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Transporter</Label>
                  <Input value={selectedRow.transporterName} disabled className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Allocated Qty</Label>
                  <Input value={selectedRow.allocatedQty} disabled className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Product</Label>
                  <Input value={selectedRow.productName} disabled className="h-9" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">In Stock Or Not *</Label>
                <Select
                  value={formData.inStockOrNot}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, inStockOrNot: value }))}
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

              {formData.inStockOrNot === "In Stock" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Order Number Of The Production</Label>
                    <Input
                      value={formData.orderNumberProduction}
                      onChange={(e) => setFormData((prev) => ({ ...prev, orderNumberProduction: e.target.value }))}
                      className="h-9 text-sm"
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Qty Transferred</Label>
                    <Input
                      value={formData.qtyTransferred}
                      onChange={(e) => setFormData((prev) => ({ ...prev, qtyTransferred: e.target.value }))}
                      className="h-9 text-sm"
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Batch Number Remarks</Label>
                    <Input
                      value={formData.batchNumberRemarks}
                      onChange={(e) => setFormData((prev) => ({ ...prev, batchNumberRemarks: e.target.value }))}
                      className="h-9 text-sm"
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}

              {formData.inStockOrNot === "From Purchase" && (
                <div className="space-y-2">
                  <Label className="text-xs">Indent/Self Batch Number *</Label>
                  <Input
                    value={formData.indentSelfBatchNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, indentSelfBatchNumber: e.target.value }))}
                    className="h-9 text-sm"
                    disabled={submitting}
                  />
                </div>
              )}

              {formData.inStockOrNot === "For Production Planning" && (
                <div className="space-y-2">
                  <Label className="text-xs">GP % *</Label>
                  <Input
                    value={formData.gpPercent}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gpPercent: e.target.value }))}
                    className="h-9 text-sm"
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={
                    submitting ||
                    !formData.inStockOrNot ||
                    (formData.inStockOrNot === "From Purchase" && !formData.indentSelfBatchNumber)
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Check"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
