"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, FileText } from "lucide-react"

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
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Cache for orders data
  const [cachedOrders, setCachedOrders] = useState([])
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const CACHE_DURATION = 30000 // 30 seconds

  // Fetch data from Google Sheets with caching
  const fetchData = useCallback(async (forceRefresh = false) => {
    const now = Date.now()
    
    // Return cached data if within cache duration and not force refresh
    if (!forceRefresh && cachedOrders.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
      setOrders(cachedOrders)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Fetch data from Google Sheets
      const response = await fetch(`${SCRIPT_URL}?sheet=ORDER%20RECEIPT&timestamp=${now}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.data) {
        const transformedOrders = transformSheetData(data.data)
        setOrders(transformedOrders)
        setCachedOrders(transformedOrders)
        setLastFetchTime(now)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      // Use cached data if available
      if (cachedOrders.length > 0) {
        setOrders(cachedOrders)
      }
    } finally {
      setLoading(false)
    }
  }, [cachedOrders, lastFetchTime])

  useEffect(() => {
    fetchData()
  }, [])

  // Format date for display
  const formatDate = useCallback((dateString) => {
    if (!dateString) return ""
    
    try {
      // If it's already in DD/MM/YYYY format, return as is
      if (typeof dateString === 'string' && dateString.includes('/')) {
        // Validate DD/MM/YYYY format
        const parts = dateString.split('/')
        if (parts.length === 3) {
          const [day, month, year] = parts
          if (day.length === 2 && month.length === 2 && year.length === 4) {
            return dateString
          }
        }
      }
      
      let date
      if (dateString instanceof Date) {
        date = dateString
      } else if (typeof dateString === 'string' || typeof dateString === 'number') {
        // Try to parse as date
        date = new Date(dateString)
        
        // If invalid date, return original string
        if (isNaN(date.getTime())) {
          return dateString.toString()
        }
      } else {
        return dateString?.toString() || ""
      }
      
      // Format as DD/MM/YYYY
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      
      return `${day}/${month}/${year}`
    } catch {
      return dateString?.toString() || ""
    }
  }, [])

  // Transform Google Sheets data to order format
  const transformSheetData = useCallback((sheetData) => {
    if (!sheetData || sheetData.length < 6) return []
    
    // Headers are at index 5 (6th row)
    const headers = sheetData[5].map(header => header ? header.toString().trim() : "")
    
    const orders = []
    
    // Find column indices for all fields
    const columnIndices = {}
    const columnNames = [
      "Sr No",
      "DO-Delivery Order No.",
      "PARTY PO NO (As Per Po Exact)",
      "Party PO Date",
      "Party Names",
      "Product Name",
      "Quantity",
      "Rate Of Material",
      "Firm Name",
      "Contact Person Name",
      "Planned 3",
      "Actual 3",
      "In Stock Or Not",
      "Order Number Of The Production",
      "Qty Transferred",
      "Batch Number In Remarks",
      "Indent/Self Batch Number"
    ]
    
    // Find all column indices
    columnNames.forEach(colName => {
      columnIndices[colName] = headers.findIndex(h => 
        h && colName && h.toString().toLowerCase().includes(colName.toLowerCase())
      )
    })
    
    console.log("Column indices found:", columnIndices)
    
    // Data starts from index 6 (7th row)
    for (let i = 6; i < sheetData.length; i++) {
      const row = sheetData[i]
      
      // Check if this row has data
      const hasData = row && row.some(cell => cell && cell.toString().trim() !== "")
      if (!hasData) continue
      
      const planned3Value = columnIndices["Planned 3"] >= 0 && row[columnIndices["Planned 3"]] 
        ? row[columnIndices["Planned 3"]].toString().trim() 
        : ""
      
      // Only include rows where Planned 3 has value
      if (planned3Value) {
        const order = {
          id: i,
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          serialNo: columnIndices["Sr No"] >= 0 && row[columnIndices["Sr No"]] 
            ? row[columnIndices["Sr No"]].toString().trim() 
            : i - 5,
          doNumber: columnIndices["DO-Delivery Order No."] >= 0 && row[columnIndices["DO-Delivery Order No."]] 
            ? row[columnIndices["DO-Delivery Order No."]].toString().trim() 
            : `DO-${i + 1}`,
          firmName: columnIndices["Firm Name"] >= 0 && row[columnIndices["Firm Name"]] 
            ? row[columnIndices["Firm Name"]].toString().trim() 
            : "N/A",
          partyPONumber: columnIndices["PARTY PO NO (As Per Po Exact)"] >= 0 && row[columnIndices["PARTY PO NO (As Per Po Exact)"]] 
            ? row[columnIndices["PARTY PO NO (As Per Po Exact)"]].toString().trim() 
            : "N/A",
          partyName: columnIndices["Party Names"] >= 0 && row[columnIndices["Party Names"]] 
            ? row[columnIndices["Party Names"]].toString().trim() 
            : "N/A",
          contactPersonName: columnIndices["Contact Person Name"] >= 0 && row[columnIndices["Contact Person Name"]] 
            ? row[columnIndices["Contact Person Name"]].toString().trim() 
            : "N/A",
          partyPODate: columnIndices["Party PO Date"] >= 0 && row[columnIndices["Party PO Date"]] 
            ? formatDate(row[columnIndices["Party PO Date"]]) 
            : "N/A",
          productName: columnIndices["Product Name"] >= 0 && row[columnIndices["Product Name"]] 
            ? row[columnIndices["Product Name"]].toString().trim() 
            : "N/A",
          quantity: columnIndices["Quantity"] >= 0 && row[columnIndices["Quantity"]] 
            ? parseFloat(row[columnIndices["Quantity"]]) || 0 
            : 0,
          rate: columnIndices["Rate Of Material"] >= 0 && row[columnIndices["Rate Of Material"]] 
            ? parseFloat(row[columnIndices["Rate Of Material"]]) || 0 
            : 0,
          planned3: formatDate(planned3Value),
          actual3: columnIndices["Actual 3"] >= 0 && row[columnIndices["Actual 3"]] 
            ? formatDate(row[columnIndices["Actual 3"]].toString().trim()) 
            : "",
          inStockOrNot: columnIndices["In Stock Or Not"] >= 0 && row[columnIndices["In Stock Or Not"]] 
            ? row[columnIndices["In Stock Or Not"]].toString().trim() 
            : "",
          orderNumberProduction: columnIndices["Order Number Of The Production"] >= 0 && row[columnIndices["Order Number Of The Production"]] 
            ? row[columnIndices["Order Number Of The Production"]].toString().trim() 
            : "",
          qtyTransferred: columnIndices["Qty Transferred"] >= 0 && row[columnIndices["Qty Transferred"]] 
            ? row[columnIndices["Qty Transferred"]].toString().trim() 
            : "",
          batchNumberRemarks: columnIndices["Batch Number In Remarks"] >= 0 && row[columnIndices["Batch Number In Remarks"]] 
            ? row[columnIndices["Batch Number In Remarks"]].toString().trim() 
            : "",
          indentSelfBatchNumber: columnIndices["Indent/Self Batch Number"] >= 0 && row[columnIndices["Indent/Self Batch Number"]] 
            ? row[columnIndices["Indent/Self Batch Number"]].toString().trim() 
            : "",
          rawData: row // Store raw data
        }
        
        orders.push(order)
      }
    }
    
    console.log(`Transformed ${orders.length} orders`)
    return orders
  }, [formatDate])

  // Get filtered orders with memoization
  const filteredOrders = useMemo(() => {
    let filtered = orders.filter((order) => 
      order.planned3 && 
      order.planned3.trim() !== "" && 
      (!order.actual3 || order.actual3.trim() === "")
    )
    
    if (user.role !== "master") {
      filtered = filtered.filter((order) => order.firmName === user.firm)
    }
    return filtered
  }, [orders, user])

  const pendingOrders = filteredOrders
  
  // History orders: Both Planned 3 and Actual 3 are not null
  const historyOrders = useMemo(() => {
    return orders.filter((order) => 
      order.planned3 && 
      order.planned3.trim() !== "" && 
      order.actual3 && 
      order.actual3.trim() !== "" &&
      (user.role === "master" || order.firmName === user.firm)
    )
  }, [orders, user])

  // Apply search filter
  const searchFilteredOrders = useMemo(() => {
    const ordersList = activeTab === "pending" ? pendingOrders : historyOrders
    
    if (!searchTerm) return ordersList
    
    const term = searchTerm.toLowerCase()
    return ordersList.filter((order) =>
      Object.entries(order).some(([key, value]) => {
        if (key === 'id' || key === 'rowIndex' || key === 'rawData') return false
        return value && value.toString().toLowerCase().includes(term)
      })
    )
  }, [activeTab, pendingOrders, historyOrders, searchTerm])

  const displayOrders = searchFilteredOrders

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
      setSubmitting(true)
      setSubmitSuccess(false)
      
      // Get today's date in DD/MM/YYYY format
      const today = new Date()
      const day = today.getDate().toString().padStart(2, '0')
      const month = (today.getMonth() + 1).toString().padStart(2, '0')
      const year = today.getFullYear()
      const todayFormatted = `${day}/${month}/${year}`
      
      console.log("Updating order:", selectedOrder)
      console.log("Form data:", formData)
      
      // Prepare all updates
      const updates = []
      
      // Update Actual 3 (column 53)
      updates.push({
        rowIndex: selectedOrder.rowIndex,
        columnIndex: "53",
        value: todayFormatted
      })
      
      // Update In Stock Or Not (column 55)
      updates.push({
        rowIndex: selectedOrder.rowIndex,
        columnIndex: "55",
        value: formData.inStockOrNot
      })
      
      // Update fields based on selection
      if (formData.inStockOrNot === "In Stock") {
        // Order Number Of The Production (column 56)
        if (formData.orderNumberProduction) {
          updates.push({
            rowIndex: selectedOrder.rowIndex,
            columnIndex: "56",
            value: formData.orderNumberProduction
          })
        }
        
        // Qty Transferred (column 57)
        if (formData.qtyTransferred) {
          updates.push({
            rowIndex: selectedOrder.rowIndex,
            columnIndex: "57",
            value: formData.qtyTransferred
          })
        }
        
        // Batch Number In Remarks (column 58)
        if (formData.batchNumberRemarks) {
          updates.push({
            rowIndex: selectedOrder.rowIndex,
            columnIndex: "58",
            value: formData.batchNumberRemarks
          })
        }
      } else if (formData.inStockOrNot === "From Purchase") {
        // Indent/Self Batch Number (column 59)
        if (formData.indentSelfBatchNumber) {
          updates.push({
            rowIndex: selectedOrder.rowIndex,
            columnIndex: "58", // Fixed: column 59 instead of 60
            value: formData.indentSelfBatchNumber
          })
        }
      }
      
      console.log("Updates to send:", updates)
      
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
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      setSubmitSuccess(true)
      
      // Refresh data after successful submission
      setTimeout(() => {
        fetchData(true) // Force refresh
        handleCancel()
        setSubmitSuccess(false)
      }, 1500)
      
    } catch (error) {
      console.error("Error updating data:", error)
      alert("Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
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
        <h1 className="text-3xl font-bold text-gray-900">Check for Delivery</h1>
        <p className="text-gray-600">Check stock availability and delivery readiness</p>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Check Delivery</h1>
        <p className="text-sm text-gray-600 mt-1">Verify stock & readiness</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
              </div>
              <div className="bg-blue-500 rounded-full p-2 sm:p-3">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Check</p>
                <p className="text-2xl font-bold text-gray-900">{pendingOrders.length}</p>
              </div>
              <div className="bg-amber-500 rounded-full p-2 sm:p-3">
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{historyOrders.length}</p>
              </div>
              <div className="bg-green-500 rounded-full p-2 sm:p-3">
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div className="flex-1">
            <CardTitle className="text-xl">Delivery Check</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Showing {displayOrders.length} of {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 text-sm"
              />
            </div>
            <Button 
              onClick={() => fetchData(true)} 
              variant="outline" 
              size="sm"
              className="h-9"
              disabled={loading}
            >
              <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Tabs */}
            <div className="px-4 sm:px-6 pt-2">
              <div className="flex bg-gray-100 p-1 rounded-lg">
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
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <div className="min-w-[1400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      {activeTab === "pending" && (
                        <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[100px]">Action</TableHead>
                      )}
                      <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[120px]">DO Number</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[100px]">Firm Name</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[120px]">Party PO Number</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[100px]">Party Name</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[100px]">Contact Person</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[100px]">Planned Date</TableHead>
                      {activeTab === "history" && (
                        <>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[100px]">Actual Date</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[120px]">In Stock Or Not</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[120px]">Order Number Production</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[100px]">Qty Transferred</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[120px]">Batch Number Remarks</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6 min-w-[120px]">Indent/Self Batch No</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={activeTab === "pending" ? 7 : 13} className="text-center py-8 text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="w-12 h-12 text-gray-300" />
                            <p className="text-lg">No {activeTab === "pending" ? "pending" : "historical"} orders found</p>
                            <p className="text-sm text-gray-400">
                              {searchTerm ? "Try a different search term" : "No data available"}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                          {activeTab === "pending" && (
                            <TableCell className="py-4 px-6 min-w-[100px]">
                              <Button
                                size="sm"
                                onClick={() => handleCheck(order)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Check
                              </Button>
                            </TableCell>
                          )}
                          <TableCell className="py-4 px-6 min-w-[120px]">
                            <Badge variant="outline" className="rounded-md bg-gray-50">
                              {order.doNumber}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6 min-w-[100px]">
                            <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                              {order.firmName}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6 min-w-[120px]">{order.partyPONumber}</TableCell>
                          <TableCell className="py-4 px-6 min-w-[100px] truncate max-w-[150px]">{order.partyName}</TableCell>
                          <TableCell className="py-4 px-6 min-w-[100px] truncate max-w-[150px]">{order.contactPersonName}</TableCell>
                          <TableCell className="py-4 px-6 min-w-[100px]">
                            <Badge className="bg-yellow-500 text-white rounded-full">{order.planned3}</Badge>
                          </TableCell>
                          {activeTab === "history" && (
                            <>
                              <TableCell className="py-4 px-6 min-w-[100px]">
                                <Badge className="bg-green-500 text-white rounded-full">{order.actual3}</Badge>
                              </TableCell>
                              <TableCell className="py-4 px-6 min-w-[120px]">
                                <Badge className={`rounded-full ${
                                  order.inStockOrNot === "In Stock" ? "bg-green-500 text-white" :
                                  order.inStockOrNot === "For Production Planning" ? "bg-blue-500 text-white" :
                                  order.inStockOrNot === "From Purchase" ? "bg-purple-500 text-white" :
                                  "bg-gray-500 text-white"
                                }`}>
                                  {order.inStockOrNot || "Not Set"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4 px-6 min-w-[120px]">{order.orderNumberProduction || "-"}</TableCell>
                              <TableCell className="py-4 px-6 min-w-[100px]">{order.qtyTransferred || "-"}</TableCell>
                              <TableCell className="py-4 px-6 min-w-[120px]">{order.batchNumberRemarks || "-"}</TableCell>
                              <TableCell className="py-4 px-6 min-w-[120px]">{order.indentSelfBatchNumber || "-"}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                {displayOrders.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg">No orders found</p>
                    <p className="text-sm text-gray-400">
                      {searchTerm ? "Try a different search term" : "No data available"}
                    </p>
                  </div>
                ) : (
                  displayOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Badge variant="outline" className="rounded-md bg-gray-50 text-xs mb-2">
                            {order.doNumber}
                          </Badge>
                          <p className="font-semibold text-gray-900">{order.partyPONumber}</p>
                          <p className="text-xs text-gray-500">{order.partyPODate}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full text-xs">
                          {order.firmName}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Party:</span>
                          <span className="font-medium truncate max-w-[150px]">{order.partyName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Contact:</span>
                          <span className="font-medium truncate max-w-[150px]">{order.contactPersonName}</span>
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
                              {order.inStockOrNot || "Not Set"}
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
                          {order.indentSelfBatchNumber && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Indent:</span>
                              <span className="font-medium">{order.indentSelfBatchNumber}</span>
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
            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 border-t border-gray-200">
              Showing {displayOrders.length} of {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Check Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Check for Delivery</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              {submitSuccess ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Check Submitted Successfully!</h3>
                  <p className="text-gray-600 text-center">The delivery check has been recorded and the data has been updated.</p>
                  <Button 
                    onClick={handleCancel} 
                    className="mt-6 bg-blue-600 hover:bg-blue-700"
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pre-filled fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <Label className="text-xs">DO Number</Label>
                      <Input value={selectedOrder.doNumber} disabled className="h-9" />
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
                      <Label className="text-xs">Party PO Date</Label>
                      <Input value={selectedOrder.partyPODate} disabled className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Party Name</Label>
                      <Input value={selectedOrder.partyName} disabled className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contact Person</Label>
                      <Input value={selectedOrder.contactPersonName} disabled className="h-9" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Product Name</Label>
                      <Input value={selectedOrder.productName} disabled className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Planned Date</Label>
                      <Input value={selectedOrder.planned3} disabled className="h-9" />
                    </div>
                  </div>

                  {/* In Stock Or Not */}
                  <div className="space-y-2">
                    <Label className="text-sm">In Stock Or Not *</Label>
                    <Select
                      value={formData.inStockOrNot}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, inStockOrNot: value }))}
                      disabled={submitting}
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
                          disabled={submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Qty Transferred</Label>
                        <Input
                          value={formData.qtyTransferred}
                          onChange={(e) => setFormData((prev) => ({ ...prev, qtyTransferred: e.target.value }))}
                          className="h-9 text-sm"
                          placeholder="Enter quantity"
                          disabled={submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Batch Number In Remarks</Label>
                        <Input
                          value={formData.batchNumberRemarks}
                          onChange={(e) => setFormData((prev) => ({ ...prev, batchNumberRemarks: e.target.value }))}
                          className="h-9 text-sm"
                          placeholder="Enter batch number"
                          disabled={submitting}
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
                        disabled={submitting}
                      />
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
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
                      disabled={submitting || !formData.inStockOrNot || 
                        (formData.inStockOrNot === "From Purchase" && !formData.indentSelfBatchNumber)}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Check"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}