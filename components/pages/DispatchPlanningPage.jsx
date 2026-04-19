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
import { X, Search, CheckCircle2, Loader2, Truck, FileText } from "lucide-react"
import { useNotification } from "@/components/providers/NotificationProvider"
import { supabase } from "@/lib/supabaseClient"
import { groupRowsByPo } from "@/lib/workflowGrouping"

const STATUS_CHECKED = "Checked"
const STATUS_DISPATCHED = "Dispatched"

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

export default function DispatchPlanningPage({ user }) {
  const { updateCount } = useNotification()
  const { toast } = useToast()
  const [splitRows, setSplitRows] = useState([])
  const [dispatchHistory, setDispatchHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    qtyToBeDispatched: "",
    typeOfTransporting: "",
    dateOfDispatch: "",
    toBeReconfirm: "Yes",
    testCertificateMade: "No",
    testCertificateFile: null,
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
        .in("status", [STATUS_CHECKED, STATUS_DISPATCHED, "Logistic Completed"])
        .order("id", { ascending: false })

      if (splitError) throw splitError

      const mergedSplits = (splitData || [])
        .map((split) => {
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
            contactNumber: split.contact_number || "",
            rate: split.rate || "",
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
        })
        .filter(Boolean)

      setSplitRows(mergedSplits)

      const { data: dispatchData, error: dispatchError } = await supabase
        .from("DISPATCH")
        .select("*")
        .order("id", { ascending: false })

      if (dispatchError) throw dispatchError

      const historyRows = (dispatchData || []).map((row) => {
        const order = row.po_id ? orderMap.get(row.po_id) : null
        return {
          id: row.id,
          dSrNumber: row["D-Sr Number"] || "",
          deliveryOrderNo: row["Delivery Order No."] || order?.["DO-Delivery Order No."] || "",
          partyPONumber: order?.["PARTY PO NO (As Per Po Exact)"] || "",
          partyName: row["Party Name"] || order?.["Party Names"] || "",
          productName: row["Product Name"] || order?.["Product Name"] || "",
          qtyToBeDispatched: row["Qty To Be Dispatched"] || 0,
          typeOfTransporting: row["Type Of Transporting"] || "",
          dateOfDispatch: formatDate(row["Date Of Dispatch"]),
          timestamp: formatDate(row["Timestamp"]),
          logisticsSplitId: row.logistics_split_id || null,
          transporterName: row["Transporter Name"] || "",
        }
      })

      setDispatchHistory(historyRows)
    } catch (error) {
      console.error("Error fetching dispatch planning data:", error)
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
    () => splitRows.filter((row) => row.splitStatus === STATUS_CHECKED && !row.dispatchRecordId),
    [splitRows]
  )

  useEffect(() => {
    updateCount("Dispatch Planning", pendingRows.length)
  }, [pendingRows.length, updateCount])

  const displayRows = useMemo(() => {
    const source = activeTab === "pending" ? pendingRows : dispatchHistory
    if (!searchTerm.trim()) return source
    const term = searchTerm.toLowerCase()
    return source.filter((row) =>
      Object.values(row).some((value) =>
        value?.toString().toLowerCase().includes(term)
      )
    )
  }, [activeTab, dispatchHistory, pendingRows, searchTerm])
  const groupedDisplayRows = useMemo(() => groupRowsByPo(displayRows), [displayRows])

  const generateNewDSrNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("DISPATCH")
        .select('"D-Sr Number"')
        .order("id", { ascending: false })
        .limit(1)

      if (error) return "D-01"
      if (data && data.length > 0 && data[0]["D-Sr Number"]) {
        const match = data[0]["D-Sr Number"].match(/D-(\d+)/i)
        if (match) {
          return `D-${String(parseInt(match[1], 10) + 1).padStart(2, "0")}`
        }
      }
      return "D-01"
    } catch {
      return "D-01"
    }
  }

  const handleOpen = (row) => {
    setSelectedRow(row)
    setFormData({
      qtyToBeDispatched: row.allocatedQty.toString(),
      typeOfTransporting: row.typeOfTransporting || "",
      dateOfDispatch: "",
      toBeReconfirm: "Yes",
      testCertificateMade: "No",
      testCertificateFile: null,
    })
  }

  const handleClose = () => {
    setSelectedRow(null)
    setFormData({
      qtyToBeDispatched: "",
      typeOfTransporting: "",
      dateOfDispatch: "",
      toBeReconfirm: "Yes",
      testCertificateMade: "No",
      testCertificateFile: null,
    })
  }

  const handleSubmit = async () => {
    if (!selectedRow) return

    try {
      setSubmitting(true)

      const timestamp = getISTTimestamp()
      const dSrNumber = await generateNewDSrNumber()
      const dispatchQty = parseFloat(formData.qtyToBeDispatched) || 0
      const splitAllocatedQty = parseFloat(selectedRow.allocatedQty) || 0

      if (dispatchQty <= 0) {
        throw new Error("Dispatch quantity must be greater than 0.")
      }

      if (dispatchQty - splitAllocatedQty > 0.0001) {
        throw new Error("Dispatch quantity cannot be greater than the approved split quantity.")
      }

      const { data: latestOrder, error: latestOrderError } = await supabase
        .from("ORDER RECEIPT")
        .select('id, "Quantity", "Delivered", "Pending Qty"')
        .eq("id", selectedRow.poId)
        .single()

      if (latestOrderError) throw latestOrderError

      const latestDelivered = parseFloat(latestOrder?.Delivered) || 0
      const totalQty = parseFloat(latestOrder?.Quantity) || 0
      const latestPending = parseFloat(latestOrder?.["Pending Qty"]) || Math.max(totalQty - latestDelivered, 0)

      if (dispatchQty - latestPending > 0.0001) {
        throw new Error("Dispatch quantity cannot be greater than the current pending quantity.")
      }

      let testCertificateUrl = null
      if (formData.testCertificateMade === "Yes" && formData.testCertificateFile) {
        const file = formData.testCertificateFile
        const fileExt = file.name.split(".").pop()
        const fileName = `dispatch/test-certificates/${dSrNumber}_${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(fileName, file, { cacheControl: "3600", upsert: false })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from("images")
          .getPublicUrl(fileName)

        testCertificateUrl = publicUrl
      }

      const dispatchPayload = {
        Timestamp: timestamp,
        "D-Sr Number": dSrNumber,
        "Delivery Order No.": selectedRow.doNumber,
        "Party Name": selectedRow.partyName,
        "Product Name": selectedRow.productName,
        "Qty To Be Dispatched": dispatchQty,
        "Type Of Transporting": formData.typeOfTransporting,
        "Date Of Dispatch": formData.dateOfDispatch,
        "To Be Reconfirm": formData.toBeReconfirm,
        "Trust Certificate Made": testCertificateUrl,
        "Transporter Name": selectedRow.transporterName,
        po_id: selectedRow.poId,
        logistics_plan_id: selectedRow.planId,
        logistics_split_id: selectedRow.id,
      }

      const { data: insertedDispatch, error: dispatchError } = await supabase
        .from("DISPATCH")
        .insert([dispatchPayload])
        .select("id")
        .single()

      if (dispatchError) throw dispatchError

      const { error: splitUpdateError } = await supabase
        .from("po_logistics_splits")
        .update({
          status: STATUS_DISPATCHED,
          dispatch_record_id: insertedDispatch.id,
        })
        .eq("id", selectedRow.id)

      if (splitUpdateError) throw splitUpdateError

      const newDelivered = latestDelivered + dispatchQty
      const newPending = Math.max(totalQty - newDelivered, 0)

      const orderUpdate = {
        Delivered: newDelivered,
        "Pending Qty": newPending,
      }

      if (newPending <= 0.01) {
        orderUpdate["Actual 4"] = timestamp
      }

      const { error: orderError } = await supabase
        .from("ORDER RECEIPT")
        .update(orderUpdate)
        .eq("id", selectedRow.poId)

      if (orderError) throw orderError

      toast({
        title: "Success",
        description: `Dispatch created successfully. D-Sr: ${dSrNumber}`,
      })

      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Error submitting dispatch:", error)
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
        <span className="text-gray-600">Loading dispatch planning rows...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch Planning</h1>
          <p className="text-gray-600">Plan dispatch for approved logistics splits</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Split Rows</p>
              <div className="text-2xl font-bold text-blue-900">{splitRows.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <FileText className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Dispatch</p>
              <div className="text-2xl font-bold text-amber-900">{pendingRows.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Truck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Dispatch History</p>
              <div className="text-2xl font-bold text-green-900">{dispatchHistory.length}</div>
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
                placeholder="Search rows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full"
              />
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" className="h-10 px-3" disabled={loading || submitting}>
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
            History ({dispatchHistory.length})
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
                <TableHead>Qty</TableHead>
                {activeTab === "pending" ? (
                  <TableHead>Checked On</TableHead>
                ) : (
                  <>
                    <TableHead>D-Sr</TableHead>
                    <TableHead>Dispatch Date</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No rows found
                  </TableCell>
                </TableRow>
                ) : (
                groupedDisplayRows.map((group) => (
                  <Fragment key={group.key}>
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={7} className="px-4 py-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">PO Number: {group.poNumber}</span>
                            <span className="text-xs text-slate-600">Party Name: {group.partyName}</span>
                          </div>
                          <span className="text-xs text-slate-500">{group.rows.length} row{group.rows.length > 1 ? "s" : ""}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {group.rows.map((row) => (
                  <TableRow key={row.id}>
                    {activeTab === "pending" && (
                      <TableCell>
                        <Button size="sm" onClick={() => handleOpen(row)} className="bg-blue-600 hover:bg-blue-700">
                          Dispatch
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>{row.doNumber || row.deliveryOrderNo}</TableCell>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.partyName}</TableCell>
                    <TableCell>{row.transporterName}</TableCell>
                    <TableCell>{row.allocatedQty || row.qtyToBeDispatched}</TableCell>
                    {activeTab === "pending" ? (
                      <TableCell>{formatDate(row.checkDeliveryActual)}</TableCell>
                    ) : (
                      <>
                        <TableCell>{row.dSrNumber}</TableCell>
                        <TableCell>{row.dateOfDispatch}</TableCell>
                      </>
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

      {selectedRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Dispatch Planning</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">DO Number</Label>
                  <p className="font-medium">{selectedRow.doNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Transporter</Label>
                  <p className="font-medium">{selectedRow.transporterName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Allocated Qty</Label>
                  <p className="font-medium">{selectedRow.allocatedQty}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Pending Qty</Label>
                  <p className="font-medium">{selectedRow.pendingQty}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Quantity to Dispatch *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.qtyToBeDispatched}
                    onChange={(e) => setFormData((prev) => ({ ...prev, qtyToBeDispatched: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Transport Type *</Label>
                  <Select
                    value={formData.typeOfTransporting}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, typeOfTransporting: value }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
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
                  <Label className="text-sm">Dispatch Date *</Label>
                  <Input
                    type="date"
                    value={formData.dateOfDispatch}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dateOfDispatch: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Reconfirm *</Label>
                  <Select
                    value={formData.toBeReconfirm}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, toBeReconfirm: value }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Test Certificate Made *</Label>
                  <Select
                    value={formData.testCertificateMade}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        testCertificateMade: value,
                        testCertificateFile: value === "No" ? null : prev.testCertificateFile,
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.testCertificateMade === "Yes" && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-sm">Upload Test Certificate *</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setFormData((prev) => ({ ...prev, testCertificateFile: file }))
                        }
                      }}
                      className="h-10"
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={
                    submitting ||
                    !formData.qtyToBeDispatched ||
                    parseFloat(formData.qtyToBeDispatched) <= 0 ||
                    parseFloat(formData.qtyToBeDispatched) > selectedRow.allocatedQty ||
                    !formData.typeOfTransporting ||
                    !formData.dateOfDispatch ||
                    !formData.toBeReconfirm ||
                    !formData.testCertificateMade ||
                    (formData.testCertificateMade === "Yes" && !formData.testCertificateFile)
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Dispatch"
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
