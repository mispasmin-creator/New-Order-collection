"use client"

import { Fragment, useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, CheckCircle2, Loader2, X, AlertCircle, Truck, FileText } from "lucide-react"
import { groupRowsByPo } from "@/lib/workflowGrouping"

export default function MakeInvoicePage({ user }) {
  const [orders, setOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")

  // Group-level modal state
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [invoiceNo, setInvoiceNo] = useState("")
  const [invoiceCopyFile, setInvoiceCopyFile] = useState(null)
  // Per-product editable lines: [{ id, productName, qty, rate, gstPct }]
  const [productLines, setProductLines] = useState([])

  useEffect(() => {
    fetchInvoiceData()
  }, [])

  const fetchInvoiceData = async () => {
    try {
      setLoading(true)

      const userFirms = user?.role !== "ADMIN"
        ? (user?.firm ? user.firm.split(',').map(f => f.trim()).filter(Boolean) : [])
        : null
      const shouldFilter = userFirms && !userFirms.includes('all') && userFirms.length > 0

      let orQuery = supabase
        .from("ORDER RECEIPT")
        .select('id, "PARTY PO NO (As Per Po Exact)", "Party Names", "Gst Number", "Address", "Rate Of Material", "Upload SO"')
      if (shouldFilter) orQuery = orQuery.in('Firm Name', userFirms)
      const { data: orData, error: orError } = await orQuery

      if (orError) console.error("ORDER RECEIPT fetch error:", orError)

      const allowedPoIds = (orData || []).map(r => r.id)

      let dispatchQuery = supabase.from("DISPATCH").select("*").not("Planned4", "is", null)
      if (shouldFilter) dispatchQuery = dispatchQuery.in('po_id', allowedPoIds)

      const { data: dispatchData, error: dispatchError } = await dispatchQuery

      if (dispatchError) throw dispatchError

      const orMap = new Map()
      ;(orData || []).forEach((row) => orMap.set(row.id, row))

      const pending = []
      const history = []

      ;(dispatchData || []).forEach((row) => {
        const or = row.po_id ? (orMap.get(row.po_id) || {}) : {}

        const order = {
          id: row.id,
          partyPONumber: or["PARTY PO NO (As Per Po Exact)"] || "",
          partyName: row["Party Name"] || or["Party Names"] || "",
          dSrNumber: row["D-Sr Number"] || "",
          deliveryOrderNo: row["Delivery Order No."] || "",
          lgstSrNumber: row["LGST-Sr Number"] || "",
          productName: row["Product Name"] || "",
          qtyToBeDispatched: Number(row["Qty To Be Dispatched"]) || 0,
          actualTruckQty: Number(row["Actual Truck Qty"]) || 0,
          typeOfTransporting: row["Type Of Transporting  "] || "",
          transporterName: row["Transporter Name"] || "",
          truckNo: row["Truck No."] || "",
          driverMobileNo: row["Driver Mobile No."] || "",
          typeOfRate: row["Type Of Rate"] || "",
          vehiclePlateImage: row["Vehicle No. Plate Image"] || "",
          biltyNo: row["Bilty No."] || "",
          gstNumber: or["Gst Number"] || "",
          address: or["Address"] || "",
          rateOfMaterial: Number(or["Rate Of Material"]) || 0,
          uploadSO: or["Upload SO"] || "",
          planned4: row["Planned4"],
          actual4: row["Actual4"],
          billNumber: row["Bill Number"] || "",
          billCopy: row["Bill Copy"] || "",
        }

        const a4 = order.actual4
        if (!a4 || a4 === "" || a4 === " ") {
          pending.push(order)
        } else {
          history.push(order)
        }
      })

      pending.sort((a, b) => {
        if (!a.planned4) return 1
        if (!b.planned4) return -1
        return new Date(b.planned4) - new Date(a.planned4)
      })
      history.sort((a, b) => {
        if (!a.actual4) return 1
        if (!b.actual4) return -1
        return new Date(b.actual4) - new Date(a.actual4)
      })

      setOrders(pending)
      setCompletedOrders(history)
    } catch (error) {
      console.error("Error fetching invoice data:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch invoice data" })
    } finally {
      setLoading(false)
    }
  }

  // ── Formatters ─────────────────────────────────────────────────────────────
  const formatDateOnly = (s) => {
    if (!s || s === " ") return "N/A"
    try {
      const d = new Date(s)
      if (isNaN(d)) return s
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
    } catch { return s }
  }

  const fmt = (val) => {
    const n = Number(val)
    if (!val || isNaN(n)) return "—"
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // ── Filtering & grouping ────────────────────────────────────────────────────
  const searchFilter = (list) => {
    if (!searchTerm) return list
    const term = searchTerm.toLowerCase()
    return list.filter((o) =>
      Object.values(o).some((v) => v?.toString().toLowerCase().includes(term))
    )
  }

  const displayOrders =
    activeTab === "pending" ? searchFilter(orders) : searchFilter(completedOrders)
  const groupedDisplayOrders = useMemo(() => groupRowsByPo(displayOrders), [displayOrders])

  // ── Modal open / close ──────────────────────────────────────────────────────
  const handleOpen = (group) => {
    setSelectedGroup(group)
    setProductLines(
      group.rows.map((row) => ({
        id: row.id,
        productName: row.productName,
        qty: row.actualTruckQty || row.qtyToBeDispatched || 0,
        rate: row.rateOfMaterial || 0,
        gstPct: 18,
      }))
    )
    setInvoiceNo("")
    setInvoiceCopyFile(null)
  }

  const handleClose = () => {
    setSelectedGroup(null)
    setProductLines([])
    setInvoiceNo("")
    setInvoiceCopyFile(null)
  }

  const updateLine = (index, field, value) => {
    setProductLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  // ── Computed line totals ────────────────────────────────────────────────────
  const computedLines = useMemo(
    () =>
      productLines.map((line) => {
        const qty = Number(line.qty) || 0
        const rate = Number(line.rate) || 0
        const gstPct = Number(line.gstPct) || 0
        const total = qty * rate
        const taxAmt = total * gstPct / 100
        return { ...line, total, taxAmt, amountWithTax: total + taxAmt }
      }),
    [productLines]
  )

  const grandTotal = useMemo(() => computedLines.reduce((s, l) => s + l.total, 0), [computedLines])
  const grandTax = useMemo(() => computedLines.reduce((s, l) => s + l.taxAmt, 0), [computedLines])
  const grandWithTax = useMemo(() => computedLines.reduce((s, l) => s + l.amountWithTax, 0), [computedLines])

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedGroup) return

    if (!invoiceNo.trim()) {
      toast({ variant: "destructive", title: "Validation", description: "Invoice Number is required." })
      return
    }
    if (!invoiceCopyFile) {
      toast({ variant: "destructive", title: "Validation", description: "Invoice copy upload is required." })
      return
    }

    try {
      setSubmitting(true)
      const actualDateTime = getISTTimestamp()

      // Upload invoice copy once (shared for the whole PO group)
      const fileExt = invoiceCopyFile.name.split(".").pop()
      const refDsr = selectedGroup.rows[0]?.dSrNumber || "unknown"
      const fileName = `invoices/bill-copies/${refDsr}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, invoiceCopyFile, { cacheControl: "3600", upsert: false })
      if (uploadError) throw uploadError

      const { data: { publicUrl: billCopyUrl } } = supabase.storage
        .from("images")
        .getPublicUrl(fileName)

      // Update every DISPATCH row in the group
      await Promise.all(
        selectedGroup.rows.map((row) =>
          supabase
            .from("DISPATCH")
            .update({
              "Actual4": actualDateTime,
              "Bill Number": invoiceNo.trim(),
              "Bill Copy": billCopyUrl,
            })
            .eq("id", row.id)
        )
      )

      toast({
        title: "Success",
        description: `Invoice submitted for PO ${selectedGroup.poNumber} (${selectedGroup.rows.length} row${selectedGroup.rows.length > 1 ? "s" : ""}).`,
      })

      handleClose()
      await fetchInvoiceData()
    } catch (error) {
      console.error("Error submitting invoice:", error)
      toast({ variant: "destructive", title: "Error", description: `Failed to submit. ${error.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  const totalParties = useMemo(
    () => new Set([...orders, ...completedOrders].map((o) => o.partyName)).size,
    [orders, completedOrders]
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading invoice data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Make Invoice</h1>
          <p className="text-gray-600">Upload invoice copy and record invoice details per PO</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Pending Invoices</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Completed Invoices</p>
              <div className="text-2xl font-bold text-green-900">{completedOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Parties</p>
              <div className="text-2xl font-bold text-purple-900">{totalParties}</div>
            </div>
            <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
              <Truck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Tabs */}
      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 w-full"
            />
          </div>
          <Button onClick={fetchInvoiceData} variant="outline" className="h-10 px-3" disabled={loading || submitting}>
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Pending ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            History ({completedOrders.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">LGST-Sr</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[130px]">DO No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[160px]">Product</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[90px]">Truck Qty</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Transporter</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[110px]">Truck No</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[110px]">Planned</TableHead>
                {activeTab === "history" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Bill No.</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No {activeTab} invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                groupedDisplayOrders.map((group) => (
                  <Fragment key={group.key}>
                    {/* PO group header */}
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={activeTab === "history" ? 8 : 7} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {activeTab === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleOpen(group)}
                              className="bg-green-600 hover:bg-green-700 h-8 text-xs shrink-0"
                              disabled={submitting}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Make Invoice
                            </Button>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">
                              PO Number: {group.poNumber}
                            </span>
                            <span className="text-xs text-slate-600">Party Name: {group.partyName}</span>
                          </div>
                          <span className="text-xs text-slate-500 ml-auto">
                            {group.rows.length} product{group.rows.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Product rows */}
                    {group.rows.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 border-b border-gray-100">
                        <TableCell className="py-2 px-4">
                          <Badge className="bg-blue-500 text-white rounded-sm text-xs">
                            {order.lgstSrNumber || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm font-medium">
                          {order.deliveryOrderNo || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm">{order.productName || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 text-sm font-medium">
                          {order.actualTruckQty || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm">{order.transporterName || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4">
                          <Badge variant="outline" className="rounded-sm text-xs">
                            {order.truckNo || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm">
                          {order.planned4 ? (
                            <span className="text-orange-600">{formatDateOnly(order.planned4)}</span>
                          ) : "N/A"}
                        </TableCell>
                        {activeTab === "history" && (
                          <TableCell className="py-2 px-4 text-sm">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{order.billNumber || "—"}</span>
                              {order.billCopy && (
                                <a href={order.billCopy} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline">
                                  View Copy
                                </a>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Invoice Modal ─────────────────────────────────────────────────────── */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b z-10">
              <CardTitle className="text-lg">Make Invoice</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            <CardContent className="p-4 lg:p-6 space-y-6">

              {/* PO info */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900">PO: {selectedGroup.poNumber}</p>
                    <p className="text-gray-600">Party: {selectedGroup.partyName}</p>
                    {selectedGroup.rows[0]?.gstNumber && (
                      <p className="text-gray-500 text-xs font-mono">GST: {selectedGroup.rows[0].gstNumber}</p>
                    )}
                    {selectedGroup.rows[0]?.address && (
                      <p className="text-gray-500 text-xs">Address: {selectedGroup.rows[0].address}</p>
                    )}
                    {selectedGroup.rows[0]?.uploadSO && (
                      <a
                        href={selectedGroup.rows[0].uploadSO}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2 mt-1"
                      >
                        <FileText className="w-3 h-3" />
                        View PO Copy
                      </a>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-500 shrink-0">
                    {selectedGroup.rows.length} product{selectedGroup.rows.length > 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Product lines table */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-green-600 rounded-full inline-block" />
                  Product Lines
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-xs">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Product</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">Qty</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600 min-w-[110px]">Rate (₹)</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600 min-w-[80px]">GST %</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">Total (₹)</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">Tax (₹)</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">Amt w/ Tax (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {computedLines.map((line, i) => (
                        <tr key={line.id} className="bg-white">
                          <td className="px-3 py-2 text-gray-800 font-medium">{line.productName || "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{line.qty}</td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={productLines[i].rate}
                              onChange={(e) => updateLine(i, "rate", e.target.value)}
                              className="h-8 w-24 text-right ml-auto"
                              disabled={submitting}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="h-8 flex items-center justify-end font-medium text-gray-600">
                              18%
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{fmt(line.total)}</td>
                          <td className="px-3 py-2 text-right text-gray-500 text-xs">{fmt(line.taxAmt)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(line.amountWithTax)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-xs font-semibold">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-gray-700">Grand Total</td>
                        <td className="px-3 py-2 text-right text-gray-800">{fmt(grandTotal)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{fmt(grandTax)}</td>
                        <td className="px-3 py-2 text-right text-green-700 text-sm">{fmt(grandWithTax)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Invoice details */}
              <div className="border-t pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Invoice Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Enter invoice number"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    disabled={submitting}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Invoice Copy <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setInvoiceCopyFile(e.target.files?.[0] || null)}
                    disabled={submitting}
                    className="h-10"
                  />
                  {invoiceCopyFile && (
                    <p className="text-xs text-green-600">✓ {invoiceCopyFile.name}</p>
                  )}
                </div>
              </div>

              {/* Info note */}
              <div className="p-3 bg-green-50 border border-green-100 rounded-md text-xs text-green-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Submitting will set <strong>Actual4</strong> to the current date/time for all{" "}
                  {selectedGroup.rows.length} row{selectedGroup.rows.length > 1 ? "s" : ""} in this PO group.
                  The same invoice copy will be linked to each dispatch row.
                </span>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex flex-col sm:flex-row justify-end gap-3">
                <Button variant="outline" onClick={handleClose} disabled={submitting} className="sm:w-auto w-full">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-green-600 hover:bg-green-700 sm:w-auto w-full"
                  disabled={submitting || !invoiceNo.trim() || !invoiceCopyFile}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Submit Invoice
                    </>
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
