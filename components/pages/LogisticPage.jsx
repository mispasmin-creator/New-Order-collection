"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Search, Loader2, CheckCircle2, Truck } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

const TRANSPORT_TYPES = [
  "Ex Factory",
  "For",
  "Ex Factory but paid by us",
  "Direct supply dont submit the delay",
]

const DB_COLUMNS = {
  TIMESTAMP: "Timestamp",
  DSR_NUMBER: "D-Sr Number",
  DELIVERY_ORDER_NO: "Delivery Order No.",
  PARTY_NAME: "Party Name",
  PRODUCT_NAME: "Product Name",
  QTY_TO_BE_DISPATCHED: "Qty To Be Dispatched",
  TYPE_OF_TRANSPORTING: "Type Of Transporting",
  DATE_OF_DISPATCH: "Date Of Dispatch",
  PLANNED1: "Planned1",
  ACTUAL1: "Actual1",
  LGST_SR_NUMBER: "LGST-Sr Number",
  ACTUAL_TRUCK_QTY: "Actual Truck Qty",
  TYPE_OF_TRANSPORTING_LOGISTIC: "Type Of Transporting  ",
  TRANSPORTER_NAME: "Transporter Name",
  TRUCK_NO: "Truck No.",
  DRIVER_MOBILE: "Driver Mobile No.",
  VEHICLE_IMAGE: "Vehicle No. Plate Image",
  BILTY_NO: "Bilty No.",
  TYPE_OF_RATE: "Type Of Rate",
  TRANSPORT_RATE: "Transport Rate @Per Matric Ton",
  FIXED_AMOUNT: "Fixed Amount",
}

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

export default function LogisticPage() {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [transporters, setTransporters] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    transporterName: "",
    truckNo: "",
    driverMobileNo: "",
    vehicleNoPlateImage: null,
    biltyNo: "",
    actualTruckQty: "",
    typeOfTransporting: "",
    typeOfRate: "",
    transportRatePerTon: "",
    fixedAmount: "",
  })
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const { data: dispatchData, error: dispatchError } = await supabase
        .from("DISPATCH")
        .select("*")
        .order("id", { ascending: false })

      if (dispatchError) throw dispatchError

      const pending = []
      const history = []

      ;(dispatchData || []).forEach((row) => {
        const mapped = {
          id: row.id,
          dSrNumber: row[DB_COLUMNS.DSR_NUMBER] || "",
          deliveryOrderNo: row[DB_COLUMNS.DELIVERY_ORDER_NO] || "",
          partyName: row[DB_COLUMNS.PARTY_NAME] || "",
          productName: row[DB_COLUMNS.PRODUCT_NAME] || "",
          qtyToBeDispatched: row[DB_COLUMNS.QTY_TO_BE_DISPATCHED] || "",
          typeOfTransporting: row[DB_COLUMNS.TYPE_OF_TRANSPORTING] || "",
          dateOfDispatch: formatDate(row[DB_COLUMNS.DATE_OF_DISPATCH]),
          planned1: formatDate(row[DB_COLUMNS.PLANNED1]),
          lgstSrNumber: row[DB_COLUMNS.LGST_SR_NUMBER] || "",
          actual1: formatDate(row[DB_COLUMNS.ACTUAL1]),
          actualTruckQty: row[DB_COLUMNS.ACTUAL_TRUCK_QTY] || "",
          logisticTransportType: row[DB_COLUMNS.TYPE_OF_TRANSPORTING_LOGISTIC] || "",
          transporterName: row[DB_COLUMNS.TRANSPORTER_NAME] || "",
          truckNo: row[DB_COLUMNS.TRUCK_NO] || "",
          driverMobileNo: row[DB_COLUMNS.DRIVER_MOBILE] || "",
          typeOfRate: row[DB_COLUMNS.TYPE_OF_RATE] || "",
          transportRatePerTon: row[DB_COLUMNS.TRANSPORT_RATE] || "",
          fixedAmount: row[DB_COLUMNS.FIXED_AMOUNT] || "",
          logisticsSplitId: row.logistics_split_id || null,
          logisticsPlanId: row.logistics_plan_id || null,
        }

        if (row[DB_COLUMNS.PLANNED1] && !row[DB_COLUMNS.ACTUAL1]) {
          pending.push(mapped)
        } else if (row[DB_COLUMNS.PLANNED1] && row[DB_COLUMNS.ACTUAL1]) {
          history.push(mapped)
        }
      })

      setOrders(pending)
      setHistoryOrders(history)

      const { data: masterData, error: masterError } = await supabase
        .from("MASTER")
        .select('"Transporter Name"')
        .not("Transporter Name", "is", null)

      if (!masterError) {
        const list = [...new Set((masterData || []).map((row) => row["Transporter Name"]).filter(Boolean))]
        setTransporters(list)
      }
    } catch (error) {
      console.error("Error fetching logistic data:", error)
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const transporterOptions = useMemo(
    () => (transporters.length > 0 ? transporters : ["Owned Truck", "External Transporter"]),
    [transporters]
  )

  const displayOrders = useMemo(() => {
    const source = activeTab === "pending" ? orders : historyOrders
    if (!searchTerm.trim()) return source
    const term = searchTerm.toLowerCase()
    return source.filter((row) =>
      Object.values(row).some((value) =>
        value?.toString().toLowerCase().includes(term)
      )
    )
  }, [activeTab, historyOrders, orders, searchTerm])

  const generateLGSTNumber = useCallback(() => {
    if (historyOrders.length === 0) return "LGST-001"
    let maxNumber = 0
    historyOrders.forEach((order) => {
      const match = order.lgstSrNumber?.match(/LGST-(\d+)/i)
      if (match) {
        maxNumber = Math.max(maxNumber, parseInt(match[1], 10))
      }
    })
    return `LGST-${String(maxNumber + 1).padStart(3, "0")}`
  }, [historyOrders])

  const handleOpen = (order) => {
    setSelectedOrder(order)
    setFormData({
      transporterName: order.transporterName || "",
      truckNo: "",
      driverMobileNo: "",
      vehicleNoPlateImage: null,
      biltyNo: "",
      actualTruckQty: order.qtyToBeDispatched ? String(order.qtyToBeDispatched) : "",
      typeOfTransporting: order.typeOfTransporting || "",
      typeOfRate: "",
      transportRatePerTon: "",
      fixedAmount: "",
    })
  }

  const handleClose = () => {
    setSelectedOrder(null)
    setFormData({
      transporterName: "",
      truckNo: "",
      driverMobileNo: "",
      vehicleNoPlateImage: null,
      biltyNo: "",
      actualTruckQty: "",
      typeOfTransporting: "",
      typeOfRate: "",
      transportRatePerTon: "",
      fixedAmount: "",
    })
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)

      const lgstNumber = generateLGSTNumber()
      const actualDate = getISTTimestamp()
      let vehicleImageUrl = ""

      if (formData.vehicleNoPlateImage) {
        const file = formData.vehicleNoPlateImage
        const fileExt = file.name.split(".").pop()
        const fileName = `logistic/${lgstNumber}_${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from("images").upload(fileName, file)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(fileName)
        vehicleImageUrl = publicUrl
      }

      const updates = {
        [DB_COLUMNS.ACTUAL1]: actualDate,
        [DB_COLUMNS.LGST_SR_NUMBER]: lgstNumber,
        [DB_COLUMNS.ACTUAL_TRUCK_QTY]: parseFloat(formData.actualTruckQty) || null,
        [DB_COLUMNS.TYPE_OF_TRANSPORTING_LOGISTIC]: formData.typeOfTransporting,
        [DB_COLUMNS.TRANSPORTER_NAME]: formData.transporterName,
        [DB_COLUMNS.TRUCK_NO]: formData.truckNo,
        [DB_COLUMNS.DRIVER_MOBILE]: formData.driverMobileNo,
        [DB_COLUMNS.VEHICLE_IMAGE]: vehicleImageUrl,
        [DB_COLUMNS.BILTY_NO]: formData.biltyNo,
        [DB_COLUMNS.TYPE_OF_RATE]: formData.typeOfRate,
      }

      if (formData.typeOfRate === "Per Matric Ton rate") {
        updates[DB_COLUMNS.TRANSPORT_RATE] = parseFloat(formData.transportRatePerTon) || null
        updates[DB_COLUMNS.FIXED_AMOUNT] = null
      } else if (formData.typeOfRate === "Fixed Amount") {
        updates[DB_COLUMNS.TRANSPORT_RATE] = null
        updates[DB_COLUMNS.FIXED_AMOUNT] = parseFloat(formData.fixedAmount) || null
      } else if (formData.typeOfRate === "Ex Factory Transporter") {
        updates[DB_COLUMNS.TRANSPORT_RATE] = 0
        updates[DB_COLUMNS.FIXED_AMOUNT] = 0
      }

      const { error } = await supabase
        .from("DISPATCH")
        .update(updates)
        .eq("id", selectedOrder.id)

      if (error) throw error

      if (selectedOrder.logisticsSplitId) {
        await supabase
          .from("po_logistics_splits")
          .update({
            status: "Logistic Completed",
            lgst_sr_number: lgstNumber,
          })
          .eq("id", selectedOrder.logisticsSplitId)
      }

      toast({
        title: "Success",
        description: `Logistic details submitted successfully. LGST: ${lgstNumber}`,
      })

      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Error submitting logistic details:", error)
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
        <span className="text-gray-600">Loading logistic data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistic</h1>
          <p className="text-gray-600">Manage dispatch logistics per approved split row</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Pending</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Completed Logistic</p>
              <div className="text-2xl font-bold text-green-900">{historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Transporters</p>
              <div className="text-2xl font-bold text-purple-900">{transporters.length}</div>
            </div>
            <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
              <Truck className="h-6 w-6" />
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
                placeholder="Search dispatch rows..."
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
            Pending ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            History ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && <TableHead>Action</TableHead>}
                {activeTab === "history" && <TableHead>LGST-Sr</TableHead>}
                <TableHead>D-Sr</TableHead>
                <TableHead>DO Number</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Transporter</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>{activeTab === "pending" ? "Planned" : "Actual"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeTab === "pending" ? 8 : 8} className="text-center py-8 text-gray-500">
                    No rows found
                  </TableCell>
                </TableRow>
              ) : (
                displayOrders.map((row) => (
                  <TableRow key={row.id}>
                    {activeTab === "pending" && (
                      <TableCell>
                        <Button size="sm" onClick={() => handleOpen(row)} className="bg-blue-600 hover:bg-blue-700">
                          Handle
                        </Button>
                      </TableCell>
                    )}
                    {activeTab === "history" && <TableCell>{row.lgstSrNumber}</TableCell>}
                    <TableCell>{row.dSrNumber}</TableCell>
                    <TableCell>{row.deliveryOrderNo}</TableCell>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.transporterName || "Not set"}</TableCell>
                    <TableCell>{activeTab === "pending" ? row.qtyToBeDispatched : row.actualTruckQty}</TableCell>
                    <TableCell>{activeTab === "pending" ? row.planned1 : row.actual1}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Logistic Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                <p className="font-medium text-gray-900">{selectedOrder.partyName}</p>
                <p className="text-gray-600 mt-1">DO: {selectedOrder.deliveryOrderNo} | DS: {selectedOrder.dSrNumber}</p>
                <p className="text-gray-600">Product: {selectedOrder.productName}</p>
                <p className="text-gray-600">Split ID: {selectedOrder.logisticsSplitId || "N/A"}</p>
                <p className="text-sm text-blue-600 font-medium mt-1">LGST Number: {generateLGSTNumber()}</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Type of Transporting *</Label>
                  <Select
                    value={formData.typeOfTransporting}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, typeOfTransporting: value }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Transport Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Actual Truck Qty *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.actualTruckQty}
                    onChange={(e) => setFormData((prev) => ({ ...prev, actualTruckQty: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Transporter Name *</Label>
                  <Select
                    value={formData.transporterName}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, transporterName: value }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Transporter" />
                    </SelectTrigger>
                    <SelectContent>
                      {transporterOptions.map((transporter) => (
                        <SelectItem key={transporter} value={transporter}>{transporter}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Truck No. *</Label>
                  <Input
                    value={formData.truckNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, truckNo: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Driver Mobile No. *</Label>
                  <Input
                    value={formData.driverMobileNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, driverMobileNo: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Type Of Rate *</Label>
                  <Select
                    value={formData.typeOfRate}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        typeOfRate: value,
                        transportRatePerTon: value === "Ex Factory Transporter" ? "0" : "",
                        fixedAmount: value === "Ex Factory Transporter" ? "0" : "",
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Rate Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                      <SelectItem value="Per Matric Ton rate">Per Matric Ton rate</SelectItem>
                      <SelectItem value="Ex Factory Transporter">Ex Factory Transporter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.typeOfRate === "Per Matric Ton rate" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Transport Rate @Per Matric Ton *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.transportRatePerTon}
                      onChange={(e) => setFormData((prev) => ({ ...prev, transportRatePerTon: e.target.value }))}
                      className="h-10"
                      disabled={submitting}
                    />
                  </div>
                )}

                {formData.typeOfRate === "Fixed Amount" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Fixed Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.fixedAmount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fixedAmount: e.target.value }))}
                      className="h-10"
                      disabled={submitting}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Vehicle Plate Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setFormData((prev) => ({ ...prev, vehicleNoPlateImage: file }))
                      }
                    }}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Bilty No.</Label>
                  <Input
                    value={formData.biltyNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, biltyNo: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={
                    submitting ||
                    !formData.typeOfTransporting ||
                    !formData.actualTruckQty ||
                    !formData.transporterName ||
                    !formData.truckNo ||
                    !formData.driverMobileNo ||
                    !formData.typeOfRate ||
                    (formData.typeOfRate === "Per Matric Ton rate" && !formData.transportRatePerTon) ||
                    (formData.typeOfRate === "Fixed Amount" && !formData.fixedAmount)
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Logistic"
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
