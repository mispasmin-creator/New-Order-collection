"use client"

import { useState, useEffect } from "react"
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

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"
const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-"

export default function FullKittingPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    typeOfBill: "",
    totalBillAmount: "",
    totalTruckQty: "",
    copyOfBill: null,
  })
  // const [generatedOrderNo, setGeneratedOrderNo] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    // Generate order number when order is selected
    if (selectedOrder) {
      const orderNo = generateOrderNo()
      // setGeneratedOrderNo(orderNo)
    }
  }, [selectedOrder])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch pending orders from DELIVERY sheet
      const deliveryResponse = await fetch(`${SCRIPT_URL}?sheet=DELIVERY`)
      if (deliveryResponse.ok) {
        const deliveryData = await deliveryResponse.json()
        
        if (deliveryData.success && deliveryData.data) {
          const pendingOrders = getPendingOrders(deliveryData.data)
          setOrders(pendingOrders)
          console.log("Pending orders loaded:", pendingOrders.length)
        }
      }
      
      // Fetch history from POST DELIVERY sheet
      const postDeliveryResponse = await fetch(`${SCRIPT_URL}?sheet=POST%20DELIVERY`)
      if (postDeliveryResponse.ok) {
        const postDeliveryData = await postDeliveryResponse.json()
        
        if (postDeliveryData.success && postDeliveryData.data) {
          const historyOrders = transformPostDeliveryData(postDeliveryData.data)
          setHistoryOrders(historyOrders)
          console.log("History orders loaded:", historyOrders.length)
        }
      }
      
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Get pending orders from DELIVERY sheet where Planned2 has value but Actual2 is empty
  const getPendingOrders = (sheetData) => {
    if (!sheetData || sheetData.length < 2) return []
    
    // Find header row
    let headerRowIndex = -1
    let headers = []
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (row && row.length > 0) {
        const hasTimestamp = row.some(cell => 
          cell && cell.toString().trim().toLowerCase().includes("timestamp")
        )
        if (hasTimestamp) {
          headerRowIndex = i
          headers = row.map(h => h?.toString().trim() || "")
          break
        }
      }
    }
    
    if (headerRowIndex === -1) {
      console.log("No headers found in DELIVERY sheet")
      return []
    }
    
    // Get column indices for DELIVERY sheet
    const indices = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes("timestamp")),
      billDate: headers.findIndex(h => h.toLowerCase().includes("bill date")),
      deliveryOrderNo: headers.findIndex(h => h.toLowerCase().includes("delivery order")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party name")),
      productName: headers.findIndex(h => h.toLowerCase().includes("product name")),
      quantityDelivered: headers.findIndex(h => h.toLowerCase().includes("quantity delivered")),
      billNo: headers.findIndex(h => h.toLowerCase().includes("bill no")),
      logisticNo: headers.findIndex(h => h.toLowerCase().includes("losgistic no") || h.toLowerCase().includes("logistic no")),
      rateOfMaterial: headers.findIndex(h => h.toLowerCase().includes("rate of material")),
      typeOfTransporting: headers.findIndex(h => h.toLowerCase().includes("type of transporting")),
      transporterName: headers.findIndex(h => h.toLowerCase().includes("transporter name")),
      vehicleNumber: headers.findIndex(h => h.toLowerCase().includes("vehicle number")),
      biltyNumber: headers.findIndex(h => h.toLowerCase().includes("bilty number")),
      givingFromWhere: headers.findIndex(h => h.toLowerCase().includes("giving from where")),
      planned2: headers.findIndex(h => h.toLowerCase().includes("planned 2")),
      actual2: headers.findIndex(h => h.toLowerCase().includes("actual 2")),
      delay2: headers.findIndex(h => h.toLowerCase().includes("delay 2") || h.toLowerCase().includes("delay2")),
      actualQtyLoadedInTruck: headers.findIndex(h => h.toLowerCase().includes("actual qty loaded in truck")),
      actualQtyAsPerWeighmentSlip: headers.findIndex(h => h.toLowerCase().includes("actual qty as per weighment slip")),
    }
    
    console.log("DELIVERY Column indices for Planned2:", indices)
    
    const pendingOrders = []
    
    // Start from row after header
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const getVal = (index) => {
        if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
          return row[index].toString().trim()
        }
        return ""
      }
      
      const planned2 = getVal(indices.planned2)
      const actual2 = getVal(indices.actual2)
      const billNo = getVal(indices.billNo)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      
      // Check if Planned2 has value, Actual2 is empty, and there's a Bill No
      if (planned2 && planned2 !== "" && (!actual2 || actual2 === "") && billNo && billNo !== "") {
        // Format bill date properly
        const billDateRaw = getVal(indices.billDate)
        let formattedBillDate = billDateRaw
        
        try {
          // Handle different date formats
          if (billDateRaw.includes('T')) {
            // ISO format: 2026-01-22T18:30:00.000Z
            const date = new Date(billDateRaw)
            if (!isNaN(date.getTime())) {
              formattedBillDate = format(date, "dd/MM/yyyy")
            }
          } else if (billDateRaw.includes('/')) {
            // Already in dd/MM/yyyy format
            formattedBillDate = billDateRaw
          }
        } catch (error) {
          console.error("Error formatting bill date:", error)
        }
        
        const order = {
          id: i,
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          timestamp: getVal(indices.timestamp),
          billDate: formattedBillDate,
          deliveryOrderNo: deliveryOrderNo,
          partyName: getVal(indices.partyName),
          productName: getVal(indices.productName),
          quantityDelivered: getVal(indices.quantityDelivered),
          billNo: billNo,
          logisticNo: getVal(indices.logisticNo),
          rateOfMaterial: getVal(indices.rateOfMaterial),
          typeOfTransporting: getVal(indices.typeOfTransporting),
          transporterName: getVal(indices.transporterName),
          vehicleNumber: getVal(indices.vehicleNumber),
          biltyNumber: getVal(indices.biltyNumber),
          givingFromWhere: getVal(indices.givingFromWhere),
          planned2: planned2,
          actual2: actual2,
          delay2: getVal(indices.delay2),
          actualQtyLoadedInTruck: getVal(indices.actualQtyLoadedInTruck),
          actualQtyAsPerWeighmentSlip: getVal(indices.actualQtyAsPerWeighmentSlip),
        }
        
        pendingOrders.push(order)
      }
    }
    
    console.log("Total pending orders for full kitting found:", pendingOrders.length)
    return pendingOrders
  }

  const transformPostDeliveryData = (sheetData) => {
    if (!sheetData || sheetData.length === 0) return []
    
    // Find header row
    let headerRowIndex = -1
    let headers = []
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (row && row.length > 0) {
        const hasTimestamp = row.some(cell => 
          cell && cell.toString().trim().toLowerCase().includes("timestamp")
        )
        if (hasTimestamp) {
          headerRowIndex = i
          headers = row.map(h => h?.toString().trim() || "")
          break
        }
      }
    }
    
    if (headerRowIndex === -1) {
      console.log("No headers found in POST DELIVERY sheet")
      return []
    }
    
    // Get column indices for POST DELIVERY sheet
    const indices = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes("timestamp")),
      orderNo: headers.findIndex(h => h.toLowerCase().includes("order no")),
      typeOfBill: headers.findIndex(h => h.toLowerCase().includes("type of bill")),
      billNo: headers.findIndex(h => h.toLowerCase().includes("bill no")),
      billDate: headers.findIndex(h => h.toLowerCase().includes("bill date")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party name")),
      totalBillAmount: headers.findIndex(h => h.toLowerCase().includes("total bill amount")),
      totalTruckQty: headers.findIndex(h => h.toLowerCase().includes("total truck qty")),
      copyOfBill: headers.findIndex(h => h.toLowerCase().includes("copy of bill")),
    }
    
    console.log("POST DELIVERY Column indices:", indices)
    
    const historyOrders = []
    
    // Start from row after header
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const getVal = (index) => {
        if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
          return row[index].toString().trim()
        }
        return ""
      }
      
      const timestamp = getVal(indices.timestamp)
      const orderNo = getVal(indices.orderNo)
      const billNo = getVal(indices.billNo)
      const copyOfBillUrl = getVal(indices.copyOfBill)
      
      // Only add if it has some data
      if (timestamp || orderNo || billNo) {
        // Format bill date properly
        const billDateRaw = getVal(indices.billDate)
        let formattedBillDate = billDateRaw
        
        try {
          // Handle different date formats
          if (billDateRaw.includes('T')) {
            // ISO format: 2026-01-22T18:30:00.000Z
            const date = new Date(billDateRaw)
            if (!isNaN(date.getTime())) {
              formattedBillDate = format(date, "dd/MM/yyyy")
            }
          } else if (billDateRaw.includes('/')) {
            // Already in dd/MM/yyyy format
            formattedBillDate = billDateRaw
          }
        } catch (error) {
          console.error("Error formatting bill date:", error)
        }
        
        const historyOrder = {
          id: i,
          timestamp: timestamp,
          orderNo: orderNo,
          typeOfBill: getVal(indices.typeOfBill),
          billNo: billNo,
          billDate: formattedBillDate,
          partyName: getVal(indices.partyName),
          totalBillAmount: getVal(indices.totalBillAmount),
          totalTruckQty: getVal(indices.totalTruckQty),
          copyOfBill: copyOfBillUrl,
          hasCopyOfBill: copyOfBillUrl && copyOfBillUrl.trim() !== "" && 
            (copyOfBillUrl.includes("drive.google.com") || 
             copyOfBillUrl.includes("https://") || 
             copyOfBillUrl.includes("http://")),
        }
        
        historyOrders.push(historyOrder)
      }
    }
    
    console.log("Total POST DELIVERY history orders found:", historyOrders.length)
    return historyOrders
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
    const orderNo = generateOrderNo()
    // setGeneratedOrderNo(orderNo)
    setFormData({
      typeOfBill: "",
      totalBillAmount: "",
      totalTruckQty: "",
      copyOfBill: null,
    })
  }

  const generateOrderNo = () => {
    const now = new Date()
    const dateStr = format(now, "yyyyMMdd")
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    const orderNo = `ORD-${dateStr}-${randomNum}`
    console.log("Generated Order No:", orderNo)
    return orderNo
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

 const handleSubmit = async () => {
  if (!selectedOrder) return

  try {
    setSubmitting(true)
    
    const now = new Date()
    const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    const actual2Date = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} 18:00:00`
    
    let copyOfBillUrl = ""
    
    // Upload copy of bill if provided and type is Independent Bill
    if (formData.typeOfBill === "Independent Bill" && formData.copyOfBill) {
      try {
        const base64Data = await fileToBase64(formData.copyOfBill)
        
        const formDataToSend = new FormData()
        formDataToSend.append('action', 'uploadFile')
        formDataToSend.append('base64Data', base64Data)
        formDataToSend.append('fileName', `bill_copy_${selectedOrder.billNo}_${Date.now()}.${formData.copyOfBill.name.split('.').pop()}`)
        formDataToSend.append('mimeType', formData.copyOfBill.type)
        formDataToSend.append('folderId', FOLDER_ID)
        
        const uploadResponse = await fetch(SCRIPT_URL, {
          method: 'POST',
          body: formDataToSend,
        })
        
        const uploadResult = await uploadResponse.json()
        
        if (uploadResult.success && uploadResult.fileUrl) {
          copyOfBillUrl = uploadResult.fileUrl
          console.log("Bill copy uploaded:", copyOfBillUrl)
        }
      } catch (uploadError) {
        console.error("Error uploading bill copy:", uploadError)
      }
    }
    
    // Step 1: Submit to POST DELIVERY sheet
    // Use Delivery Order No. as Order No.
    const orderNo = selectedOrder.deliveryOrderNo
    const currentBillDate = selectedOrder.billDate || format(now, "dd/MM/yyyy")
    
    const postDeliveryRowData = [
      timestamp,                           // Timestamp
      orderNo,                            // Order No. (now using Delivery Order No.)
      formData.typeOfBill,                // Type of Bill
      selectedOrder.billNo,               // Bill No.
      currentBillDate,                    // Bill Date (already formatted)
      selectedOrder.partyName,            // Party Name
      formData.typeOfBill === "Independent Bill" ? formData.totalBillAmount : "0",  // Total Bill Amount
      formData.typeOfBill === "Independent Bill" ? formData.totalTruckQty : "0",    // Total Truck Qty
      copyOfBillUrl,                      // Copy Of Bill
    ]

    console.log("Submitting to POST DELIVERY sheet:", postDeliveryRowData)

    const postDeliveryResponse = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        action: 'insert',
        sheetName: 'POST DELIVERY',
        rowData: JSON.stringify(postDeliveryRowData)
      })
    })

    if (!postDeliveryResponse.ok) {
      throw new Error(`HTTP error! status: ${postDeliveryResponse.status}`)
    }

    const postDeliveryResult = await postDeliveryResponse.json()
    console.log("POST DELIVERY sheet response:", postDeliveryResult)

    if (postDeliveryResult.success) {
      // Step 2: Update DELIVERY sheet to set Actual2
      const deliveryUpdateResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'updateCell',
          sheetName: 'DELIVERY',
          rowIndex: selectedOrder.rowIndex.toString(),
          columnIndex: "27", // Actual2 is at column 27 (0-indexed: 26+1 for 1-indexed sheets)
          value: actual2Date
        })
      })

      if (!deliveryUpdateResponse.ok) {
        console.error("Failed to update DELIVERY sheet")
      }

      // Refresh data
      await fetchData()
      
      // Clear form and selection
      setSelectedOrder(null)
      setFormData({
        typeOfBill: "",
        totalBillAmount: "",
        totalTruckQty: "",
        copyOfBill: null,
      })
      
      alert(`✓ Full kitting submitted successfully!\nOrder Number: ${orderNo}`)
      
    } else {
      throw new Error(postDeliveryResult.error || "Failed to submit to POST DELIVERY sheet")
    }
    
  } catch (error) {
    console.error("Error submitting full kitting:", error)
    alert(`✗ Failed to submit. Error: ${error.message}`)
  } finally {
    setSubmitting(false)
  }
}

  const handleCancel = () => {
    setSelectedOrder(null)
    // setGeneratedOrderNo("")
    setFormData({
      typeOfBill: "",
      totalBillAmount: "",
      totalTruckQty: "",
      copyOfBill: null,
    })
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
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Full Kitting</h1>
        <p className="text-sm text-gray-600 mt-1">Manage post-delivery full kitting</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Full Kitting Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Pending: {orders.length} | Completed: {historyOrders.length}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            <div className="flex bg-gray-100 p-1 rounded-t-lg">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "pending" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "history" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Completed ({historyOrders.length})
              </button>
            </div>

            <div className="bg-white p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50 w-full"
                />
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                    {activeTab === "pending" && (
                      <>
                        {/* <TableHead className="font-semibold text-gray-900 py-4 px-6">Order No.</TableHead> */}
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
                        No {activeTab === "pending" ? "pending" : "completed"} full kitting entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <>
                            
                            <TableCell className="py-4 px-6">
                              <Button
                                size="sm"
                                onClick={() => handleFullKitting(order)}
                                className="bg-purple-600 hover:bg-purple-700"
                                disabled={submitting}
                              >
                                Full Kitting
                              </Button>
                            </TableCell>
                          </>
                        )}
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6 font-medium text-blue-600">
                              {order.orderNo}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge className={`rounded-full ${
                                order.typeOfBill === "Independent Bill" ? "bg-green-500" : "bg-blue-500"
                              } text-white`}>
                                {order.typeOfBill}
                              </Badge>
                            </TableCell>
                          </>
                        )}
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-green-500 text-white rounded-full">
                            {order.billNo}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {formatDisplayDate(order.billDate)}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className="font-medium">{order.deliveryOrderNo}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="max-w-[200px]">
                            <span className="break-words">{order.productName}</span>
                          </div>
                        </TableCell>
                        {activeTab === "pending" && (
                          <>
                            <TableCell className="py-4 px-6 font-medium">{order.quantityDelivered}</TableCell>
                            <TableCell className="py-4 px-6">{order.planned2 || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">{order.actualQtyLoadedInTruck || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">{order.actualQtyAsPerWeighmentSlip || "N/A"}</TableCell>
                          </>
                        )}
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6 font-medium">
                              ₹{order.totalBillAmount || "0"}
                            </TableCell>
                            <TableCell className="py-4 px-6">{order.totalTruckQty || "0"}</TableCell>
                            <TableCell className="py-4 px-6">
                              {order.hasCopyOfBill ? (
                                <a 
                                  href={order.copyOfBill} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded-full text-sm"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Available
                                </a>
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

            {/* Mobile View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {displayOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No {activeTab === "pending" ? "pending" : "completed"} full kitting entries found
                  </p>
                ) : (
                  displayOrders.map((order) => (
                    <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          {activeTab === "history" && (
                            <>
                              <p className="text-blue-600 font-medium text-sm mb-1">
                                {order.orderNo}
                              </p>
                              <Badge className={`mb-1 text-xs ${
                                order.typeOfBill === "Independent Bill" ? "bg-green-500" : "bg-blue-500"
                              } text-white`}>
                                {order.typeOfBill}
                              </Badge>
                            </>
                          )}
                          {activeTab === "pending" && (
                            <p className="text-gray-500 text-sm mb-1">Pending...</p>
                          )}
                          <p className="font-semibold text-gray-900">{order.partyName}</p>
                          <p className="text-xs text-gray-500">
                            Bill: {order.billNo} | DO: {order.deliveryOrderNo}
                          </p>
                          <p className="text-xs text-gray-500">
                            Bill Date: {formatDisplayDate(order.billDate)}
                          </p>
                          {activeTab === "pending" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Planned: {order.planned2 || "N/A"}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {activeTab === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => handleFullKitting(order)}
                              className="bg-purple-600 hover:bg-purple-700"
                              disabled={submitting}
                            >
                              Kitting
                            </Button>
                          ) : (
                            <p className="text-sm font-medium">₹{order.totalBillAmount || "0"}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Product:</span>
                          <span>{order.productName}</span>
                        </div>
                        {activeTab === "pending" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Quantity:</span>
                              <span className="font-medium">{order.quantityDelivered}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Truck Qty:</span>
                              <span>{order.actualQtyLoadedInTruck || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Weighment Qty:</span>
                              <span>{order.actualQtyAsPerWeighmentSlip || "N/A"}</span>
                            </div>
                          </>
                        )}
                        {activeTab === "history" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Truck Qty:</span>
                              <span>{order.totalTruckQty || "0"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Bill Copy:</span>
                              {order.hasCopyOfBill ? (
                                <a 
                                  href={order.copyOfBill} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded text-xs"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View Bill
                                </a>
                              ) : (
                                <span className="text-gray-400 text-xs">N/A</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

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
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{selectedOrder.partyName}</p>
                  <p className="text-sm text-gray-600">
                    Bill: {selectedOrder.billNo} | DO: {selectedOrder.deliveryOrderNo}
                  </p>
                  <p className="text-sm text-gray-600">
                    Bill Date: {formatDisplayDate(selectedOrder.billDate)}
                  </p>
                  <p className="text-sm text-gray-600">Product: {selectedOrder.productName}</p>
                  <p className="text-sm text-gray-600">
                    Quantity: {selectedOrder.quantityDelivered} | Planned2: {selectedOrder.planned2}
                  </p>
                  {/* <p className="text-sm text-green-600 font-medium mt-1">
                    Order No: <span className="font-bold">{generatedOrderNo}</span>
                  </p> */}
                </div>

                <div className="space-y-3">
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
                                  alert("File size should be less than 5MB")
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
                            <span className="text-sm text-green-600 truncate">
                              ✓ {formData.copyOfBill.name}
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

      <div className="flex justify-center">
        <Button 
          onClick={fetchData} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
          disabled={submitting}
        >
          <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>
    </div>
  )
}