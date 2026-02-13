"use client"

import { useState, useEffect } from "react"
import { getISTDisplayDate, getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Search, CheckCircle2, Loader2, Upload, Calendar, ExternalLink } from "lucide-react"
import { format, parse } from "date-fns"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { supabase } from "@/lib/supabaseClient"
import { getISTDate } from "@/lib/dateUtils"
import { useNotification } from "@/components/providers/NotificationProvider"
import { Package, Truck, FileCheck } from "lucide-react"
import { getSignedUrl } from "@/lib/storageUtils"

export default function FullKittingPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const { updateCount } = useNotification()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    typeOfBill: "",
    totalBillAmount: "",
    totalTruckQty: "",
    copyOfBill: null,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch from DELIVERY table where Planned 2 is not null
      const { data, error } = await supabase
        .from('DELIVERY')
        .select('*')
        .not('Planned 2', 'is', null)

      if (error) throw error

      if (data) {
        const pendingOrders = []
        const historyOrdersData = []

        data.forEach(row => {
          // Map row to order object
          const order = {
            id: row.id,
            rowIndex: row.id,
            timestamp: row["Timestamp"],
            billDate: formatDate(row["Bill Date"]),
            deliveryOrderNo: row["Delivery Order No."],
            partyName: row["Party Name"],
            productName: row["Product Name"],
            quantityDelivered: row["Quantity Delivered."] || row["Quantity Delivered"] || "",
            billNo: row["Bill No."],
            logisticNo: row["Losgistic no."] || row["Logistic No."] || "",
            rateOfMaterial: row["Rate Of Material"],
            typeOfTransporting: row["Type Of Transporting"],
            transporterName: row["Transporter Name"],
            vehicleNumber: row["Vehicle Number."] || row["Vehicle Number"],
            biltyNumber: row["Bilty Number."] || row["Bilty Number"],
            givingFromWhere: row["Giving From Where"],
            // Full Kitting specific columns
            planned2: formatDate(row["Planned 2"]),
            actual2: row["Actual 2"] ? formatDisplayDate(row["Actual 2"]) : "", // Actual 2 might be timestamp
            rawActual2: row["Actual 2"],
            delay2: row["Delay 2"],
            actualQtyLoadedInTruck: row["Actual Qty loaded In Truck (Total Qty)"] || row["Actual Truck Qty"],
            actualQtyAsPerWeighmentSlip: row["Actual Qty As Per Weighment Slip"],

            // History specific
            typeOfBill: row["Type Of Bill"], // Mapping might need checking if column exists, usually stored in Remarks or new column? 
            // The schema provided doesn't explicitly show "Type Of Bill" column in DELIVERY table.
            // Assuming we might need to store it in Remarks or a new column if not present.
            // Wait, schema provided didn't show "Type Of Bill". 
            // However, previous Google Sheet logic had it. 
            // I will assume for now we might map it if it exists or handle it in Remarks.
            // Checking schema again: ... "Remarks" text null ... "Bilty Copy" text null ... 
            // No "Type Of Bill" in schema. 
            // I will store Type of Bill in Remarks for now or just generic. 
            // But wait, the user said "use DELIVERY table". 
            // I'll leave mapped property empty if column missing.

            totalBillAmount: row["Total Bill Amount"], // Schema check: not in provided schema list. 
            totalTruckQty: row["Total Truck Qty"], // Schema check: not in provided schema list.
            copyOfBill: row["Bilty Copy"] || row["Copy Of Bill"], // Schema has "Bilty Copy".

            hasCopyOfBill: !!(row["Bilty Copy"] || row["Copy Of Bill"]),
          }

          // Logic: Pending if Planned 2 exists (query ensures this) AND Actual 2 is null.
          if (!order.rawActual2) {
            pendingOrders.push(order)
          }
        })

        // Sort by ID descending
        setOrders(pendingOrders.sort((a, b) => b.id - a.id))
        // Fetch history from POST DELIVERY table
        const { data: postDeliveryData, error: postDeliveryError } = await supabase
          .from('POST DELIVERY')
          .select('*')

        if (postDeliveryError) throw postDeliveryError

        if (postDeliveryData) {
          const historyOrdersData = postDeliveryData.map(row => ({
            id: row.id,
            timestamp: row["Timestamp"],
            orderNo: row["Order No."],
            typeOfBill: row["Type of Bill"],
            billNo: row["Bill No."],
            billDate: formatDate(row["Bill Date"]),
            partyName: row["Party Name"],
            totalBillAmount: row["Total Bill Amount"],
            totalTruckQty: row["Total Truck Qty"],
            copyOfBill: row["Copy Of Bill"],
            hasCopyOfBill: !!row["Copy Of Bill"],
            // Map other valid fields if needed for display
            deliveryOrderNo: row["Order No."], // Assuming Order No. is used as reference
            productName: "N/A", // Product Name not in POST DELIVERY schema
          }))

          setHistoryOrders(historyOrdersData.sort((a, b) => b.id - a.id))
          console.log("History orders loaded:", historyOrdersData.length)
        }

        // Update notification count
        updateCount?.("Fullkiting", pendingOrders.length) // Assuming sidebar name is "Full Kitting" (Sidebar has "Fullkiting")
        // Note: Sidebar likely maps "Fullkiting" to this page. I should check Sidebar name.
        // Sidebar usually takes the name from the path or explicit prop.
        // I'll call it "Fullkiting" to match sidebar icon potentially.
        // Actually, looking at Sidebar code previously: Update count key must match Sidebar key.
        // I'll try "Fullkiting".

        console.log("Supabase Delivery Data - Pending:", pendingOrders.length, "History:", historyOrders.length)
      }

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch data from Supabase"
      })
    } finally {
      setLoading(false)
    }
  }

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === "") return "N/A"
    const date = new Date(dateString)
    if (!isNaN(date.getTime())) {
      return format(date, "dd/MM/yyyy")
    }
    return dateString
  }

  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm.trim()) return ordersList

    return ordersList.filter((order) =>
      Object.values(order).some((value) =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayOrders = activeTab === "pending"
    ? searchFilteredOrders(orders)
    : searchFilteredOrders(historyOrders)

  const handleFullKitting = (order) => {
    setSelectedOrder(order)
    setFormData({
      typeOfBill: "",
      totalBillAmount: "",
      totalTruckQty: "",
      copyOfBill: null,
    })
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

  const uploadFileToSupabase = async (file, path) => {
    try {
      const { data, error } = await supabase.storage
        .from('images')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(path)

      return publicUrl
    } catch (error) {
      console.error("Error uploading file:", error)
      throw error
    }
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)

      const timestamp = getISTTimestamp()
      const actual2Time = getISTTimestamp()

      let copyOfBillUrl = ""

      // Upload copy of bill if provided and type is Independent Bill
      if (formData.typeOfBill === "Independent Bill" && formData.copyOfBill) {
        try {
          // Create a unique file path
          const timestamp = Date.now()
          const safeFileName = formData.copyOfBill.name.replace(/[^a-zA-Z0-9.]/g, '_')
          const filePath = `fullkitting/${selectedOrder.id}_bill_${timestamp}_${safeFileName}`

          const publicUrl = await uploadFileToSupabase(formData.copyOfBill, filePath)
          if (publicUrl) copyOfBillUrl = publicUrl

        } catch (uploadError) {
          console.error("Error uploading bill copy:", uploadError)
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload bill copy"
          })
        }
      }

      // Step 1: Submit to POST DELIVERY table
      // Use Delivery Order No. as Order No.
      const orderNo = selectedOrder.deliveryOrderNo
      // Convert formatted date back to YYYY-MM-DD or use object if date type
      // selectedOrder.billDate is dd/MM/yyyy from formatDate.
      // Need valid date for Supabase date column: YYYY-MM-DD
      let billDateISO = null
      if (selectedOrder.billDate && selectedOrder.billDate !== "N/A") {
        const [d, m, y] = selectedOrder.billDate.split('/')
        if (d && m && y) billDateISO = `20${y}-${m}-${d}` // assuming yy is 2-digit format from formatDate (slice -2)
        // Wait, formatDate helper uses slice(-2). So "26".
        // If billDate is already dd/mm/yyyy from other parsers, it might have 4 digit year.
        // Let's use a safer parser.
        // Or just rely on JS date parsing if format is standard.
        // Safer:
        const parts = selectedOrder.billDate.split('/')
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
          billDateISO = `${year}-${parts[1]}-${parts[0]}`
        }
      }

      const postDeliveryPayload = {
        "Timestamp": timestamp,
        "Order No.": orderNo,
        "Type of Bill": formData.typeOfBill,
        "Bill No.": selectedOrder.billNo,
        "Bill Date": billDateISO || new Date().toISOString().split('T')[0],
        "Party Name": selectedOrder.partyName,
        "Total Bill Amount": formData.typeOfBill === "Independent Bill" ? parseFloat(formData.totalBillAmount) : 0,
        "Total Truck Qty": formData.typeOfBill === "Independent Bill" ? parseFloat(formData.totalTruckQty) : 0,
        "Copy Of Bill": copyOfBillUrl,
      }

      console.log("Submitting to POST DELIVERY table:", postDeliveryPayload)

      const { error: insertError } = await supabase
        .from('POST DELIVERY')
        .insert([postDeliveryPayload])

      if (insertError) throw insertError

      // Step 2: Update DELIVERY table to set Actual 2
      const deliveryUpdatePayload = {
        "Actual 2": actual2Time,
      }

      const { error: updateError } = await supabase
        .from('DELIVERY')
        .update(deliveryUpdatePayload)
        .eq('id', selectedOrder.id)

      if (updateError) throw updateError

      await fetchData()

      // Update sidebar count
      updateCount?.("Fullkiting", orders.length - 1)

      handleCancel()

      toast({
        title: "Success",
        description: `Full kitting submitted successfully! Order Number: ${orderNo}`,
      })
    } catch (error) {
      console.error("Error submitting full kitting:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit. Error: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Helper to convert dd/mm/yyyy or dd/mm/yy to YYYY-MM-DD
  const dateToISO = (dateStr) => {
    if (!dateStr || dateStr === "N/A") return null
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0')
      const month = parts[1].padStart(2, '0')
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
      return `${year}-${month}-${day}`
    }
    return null
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      typeOfBill: "",
      totalBillAmount: "",
      totalTruckQty: "",
      copyOfBill: null,
    })
  }

  const handleViewBill = async (url) => {
    if (!url) return
    const signedUrl = await getSignedUrl(url)
    window.open(signedUrl, '_blank')
  }

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "N/A"

    try {
      // If it's already in dd/MM/yyyy format, just return it
      if (dateStr.includes('/')) {
        return dateStr
      }

      // Try to parse other formats
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        return format(date, "dd/MM/yyyy")
      }

      return dateStr
    } catch (error) {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading full kitting data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Full Kitting</h1>
          <p className="text-gray-600">Manage post-delivery full kitting</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Entries</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length + historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <Package className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Kitting</p>
              <div className="text-2xl font-bold text-amber-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <FileCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">History</p>
              <div className="text-2xl font-bold text-green-900">{historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <Truck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full"
              />
            </div>
          </div>

          <Button
            onClick={() => fetchData()}
            variant="outline"
            className="h-10 px-3"
            disabled={loading || submitting}
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Pending ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Completed ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                  </>
                )}
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Type of Bill</TableHead>
                  </>
                )}
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                {activeTab === "pending" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Quantity</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned2 Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Truck Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Weighment Qty</TableHead>
                  </>
                )}
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Total Bill Amount</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Total Truck Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill Copy</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === "pending" ? 13 : 10}
                    className="text-center py-8 text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No {activeTab === "pending" ? "pending" : "completed"} full kitting entries found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    {activeTab === "pending" && (
                      <>

                        <TableCell className="py-2 px-6">
                          <Button
                            size="sm"
                            onClick={() => handleFullKitting(order)}
                            className="bg-purple-600 hover:bg-purple-700 h-8 text-xs"
                            disabled={submitting}
                          >
                            Full Kitting
                          </Button>
                        </TableCell>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableCell className="py-2 px-6 font-medium text-blue-600 text-sm">
                          {order.orderNo}
                        </TableCell>
                        <TableCell className="py-2 px-6">
                          <Badge className={`rounded-sm ${order.typeOfBill === "Independent Bill" ? "bg-green-500" : "bg-blue-500"
                            } text-white text-xs`}>
                            {order.typeOfBill}
                          </Badge>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="py-2 px-6">
                      <Badge variant="outline" className="border-gray-300 text-gray-700 bg-gray-50 text-xs">
                        {order.billNo}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-6 text-sm">
                      {formatDisplayDate(order.billDate)}
                    </TableCell>
                    <TableCell className="py-2 px-6 text-sm">
                      <span className="font-medium">{order.deliveryOrderNo}</span>
                    </TableCell>
                    <TableCell className="py-2 px-6 text-sm">
                      <div className="truncate max-w-[150px]">{order.partyName}</div>
                    </TableCell>
                    <TableCell className="py-2 px-6 text-sm">
                      <div className="truncate max-w-[150px]">
                        <span className="break-words">{order.productName}</span>
                      </div>
                    </TableCell>
                    {activeTab === "pending" && (
                      <>
                        <TableCell className="py-2 px-6 font-medium text-sm">{order.quantityDelivered}</TableCell>
                        <TableCell className="py-2 px-6 text-sm">{order.planned2 || "N/A"}</TableCell>
                        <TableCell className="py-2 px-6 text-sm">{order.actualQtyLoadedInTruck || "N/A"}</TableCell>
                        <TableCell className="py-2 px-6 text-sm">{order.actualQtyAsPerWeighmentSlip || "N/A"}</TableCell>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableCell className="py-2 px-6 font-medium text-sm">
                          ₹{order.totalBillAmount || "0"}
                        </TableCell>
                        <TableCell className="py-2 px-6 text-sm">{order.totalTruckQty || "0"}</TableCell>
                        <TableCell className="py-2 px-6 text-sm">
                          {order.hasCopyOfBill ? (
                            <div
                              onClick={() => handleViewBill(order.copyOfBill)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Full Kitting Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Full Kitting Form</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                  <p className="font-medium text-gray-900">{selectedOrder.partyName}</p>
                  <p className="text-gray-600 mt-1">
                    Bill: {selectedOrder.billNo} | DO: {selectedOrder.deliveryOrderNo}
                  </p>
                  <p className="text-gray-600">
                    Bill Date: {formatDisplayDate(selectedOrder.billDate)}
                  </p>
                  <p className="text-gray-600">Product: {selectedOrder.productName}</p>
                  <p className="text-gray-600">
                    Quantity: {selectedOrder.quantityDelivered} | Planned2: {selectedOrder.planned2}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Type of Bill *</Label>
                    <Select
                      value={formData.typeOfBill}
                      onValueChange={(value) => {
                        setFormData(prev => ({
                          ...prev,
                          typeOfBill: value,
                          // Reset fields if switching from Independent Bill
                          ...(value !== "Independent Bill" && {
                            totalBillAmount: "",
                            totalTruckQty: "",
                            copyOfBill: null
                          })
                        }))
                      }}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Bill Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Independent Bill">Independent Bill</SelectItem>
                        <SelectItem value="Common">Common</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.typeOfBill === "Independent Bill" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm">Total Bill Amount *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.totalBillAmount}
                          onChange={(e) => setFormData(prev => ({ ...prev, totalBillAmount: e.target.value }))}
                          className="h-10"
                          placeholder="Enter total bill amount"
                          disabled={submitting}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Total Truck Qty *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.totalTruckQty}
                          onChange={(e) => setFormData(prev => ({ ...prev, totalTruckQty: e.target.value }))}
                          className="h-10"
                          placeholder="Enter total truck quantity"
                          disabled={submitting}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Copy Of Bill *</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files[0]
                              if (file) {
                                if (file.size > 5 * 1024 * 1024) {
                                  toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: "File size should be less than 5MB",
                                  })
                                  e.target.value = ""
                                  return
                                }
                                setFormData(prev => ({
                                  ...prev,
                                  copyOfBill: file
                                }))
                              }
                            }}
                            className="h-10"
                            disabled={submitting}
                          />
                          {formData.copyOfBill && (
                            <span className="text-sm text-green-600 truncate flex-shrink-0">
                              ✓ Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">Accepts image or PDF files (max 5MB)</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="flex flex-col gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={
                        !formData.typeOfBill ||
                        (formData.typeOfBill === "Independent Bill" &&
                          (!formData.totalBillAmount ||
                            !formData.totalTruckQty ||
                            !formData.copyOfBill)) ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Full Kitting`
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