"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { X, Search, CheckCircle2, Loader2 } from "lucide-react"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

export default function CRMDonePage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const deliveryResponse = await fetch(`${SCRIPT_URL}?sheet=DELIVERY`)
      if (deliveryResponse.ok) {
        const deliveryData = await deliveryResponse.json()
        
        if (deliveryData.success && deliveryData.data) {
          const pendingOrders = getPendingOrders(deliveryData.data)
          setOrders(pendingOrders)
          
          const historyOrders = getHistoryOrders(deliveryData.data)
          setHistoryOrders(historyOrders)
          
          console.log("Pending CRM orders:", pendingOrders.length, "History CRM orders:", historyOrders.length)
        }
      }
      
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Format date to dd/mm/yyyy - SAFE VERSION
  const formatDate = (dateString) => {
    // Handle all possible cases
    if (!dateString) return "N/A"
    
    // Convert to string if it's not already
    const str = typeof dateString === 'string' ? dateString : String(dateString)
    
    // Trim if it's a string, otherwise use as is
    const trimmedStr = str.trim ? str.trim() : str
    
    if (trimmedStr === "" || trimmedStr === "N/A" || trimmedStr === "null" || trimmedStr === "undefined") {
      return "N/A"
    }
    
    try {
      // Check if it's already in dd/mm/yyyy format
      if (trimmedStr.includes('/')) {
        const datePart = trimmedStr.split(' ')[0]
        const parts = datePart.split('/')
        
        if (parts.length >= 3) {
          let [day, month, year] = parts
          
          // Clean up any extra characters
          day = day.replace(/\D/g, '')
          month = month.replace(/\D/g, '')
          year = year.replace(/\D/g, '').slice(0, 4)
          
          // If year is 2 digits, assume 20xx
          if (year.length === 2) {
            year = `20${year}`
          }
          
          // Pad day and month with leading zeros
          day = day.padStart(2, '0')
          month = month.padStart(2, '0')
          
          return `${day}/${month}/${year}`
        }
      }
      
      // Try parsing various date formats
      let dateToParse = trimmedStr
      
      // Try to parse as Date object
      const date = new Date(dateToParse)
      
      if (!isNaN(date.getTime())) {
        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const year = date.getFullYear().toString()
        return `${day}/${month}/${year}`
      }
      
      // If parsing failed, try to extract date-like pattern
      const dateMatch = trimmedStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
      if (dateMatch) {
        let [_, day, month, year] = dateMatch
        day = day.padStart(2, '0')
        month = month.padStart(2, '0')
        if (year.length === 2) year = `20${year}`
        return `${day}/${month}/${year}`
      }
      
      // Return the original string (or first part) if all else fails
      return trimmedStr.split(' ')[0] || "N/A"
      
    } catch (error) {
      console.error("Error formatting date:", error, dateString)
      return trimmedStr.split(' ')[0] || "N/A"
    }
  }

  // Get pending orders from DELIVERY sheet where Planned4 has value but Actual4 is empty
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
      planned1: headers.findIndex(h => h.toLowerCase().includes("planned 1")),
      actual1: headers.findIndex(h => h.toLowerCase().includes("actual 1")),
      planned2: headers.findIndex(h => h.toLowerCase().includes("planned 2")),
      actual2: headers.findIndex(h => h.toLowerCase().includes("actual 2")),
      planned3: headers.findIndex(h => h.toLowerCase().includes("planned 3")),
      actual3: headers.findIndex(h => h.toLowerCase().includes("actual3")),
      planned4: headers.findIndex(h => h.toLowerCase().includes("planned4")),
      actual4: headers.findIndex(h => h.toLowerCase().includes("actual4")),
      delay4: headers.findIndex(h => h.toLowerCase().includes("delay4")),
    }
    
    console.log("DELIVERY Column indices for Planned4:", indices)
    
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
      
      const planned4 = getVal(indices.planned4)
      const actual4 = getVal(indices.actual4)
      const billNo = getVal(indices.billNo)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      
      // Check if Planned4 has value, Actual4 is empty, and there's a Bill No
      if (planned4 && planned4 !== "" && (!actual4 || actual4 === "") && billNo && billNo !== "") {
        const order = {
          id: i,
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          timestamp: getVal(indices.timestamp),
          billDate: getVal(indices.billDate),
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
          planned1: getVal(indices.planned1),
          actual1: getVal(indices.actual1),
          planned2: getVal(indices.planned2),
          actual2: getVal(indices.actual2),
          planned3: getVal(indices.planned3),
          actual3: getVal(indices.actual3),
          planned4: planned4,
          actual4: actual4,
          delay4: getVal(indices.delay4),
        }
        
        pendingOrders.push(order)
      }
    }
    
    console.log("Total pending CRM orders found:", pendingOrders.length)
    return pendingOrders
  }

  // Get history orders from DELIVERY sheet where Actual4 has value
  const getHistoryOrders = (sheetData) => {
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
      planned1: headers.findIndex(h => h.toLowerCase().includes("planned 1")),
      actual1: headers.findIndex(h => h.toLowerCase().includes("actual 1")),
      planned2: headers.findIndex(h => h.toLowerCase().includes("planned 2")),
      actual2: headers.findIndex(h => h.toLowerCase().includes("actual 2")),
      planned3: headers.findIndex(h => h.toLowerCase().includes("planned 3")),
      actual3: headers.findIndex(h => h.toLowerCase().includes("actual3")),
      planned4: headers.findIndex(h => h.toLowerCase().includes("planned4")),
      actual4: headers.findIndex(h => h.toLowerCase().includes("actual4")),
      delay4: headers.findIndex(h => h.toLowerCase().includes("delay4")),
    }
    
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
      
      const actual4 = getVal(indices.actual4)
      const billNo = getVal(indices.billNo)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      
      // Check if Actual4 has value (CRM done completed) and there's a Bill No
      if (actual4 && actual4 !== "" && billNo && billNo !== "") {
        const historyOrder = {
          id: i,
          timestamp: getVal(indices.timestamp),
          billDate: getVal(indices.billDate),
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
          planned4: getVal(indices.planned4),
          actual4: actual4,
          delay4: getVal(indices.delay4),
        }
        
        historyOrders.push(historyOrder)
      }
    }
    
    console.log("Total history CRM done entries found:", historyOrders.length)
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

  const handleCRMDone = (order) => {
    setSelectedOrder(order)
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)
      
      const now = new Date()
      const actual4Date = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} 18:00:00`
      
      // Get current row data from DELIVERY sheet
      const response = await fetch(`${SCRIPT_URL}?sheet=DELIVERY`)
      if (!response.ok) throw new Error("Failed to fetch sheet data")
      
      const result = await response.json()
      if (!result.success || !result.data) throw new Error("Failed to get sheet data")
      
      // Get the current row
      const currentRow = result.data[selectedOrder.rowIndex - 1] || []
      
      // Create updated row data (40 columns based on your DELIVERY sheet structure)
      const updatedRow = [...currentRow]
      
      // Ensure we have enough columns
      while (updatedRow.length < 40) updatedRow.push("")
      
      // Update CRM done columns
      // Column 34: Planned4 (index 33) - keep as is
      // Column 35: Actual4 (index 34)
      updatedRow[34] = actual4Date
      
      // Column 36: Delay4 (index 35) - set to 0
      updatedRow[35] = "0"

      // Update the row in DELIVERY sheet
      const updateResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'update',
          sheetName: 'DELIVERY',
          rowIndex: selectedOrder.rowIndex.toString(),
          rowData: JSON.stringify(updatedRow)
        })
      })
      
      if (!updateResponse.ok) throw new Error(`Update failed: ${updateResponse.status}`)
      
      const updateResult = await updateResponse.json()
      
      if (updateResult.success) {
        await fetchData()
        setSelectedOrder(null)
        
        alert(`✓ CRM Done marked successfully!\nActual4 Date: ${actual4Date.split(' ')[0]}`)
      } else {
        throw new Error(updateResult.error || "Update failed")
      }
      
    } catch (error) {
      console.error("Error marking CRM done:", error)
      alert(`✗ Failed to submit: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading CRM data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">CRM Done</h1>
        <p className="text-sm text-gray-600 mt-1">Mark orders as CRM completed</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">CRM Done Management</CardTitle>
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
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Quantity</TableHead>
                    {activeTab === "pending" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned4 Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Rate</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Total Amount</TableHead>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual4 Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Status</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 11 : 8} 
                        className="text-center py-8 text-gray-500"
                      >
                        No {activeTab === "pending" ? "pending" : "completed"} CRM orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <Button
                              size="sm"
                              onClick={() => handleCRMDone(order)}
                              className="bg-indigo-600 hover:bg-indigo-700"
                              disabled={submitting}
                            >
                              CRM Done
                            </Button>
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-green-500 text-white rounded-full">
                            {order.billNo}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {formatDate(order.billDate)}
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
                        <TableCell className="py-4 px-6 font-medium">{order.quantityDelivered}</TableCell>
                        {activeTab === "pending" && (
                          <>
                            <TableCell className="py-4 px-6">{formatDate(order.planned4)}</TableCell>
                            <TableCell className="py-4 px-6">₹{order.rateOfMaterial || "0"}</TableCell>
                            <TableCell className="py-4 px-6 font-bold">
                              ₹{(
                                parseFloat(order.quantityDelivered || 0) * 
                                parseFloat(order.rateOfMaterial || 0)
                              ).toFixed(2)}
                            </TableCell>
                          </>
                        )}
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6">
                              {formatDate(order.actual4)}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge className="bg-green-500 text-white">
                                Completed
                              </Badge>
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
                    No {activeTab === "pending" ? "pending" : "completed"} CRM orders found
                  </p>
                ) : (
                  displayOrders.map((order) => (
                    <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          {activeTab === "history" && (
                            <p className="text-green-600 font-medium text-sm mb-1">
                              Actual4: {formatDate(order.actual4)}
                            </p>
                          )}
                          <p className="font-semibold text-gray-900">{order.partyName}</p>
                          <p className="text-xs text-gray-500">
                            Bill: {order.billNo} | DO: {order.deliveryOrderNo}
                          </p>
                          {activeTab === "pending" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Planned4: {formatDate(order.planned4)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {activeTab === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => handleCRMDone(order)}
                              className="bg-indigo-600 hover:bg-indigo-700"
                              disabled={submitting}
                            >
                              Done
                            </Button>
                          ) : (
                            <Badge className="bg-green-500 text-white">
                              Completed
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Product:</span>
                          <span>{order.productName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bill Date:</span>
                          <span>{formatDate(order.billDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quantity:</span>
                          <span className="font-medium">{order.quantityDelivered}</span>
                        </div>
                        {activeTab === "pending" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Rate:</span>
                              <span>₹{order.rateOfMaterial || "0"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Amount:</span>
                              <span className="font-bold">
                                ₹{(
                                  parseFloat(order.quantityDelivered || 0) * 
                                  parseFloat(order.rateOfMaterial || 0)
                                ).toFixed(2)}
                              </span>
                            </div>
                          </>
                        )}
                        {activeTab === "history" && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Planned4:</span>
                            <span>{formatDate(order.planned4)}</span>
                          </div>
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

      {/* Simplified CRM Done Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Mark as CRM Done</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Order Info */}
                <div className="space-y-4">
                  <div className="text-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Confirm CRM Completion
                    </h3>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Party Name:</span>
                      <span className="font-medium">{selectedOrder.partyName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Bill No:</span>
                      <Badge className="bg-green-500 text-white">
                        {selectedOrder.billNo}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Delivery Order No:</span>
                      <span className="font-medium">{selectedOrder.deliveryOrderNo}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Product:</span>
                      <span>{selectedOrder.productName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Quantity:</span>
                      <span className="font-medium">{selectedOrder.quantityDelivered}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Planned4 Date:</span>
                      <span className="font-medium text-blue-600">{formatDate(selectedOrder.planned4)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-bold">
                        ₹{(
                          parseFloat(selectedOrder.quantityDelivered || 0) * 
                          parseFloat(selectedOrder.rateOfMaterial || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-800 text-center">
                      Actual4 will be set to: <span className="font-bold">{formatDate(new Date())}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-1 text-center">
                      Delay4 will be automatically calculated
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <Button 
                    onClick={handleSubmit} 
                    className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      '✓ Mark as CRM Done'
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleCancel} 
                    className="w-full h-12 text-lg"
                    variant="outline"
                    disabled={submitting}
                  >
                    Cancel
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