"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2 } from "lucide-react"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

export default function DispatchPlanningPage({ user }) {
  const [orders, setOrders] = useState([])
  const [dispatchOrders, setDispatchOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    qtyToBeDispatched: "",
    typeOfTransporting: "",
    dateOfDispatch: "",
    toBeReconfirm: "Yes",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch from ORDER RECEIPT sheet
      const response = await fetch(`${SCRIPT_URL}?sheet=ORDER%20RECEIPT`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.data) {
        const transformedOrders = transformSheetData(data.data)
        setOrders(transformedOrders)
        console.log("ORDER RECEIPT data loaded:", transformedOrders.length, "orders")
      } else {
        console.error("Failed to load ORDER RECEIPT data:", data)
      }
      
      // Fetch from DISPATCH sheet
      const dispatchResponse = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      if (dispatchResponse.ok) {
        const dispatchData = await dispatchResponse.json()
        console.log("Raw DISPATCH API response:", dispatchData)
        
        if (dispatchData.success && dispatchData.data) {
          const transformedDispatch = transformDispatchData(dispatchData.data)
          setDispatchOrders(transformedDispatch)
          console.log("DISPATCH data loaded:", transformedDispatch.length, "dispatch records")
        } else {
          console.error("Failed to load DISPATCH data:", dispatchData)
        }
      } else {
        console.error("Failed to fetch DISPATCH sheet")
      }
      
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ""
    try {
      // Check if it's already a valid date string
      if (typeof dateString === 'string' && dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
        return dateString.split(' ')[0] // Return date part only
      }
      
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString // Return as is if not a date
      
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      
      return `${day}/${month}/${year}`
    } catch {
      return dateString
    }
  }

  const transformSheetData = (sheetData) => {
    if (!sheetData || sheetData.length < 6) return []
    
    // Headers are at index 5 (6th row)
    const headers = sheetData[5].map(header => header ? header.toString().trim() : "")
    
    console.log("ORDER RECEIPT Headers found:", headers)
    
    // Find the exact column indices
    const indices = {
      serialNo: headers.findIndex(h => h.includes("Sr No")),
      firmName: headers.findIndex(h => h.includes("Firm Name")),
      partyPONo: headers.findIndex(h => h.includes("PARTY PO NO")),
      partyName: headers.findIndex(h => h.includes("Party Names")),
      productName: headers.findIndex(h => h.includes("Product Name")),
      quantity: headers.findIndex(h => h.includes("Quantity")),
      status: headers.findIndex(h => h.includes("Status")),
      quantityDelivered: headers.findIndex(h => {
  const headerText = h
    ?.toLowerCase()
    .replace(/\s+/g, " ")   // replaces \n, tabs, extra spaces
    .trim();

  return headerText === "quantity delivered" ||
         headerText.includes("qty delivered") ||
         headerText.includes("delivered qty");
}),

      pendingQty: headers.findIndex(h => {
        const headerText = h.toLowerCase().trim();
        return headerText.includes("pending qty") || 
               headerText.includes("pending quantity") ||
               headerText === "pending";
      }),
      deliveryOrderNo: headers.findIndex(h => h.includes("Delivery Order No")),
      planned4: headers.findIndex(h => h.trim() === "Planned 4"),
      actual4: headers.findIndex(h => h.trim() === "Actual 4"),
    }
    
    // Log the found indices for debugging
    console.log("ORDER RECEIPT Column indices found:", {
      ...indices,
      quantityDeliveredHeader: indices.quantityDelivered >= 0 ? headers[indices.quantityDelivered] : "Not Found",
      pendingQtyHeader: indices.pendingQty >= 0 ? headers[indices.pendingQty] : "Not Found"
    })
    
    const orders = []
    
    // Data starts from index 6 (7th row)
    for (let i = 6; i < sheetData.length; i++) {
      const row = sheetData[i]
      
      if (!row || row.length === 0) continue
      
      const getValue = (index) => {
        if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
          const val = row[index];
          return val.toString().trim()
        }
        return ""
      }
      
      // Get raw values - no calculations
      const orderQuantity = getValue(indices.quantity);
      const quantityDelivered = getValue(indices.quantityDelivered);
      const pendingQty = getValue(indices.pendingQty);
      
      const order = {
        id: i,
        rowIndex: i + 1,
        serialNo: getValue(indices.serialNo) || `Row ${i - 5}`,
        firmName: getValue(indices.firmName) || "N/A",
        partyPONumber: getValue(indices.partyPONo) || "N/A",
        partyName: getValue(indices.partyName) || "N/A",
        productName: getValue(indices.productName) || "N/A",
        quantity: orderQuantity,
        status: getValue(indices.status) || "Pending",
        quantityDelivered: quantityDelivered,
        pendingQty: pendingQty, // Use the value directly from sheet
        deliveryOrderNo: getValue(indices.deliveryOrderNo) || "",
        planned4: formatDate(getValue(indices.planned4)),
        actual4: formatDate(getValue(indices.actual4)),
      }
      
      // Debug log for first few rows
      if (i < 10) {
        console.log(`Row ${i}:`, {
          orderQuantity,
          quantityDelivered,
          pendingQty,
          deliveryOrderNo: order.deliveryOrderNo
        });
      }
      
      orders.push(order)
    }
    
    console.log("Total orders transformed:", orders.length)
    return orders
  }

  const transformDispatchData = (sheetData) => {
    if (!sheetData || sheetData.length === 0) return []
    
    console.log("Raw DISPATCH sheet data:", sheetData)
    
    // Find the header row - look for "Timestamp" in any row
    let headerRowIndex = -1
    let headers = []
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (row && row.length > 0) {
        // Check if this row contains "Timestamp"
        const hasTimestamp = row.some(cell => 
          cell && cell.toString().trim().toLowerCase().includes("timestamp")
        )
        
        if (hasTimestamp) {
          headerRowIndex = i
          headers = row.map(h => h?.toString().trim() || "")
          console.log("Found headers at row:", headerRowIndex + 1)
          console.log("Headers:", headers)
          break
        }
      }
    }
    
    if (headerRowIndex === -1) {
      console.log("No headers found in DISPATCH sheet")
      return []
    }
    
    // Exact header names from your sheet
    const indices = {
      timestamp: headers.indexOf("Timestamp"),
      dSrNumber: headers.indexOf("D-Sr Number"),
      deliveryOrderNo: headers.indexOf("Delivery Order No."),
      partyName: headers.indexOf("Party Name"),
      productName: headers.indexOf("Product Name"),
      qtyToBeDispatched: headers.indexOf("Qty To Be Dispatched"),
      typeOfTransporting: headers.indexOf("Type Of Transporting"),
      dateOfDispatch: headers.indexOf("Date Of Dispatch"),
      toBeReconfirm: headers.indexOf("To Be Reconfirm"),
    }
    
    // If exact match fails, try case-insensitive search
    if (indices.timestamp === -1) {
      indices.timestamp = headers.findIndex(h => h.toLowerCase().includes("timestamp"))
    }
    if (indices.dSrNumber === -1) {
      indices.dSrNumber = headers.findIndex(h => h.toLowerCase().includes("d-sr") || h.toLowerCase().includes("dsr"))
    }
    if (indices.deliveryOrderNo === -1) {
      indices.deliveryOrderNo = headers.findIndex(h => h.toLowerCase().includes("delivery order"))
    }
    if (indices.partyName === -1) {
      indices.partyName = headers.findIndex(h => h.toLowerCase().includes("party name"))
    }
    if (indices.productName === -1) {
      indices.productName = headers.findIndex(h => h.toLowerCase().includes("product name"))
    }
    if (indices.qtyToBeDispatched === -1) {
      indices.qtyToBeDispatched = headers.findIndex(h => h.toLowerCase().includes("qty to be"))
    }
    if (indices.typeOfTransporting === -1) {
      indices.typeOfTransporting = headers.findIndex(h => h.toLowerCase().includes("type of transporting"))
    }
    if (indices.dateOfDispatch === -1) {
      indices.dateOfDispatch = headers.findIndex(h => h.toLowerCase().includes("date of dispatch"))
    }
    if (indices.toBeReconfirm === -1) {
      indices.toBeReconfirm = headers.findIndex(h => h.toLowerCase().includes("to be reconfirm"))
    }
    
    console.log("DISPATCH Column indices:", indices)
    
    const dispatchOrders = []
    
    // Data starts from the next row after headers
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const getVal = (index) => {
        if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
          const value = row[index].toString().trim()
          return value !== "" ? value : ""
        }
        return ""
      }
      
      const timestamp = getVal(indices.timestamp)
      const dSrNumber = getVal(indices.dSrNumber)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      const partyName = getVal(indices.partyName)
      
      // Only add if it has some meaningful data (not empty rows)
      if (timestamp || dSrNumber || deliveryOrderNo || partyName) {
        const dispatchOrder = {
          id: i,
          timestamp: timestamp,
          dSrNumber: dSrNumber,
          deliveryOrderNo: deliveryOrderNo,
          partyName: partyName,
          productName: getVal(indices.productName),
          qtyToBeDispatched: getVal(indices.qtyToBeDispatched),
          typeOfTransporting: getVal(indices.typeOfTransporting),
          dateOfDispatch: getVal(indices.dateOfDispatch),
          toBeReconfirm: getVal(indices.toBeReconfirm),
        }
        
        dispatchOrders.push(dispatchOrder)
      }
    }
    
    console.log("Total dispatch orders found:", dispatchOrders.length)
    if (dispatchOrders.length > 0) {
      console.log("First dispatch order:", dispatchOrders[0])
      console.log("Last dispatch order:", dispatchOrders[dispatchOrders.length - 1])
    }
    return dispatchOrders
  }

  // Filter orders: Show only if status is "Pending"
  const getPendingOrders = () => {
    let filtered = orders.filter((order) => {
      return order.status.toLowerCase() === "pending"
    })
    
    if (user.role !== "master") {
      filtered = filtered.filter((order) => order.firmName === user.firm)
    }
    return filtered
  }

  const getHistoryOrders = () => {
    // Simply return all dispatch orders from DISPATCH sheet
    console.log("Getting history orders. Total dispatch orders:", dispatchOrders.length)
    
    const historyOrders = dispatchOrders.map(dispatch => {
      return {
        id: dispatch.id,
        timestamp: dispatch.timestamp || "",
        dSrNumber: dispatch.dSrNumber || "N/A",
        deliveryOrderNo: dispatch.deliveryOrderNo || "N/A",
        firmName: " ", // We'll try to find it if needed
        partyName: dispatch.partyName || "N/A",
        productName: dispatch.productName || "N/A",
        qtyToBeDispatched: dispatch.qtyToBeDispatched || "0",
        typeOfTransporting: dispatch.typeOfTransporting || "",
        dateOfDispatch: dispatch.dateOfDispatch || "",
        toBeReconfirm: dispatch.toBeReconfirm || "",
        status: "Dispatched"
      }
    })
    
    console.log("History orders prepared:", historyOrders.length)
    
    // Filter by firm if not master
    if (user.role !== "master") {
      return historyOrders.filter(order => order.firmName === user.firm)
    }
    
    return historyOrders
  }

  const pendingOrders = getPendingOrders()
  const historyOrders = getHistoryOrders()

  // Apply search filter
  const searchFilteredOrders = (ordersList) => {
    return ordersList.filter((order) =>
      Object.values(order).some((value) => 
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayOrders =
    activeTab === "pending" ? searchFilteredOrders(pendingOrders) : searchFilteredOrders(historyOrders)

  const generateDSrNumber = () => {
    if (dispatchOrders.length === 0) return "D-01"
    
    // Extract all D-Sr numbers and find the maximum
    const dSrNumbers = dispatchOrders
      .map(order => order.dSrNumber)
      .filter(dSr => dSr && dSr.match(/^D-\d+$/i)) // Match exact pattern D-01, D-02, etc.
    
    if (dSrNumbers.length === 0) return "D-01"
    
    // Extract numbers and find the maximum
    let maxNumber = 0
    dSrNumbers.forEach(dSr => {
      const match = dSr.match(/D-(\d+)/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num
        }
      }
    })
    
    // Return next number with leading zero
    return `D-${String(maxNumber + 1).padStart(2, '0')}`
  }

  const handlePlanning = (order) => {
    // Use pendingQty directly from sheet
    setSelectedOrder(order)
    setFormData({
      qtyToBeDispatched: order.pendingQty || "0",
      typeOfTransporting: "",
      dateOfDispatch: "",
      toBeReconfirm: "Yes",
    })
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)
      
      const dSrNumber = generateDSrNumber()
      const now = new Date()
      const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      
      let formattedDispatchDate = formData.dateOfDispatch
      if (formData.dateOfDispatch.includes('-')) {
        const [year, month, day] = formData.dateOfDispatch.split('-')
        formattedDispatchDate = `${day}/${month}/${year}`
      }
      
      // Submit only to DISPATCH sheet (9 columns as per your screenshot)
      const dispatchData = [
        timestamp,                     // Timestamp
        dSrNumber,                     // D-Sr Number (auto-incremented)
        selectedOrder.deliveryOrderNo || "N/A", // Delivery Order No.
        selectedOrder.partyName || "",     // Party Name
        selectedOrder.productName || "",   // Product Name
        formData.qtyToBeDispatched,    // Qty To Be Dispatched
        formData.typeOfTransporting,   // Type Of Transporting
        formattedDispatchDate + " 18:00:00", // Date Of Dispatch
        formData.toBeReconfirm,        // To Be Reconfirm
      ]

      console.log("Submitting to DISPATCH sheet:", dispatchData)

      // Submit to DISPATCH sheet only
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'insert',
          sheetName: 'DISPATCH',
          rowData: JSON.stringify(dispatchData)
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log("Google Apps Script response:", result)

      if (result.success) {
        // Refresh data immediately
        await fetchData()
        
        // Clear form and selection
        setSelectedOrder(null)
        setFormData({
          qtyToBeDispatched: "",
          typeOfTransporting: "",
          dateOfDispatch: "",
          toBeReconfirm: "Yes",
        })
        
        // Show success message
        alert("✓ Dispatch submitted successfully to DISPATCH sheet!")
        
      } else {
        throw new Error(result.error || "Failed to submit to Google Sheets")
      }
      
    } catch (error) {
      console.error("Error submitting dispatch:", error)
      alert(`✗ Failed to submit. Error: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      qtyToBeDispatched: "",
      typeOfTransporting: "",
      dateOfDispatch: "",
      toBeReconfirm: "Yes",
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading orders from Google Sheets...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-gray-900">Dispatch Planning</h1>
        <p className="text-gray-600">Plan and schedule order dispatches</p>
      </div>

      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Dispatch Planning</h1>
        <p className="text-sm text-gray-600 mt-1">Schedule dispatches</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Dispatch Planning</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Total orders: {orders.length} | Pending: {pendingOrders.length} | History: {historyOrders.length}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            <div className="flex bg-gray-100 p-1 rounded-t-lg">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending ({pendingOrders.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                History ({historyOrders.length})
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

            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                    {activeTab === "pending" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Timestamp</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">D-Sr Number</TableHead>
                      </>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    {activeTab === "pending" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Order Qty</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivered</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Pending</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Status</TableHead>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Qty Dispatched</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Transport Type</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Dispatch Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Reconfirm</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 10 : 10} 
                        className="text-center py-8 text-gray-500"
                      >
                        No {activeTab === "pending" ? "pending" : "dispatch history"} found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => {
                      // PENDING TAB
                      if (activeTab === "pending") {
                        return (
                          <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                            <TableCell className="py-4 px-6">
                              <Button
                                size="sm"
                                onClick={() => handlePlanning(order)}
                                className="bg-blue-600 hover:bg-blue-700"
                                disabled={submitting}
                              >
                                {submitting ? "Submitting..." : "Dispatch"}
                              </Button>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <span className="font-medium">{order.deliveryOrderNo || "N/A"}</span>
                            </TableCell>
                            <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                            <TableCell className="py-4 px-6">{order.productName}</TableCell>
                            <TableCell className="py-4 px-6 font-medium">{order.quantity}</TableCell>
                            <TableCell className="py-4 px-6">
                              <span className="font-medium text-green-600">
                                {order.quantityDelivered}
                              </span>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <span className={`font-medium ${order.pendingQty > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                {order.pendingQty}
                              </span>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge className={`rounded-full ${
                                order.status.toLowerCase() === 'pending' ? 'bg-yellow-500' : 'bg-green-500'
                              } text-white`}>
                                {order.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      }
                      
                      // HISTORY TAB - Show dispatch data directly
                      return (
                        <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                          <TableCell className="py-4 px-6 text-sm whitespace-nowrap">
                            {order.timestamp ? order.timestamp.split(' ')[0] : "N/A"}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge className="bg-purple-500 text-white rounded-full whitespace-nowrap">
                              {order.dSrNumber}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="max-w-[120px]">
                              <span className="font-medium break-words">{order.deliveryOrderNo}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="max-w-[180px]">
                              <p className="break-words">{order.partyName}</p>
                              <p className="text-xs text-gray-500 break-words">{order.firmName}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="max-w-[150px]">
                              <span className="break-words">{order.productName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 font-medium whitespace-nowrap">
                            {order.qtyToBeDispatched}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="max-w-[120px]">
                              <Badge variant="outline" className="rounded-full break-words whitespace-normal">
                                {order.typeOfTransporting}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 whitespace-nowrap">
                            {order.dateOfDispatch ? order.dateOfDispatch.split(' ')[0] : "N/A"}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge className={`rounded-full whitespace-nowrap ${
                              order.toBeReconfirm === 'Yes' ? 'bg-green-500' : 'bg-red-500'
                            } text-white`}>
                              {order.toBeReconfirm}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {displayOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No {activeTab === "pending" ? "pending orders" : "dispatch history"} found
                  </p>
                ) : (
                  displayOrders.map((order) => {
                    if (activeTab === "pending") {
                      return (
                        <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-semibold text-gray-900">{order.partyName}</p>
                              <p className="text-xs text-gray-500">{order.deliveryOrderNo || "No DO"}</p>
                            </div>
                            <Badge variant="outline" className="rounded-full text-xs">
                              {order.firmName}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">DO No:</span>
                              <span className="font-medium">{order.deliveryOrderNo || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Product:</span>
                              <span className="font-medium">{order.productName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Order Qty:</span>
                              <span className="font-medium">{order.quantity}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Delivered:</span>
                              <span className="font-medium text-green-600">{order.quantityDelivered}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Pending:</span>
                              <span className={`font-medium ${order.pendingQty > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                {order.pendingQty}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Status:</span>
                              <Badge className={`text-xs ${
                                order.status.toLowerCase() === 'pending' ? 'bg-yellow-500' : 'bg-green-500'
                              } text-white`}>
                                {order.status}
                              </Badge>
                            </div>
                          </div>

                          {order.pendingQty > 0 && (
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <Button
                                size="sm"
                                onClick={() => handlePlanning(order)}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                                disabled={submitting}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                {submitting ? "Submitting..." : "Plan Dispatch"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    } else {
                      // HISTORY TAB MOBILE VIEW - Show dispatch data
                      return (
                        <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-purple-500 text-white text-xs">
                                  {order.dSrNumber}
                                </Badge>
                                {order.firmName !== "N/A" && (
                                  <Badge variant="outline" className="text-xs">
                                    {order.firmName}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-semibold text-gray-900">{order.partyName}</p>
                              <p className="text-xs text-gray-500">{order.deliveryOrderNo}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{order.qtyToBeDispatched} units</p>
                              <p className="text-xs text-gray-500">
                                {order.dateOfDispatch ? order.dateOfDispatch.split(' ')[0] : ""}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Product:</span>
                              <span className="font-medium">{order.productName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transport:</span>
                              <span className="font-medium">{order.typeOfTransporting}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Date:</span>
                              <span className="font-medium">
                                {order.dateOfDispatch ? order.dateOfDispatch.split(' ')[0] : "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Reconfirm:</span>
                              <Badge className={`text-xs ${
                                order.toBeReconfirm === 'Yes' ? 'bg-green-500' : 'bg-red-500'
                              } text-white`}>
                                {order.toBeReconfirm}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  })
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} of {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dispatch Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Dispatch Planning</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-6">
                {/* Order Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Order Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-500">Party Name</Label>
                      <p className="font-medium">{selectedOrder.partyName}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Delivery Order No.</Label>
                      <p className="font-medium">{selectedOrder.deliveryOrderNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Product Name</Label>
                      <p className="font-medium">{selectedOrder.productName}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Order Quantity</Label>
                      <p className="font-medium">{selectedOrder.quantity}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Already Delivered</Label>
                      <p className="font-medium text-green-600">{selectedOrder.quantityDelivered}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Pending Quantity</Label>
                      <p className="font-medium text-orange-600">{selectedOrder.pendingQty}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-3">Dispatch Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Quantity to Dispatch *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.qtyToBeDispatched}
                        onChange={(e) => setFormData(prev => ({ ...prev, qtyToBeDispatched: e.target.value }))}
                        className="h-10"
                        placeholder="Enter quantity"
                        disabled={submitting}
                        max={selectedOrder.pendingQty}
                        min="0"
                      />
                      <p className="text-xs text-gray-500">
                        Max: {selectedOrder.pendingQty} units available
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Transport Type *</Label>
                      <Select
                        value={formData.typeOfTransporting}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, typeOfTransporting: value }))}
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
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Dispatch Date *</Label>
                      <Input
                        type="date"
                        value={formData.dateOfDispatch}
                        onChange={(e) => setFormData(prev => ({ ...prev, dateOfDispatch: e.target.value }))}
                        className="h-10"
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Reconfirm *</Label>
                      <Select
                        value={formData.toBeReconfirm}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, toBeReconfirm: value }))}
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
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      disabled={
                        !formData.qtyToBeDispatched || 
                        parseFloat(formData.qtyToBeDispatched) <= 0 ||
                        parseFloat(formData.qtyToBeDispatched) > selectedOrder.pendingQty ||
                        !formData.typeOfTransporting || 
                        !formData.dateOfDispatch || 
                        !formData.toBeReconfirm ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Dispatch (D-Sr: ${generateDSrNumber()})`
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