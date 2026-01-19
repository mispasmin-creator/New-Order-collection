"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import OrderForm from "../forms/OrderForm"
import { Plus, FileText, TrendingUp, CheckCircle, Search, Filter, Eye, RefreshCw, Loader2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { format } from "date-fns"

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec";

export default function OrderPage({ user }) {
  const [showForm, setShowForm] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [firmFilter, setFirmFilter] = useState("all")
  const [refreshing, setRefreshing] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Function to transform Google Sheets data to order format
  const transformSheetData = (sheetData) => {
    if (!sheetData || sheetData.length < 6) return []
    
    // Headers are at index 5 (6th row)
    const headers = sheetData[5].map(header => header ? header.toString().trim() : "")
    
    console.log("Headers found:", headers)
    console.log("Total rows:", sheetData.length)
    
    const orders = []
    
    // Find column indices based on your headers
    const indices = {
      timestamp: headers.findIndex(h => h.includes("Timestamp")),
      firmName: headers.findIndex(h => h.includes("Firm Name")),
      doNumber: headers.findIndex(h => h.includes("DO-Delivery Order No.")),
      partyPONumber: headers.findIndex(h => h.includes("PARTY PO NO (As Per Po Exact)")),
      partyPODate: headers.findIndex(h => h.includes("Party PO Date")),
      partyName: headers.findIndex(h => h.includes("Party Names")),
      contactPerson: headers.findIndex(h => h.includes("Contact Person Name")),
      productName: headers.findIndex(h => h.includes("Product Name")),
      quantity: headers.findIndex(h => h.includes("Quantity")),
      typeOfMeasurement: headers.findIndex(h => h.includes("Type Of Measurement")),
      rate: headers.findIndex(h => h.includes("Rate Of Material")),
      totalValue: headers.findIndex(h => h.includes("Total PO Basic Value")),
      status: headers.findIndex(h => h.includes("Status")),
      planned1: headers.findIndex(h => h.includes("Planned 1")),
      actual1: headers.findIndex(h => h.includes("Actual 1")),
      planned2: headers.findIndex(h => h.includes("Planned 2")),
      actual2: headers.findIndex(h => h.includes("Actual 2")),
      planned3: headers.findIndex(h => h.includes("Planned 3")),
      actual3: headers.findIndex(h => h.includes("Actual 3"))
    }
    
    console.log("Column indices:", indices)
    
    // Data starts from index 6 (7th row)
    for (let i = 6; i < sheetData.length; i++) {
      const row = sheetData[i]
      
      // Skip empty rows
      if (!row || row.length === 0 || !row[indices.timestamp]) continue
      
      const order = {
        id: `order-${i}`,
        rowIndex: i + 1, // Google Sheets row number (1-indexed)
        timestamp: indices.timestamp >= 0 && row[indices.timestamp] ? row[indices.timestamp].toString().trim() : "",
        firmName: indices.firmName >= 0 && row[indices.firmName] ? row[indices.firmName].toString().trim() : "N/A",
        doNumber: indices.doNumber >= 0 && row[indices.doNumber] ? row[indices.doNumber].toString().trim() : `DO-${i-5}`,
        partyPONumber: indices.partyPONumber >= 0 && row[indices.partyPONumber] ? row[indices.partyPONumber].toString().trim() : "N/A",
        partyPODate: indices.partyPODate >= 0 && row[indices.partyPODate] ? formatDate(row[indices.partyPODate]) : "N/A",
        partyName: indices.partyName >= 0 && row[indices.partyName] ? row[indices.partyName].toString().trim() : "N/A",
        contactPerson: indices.contactPerson >= 0 && row[indices.contactPerson] ? row[indices.contactPerson].toString().trim() : "N/A",
        productName: indices.productName >= 0 && row[indices.productName] ? row[indices.productName].toString().trim() : "N/A",
        quantity: indices.quantity >= 0 && row[indices.quantity] ? parseFloat(row[indices.quantity]) || 0 : 0,
        typeOfMeasurement: indices.typeOfMeasurement >= 0 && row[indices.typeOfMeasurement] ? row[indices.typeOfMeasurement].toString().trim() : "",
        rate: indices.rate >= 0 && row[indices.rate] ? parseFloat(row[indices.rate]) || 0 : 0,
        totalValue: indices.totalValue >= 0 && row[indices.totalValue] ? parseFloat(row[indices.totalValue]) || 0 : 0,
        status: indices.status >= 0 && row[indices.status] ? row[indices.status].toString().trim() : "New Order",
        planned1: indices.planned1 >= 0 && row[indices.planned1] ? formatDate(row[indices.planned1]) : "",
        actual1: indices.actual1 >= 0 && row[indices.actual1] ? formatDate(row[indices.actual1]) : "",
        planned2: indices.planned2 >= 0 && row[indices.planned2] ? formatDate(row[indices.planned2]) : "",
        actual2: indices.actual2 >= 0 && row[indices.actual2] ? formatDate(row[indices.actual2]) : "",
        planned3: indices.planned3 >= 0 && row[indices.planned3] ? formatDate(row[indices.planned3]) : "",
        actual3: indices.actual3 >= 0 && row[indices.actual3] ? formatDate(row[indices.actual3]) : "",
        rawData: row // Store raw data for debugging
      }
      
      orders.push(order)
    }
    
    console.log("Total orders transformed:", orders.length)
    return orders
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

  // Fetch orders from Google Sheets
  const fetchOrders = async () => {
    try {
      setLoading(true)
      setRefreshing(true)
      
      console.log("Fetching orders from Google Sheets...")
      
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=ORDER%20RECEIPT`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        console.log("Data received, transforming...")
        const ordersData = transformSheetData(result.data)
        setOrders(ordersData)
        console.log("Orders set:", ordersData.length)
      } else {
        console.error("No data in response:", result)
        setOrders([])
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      setOrders([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initialize - fetch orders on component mount
  useEffect(() => {
    fetchOrders()
  }, [])

  // Function to manually refresh orders
  const refreshOrders = async () => {
    setRefreshing(true)
    await fetchOrders()
  }

  const handleSendToDispatch = async (order) => {
    try {
      // Update status to "Dispatched" in Google Sheets
      const updateData = new FormData()
      updateData.append("action", "updateCell")
      updateData.append("sheetName", "ORDER RECEIPT")
      updateData.append("rowIndex", order.rowIndex.toString())
      
      // Find status column index (adjust based on your sheet)
      updateData.append("columnIndex", "17") // Status is typically column Q (index 16)
      updateData.append("value", "Dispatched")
      
      const updateResponse = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: updateData
      })
      
      const updateResult = await updateResponse.json()
      
      if (updateResult.success) {
        // Update local state
        setOrders(prevOrders => 
          prevOrders.map(o => 
            o.id === order.id ? { ...o, status: "Dispatched" } : o
          )
        )
      }
    } catch (error) {
      console.error("Error sending to dispatch:", error)
      alert("Failed to update status. Please try again.")
    }
  }

  // Filter orders based on user role and search/filters
  const getFilteredOrders = () => {
    let filtered = orders
    
    // Filter by user role
    if (user.role !== "master") {
      filtered = filtered.filter(order => order.firmName === user.firm)
    }
    
    // Apply firm filter
    if (firmFilter !== "all" && user.role === "master") {
      filtered = filtered.filter(order => order.firmName === firmFilter)
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter)
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order => {
        const searchableFields = [
          "doNumber",
          "partyPONumber",
          "partyName",
          "productName",
          "contactPerson",
          "firmName",
          "status"
        ]
        
        return searchableFields.some(field => 
          order[field]?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }
    
    return filtered
  }

  const filteredOrders = getFilteredOrders()
  
  // Calculate totals
  const totalValue = filteredOrders.reduce((sum, order) => {
    return sum + (order.totalValue || 0)
  }, 0)
  
  const totalQuantity = filteredOrders.reduce((sum, order) => {
    return sum + (order.quantity || 0)
  }, 0)

  // Get unique firms for filter
  const uniqueFirms = [...new Set(orders.map(order => order.firmName).filter(Boolean))]
  
  // Get unique statuses for filter
  const uniqueStatuses = [...new Set(orders.map(order => order.status || "New Order").filter(Boolean))]

  // View order details
  const viewOrderDetails = (order) => {
    setSelectedOrder(order)
    setShowDetailModal(true)
  }

  // Handle form submission success
  const handleFormSuccess = () => {
    setShowForm(false)
    // Refresh orders after form submission
    setTimeout(() => {
      fetchOrders()
    }, 1500)
  }

  if (loading && orders.length === 0) {
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
        <h1 className="text-3xl font-bold text-gray-900">Orders Management</h1>
        <p className="text-gray-600">Manage your orders and track their progress</p>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-600 mt-1">Manage & track all orders</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Orders</p>
                <p className="text-2xl font-bold text-blue-900">{filteredOrders.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Total Value</p>
                <p className="text-2xl font-bold text-green-900">₹{totalValue.toLocaleString("en-IN")}</p>
              </div>
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Total Quantity</p>
                <p className="text-2xl font-bold text-purple-900">{totalQuantity.toLocaleString("en-IN")}</p>
              </div>
              <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-50 to-orange-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">Pending Orders</p>
                <p className="text-2xl font-bold text-orange-900">
                  {filteredOrders.filter(o => !o.status || o.status === "New Order").length}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search orders by DO No, Party Name, Product, etc..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4">
              {user.role === "master" && (
                <Select value={firmFilter} onValueChange={setFirmFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Firm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Firms</SelectItem>
                    {uniqueFirms.map(firm => (
                      <SelectItem key={firm} value={firm}>{firm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setSearchTerm("")
                  setStatusFilter("all")
                  setFirmFilter("all")
                }} className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Clear Filters
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={refreshOrders}
                  disabled={refreshing}
                  className="flex items-center gap-2"
                >
                  {refreshing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Order Button */}
      <div className="flex justify-end">
        <Button 
          onClick={() => setShowForm(true)} 
          className="bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New Order
        </Button>
      </div>

      {/* Order Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto shadow-2xl">
            <OrderForm 
              onCancel={() => setShowForm(false)}
              onSuccess={handleFormSuccess}
              user={user} 
            />
          </div>
        </div>
      )}

      {/* Orders Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-gray-900">All Orders</CardTitle>
            <span className="text-sm text-gray-500">
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">
                {searchTerm ? "No orders found matching your search" : "No orders found"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {!searchTerm && "Click 'Add New Order' to create your first order"}
              </p>
              {searchTerm && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchTerm("")}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">DO No.</TableHead>
                    <TableHead className="font-semibold text-gray-900">Party PO</TableHead>
                    <TableHead className="font-semibold text-gray-900">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900">Product</TableHead>
                    <TableHead className="font-semibold text-gray-900">Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900">Rate</TableHead>
                    <TableHead className="font-semibold text-gray-900">Total Value</TableHead>
                    <TableHead className="font-semibold text-gray-900">Firm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {order.doNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.partyPONumber}</div>
                        <div className="text-xs text-gray-500">{order.partyPODate}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.partyName}</div>
                        {order.contactPerson && (
                          <div className="text-xs text-gray-500">{order.contactPerson}</div>
                        )}
                      </TableCell>
                      <TableCell>{order.productName}</TableCell>
                      <TableCell>
                        <div>{order.quantity || "0"}</div>
                        {order.typeOfMeasurement && (
                          <div className="text-xs text-gray-500">{order.typeOfMeasurement}</div>
                        )}
                      </TableCell>
                      <TableCell>₹{(order.rate || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="font-semibold">
                        ₹{(order.totalValue || 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {order.firmName}
                        </Badge>
                      </TableCell>
                      
                      {/* <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendToDispatch(order)}
                            disabled={order.status === "Dispatched" || order.status === "Completed"}
                          >
                            Dispatch
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewOrderDetails(order)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell> */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Order Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">DO Number</Label>
                    <p className="text-lg font-semibold">{selectedOrder.doNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Firm Name</Label>
                    <p className="text-lg">{selectedOrder.firmName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Party Name</Label>
                    <p className="text-lg">{selectedOrder.partyName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Contact Person</Label>
                    <p className="text-lg">{selectedOrder.contactPerson || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Product Name</Label>
                    <p className="text-lg">{selectedOrder.productName}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Party PO Number</Label>
                    <p className="text-lg">{selectedOrder.partyPONumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Party PO Date</Label>
                    <p className="text-lg">{selectedOrder.partyPODate}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Quantity</Label>
                    <p className="text-lg">{selectedOrder.quantity} {selectedOrder.typeOfMeasurement}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Rate</Label>
                    <p className="text-lg">₹{(selectedOrder.rate || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Total Value</Label>
                    <p className="text-lg font-semibold">₹{(selectedOrder.totalValue || 0).toLocaleString("en-IN")}</p>
                  </div>
                 
                </div>
              </div>
              
              {/* Timeline Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Order Timeline</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Planned 1</Label>
                    <p className="text-sm">{selectedOrder.planned1 || "Not set"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Actual 1</Label>
                    <p className="text-sm">{selectedOrder.actual1 || "Not set"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <Badge variant={selectedOrder.actual1 ? "outline" : "secondary"}>
                      {selectedOrder.actual1 ? "Completed" : "Pending"}
                    </Badge>
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

// Add Label component if not already imported
const Label = ({ children, className }) => (
  <label className={`block text-sm font-medium ${className}`}>{children}</label>
)