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
      
      // Fetch from ORDER RECEIPT sheet (same as CheckDeliveryPage)
      const response = await fetch(`${SCRIPT_URL}?sheet=ORDER%20RECEIPT`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.data) {
        const transformedOrders = transformSheetData(data.data)
        setOrders(transformedOrders)
      }
      
      // Fetch from DISPATCH sheet
      const dispatchResponse = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      if (dispatchResponse.ok) {
        const dispatchData = await dispatchResponse.json()
        if (dispatchData.success && dispatchData.data) {
          setDispatchOrders(transformDispatchData(dispatchData.data))
        }
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
  
  // FIXED: Use correct header names from your sheet
  const indices = {
    serialNo: headers.findIndex(h => h.includes("Sr No")),
    firmName: headers.findIndex(h => h.includes("Firm Name")),
    partyPONo: headers.findIndex(h => h.includes("PARTY PO NO")),
    partyName: headers.findIndex(h => h.includes("Party Names")),
    productName: headers.findIndex(h => h.includes("Product Name")),
    quantity: headers.findIndex(h => h.includes("Quantity")),
    status: headers.findIndex(h => h.includes("Status")),
    quantityDelivered: headers.findIndex(h => h.includes("Quantity Delivered")),
    pendingQty: headers.findIndex(h => h.includes("Pending Qty")),
    // FIXED: Use exact header names as they appear in your sheet
    planned4: headers.findIndex(h => h.trim() === "Planned 4"),
    actual4: headers.findIndex(h => h.trim() === "Actual 4"),
  }
  
  console.log("ORDER RECEIPT Column indices:", indices)
  
  const orders = []
  
  // Data starts from index 6 (7th row)
  for (let i = 6; i < sheetData.length; i++) {
    const row = sheetData[i]
    
    if (!row || row.length === 0) continue
    
    // FIXED: Get column values with proper checks
    const getValue = (index) => {
      if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
        return row[index].toString().trim()
      }
      return ""
    }
    
    const planned4Value = getValue(indices.planned4)
    const actual4Value = getValue(indices.actual4)
    
    const order = {
      id: i,
      rowIndex: i + 1, // Google Sheets row number (1-indexed)
      serialNo: getValue(indices.serialNo) || `Row ${i - 5}`,
      firmName: getValue(indices.firmName) || "N/A",
      partyPONumber: getValue(indices.partyPONo) || "N/A",
      partyName: getValue(indices.partyName) || "N/A",
      productName: getValue(indices.productName) || "N/A",
      quantity: parseFloat(getValue(indices.quantity)) || 0,
      status: getValue(indices.status) || "Pending",
      quantityDelivered: parseFloat(getValue(indices.quantityDelivered)) || 0,
      pendingQty: parseFloat(getValue(indices.pendingQty)) || 0,
      planned4: formatDate(planned4Value),
      actual4: formatDate(actual4Value),
      rawPlanned4: planned4Value,
      rawActual4: actual4Value,
    }
    
    orders.push(order)
  }
  
  console.log("Total orders transformed:", orders.length)
  return orders
}


  const transformDispatchData = (sheetData) => {
    if (!sheetData || sheetData.length === 0) return []
    
    // Assume headers are in first row
    const headers = sheetData[0].map(h => h?.toString().trim() || "")
    
    const findCol = (searchTerms) => {
      const lowerHeaders = headers.map(h => h.toLowerCase())
      for (const term of searchTerms) {
        const index = lowerHeaders.findIndex(h => h.includes(term.toLowerCase()))
        if (index !== -1) return index
      }
      return -1
    }
    
    const indices = {
      dSrNumber: findCol(["d-sr", "dsr"]),
      deliveryOrderNo: findCol(["delivery order", "order no"]),
    }
    
    const dispatchOrders = []
    
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const getVal = (index) => index >= 0 && row[index] ? row[index].toString().trim() : ""
      
      dispatchOrders.push({
        id: i,
        dSrNumber: getVal(indices.dSrNumber),
        deliveryOrderNo: getVal(indices.deliveryOrderNo),
      })
    }
    
    return dispatchOrders
  }

  // Filter orders: Planned 4 has value AND Actual 4 is empty
    const getPendingOrders = () => {
    console.log("Filtering pending orders...")
    
    let filtered = orders.filter((order) => {  // <-- Change 'let' here too
      // Check if Planned 4 has a valid date value (not empty and not text like "Testing")
      const hasPlannedDate = order.rawPlanned4 && 
                            order.rawPlanned4.trim() !== "" && 
                            !isNaN(new Date(order.rawPlanned4).getTime())
      
      // Check if Actual 4 is empty or doesn't contain a valid date
      const noActualDate = !order.rawActual4 || 
                          order.rawActual4.trim() === "" || 
                          isNaN(new Date(order.rawActual4).getTime())
      
      console.log(`Order ${order.serialNo}: hasPlannedDate=${hasPlannedDate}, noActualDate=${noActualDate}`)
      
      return hasPlannedDate && noActualDate
    })
    
    console.log("Pending orders found:", filtered.length)
    
    if (user.role !== "master") {
      filtered = filtered.filter((order) => order.firmName === user.firm)
    }
    return filtered
  }

  const getHistoryOrders = () => {
    let filtered = orders.filter((order) => {  // <-- Changed to 'let'
      // Has both Planned 4 and Actual 4 dates
      const hasPlannedDate = order.rawPlanned4 && 
                            order.rawPlanned4.trim() !== "" && 
                            !isNaN(new Date(order.rawPlanned4).getTime())
      
      const hasActualDate = order.rawActual4 && 
                           order.rawActual4.trim() !== "" && 
                           !isNaN(new Date(order.rawActual4).getTime())
      
      return hasPlannedDate && hasActualDate
    })
    
    if (user.role !== "master") {
      filtered = filtered.filter((order) => order.firmName === user.firm)
    }
    return filtered
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
    const lastNumber = dispatchOrders.reduce((max, order) => {
      const match = order.dSrNumber?.match(/D-(\d+)/)
      return match ? Math.max(max, parseInt(match[1])) : max
    }, 0)
    
    return `D-${String(lastNumber + 1).padStart(2, '0')}`
  }

  const handlePlanning = (order) => {
    setSelectedOrder(order)
    setFormData({
      qtyToBeDispatched: order.pendingQty.toString() || "",
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
    
    // IMPORTANT: Match the DISPATCH sheet columns exactly as shown in your screenshot
    // The order should match the columns in your DISPATCH sheet
    const dispatchData = [
      timestamp,                     // Timestamp
      dSrNumber,                     // D-Sr Number (D-01)
      selectedOrder.partyPONumber || "", // Delivery Order No.
      selectedOrder.partyName || "",     // Party Name
      selectedOrder.productName || "",   // Product Name
      formData.qtyToBeDispatched,    // Qty To Be Dispatched
      formData.typeOfTransporting,   // Type Of Transporting
      formattedDispatchDate + " 18:00:00", // Date Of Dispatch (with time)
      formData.toBeReconfirm,        // To Be Reconfirm
      selectedOrder.pendingQty || 0  // Balance To Dispatch (added as last column)
    ]

    console.log("Submitting dispatch data:", dispatchData)

    // Submit to DISPATCH sheet using 'insert' action (not 'appendRow')
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        action: 'insert',  // Changed from 'appendRow' to 'insert'
        sheetName: 'DISPATCH',
        rowData: JSON.stringify(dispatchData) // Changed from 'values' to 'rowData'
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log("Google Apps Script response:", result)

    if (result.success) {
      // Update Actual 4 in ORDER RECEIPT sheet
      const today = new Date()
      const actual4Date = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`
      
      console.log(`Updating row ${selectedOrder.rowIndex}, column 60 (Actual 4) with: ${actual4Date}`)
      
      const updateResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'updateCell',  // Using 'updateCell' action
          sheetName: 'ORDER RECEIPT',
          rowIndex: selectedOrder.rowIndex.toString(),
          columnIndex: "61", // Column index for Actual 4 (assuming it's column 60)
          value: actual4Date
        })
      })

      if (!updateResponse.ok) {
        console.warn("Failed to update ORDER RECEIPT sheet")
      } else {
        const updateResult = await updateResponse.json()
        console.log("Update cell response:", updateResult)
      }

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
      alert("✓ Dispatch planning submitted successfully!")
      
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
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">D-Sr Number</TableHead>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Serial No</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Firm Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party PO Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned 4</TableHead>
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual 4</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivered</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Pending</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeTab === "pending" ? 9 : 13} className="text-center py-8 text-gray-500">
                        No {activeTab === "pending" ? "pending" : "historical"} orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <Button
                              size="sm"
                              onClick={() => handlePlanning(order)}
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={submitting}
                            >
                              {submitting ? "Submitting..." : "Plan"}
                            </Button>
                          </TableCell>
                        )}
                        {activeTab === "history" && (
                          <TableCell className="py-4 px-6">
                            <Badge className="bg-purple-500 text-white rounded-full">
                              {dispatchOrders.find(d => d.deliveryOrderNo === order.partyPONumber)?.dSrNumber || "N/A"}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-6">{order.serialNo}</TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                            {order.firmName}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">{order.partyPONumber}</TableCell>
                        <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                        <TableCell className="py-4 px-6">{order.productName}</TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-yellow-500 text-white rounded-full">{order.planned4 || "No date"}</Badge>
                        </TableCell>
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6">
                              <Badge className="bg-green-500 text-white rounded-full">{order.actual4 || "No date"}</Badge>
                            </TableCell>
                            <TableCell className="py-4 px-6 font-medium">{order.quantityDelivered}</TableCell>
                            <TableCell className="py-4 px-6 font-medium">{order.pendingQty}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {displayOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No orders found</p>
                ) : (
                  displayOrders.map((order) => (
                    <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">#{order.serialNo}</p>
                          <p className="text-xs text-gray-500">{order.partyPONumber}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full text-xs">
                          {order.firmName}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Party:</span>
                          <span className="font-medium">{order.partyName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Product:</span>
                          <span className="font-medium">{order.productName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned 4:</span>
                          <Badge className="bg-yellow-500 text-white text-xs">{order.planned4 || "No date"}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pending Qty:</span>
                          <span className="font-medium">{order.pendingQty}</span>
                        </div>
                      </div>

                      {activeTab === "pending" && (
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

                      {activeTab === "history" && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Actual 4:</span>
                            <Badge className="bg-green-500 text-white text-xs">{order.actual4 || "No date"}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Delivered:</span>
                            <span className="font-medium">{order.quantityDelivered}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pending:</span>
                            <span className="font-medium">{order.pendingQty}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} of {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

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
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <Label className="text-xs">Serial No</Label>
                    <Input value={selectedOrder.serialNo} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Firm Name</Label>
                    <Input value={selectedOrder.firmName} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Party PO Number</Label>
                    <Input value={selectedOrder.partyPONumber} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Party Name</Label>
                    <Input value={selectedOrder.partyName} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Product Name</Label>
                    <Input value={selectedOrder.productName} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pending Qty</Label>
                    <Input value={selectedOrder.pendingQty} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Planned 4</Label>
                    <Input value={selectedOrder.planned4} disabled className="h-9" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label className="text-sm">Qty To Dispatch *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.qtyToBeDispatched}
                      onChange={(e) => setFormData(prev => ({ ...prev, qtyToBeDispatched: e.target.value }))}
                      className="h-10"
                      placeholder="Enter quantity"
                      disabled={submitting}
                    />
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

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto" disabled={submitting}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                    disabled={!formData.qtyToBeDispatched || 
                             !formData.typeOfTransporting || 
                             !formData.dateOfDispatch || 
                             !formData.toBeReconfirm ||
                             submitting}
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