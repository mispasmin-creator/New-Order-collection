"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, CheckCircle2, Loader2 } from "lucide-react"

export default function CheckPOPage({ user, onNavigate }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState([])
  const [deliveryDates, setDeliveryDates] = useState({})
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")

  // Your Google Apps Script web app URL
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

  // Fetch data from Google Sheets
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch data from Google Sheets
      const response = await fetch(`${SCRIPT_URL}?sheet=ORDER%20RECEIPT`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.data) {
        const transformedOrders = transformSheetData(data.data)
        setOrders(transformedOrders)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return ""
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      
      // Format as DD/MM/YYYY
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      
      return `${day}/${month}/${year}`
    } catch {
      return dateString
    }
  }

  // Transform Google Sheets data to order format
  const transformSheetData = (sheetData) => {
    if (!sheetData || sheetData.length < 6) return []
    
    // Headers are at index 5 (6th row)
    const headers = sheetData[5].map(header => header ? header.toString().trim() : "")
    
    console.log("Headers found:", headers)
    
    const orders = []
    
    // Find column indices based on your headers
    const indices = {
      partyPONo: headers.findIndex(h => h.includes("PARTY PO NO")),
      partyPODate: headers.findIndex(h => h.includes("Party PO Date")),
      partyName: headers.findIndex(h => h.includes("Party Names")),
      contactPerson: headers.findIndex(h => h.includes("Contact Person Name")),
      firmName: headers.findIndex(h => h.includes("Firm Name")),
      planned1: headers.findIndex(h => h.includes("Planned 1")),
      actual1: headers.findIndex(h => h.includes("Actual 1")),
      expectedDeliveryDate: headers.findIndex(h => h.includes("Expected Delivery Date")),
      status: headers.findIndex(h => h.includes("Status")),
      timestamp: headers.findIndex(h => h.includes("Timestamp")),
      doNumber: headers.findIndex(h => h.includes("DO-Delivery Order No."))
    }
    
    console.log("Column indices:", indices)
    
    // Data starts from index 6 (7th row)
    for (let i = 6; i < sheetData.length; i++) {
      const row = sheetData[i]
      
      // Get values with fallbacks
      const plannedValue = indices.planned1 >= 0 && row[indices.planned1] ? row[indices.planned1].toString().trim() : ""
      const actualValue = indices.actual1 >= 0 && row[indices.actual1] ? row[indices.actual1].toString().trim() : ""
      const expectedValue = indices.expectedDeliveryDate >= 0 && row[indices.expectedDeliveryDate] ? row[indices.expectedDeliveryDate].toString().trim() : ""
      
      // Only include rows where Planned 1 has value
      if (plannedValue) {
        const order = {
          id: i,
          serialNo: i - 5, // Starting from 1
          firmName: indices.firmName >= 0 && row[indices.firmName] ? row[indices.firmName].toString().trim() : "N/A",
          partyPONumber: indices.partyPONo >= 0 && row[indices.partyPONo] ? row[indices.partyPONo].toString().trim() : "N/A",
          partyPODate: indices.partyPODate >= 0 && row[indices.partyPODate] ? formatDate(row[indices.partyPODate]) : "N/A",
          partyName: indices.partyName >= 0 && row[indices.partyName] ? row[indices.partyName].toString().trim() : "N/A",
          contactPersonName: indices.contactPerson >= 0 && row[indices.contactPerson] ? row[indices.contactPerson].toString().trim() : "N/A",
          plannedDate: formatDate(plannedValue),
          actualDate: formatDate(actualValue),
          expectedDeliveryDate: formatDate(expectedValue),
          status: indices.status >= 0 && row[indices.status] ? row[indices.status].toString().trim() : "Pending",
          doNumber: indices.doNumber >= 0 && row[indices.doNumber] ? row[indices.doNumber].toString().trim() : "",
          timestamp: indices.timestamp >= 0 && row[indices.timestamp] ? row[indices.timestamp] : "",
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          rawData: row // Store raw data for debugging
        }
        
        console.log(`Order ${i}:`, {
          plannedValue,
          actualValue,
          expectedValue,
          firmName: order.firmName,
          partyPONumber: order.partyPONumber
        })
        
        orders.push(order)
      }
    }
    
    console.log("Total orders transformed:", orders.length)
    return orders
  }

  // Filter orders based on user role
  const getFilteredOrders = () => {
    if (user.role === "master") {
      return orders
    } else {
      return orders.filter((order) => order.firmName === user.firm)
    }
  }

  const filteredOrders = getFilteredOrders()
  
  // Pending orders: Planned 1 has value, Actual 1 is empty
  const pendingOrders = filteredOrders.filter((order) => 
    order.plannedDate && 
    order.plannedDate.trim() !== "" && 
    (!order.actualDate || order.actualDate.trim() === "")
  )
  
  // History orders: Expected Delivery Date has value
  const historyOrders = filteredOrders.filter((order) => 
    order.expectedDeliveryDate && order.expectedDeliveryDate.trim() !== ""
  )

  // Apply search filter
  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm) return ordersList
    return ordersList.filter((order) =>
      Object.values(order).some((value) => 
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayOrders = activeTab === "pending" 
    ? searchFilteredOrders(pendingOrders) 
    : searchFilteredOrders(historyOrders)

  const handleOrderSelection = (orderId, checked) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId])
    } else {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId))
      const newDates = { ...deliveryDates }
      delete newDates[orderId]
      setDeliveryDates(newDates)
    }
  }

  const handleDeliveryDateChange = (orderId, date) => {
    setDeliveryDates({
      ...deliveryDates,
      [orderId]: date,
    })
  }

  const handleSubmit = async () => {
    if (selectedOrders.length === 0) return
    
    try {
      const updates = []
      
      // Prepare all updates
      for (const orderId of selectedOrders) {
        const order = orders.find(o => o.id === orderId)
        const date = deliveryDates[orderId]
        
        if (!date || !order) continue
        
        // Format date for Google Sheets
        const formattedDate = date // YYYY-MM-DD format
        
        updates.push({
          rowIndex: order.rowIndex,
          expectedDate: formattedDate,
          actualDate: new Date().toISOString().split('T')[0] // Today's date
        })
      }
      
      // Send updates to Google Sheets
      for (const update of updates) {
        // Update Expected Delivery Date (column 47, 1-indexed)
        const expectedDateParams = new URLSearchParams({
          action: 'updateCell',
          sheetName: 'ORDER RECEIPT',
          rowIndex: update.rowIndex.toString(),
          columnIndex: '48', // Expected Delivery Date is column 47 (1-indexed)
          value: update.expectedDate
        })
        
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: expectedDateParams
        })
        
        // Update Actual 1 (column 45, 1-indexed)
        const actualDateParams = new URLSearchParams({
          action: 'updateCell',
          sheetName: 'ORDER RECEIPT',
          rowIndex: update.rowIndex.toString(),
          columnIndex: '46', // Actual 1 is column 45 (1-indexed)
          value: update.actualDate
        })
        
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: actualDateParams
        })
      }
      
      // Refresh data
      setTimeout(() => {
        fetchData()
      }, 2000)
      
      // Clear selections
      setSelectedOrders([])
      setDeliveryDates({})
      
      alert(`Successfully updated ${selectedOrders.length} order(s)!`)
      
      if (onNavigate) {
        onNavigate("Check for Delivery")
      }
    } catch (error) {
      console.error("Error updating data:", error)
      alert("Failed to update data. Please try again.")
    }
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
      {/* Header */}
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-gray-900">Check PO</h1>
        <p className="text-gray-600">Review and set expected delivery dates for purchase orders</p>
      </div>

      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Check PO</h1>
        <p className="text-sm text-gray-600 mt-1">Set delivery dates</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-xl">Purchase Orders</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Total orders: {orders.length} | Pending: {pendingOrders.length} | History: {historyOrders.length}
            </p>
          </div>
          {selectedOrders.length > 0 && (
            <Button 
              onClick={handleSubmit} 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
              disabled={loading}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Submit Selected ({selectedOrders.length})
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-t-lg">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "pending" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending ({pendingOrders.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "history" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                History ({historyOrders.length})
              </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by DO number, party name, PO number..."
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
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Select</TableHead>
                    )}
                    {activeTab === "pending" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Expected Delivery Date</TableHead>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">DO Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Firm Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party PO Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party PO Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Contact Person</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned Date</TableHead>
                    {activeTab === "history" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Expected Delivery Date</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeTab === "pending" ? 12 : 11} className="text-center py-8 text-gray-500">
                        {orders.length === 0 
                          ? "No data found. Please check your Google Apps Script." 
                          : `No ${activeTab === "pending" ? "pending" : "historical"} orders found`
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={(checked) => handleOrderSelection(order.id, checked)}
                            />
                          </TableCell>
                        )}
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <Input
                              type="date"
                              disabled={!selectedOrders.includes(order.id)}
                              value={deliveryDates[order.id] || ""}
                              onChange={(e) => handleDeliveryDateChange(order.id, e.target.value)}
                              className="w-40"
                            />
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-6 font-mono text-sm">{order.doNumber}</TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                            {order.firmName}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">{order.partyPONumber}</TableCell>
                        <TableCell className="py-4 px-6">{order.partyPODate}</TableCell>
                        <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                        <TableCell className="py-4 px-6">{order.contactPersonName}</TableCell>
                        <TableCell className="py-4 px-6">{order.plannedDate}</TableCell>
                       
                        {activeTab === "history" && (
                          <TableCell className="py-4 px-6">
                            <Badge className="bg-green-500 text-white rounded-full">{order.expectedDeliveryDate}</Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {displayOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    {orders.length === 0 
                      ? "No data found" 
                      : "No orders found"
                    }
                  </p>
                ) : (
                  displayOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`p-4 rounded-lg border ${
                        selectedOrders.includes(order.id) ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
                      } shadow-sm transition-all`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {activeTab === "pending" && (
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={(checked) => handleOrderSelection(order.id, checked)}
                            />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">#{order.serialNo}</p>
                            <p className="text-xs text-gray-500">{order.doNumber}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-full text-xs">
                          {order.firmName}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">PO Number:</span>
                          <span className="font-medium">{order.partyPONumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Party:</span>
                          <span className="font-medium">{order.partyName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Contact:</span>
                          <span className="font-medium">{order.contactPersonName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned:</span>
                          <span className="font-medium">{order.plannedDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Actual:</span>
                          {order.actualDate && order.actualDate.trim() ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">{order.actualDate}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 text-xs border-amber-200">Pending</Badge>
                          )}
                        </div>
                      </div>

                      {activeTab === "pending" && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3" />
                            Expected Delivery
                          </label>
                          <Input
                            type="date"
                            disabled={!selectedOrders.includes(order.id)}
                            value={deliveryDates[order.id] || ""}
                            onChange={(e) => handleDeliveryDateChange(order.id, e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                      )}

                      {activeTab === "history" && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-600">Expected Delivery:</p>
                          <Badge className="mt-1 bg-green-500 text-white text-xs">
                            {order.expectedDeliveryDate}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Results Count */}
            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} of{" "}
              {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button 
          onClick={fetchData} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>
    </div>
  )
}