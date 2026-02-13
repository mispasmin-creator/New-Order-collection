"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Truck, CheckCircle2, Search, X, Calendar, Loader2, AlertCircle, Users, FileText, ClipboardList } from "lucide-react"
import { format } from "date-fns"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"


import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp, getISTFullDisplayDateTime } from "@/lib/dateUtils"

export default function SalesFormPage({ user }) {
  const [orders, setOrders] = useState([])
  const [deliveryHistory, setDeliveryHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    billDate: format(new Date(), "yyyy-MM-dd"),
    deliveryOrderNo: "",
    partyName: "",
    productName: "",
    quantityDelivered: "",
    billNo: "",
    logisticNo: "",
    rateOfMaterial: "",
    typeOfTransporting: "",
    transporterName: "",
    vehicleNumber: "",
    biltyNumber: "",
    givingFromWhere: "",
    indentNo: "",
    qty: "",
    planned4: "",
    actual4: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // 1. Fetch PENDING from DISPATCH table in Supabase
      const { data: dispatchData, error: dispatchError } = await supabase
        .from('DISPATCH')
        .select('*')
        .is('Actual4', null)
        .not('Planned4', 'is', null)

      if (dispatchError) throw dispatchError

      // 2. Fetch HISTORY from DELIVERY table in Supabase
      const { data: historyData, error: historyError } = await supabase
        .from('DELIVERY')
        .select('*')

      if (historyError) throw historyError

      // Process Pending Orders from DISPATCH
      const pending = dispatchData?.map(row => ({
        id: row.id,
        dSrNumber: row["D-Sr Number"],
        deliveryOrderNo: row["Delivery Order No."],
        partyName: row["Party Name"],
        productName: row["Product Name"],
        qtyToBeDispatched: row["Qty To Be Dispatched"],
        typeOfTransporting: row["Type Of Transporting"],
        transporterName: row["Transporter Name"],
        truckNo: row["Truck No."],
        biltyNo: row["Bilty No."],
        lgstNumber: row["LGST-Sr Number"],
        actualTruckQty: row["Actual Truck Qty"],
        planned4: row["Planned4"],
        actual4: row["Actual4"],

        // Fields to be carried over to DELIVERY table from DISPATCH (No spaces as per SQL)
        planned1: row["Planned1"],
        actual1: row["Actual1"],
        delay1: row["Delay1"],
        planned2: row["Planned2"],
        actual2: row["Actual2"],
        delay2: row["Delay2"],
        planned3: row["Planned3"],
        actual3: row["Actual3"],
        delay3: row["Delay3"],
        imageOfSlip: row["Loading Image 1"],
        imageOfSlip2: row["Loading Image 2"],
        imageOfSlip3: row["Loading Image 3"],
        remarks: row["Remarks"],
      })) || []

      // Process History Orders from DELIVERY table (Mapped strictly to SQL schema)
      const historyItems = historyData?.map(row => ({
        id: row.id,
        timestamp: row["Timestamp"],
        billDate: row["Bill Date"],
        deliveryOrderNo: row["Delivery Order No."],
        partyName: row["Party Name"],
        productName: row["Product Name"],
        quantityDelivered: row["Quantity Delivered."],
        billNo: row["Bill No."],
        logisticNo: row["Losgistic no."],
        rateOfMaterial: row["Rate Of Material"],
        typeOfTransporting: row["Type Of Transporting"],
        transporterName: row["Transporter Name"],
        vehicleNumber: row["Vehicle Number."],
        biltyNumber: row["Bilty Number."],
        givingFromWhere: row["Giving From Where"],
        indentNo: row["Indent No."],
        qty: row["Qty"],
        dSrNumber: row["D-Sr Number"]
      })) || []

      setOrders(pending.sort((a, b) => b.id - a.id))
      setDeliveryHistory(historyItems.sort((a, b) => b.id - a.id))
      console.log("Data loaded from Supabase: DISPATCH (Pending) and DELIVERY (History)")

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch sales data from Supabase",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSales = (order) => {
    const now = new Date()
    const formattedDate = format(now, "yyyy-MM-dd")

    setSelectedOrder(order)
    setFormData({
      billDate: formattedDate,
      deliveryOrderNo: order.deliveryOrderNo || "",
      partyName: order.partyName || "",
      productName: order.productName || "",
      quantityDelivered: order.actualTruckQty || order.qtyToBeDispatched || "",
      billNo: "",
      logisticNo: order.lgstNumber || "",
      rateOfMaterial: "",
      typeOfTransporting: order.typeOfTransporting || "",
      transporterName: order.transporterName || "",
      vehicleNumber: order.truckNo || "",
      biltyNumber: order.biltyNo || "",
      givingFromWhere: "",
      indentNo: order.indentNo || "",
      qty: order.qty || "",
      planned4: order.planned4 || "",
    })
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)

      const timestampIST = getISTTimestamp()
      const displayTimestamp = getISTFullDisplayDateTime()
      const formattedBillDateForSheets = format(new Date(formData.billDate), "dd/MM/yyyy")

      // 1. Update Supabase DISPATCH table (Only mark as completed)
      const { error: dispatchUpdateError } = await supabase
        .from('DISPATCH')
        .update({
          "Actual4": timestampIST
        })
        .eq('id', selectedOrder.id)

      if (dispatchUpdateError) {
        console.error("DISPATCH Update Error:", dispatchUpdateError)
        throw dispatchUpdateError
      }

      // 2. Insert into Supabase DELIVERY table
      // Only storing form fields and current timestamp as per user request
      // Note: "D-Sr Number" is numeric in schema, so we extract digits from "D-01" etc.

      // Ensure Bill Date is formatted as YYYY-MM-DD
      let formattedBillDate = formData.billDate;
      try {
        if (formData.billDate) {
          formattedBillDate = format(new Date(formData.billDate), "yyyy-MM-dd");
        }
      } catch (e) {
        console.error("Error formatting date:", e);
        // Fallback or keep original
      }

      console.log("Submitting Sales Payload:", {
        timestamp: timestampIST,
        billDate: formattedBillDate,
        originalBillDate: formData.billDate
      });

      const deliveryPayload = {
        "Timestamp": timestampIST,
        "Bill Date": formattedBillDate,
        "Delivery Order No.": String(formData.deliveryOrderNo || ""),
        "Party Name": String(formData.partyName || ""),
        "Product Name": String(formData.productName || ""),
        "Quantity Delivered.": parseFloat(formData.quantityDelivered) || 0,
        "Bill No.": String(formData.billNo || ""),
        "Losgistic no.": String(formData.logisticNo || ""),
        "Rate Of Material": parseFloat(formData.rateOfMaterial) || 0,
        "Type Of Transporting": String(formData.typeOfTransporting || ""),
        "Transporter Name": String(formData.transporterName || ""),
        "Vehicle Number.": String(formData.vehicleNumber || ""),
        "Bilty Number.": String(formData.biltyNumber || ""),
        "Bilty No.": String(formData.biltyNumber || ""),
        "Giving From Where": String(formData.givingFromWhere || ""),
        "Indent No.": String(formData.indentNo || ""),
        "Qty": parseFloat(formData.qty) || 0,
        "D-Sr Number": String(selectedOrder.dSrNumber || "")
      }

      console.log("FINAL Payload to DELIVERY:", JSON.stringify(deliveryPayload, null, 2))

      const { error: deliveryTableError } = await supabase
        .from('DELIVERY')
        .insert([deliveryPayload])

      if (deliveryTableError) {
        console.error("DELIVERY Insert Error Detail:", deliveryTableError.message, deliveryTableError.details, deliveryTableError.hint)
        throw deliveryTableError
      }

      // 3. Handle Success
      await fetchData()
      setSelectedOrder(null)
      setFormData({
        billDate: format(new Date(), "yyyy-MM-dd"),
        deliveryOrderNo: "",
        partyName: "",
        productName: "",
        quantityDelivered: "",
        billNo: "",
        logisticNo: "",
        rateOfMaterial: "",
        typeOfTransporting: "",
        transporterName: "",
        vehicleNumber: "",
        biltyNumber: "",
        givingFromWhere: "",
        indentNo: "",
        qty: "",
        planned4: "",
        actual4: "",
      })

      toast({
        title: "Success",
        description: "Sales form submitted successfully in Supabase (DISPATCH & DELIVERY)!",
      })

    } catch (error) {
      console.error("Error submitting sales form:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit. Error: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      billDate: format(new Date(), "yyyy-MM-dd"),
      deliveryOrderNo: "",
      partyName: "",
      productName: "",
      quantityDelivered: "",
      billNo: "",
      logisticNo: "",
      rateOfMaterial: "",
      typeOfTransporting: "",
      transporterName: "",
      vehicleNumber: "",
      biltyNumber: "",
      givingFromWhere: "",
      indentNo: "",
      qty: "",
      planned4: "",
      actual4: "",
    })
  }

  // Apply search filter
  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm.trim()) return ordersList

    return ordersList.filter((order) =>
      Object.values(order).some((value) =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const pendingOrders = searchFilteredOrders(orders)
  const historyOrders = searchFilteredOrders(deliveryHistory)

  const totalParties = new Set([...orders, ...deliveryHistory].map(o => o.partyName)).size

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
        <span className="text-gray-600 font-medium italic">Loading sales data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales Form</h1>
          <p className="text-gray-500 text-sm italic">Manage sales deliveries and track history</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm transition-all hover:shadow-md cursor-default">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Pending Deliveries</p>
              <div className="text-3xl font-bold text-blue-900 mt-1">{orders.length}</div>
            </div>
            <div className="h-12 w-12 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Truck className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm transition-all hover:shadow-md cursor-default">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-green-600 uppercase tracking-wider">Delivery History</p>
              <div className="text-3xl font-bold text-green-900 mt-1">{deliveryHistory.length}</div>
            </div>
            <div className="h-12 w-12 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <CheckCircle2 className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50 border-indigo-100 shadow-sm transition-all hover:shadow-md cursor-default">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Total Parties</p>
              <div className="text-3xl font-bold text-indigo-900 mt-1">{totalParties}</div>
            </div>
            <div className="h-12 w-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Users className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Search & Tabs Header */}
        <div className="p-4 border-b bg-gray-50/50 flex flex-col lg:flex-row gap-4 items-center">
          <div className="w-full lg:max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by Party, DO, Product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 w-full border-gray-200 focus:ring-green-500 rounded-lg shadow-sm"
            />
          </div>

          <div className="flex bg-gray-200/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === "pending"
                ? "bg-white text-green-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Pending ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === "history"
                ? "bg-white text-green-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              History ({deliveryHistory.length})
            </button>
          </div>

          <Button
            onClick={() => fetchData()}
            variant="ghost"
            size="sm"
            className="ml-auto text-gray-400 hover:text-green-600"
            disabled={loading}
          >
            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Action</TableHead>
                )}
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Bill Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Bill No.</TableHead>
                  </>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">D-Sr Number</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Delivery Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Product Name</TableHead>
                {activeTab === "pending" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Planned Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Transport Type</TableHead>
                  </>
                )}
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Quantity Delivered</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Rate of Material</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Source</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(activeTab === "pending" ? pendingOrders : historyOrders).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === "pending" ? 8 : 9}
                    className="text-center py-8 text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No {activeTab} orders found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                (activeTab === "pending" ? pendingOrders : historyOrders).map((order) => {
                  if (activeTab === "pending") {
                    return (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        <TableCell className="py-2 px-4 min-w-[100px]">
                          <Button
                            size="sm"
                            onClick={() => handleSales(order)}
                            className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                            disabled={submitting}
                          >
                            Sales Form
                          </Button>
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px]">
                          <Badge variant="outline" className="rounded-sm font-normal text-xs">
                            {order.dSrNumber}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] font-medium text-sm">
                          {order.deliveryOrderNo || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.partyName}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.productName}</TableCell>

                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.planned4}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px]">
                          <Badge variant="outline" className="rounded-sm font-normal text-xs">
                            {order.typeOfTransporting}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  } else {
                    return (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        <TableCell className="py-2 px-4 min-w-[120px] whitespace-nowrap text-sm">
                          {order.billDate ? order.billDate.split(' ')[0] : "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px]">
                          <Badge className="bg-purple-500 text-white rounded-sm text-xs">
                            {order.billNo}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                          <Badge variant="outline" className="rounded-sm font-normal text-xs">
                            {order.dSrNumber || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] font-medium text-sm">
                          {order.deliveryOrderNo}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.partyName}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.productName}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px] font-medium text-sm">{order.quantityDelivered}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                          ₹{order.rateOfMaterial || "0"}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px]">
                          <Badge className={`rounded-sm text-xs ${order.givingFromWhere === 'Production' ? 'bg-blue-500' : 'bg-green-500'
                            } text-white`}>
                            {order.givingFromWhere || "N/A"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  }
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Sales Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Sales Delivery Form</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-6">
                {/* Order Info */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Order Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Delivery Order No.</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.deliveryOrderNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">D-Sr Number</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.dSrNumber}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Party Name</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.partyName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Product Name</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.productName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">LGST Number</Label>
                      <p className="font-medium text-blue-600">{selectedOrder.lgstNumber || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Planned4 Date</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.planned4}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Actual Truck Qty</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.actualTruckQty || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Transporter</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.transporterName || "N/A"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="w-1 h-6 bg-green-600 rounded-full inline-block"></span>
                    Sales Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Bill Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-10 justify-start text-left font-normal",
                              !formData.billDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {formData.billDate ? format(new Date(formData.billDate), "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={new Date(formData.billDate)}
                            onSelect={(date) =>
                              setFormData(prev => ({
                                ...prev,
                                billDate: format(date, "yyyy-MM-dd")
                              }))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Quantity Delivered *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.quantityDelivered}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantityDelivered: e.target.value }))}
                        className="h-10"
                        placeholder="Enter quantity"
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Rate Of Material *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.rateOfMaterial}
                        onChange={(e) => setFormData(prev => ({ ...prev, rateOfMaterial: e.target.value }))}
                        className="h-10"
                        placeholder="Enter rate"
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Giving From Where *</Label>
                      <Select
                        value={formData.givingFromWhere}
                        onValueChange={(value) => {
                          setFormData(prev => ({
                            ...prev,
                            givingFromWhere: value,
                            qty: value === "Production" ? "" : "0" // Reset if Production, set 0 for Purchase
                          }))
                        }}
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Production">Production</SelectItem>
                          <SelectItem value="Purchase">Purchase</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.givingFromWhere === "Production" && (
                      <div className="space-y-2">
                        <Label className="text-sm">Quantity *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.qty}
                          onChange={(e) => setFormData(prev => ({ ...prev, qty: e.target.value }))}
                          className="h-10"
                          placeholder="Enter production quantity"
                          disabled={submitting}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm">Bill No. *</Label>
                      <Input
                        value={formData.billNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, billNo: e.target.value }))}
                        className="h-10"
                        placeholder="Enter bill number"
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-500">Logistic No.</Label>
                      <div className="h-10 px-3 py-2 bg-gray-50 border rounded-md text-sm text-gray-500">
                        {formData.logisticNo || "N/A"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-500">Type of Transporting</Label>
                      <div className="h-10 px-3 py-2 bg-gray-50 border rounded-md text-sm text-gray-500">
                        {formData.typeOfTransporting || "N/A"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-500">Transporter Name</Label>
                      <div className="h-10 px-3 py-2 bg-gray-50 border rounded-md text-sm text-gray-500">
                        {formData.transporterName || "N/A"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-500">Vehicle Number</Label>
                      <div className="h-10 px-3 py-2 bg-gray-50 border rounded-md text-sm text-gray-500">
                        {formData.vehicleNumber || "N/A"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-500">Bilty Number</Label>
                      <div className="h-10 px-3 py-2 bg-gray-50 border rounded-md text-sm text-gray-500">
                        {formData.biltyNumber || "N/A"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Indent No.</Label>
                      <Input
                        value={formData.indentNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, indentNo: e.target.value }))}
                        className="h-10"
                        placeholder="Enter indent number"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="w-full sm:w-auto"
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                      disabled={
                        !formData.billDate ||
                        !formData.quantityDelivered ||
                        !formData.rateOfMaterial ||
                        !formData.givingFromWhere ||
                        !formData.billNo ||
                        (formData.givingFromWhere === "Production" && !formData.qty) ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Sales`
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}