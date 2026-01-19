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

// Your Google Apps Script web app URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

export default function CheckDeliveryPage({ user, onNavigate }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    inStockOrNot: "",
    orderNumberProduction: "",
    qtyTransferred: "",
    batchNumberRemarks: "",
    indentSelfBatchNumber: ""
  })

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
      serialNo: headers.findIndex(h => h.includes("Sr No")),
      firmName: headers.findIndex(h => h.includes("Firm Name")),
      partyPONo: headers.findIndex(h => h.includes("PARTY PO NO")),
      partyName: headers.findIndex(h => h.includes("Party Names")),
      contactPerson: headers.findIndex(h => h.includes("Contact Person Name")),
      partyPODate: headers.findIndex(h => h.includes("Party PO Date")),
      planned3: headers.findIndex(h => h.includes("Planned 3")),
      actual3: headers.findIndex(h => h.includes("Actual 3")),
      inStockOrNot: headers.findIndex(h => h.includes("In Stock Or Not")),
      orderNumberProduction: headers.findIndex(h => h.includes("Order Number Of The Production")),
      qtyTransferred: headers.findIndex(h => h.includes("Qty Transferred")),
      batchNumberRemarks: headers.findIndex(h => h.includes("Batch Number In Remarks")),
      indentSelfBatchNumber: headers.findIndex(h => h.includes("Indent/Self Batch Number")),
      productName: headers.findIndex(h => h.includes("Product Name")),
      rowIndex: headers.findIndex(h => h.includes("Row Index"))
    }
    
    console.log("Column indices:", indices)
    
    // Data starts from index 6 (7th row)
    for (let i = 6; i < sheetData.length; i++) {
      const row = sheetData[i]
      
      // Get values with fallbacks
      const planned3Value = indices.planned3 >= 0 && row[indices.planned3] ? row[indices.planned3].toString().trim() : ""
      const actual3Value = indices.actual3 >= 0 && row[indices.actual3] ? row[indices.actual3].toString().trim() : ""
      
      const order = {
        id: i,
        rowIndex: i + 1, // Google Sheets row number (1-indexed)
        serialNo: indices.serialNo >= 0 && row[indices.serialNo] ? row[indices.serialNo].toString().trim() : i - 5,
        firmName: indices.firmName >= 0 && row[indices.firmName] ? row[indices.firmName].toString().trim() : "N/A",
        partyPONumber: indices.partyPONo >= 0 && row[indices.partyPONo] ? row[indices.partyPONo].toString().trim() : "N/A",
        partyName: indices.partyName >= 0 && row[indices.partyName] ? row[indices.partyName].toString().trim() : "N/A",
        contactPersonName: indices.contactPerson >= 0 && row[indices.contactPerson] ? row[indices.contactPerson].toString().trim() : "N/A",
        partyPODate: indices.partyPODate >= 0 && row[indices.partyPODate] ? formatDate(row[indices.partyPODate]) : "N/A",
        productName: indices.productName >= 0 && row[indices.productName] ? row[indices.productName].toString().trim() : "N/A",
        planned3: formatDate(planned3Value),
        actual3: formatDate(actual3Value),
        inStockOrNot: indices.inStockOrNot >= 0 && row[indices.inStockOrNot] ? row[indices.inStockOrNot].toString().trim() : "",
        orderNumberProduction: indices.orderNumberProduction >= 0 && row[indices.orderNumberProduction] ? row[indices.orderNumberProduction].toString().trim() : "",
        qtyTransferred: indices.qtyTransferred >= 0 && row[indices.qtyTransferred] ? row[indices.qtyTransferred].toString().trim() : "",
        batchNumberRemarks: indices.batchNumberRemarks >= 0 && row[indices.batchNumberRemarks] ? row[indices.batchNumberRemarks].toString().trim() : "",
        indentSelfBatchNumber: indices.indentSelfBatchNumber >= 0 && row[indices.indentSelfBatchNumber] ? row[indices.indentSelfBatchNumber].toString().trim() : "",
        rawData: row // Store raw data for debugging
      }
      
      orders.push(order)
    }
    
    console.log("Total orders transformed:", orders.length)
    return orders
  }

  // Filter orders based on user role and logic: Planned 3 is not null and Actual 3 is null
  const getFilteredOrders = () => {
    let filtered = orders.filter((order) => 
      order.planned3 && 
      order.planned3.trim() !== "" && 
      (!order.actual3 || order.actual3.trim() === "")
    )
    
    if (user.role !== "master") {
      filtered = filtered.filter((order) => order.firmName === user.firm)
    }
    return filtered
  }

  const pendingOrders = getFilteredOrders()
  
  // History orders: Both Planned 3 and Actual 3 are not null
  const historyOrders = orders.filter((order) => 
    order.planned3 && 
    order.planned3.trim() !== "" && 
    order.actual3 && 
    order.actual3.trim() !== "" &&
    (user.role === "master" || order.firmName === user.firm)
  )

  // Apply search filter
  const searchFilteredOrders = (ordersList) => {
    return ordersList.filter((order) =>
      Object.values(order).some((value) => value?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }

  const displayOrders =
    activeTab === "pending" ? searchFilteredOrders(pendingOrders) : searchFilteredOrders(historyOrders)

  const handleCheck = (order) => {
    setSelectedOrder(order)
    setFormData({
      inStockOrNot: order.inStockOrNot || "",
      orderNumberProduction: order.orderNumberProduction || "",
      qtyTransferred: order.qtyTransferred || "",
      batchNumberRemarks: order.batchNumberRemarks || "",
      indentSelfBatchNumber: order.indentSelfBatchNumber || ""
    })
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      const today = new Date().toISOString().split('T')[0]
      
      // Prepare update data based on selection
      const updates = []
      
      // Always update Actual 3 with current date
      updates.push({
        rowIndex: selectedOrder.rowIndex,
        columnIndex: "53", // Actual 3 column (adjust based on your sheet)
        value: today
      })
      
      // Update In Stock Or Not
      updates.push({
        rowIndex: selectedOrder.rowIndex,
        columnIndex: "55", // In Stock Or Not column (adjust based on your sheet)
        value: formData.inStockOrNot
      })
      
      // Update additional fields based on selection
      if (formData.inStockOrNot === "In Stock") {
        updates.push({
          rowIndex: selectedOrder.rowIndex,
          columnIndex: "56", // Order Number Of The Production
          value: formData.orderNumberProduction
        })
        updates.push({
          rowIndex: selectedOrder.rowIndex,
          columnIndex: "57", // Qty Transferred
          value: formData.qtyTransferred
        })
        updates.push({
          rowIndex: selectedOrder.rowIndex,
          columnIndex: "58", // Batch Number In Remarks
          value: formData.batchNumberRemarks
        })
      } else if (formData.inStockOrNot === "From Purchase") {
        updates.push({
          rowIndex: selectedOrder.rowIndex,
          columnIndex: "59", // Indent/Self Batch Number (adjust based on your sheet)
          value: formData.indentSelfBatchNumber
        })
      }
      
      // Send updates to Google Sheets
      for (const update of updates) {
        const params = new URLSearchParams({
          action: 'updateCell',
          sheetName: 'ORDER RECEIPT',
          rowIndex: update.rowIndex.toString(),
          columnIndex: update.columnIndex,
          value: update.value
        })
        
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: params
        })
      }
      
      // Refresh data
      setTimeout(() => {
        fetchData()
      }, 1000)
      
      setSelectedOrder(null)
      setFormData({
        inStockOrNot: "",
        orderNumberProduction: "",
        qtyTransferred: "",
        batchNumberRemarks: "",
        indentSelfBatchNumber: ""
      })
      
      alert("Delivery check submitted successfully!")
      
    } catch (error) {
      console.error("Error updating data:", error)
      alert("Failed to submit. Please try again.")
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      inStockOrNot: "",
      orderNumberProduction: "",
      qtyTransferred: "",
      batchNumberRemarks: "",
      indentSelfBatchNumber: ""
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
      {/* Desktop Header */}
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-gray-900">Check for Delivery</h1>
        <p className="text-gray-600">Check stock availability and delivery readiness</p>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Check Delivery</h1>
        <p className="text-sm text-gray-600 mt-1">Verify stock & readiness</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Delivery Check</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Total orders: {orders.length} | Pending: {pendingOrders.length} | History: {historyOrders.length}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Tabs */}
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

            {/* Search Bar */}
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
                    {/* <TableHead className="font-semibold text-gray-900 py-4 px-6">Serial No</TableHead> */}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Firm Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party PO Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Contact Person</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned </TableHead>
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Date </TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">In Stock Or Not</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Order Number Production</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Qty Transferred</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Batch Number Remarks</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeTab === "pending" ? 7 : 12} className="text-center py-8 text-gray-500">
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
                              onClick={() => handleCheck(order)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Check
                            </Button>
                          </TableCell>
                        )}
                         <TableCell className="py-4 px-6">
                          <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                            {order.firmName}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">{order.partyPONumber}</TableCell>
                        <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                        <TableCell className="py-4 px-6">{order.contactPersonName}</TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-yellow-500 text-white rounded-full">{order.planned3}</Badge>
                        </TableCell>
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6">
                              <Badge className="bg-green-500 text-white rounded-full">{order.actual3}</Badge>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge className={`rounded-full ${
                                order.inStockOrNot === "In Stock" ? "bg-green-500 text-white" :
                                order.inStockOrNot === "For Production Planning" ? "bg-blue-500 text-white" :
                                order.inStockOrNot === "From Purchase" ? "bg-purple-500 text-white" :
                                "bg-gray-500 text-white"
                              }`}>
                                {order.inStockOrNot}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 px-6">{order.orderNumberProduction}</TableCell>
                            <TableCell className="py-4 px-6">{order.qtyTransferred}</TableCell>
                            <TableCell className="py-4 px-6">{order.batchNumberRemarks}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
                {displayOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No orders found</p>
                ) : (
                  displayOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">#{order.serialNo}</p>
                          <p className="text-xs text-gray-500">{order.partyPODate}</p>
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
                          <Badge className="bg-yellow-500 text-white text-xs">{order.planned3}</Badge>
                        </div>
                      </div>

                      {activeTab === "pending" && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <Button
                            size="sm"
                            onClick={() => handleCheck(order)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Check for Delivery
                          </Button>
                        </div>
                      )}

                      {activeTab === "history" && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Actual:</span>
                            <Badge className="bg-green-500 text-white text-xs">{order.actual3}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Status:</span>
                            <Badge className={`text-xs ${
                              order.inStockOrNot === "In Stock" ? "bg-green-500 text-white" :
                              order.inStockOrNot === "For Production Planning" ? "bg-blue-500 text-white" :
                              order.inStockOrNot === "From Purchase" ? "bg-purple-500 text-white" :
                              "bg-gray-500 text-white"
                            }`}>
                              {order.inStockOrNot}
                            </Badge>
                          </div>
                          {order.orderNumberProduction && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Prod #:</span>
                              <span className="font-medium">{order.orderNumberProduction}</span>
                            </div>
                          )}
                          {order.qtyTransferred && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Qty:</span>
                              <span className="font-medium">{order.qtyTransferred}</span>
                            </div>
                          )}
                          {order.batchNumberRemarks && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Batch:</span>
                              <span className="font-medium">{order.batchNumberRemarks}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Results Count */}
            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} of {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Check Modal - Fullscreen on Mobile */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Check for Delivery</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-4">
                {/* Pre-filled fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <Label className="text-xs">Firm Name</Label>
                    <Input value={selectedOrder.firmName} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Party PO Number</Label>
                    <Input value={selectedOrder.partyPONumber} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Party PO Date</Label>
                    <Input value={selectedOrder.partyPODate} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Party Name</Label>
                    <Input value={selectedOrder.partyName} disabled className="h-9" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Product Name</Label>
                    <Input value={selectedOrder.productName} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Planned </Label>
                    <Input value={selectedOrder.planned3} disabled className="h-9" />
                  </div>
                </div>

                {/* In Stock Or Not */}
                <div className="space-y-2">
                  <Label className="text-sm">In Stock Or Not *</Label>
                  <Select
                    value={formData.inStockOrNot}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, inStockOrNot: value }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In Stock">In Stock</SelectItem>
                      <SelectItem value="For Production Planning">For Production Planning</SelectItem>
                      <SelectItem value="From Purchase">From Purchase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditional fields for "In Stock" */}
                {formData.inStockOrNot === "In Stock" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Order Number Of The Production</Label>
                      <Input
                        value={formData.orderNumberProduction}
                        onChange={(e) => setFormData((prev) => ({ ...prev, orderNumberProduction: e.target.value }))}
                        className="h-9 text-sm"
                        placeholder="Enter production order number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Qty Transferred</Label>
                      <Input
                        value={formData.qtyTransferred}
                        onChange={(e) => setFormData((prev) => ({ ...prev, qtyTransferred: e.target.value }))}
                        className="h-9 text-sm"
                        placeholder="Enter quantity"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Batch Number In Remarks</Label>
                      <Input
                        value={formData.batchNumberRemarks}
                        onChange={(e) => setFormData((prev) => ({ ...prev, batchNumberRemarks: e.target.value }))}
                        className="h-9 text-sm"
                        placeholder="Enter batch number"
                      />
                    </div>
                  </div>
                )}

                {/* Conditional field for "From Purchase" */}
                {formData.inStockOrNot === "From Purchase" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Indent/Self Batch Number *</Label>
                    <Input
                      value={formData.indentSelfBatchNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, indentSelfBatchNumber: e.target.value }))}
                      className="h-9 text-sm"
                      placeholder="Enter indent/self batch number"
                    />
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                    disabled={!formData.inStockOrNot || 
                      (formData.inStockOrNot === "From Purchase" && !formData.indentSelfBatchNumber)}
                  >
                    Submit Check
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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