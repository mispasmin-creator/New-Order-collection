"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
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
import { CheckCircle2, Download, Eye, Loader2, PackageCheck, Search, X } from "lucide-react"

const HIDDEN_DETAIL_FIELDS = new Set([
  "id",
  "po_id",
  "Timestamp",
  "PARTY PO NO (As Per Po Exact)",
  "Party Names",
  "Firm Name",
  "Product Name",
  "Rate Of Material",
])

const formatDetailLabel = (key) =>
  key
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim()

const getTransporterRateValue = (row) =>
  Number(row["Transporter Amount"]) ||
  Number(row["Transport Rate @Per Matric Ton"]) ||
  Number(row["Fixed Amount"]) ||
  0

export default function FullkittingPage({ user }) {
  const [pendingRows, setPendingRows] = useState([])
  const [historyRows, setHistoryRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRow, setSelectedRow] = useState(null)
  const [form, setForm] = useState({
    status: "No",
    productName: "",
    truckQty: "",
    transporter: "",
    truckNo: "",
    amount: "",
    remarks: "",
  })
  const { toast } = useToast()
  const { updateCount } = useNotification()

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

      let orderQuery = supabase.from("ORDER RECEIPT").select("*")
      if (shouldFilter) orderQuery = orderQuery.in("Firm Name", userFirms)

      const { data: orderData, error: orderError } = await orderQuery
      if (orderError) throw orderError

      const allowedPoIds = (orderData || []).map((row) => row.id)
      const orderMap = new Map((orderData || []).map((row) => [row.id, row]))

      let dispatchQuery = supabase.from("DISPATCH").select("*").not("Actual4", "is", null)
      if (shouldFilter) dispatchQuery = dispatchQuery.in("po_id", allowedPoIds)

      const { data: dispatchData, error: dispatchError } = await dispatchQuery
      if (dispatchError) throw dispatchError

      const pending = []
      const history = []

      ;(dispatchData || []).forEach((row) => {
        const po = row.po_id ? orderMap.get(row.po_id) || {} : {}
        const typeOfTransporting = row["Type Of Transporting  "] || row["Type Of Transporting"] || ""
        if (typeOfTransporting === "Ex Factory") return

        const truckQty = Number(row["Actual Truck Qty"]) || Number(row["Qty To Be Dispatched"]) || 0
        const rate = Number(po["Rate Of Material"]) || 0
        const amount = Number(row["Fullkitting Amount"] ?? row["Fixed Amount"]) || truckQty * rate || 0
        const rateType = row["Type Of Rate"] || ""
        const transportRate = Number(row["Transport Rate @Per Matric Ton"]) || 0
        const fixedAmount = Number(row["Fixed Amount"]) || 0
        const transporterRate = getTransporterRateValue(row)
        const transporterAmount =
          Number(row["Transporter Amount"]) ||
          (rateType === "Per Matric Ton rate" ? truckQty * transportRate : fixedAmount)
        const biltyCopy = row["Bilty Copy"] || ""
        const fullkittingStatus = row["Fullkitting Status"] || ""

        const additionalDetails = [
          ...Object.entries(po)
            .filter(([key, value]) => !HIDDEN_DETAIL_FIELDS.has(key) && value !== null && value !== undefined && String(value).trim() !== "")
            .map(([key, value]) => ({ label: formatDetailLabel(key), value })),
          ...[
            ["LGST-Sr Number", row["LGST-Sr Number"]],
            ["Driver Mobile No.", row["Driver Mobile No."]],
            ["Vehicle No. Plate Image", row["Vehicle No. Plate Image"]],
            ["Loading Image 1", row["Loading Image 1"]],
            ["Loading Image 2", row["Loading Image 2"]],
            ["Loading Image 3", row["Loading Image 3"]],
          ]
            .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
            .map(([label, value]) => ({ label, value })),
        ]

        const item = {
          id: row.id,
          po_id: row.po_id,
          partyPONumber: po["PARTY PO NO (As Per Po Exact)"] || "",
          partyName: row["Party Name"] || po["Party Names"] || "",
          firmName: po["Firm Name"] || "",
          dSrNumber: row["D-Sr Number"] || "",
          deliveryOrderNo: row["Delivery Order No."] || "",
          lgstSrNumber: row["LGST-Sr Number"] || "",
          billNumber: row["Bill Number"] || "",
          billCopy: row["Bill Copy"] || "",
          productName: row["Product Name"] || "",
          qtyToBeDispatched: Number(row["Qty To Be Dispatched"]) || 0,
          truckQty,
          transporter: row["Transporter Name"] || "",
          truckNo: row["Truck No."] || "",
          biltyNo: row["Bilty No."] || "",
          biltyCopy,
          typeOfTransporting,
          rateType,
          rateOfMaterial: rate,
          amount,
          transporterRate,
          transporterAmount,
          invoiceAt: row["Actual4"] || "",
          fullkittingAt: row["Fullkitting Actual"] || "",
          fullkittingStatus,
          remarks: row["Fullkitting Remarks"] || "",
          additionalDetails,
        }

        if (item.fullkittingAt && String(item.fullkittingAt).trim() !== "") history.push(item)
        else pending.push(item)
      })

      pending.sort((a, b) => new Date(b.invoiceAt || 0) - new Date(a.invoiceAt || 0))
      history.sort((a, b) => new Date(b.fullkittingAt || 0) - new Date(a.fullkittingAt || 0))

      setPendingRows(pending)
      setHistoryRows(history)
      updateCount?.("Fullkitting", pending.length)
    } catch (error) {
      console.error("Error fetching Fullkitting data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch Fullkitting data. Please run the Fullkitting SQL migration if columns are missing.",
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

  const fmt = (value) => {
    const number = Number(value)
    if (!Number.isFinite(number)) return "0.00"
    return number.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const isFileUrl = (value) => /^https?:\/\//i.test(String(value || ""))

  const sourceRows = activeTab === "pending" ? pendingRows : historyRows
  const displayRows = useMemo(() => {
    if (!searchTerm.trim()) return sourceRows
    const term = searchTerm.toLowerCase()
    return sourceRows.filter((row) =>
      Object.values(row).some((value) => value?.toString().toLowerCase().includes(term)),
    )
  }, [sourceRows, searchTerm])

  const groupedRows = useMemo(() => groupRowsByPo(displayRows), [displayRows])

  const handleOpen = (row) => {
    setSelectedRow(row)
    setForm({
      status: row.fullkittingStatus || "No",
      productName: row.productName || "",
      truckQty: row.truckQty || "",
      transporter: row.transporter || "",
      truckNo: row.truckNo || "",
      amount: row.transporterRate || "",
      remarks: row.remarks || "",
    })
  }

  const handleClose = () => {
    setSelectedRow(null)
    setForm({ status: "No", productName: "", truckQty: "", transporter: "", truckNo: "", amount: "", remarks: "" })
  }

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!selectedRow) return
    const status = form.status || "No"
    if (status === "Yes" && (!form.productName.trim() || !form.truckQty || !form.transporter.trim() || !form.truckNo.trim() || !form.amount)) {
      toast({
        variant: "destructive",
        title: "Validation",
        description: "Product Name, Truck Qty, Transporter, Truck No, and Amount are required.",
      })
      return
    }

    try {
      setSubmitting(true)
      const payload =
        status === "Yes"
          ? {
              "Fullkitting Status": "Yes",
              "Product Name": form.productName.trim(),
              "Actual Truck Qty": Number(form.truckQty) || null,
              "Transporter Name": form.transporter.trim(),
              "Truck No.": form.truckNo.trim(),
              "Fullkitting Amount": Number(form.amount) || 0,
              "Fullkitting Remarks": form.remarks.trim() || null,
              "Fullkitting Actual": getISTTimestamp(),
            }
          : {
              "Fullkitting Status": "No",
              "Fullkitting Actual": getISTTimestamp(),
            }

      const { error } = await supabase
        .from("DISPATCH")
        .update(payload)
        .eq("id", selectedRow.id)

      if (error) throw error

      toast({
        title: "Success",
        description:
          status === "Yes"
            ? `${selectedRow.dSrNumber || "Entry"} moved to TC after Fullkitting.`
            : `${selectedRow.dSrNumber || "Entry"} status saved as No.`,
      })
      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Error submitting Fullkitting:", error)
      toast({ variant: "destructive", title: "Error", description: `Failed to submit: ${error.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = () => {
    exportToExcel(sourceRows, `Fullkitting_${activeTab}`)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading Fullkitting data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fullkitting</h1>
          <p className="text-gray-600">Review invoice history and send completed rows to TC</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Invoice History</p>
              <div className="text-2xl font-bold text-blue-900">{pendingRows.length + historyRows.length}</div>
            </div>
            <PackageCheck className="h-10 w-10 text-blue-600" />
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Fullkitting</p>
              <div className="text-2xl font-bold text-amber-900">{pendingRows.length}</div>
            </div>
            <PackageCheck className="h-10 w-10 text-amber-600" />
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Completed</p>
              <div className="text-2xl font-bold text-green-900">{historyRows.length}</div>
            </div>
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-md shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search Fullkitting entries..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10 h-10 w-full"
            />
          </div>
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
                {activeTab === "pending" && <TableHead>Action</TableHead>}
                <TableHead>Invoice</TableHead>
                <TableHead>PO / Party</TableHead>
                <TableHead>DO Number</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Truck Qty</TableHead>
                <TableHead>Transporter Type</TableHead>
                <TableHead>Transporter Name</TableHead>
                <TableHead>Vehicle Number</TableHead>
                <TableHead>Bilty Number</TableHead>
                <TableHead>Rate Type</TableHead>
                <TableHead>Bilty Image</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>{activeTab === "pending" ? "Invoice Date" : "Fullkitting Date"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeTab === "pending" ? 16 : 15} className="py-8 text-center text-gray-500">
                    No {activeTab} Fullkitting entries found
                  </TableCell>
                </TableRow>
              ) : (
                groupedRows.map((group) => (
                  <Fragment key={group.key}>
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={activeTab === "pending" ? 16 : 15} className="py-2 px-4">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="font-semibold text-slate-900">{group.poNumber}</span>
                          <span className="text-slate-500">{group.partyName}</span>
                          <Badge variant="outline" className="rounded-sm">{group.rows.length} row{group.rows.length > 1 ? "s" : ""}</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                    {group.rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-gray-50">
                        <TableCell className="text-sm font-mono text-blue-700">{row.dSrNumber || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-sm">
                            {row.fullkittingStatus || "Pending"}
                          </Badge>
                        </TableCell>
                        {activeTab === "pending" && (
                          <TableCell>
                            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => handleOpen(row)}>
                              Process
                            </Button>
                          </TableCell>
                        )}
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
                        <TableCell>
                          <div className="text-sm font-medium text-gray-900">{row.partyPONumber || "N/A"}</div>
                          <div className="text-xs text-gray-500">{row.partyName || "N/A"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{row.deliveryOrderNo || "N/A"}</TableCell>
                        <TableCell className="text-sm">{row.productName || "N/A"}</TableCell>
                        <TableCell className="text-sm font-medium">{fmt(row.truckQty)}</TableCell>
                        <TableCell className="text-sm">{row.typeOfTransporting || "N/A"}</TableCell>
                        <TableCell className="text-sm">{row.transporter || "N/A"}</TableCell>
                        <TableCell className="text-sm">{row.truckNo || "N/A"}</TableCell>
                        <TableCell className="text-sm">{row.biltyNo || "N/A"}</TableCell>
                        <TableCell className="text-sm">{row.rateType || "N/A"}</TableCell>
                        <TableCell className="text-sm">
                          {row.biltyCopy ? (
                            <a href={row.biltyCopy} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmt(row.amount)}</TableCell>
                        <TableCell className="text-sm">{formatDateTime(activeTab === "pending" ? row.invoiceAt : row.fullkittingAt)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b z-10">
              <CardTitle className="text-lg">Fullkitting Process</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 space-y-5">
              <div className="bg-gray-50 p-4 rounded-md border text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="bg-indigo-500 text-white rounded-sm">{selectedRow.billNumber || "No Invoice"}</Badge>
                  <span className="font-semibold text-gray-900">{selectedRow.partyName}</span>
                  <span className="text-gray-500">PO: {selectedRow.partyPONumber || "N/A"}</span>
                  <span className="text-gray-500">D-Sr: {selectedRow.dSrNumber || "N/A"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
                  <span>DO: {selectedRow.deliveryOrderNo || "N/A"}</span>
                  <span>Bilty: {selectedRow.biltyNo || "N/A"}</span>
                  <span>Invoice Date: {formatDateTime(selectedRow.invoiceAt)}</span>
                  <span>Rate: {fmt(selectedRow.rateOfMaterial)}</span>
                </div>
              </div>

              <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border p-4">
                    <div>
                      <p className="text-xs text-gray-500">Transporter Name</p>
                      <p className="text-sm font-medium text-gray-900">{selectedRow.transporter || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Vehicle Number</p>
                      <p className="text-sm font-medium text-gray-900">{selectedRow.truckNo || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Bilty Number</p>
                      <p className="text-sm font-medium text-gray-900">{selectedRow.biltyNo || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Rate Type</p>
                      <p className="text-sm font-medium text-gray-900">{selectedRow.rateType || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Transporter Rate</p>
                      <p className="text-sm font-medium text-gray-900">{fmt(selectedRow.transporterRate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Bilty Image</p>
                      {selectedRow.biltyCopy ? (
                        <a href={selectedRow.biltyCopy} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-gray-900">N/A</p>
                      )}
                    </div>
                  </div>

                  {selectedRow.additionalDetails?.length > 0 && (
                    <div className="rounded-md border p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                        {selectedRow.additionalDetails.map((detail) => (
                          <div key={`${detail.label}-${detail.value}`} className="min-w-0">
                            <p className="text-xs text-gray-500">{detail.label}</p>
                            {isFileUrl(detail.value) ? (
                              <a href={detail.value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline break-all">
                                <Eye className="h-3.5 w-3.5 shrink-0" />
                                View
                              </a>
                            ) : (
                              <p className="text-sm font-medium text-gray-900 break-words">{String(detail.value)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select value={form.status} onValueChange={(value) => updateForm("status", value)} disabled={submitting}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
              </div>

              {form.status === "Yes" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Product Name *</Label>
                      <Input value={form.productName} onChange={(event) => updateForm("productName", event.target.value)} disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label>Truck Qty *</Label>
                      <Input type="number" step="0.01" min="0" value={form.truckQty} onChange={(event) => updateForm("truckQty", event.target.value)} disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label>Transporter *</Label>
                      <Input value={form.transporter} onChange={(event) => updateForm("transporter", event.target.value)} disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label>Truck No *</Label>
                      <Input value={form.truckNo} onChange={(event) => updateForm("truckNo", event.target.value)} disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label>Transporter Rate *</Label>
                      <Input type="number" step="0.01" min="0" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Input value={form.remarks} onChange={(event) => updateForm("remarks", event.target.value)} disabled={submitting} />
                    </div>
                  </div>
                </>
              )}

              <div className="border-t pt-4 flex flex-col sm:flex-row justify-end gap-3">
                <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />{form.status === "Yes" ? "Submit & Send to TC" : "Submit Status"}</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
