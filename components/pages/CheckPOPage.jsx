"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Calendar, 
  CheckCircle2, 
  Loader2,
  Filter,
  Download,
  ChevronRight,
  ChevronDown,
  Building,
  FileText,
  User,
  Package,
  Truck
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function CheckPOPage({ user, onNavigate }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState([])
  const [deliveryDates, setDeliveryDates] = useState({})
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterFirm, setFilterFirm] = useState("all")
  const [expandedRow, setExpandedRow] = useState(null)
  
  // Your Google Apps Script web app URL
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

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
      let date
      
      if (dateString instanceof Date) {
        date = dateString
      } else if (typeof dateString === 'string' || typeof dateString === 'number') {
        date = new Date(dateString)
      } else {
        return dateString.toString()
      }
      
      if (isNaN(date.getTime())) {
        return dateString.toString()
      }
      
      // Format as DD/MM/YYYY
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      
      return `${day}/${month}/${year}`
    } catch {
      return dateString.toString()
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
      "DO-Delivery Order No.",
      "PARTY PO NO (As Per Po Exact)",
      "Party PO Date",
      "Party Names",
      "Product Name",
      "Quantity",
      "Rate Of Material",
      "Type Of Transporting",
      "Is This Order Through Some Agent",
      "Order Received From",
      "Type Of Measurement",
      "Contact Person Name",
      "Contact Person WhatsApp No.",
      "Alumina%",
      "Iron%",
      "Type Of PI",
      "Lead Time For Collection Of Final Payment",
      "Type Of Application",
      "Customer Category",
      "Free Replacement (FOC)",
      "Gst Number",
      "Address",
      "Firm Name",
      "Total PO Basic Value",
      "Payment to Be Taken",
      "Advance",
      "Basic",
      "Retention Payment",
      "Retention Percentage",
      "Lead Time for Retention",
      "Specific Concern",
      "Reference No.",
      "Adjusted Amount",
      "Planned 1",
      "Actual 1",
      "Expected Delivery Date",
      "Status"
    ]
    
    // Find all column indices
    columnNames.forEach(colName => {
      columnIndices[colName] = headers.findIndex(h => 
        h && colName && h.toString().toLowerCase().includes(colName.toLowerCase())
      )
    })
    
    // Data starts from index 6 (7th row)
    for (let i = 6; i < sheetData.length; i++) {
      const row = sheetData[i]
      
      // Check if this row has data
      const hasData = row && row.some(cell => cell && cell.toString().trim() !== "")
      if (!hasData) continue
      
      // Get DO number or use row index
      const doNumber = columnIndices["DO-Delivery Order No."] >= 0 && row[columnIndices["DO-Delivery Order No."]] 
        ? row[columnIndices["DO-Delivery Order No."]].toString().trim() 
        : `DO-${i + 1}`
      
      const plannedValue = columnIndices["Planned 1"] >= 0 && row[columnIndices["Planned 1"]] 
        ? row[columnIndices["Planned 1"]].toString().trim() 
        : ""
      
      // Only include rows where Planned 1 has value or DO number exists
      if (plannedValue || doNumber !== `DO-${i + 1}`) {
        const order = {
          id: i,
          doNumber: doNumber,
          partyPONumber: columnIndices["PARTY PO NO (As Per Po Exact)"] >= 0 && row[columnIndices["PARTY PO NO (As Per Po Exact)"]] 
            ? row[columnIndices["PARTY PO NO (As Per Po Exact)"]].toString().trim() 
            : "N/A",
          partyPODate: columnIndices["Party PO Date"] >= 0 && row[columnIndices["Party PO Date"]] 
            ? formatDate(row[columnIndices["Party PO Date"]]) 
            : "N/A",
          partyName: columnIndices["Party Names"] >= 0 && row[columnIndices["Party Names"]] 
            ? row[columnIndices["Party Names"]].toString().trim() 
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
          transportType: columnIndices["Type Of Transporting"] >= 0 && row[columnIndices["Type Of Transporting"]] 
            ? row[columnIndices["Type Of Transporting"]].toString().trim() 
            : "N/A",
          isAgentOrder: columnIndices["Is This Order Through Some Agent"] >= 0 && row[columnIndices["Is This Order Through Some Agent"]] 
            ? row[columnIndices["Is This Order Through Some Agent"]].toString().trim() 
            : "No",
          orderReceivedFrom: columnIndices["Order Received From"] >= 0 && row[columnIndices["Order Received From"]] 
            ? row[columnIndices["Order Received From"]].toString().trim() 
            : "N/A",
          measurementType: columnIndices["Type Of Measurement"] >= 0 && row[columnIndices["Type Of Measurement"]] 
            ? row[columnIndices["Type Of Measurement"]].toString().trim() 
            : "N/A",
          contactPersonName: columnIndices["Contact Person Name"] >= 0 && row[columnIndices["Contact Person Name"]] 
            ? row[columnIndices["Contact Person Name"]].toString().trim() 
            : "N/A",
          contactWhatsApp: columnIndices["Contact Person WhatsApp No."] >= 0 && row[columnIndices["Contact Person WhatsApp No."]] 
            ? row[columnIndices["Contact Person WhatsApp No."]].toString().trim() 
            : "N/A",
          aluminaPercent: columnIndices["Alumina%"] >= 0 && row[columnIndices["Alumina%"]] 
            ? row[columnIndices["Alumina%"]].toString().trim() 
            : "N/A",
          ironPercent: columnIndices["Iron%"] >= 0 && row[columnIndices["Iron%"]] 
            ? row[columnIndices["Iron%"]].toString().trim() 
            : "N/A",
          piType: columnIndices["Type Of PI"] >= 0 && row[columnIndices["Type Of PI"]] 
            ? row[columnIndices["Type Of PI"]].toString().trim() 
            : "N/A",
          leadTimePayment: columnIndices["Lead Time For Collection Of Final Payment"] >= 0 && row[columnIndices["Lead Time For Collection Of Final Payment"]] 
            ? row[columnIndices["Lead Time For Collection Of Final Payment"]].toString().trim() 
            : "N/A",
          applicationType: columnIndices["Type Of Application"] >= 0 && row[columnIndices["Type Of Application"]] 
            ? row[columnIndices["Type Of Application"]].toString().trim() 
            : "N/A",
          customerCategory: columnIndices["Customer Category"] >= 0 && row[columnIndices["Customer Category"]] 
            ? row[columnIndices["Customer Category"]].toString().trim() 
            : "N/A",
          freeReplacement: columnIndices["Free Replacement (FOC)"] >= 0 && row[columnIndices["Free Replacement (FOC)"]] 
            ? row[columnIndices["Free Replacement (FOC)"]].toString().trim() 
            : "No",
          gstNumber: columnIndices["Gst Number"] >= 0 && row[columnIndices["Gst Number"]] 
            ? row[columnIndices["Gst Number"]].toString().trim() 
            : "N/A",
          address: columnIndices["Address"] >= 0 && row[columnIndices["Address"]] 
            ? row[columnIndices["Address"]].toString().trim() 
            : "N/A",
          firmName: columnIndices["Firm Name"] >= 0 && row[columnIndices["Firm Name"]] 
            ? row[columnIndices["Firm Name"]].toString().trim() 
            : "N/A",
          totalPOValue: columnIndices["Total PO Basic Value"] >= 0 && row[columnIndices["Total PO Basic Value"]] 
            ? parseFloat(row[columnIndices["Total PO Basic Value"]]) || 0 
            : 0,
          paymentToBeTaken: columnIndices["Payment to Be Taken"] >= 0 && row[columnIndices["Payment to Be Taken"]] 
            ? row[columnIndices["Payment to Be Taken"]].toString().trim() 
            : "N/A",
          advance: columnIndices["Advance"] >= 0 && row[columnIndices["Advance"]] 
            ? parseFloat(row[columnIndices["Advance"]]) || 0 
            : 0,
          basic: columnIndices["Basic"] >= 0 && row[columnIndices["Basic"]] 
            ? parseFloat(row[columnIndices["Basic"]]) || 0 
            : 0,
          retentionPayment: columnIndices["Retention Payment"] >= 0 && row[columnIndices["Retention Payment"]] 
            ? parseFloat(row[columnIndices["Retention Payment"]]) || 0 
            : 0,
          retentionPercentage: columnIndices["Retention Percentage"] >= 0 && row[columnIndices["Retention Percentage"]] 
            ? parseFloat(row[columnIndices["Retention Percentage"]]) || 0 
            : 0,
          leadTimeRetention: columnIndices["Lead Time for Retention"] >= 0 && row[columnIndices["Lead Time for Retention"]] 
            ? row[columnIndices["Lead Time for Retention"]].toString().trim() 
            : "N/A",
          specificConcern: columnIndices["Specific Concern"] >= 0 && row[columnIndices["Specific Concern"]] 
            ? row[columnIndices["Specific Concern"]].toString().trim() 
            : "N/A",
          referenceNo: columnIndices["Reference No."] >= 0 && row[columnIndices["Reference No."]] 
            ? row[columnIndices["Reference No."]].toString().trim() 
            : "N/A",
          adjustedAmount: columnIndices["Adjusted Amount"] >= 0 && row[columnIndices["Adjusted Amount"]] 
            ? parseFloat(row[columnIndices["Adjusted Amount"]]) || 0 
            : 0,
          plannedDate: formatDate(plannedValue),
          actualDate: columnIndices["Actual 1"] >= 0 && row[columnIndices["Actual 1"]] 
            ? formatDate(row[columnIndices["Actual 1"]].toString().trim()) 
            : "",
          expectedDeliveryDate: columnIndices["Expected Delivery Date"] >= 0 && row[columnIndices["Expected Delivery Date"]] 
            ? formatDate(row[columnIndices["Expected Delivery Date"]].toString().trim()) 
            : "",
          status: columnIndices["Status"] >= 0 && row[columnIndices["Status"]] 
            ? row[columnIndices["Status"]].toString().trim() 
            : "Pending",
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          rawData: row // Store raw data
        }
        
        // Calculate total value if not provided
        if (order.totalPOValue === 0 && order.quantity > 0 && order.rate > 0) {
          order.totalPOValue = order.quantity * order.rate
        }
        
        orders.push(order)
      }
    }
    
    return orders
  }, [formatDate])

  // Get unique firm names for filter
  const firmOptions = useMemo(() => {
    const firms = [...new Set(orders.map(order => order.firmName).filter(Boolean))]
    return ["all", ...firms]
  }, [orders])

  // Filter orders based on user role, tab, and filters
  const filteredOrders = useMemo(() => {
    let filtered = orders
    
    // Filter by user role
    if (user.role !== "master") {
      filtered = filtered.filter(order => order.firmName === user.firm)
    }
    
    // Filter by firm
    if (filterFirm !== "all") {
      filtered = filtered.filter(order => order.firmName === filterFirm)
    }
    
    // Filter by tab
    if (activeTab === "pending") {
      filtered = filtered.filter(order => 
        order.plannedDate && 
        order.plannedDate.trim() !== "" && 
        (!order.actualDate || order.actualDate.trim() === "")
      )
    } else {
      filtered = filtered.filter(order => 
        order.expectedDeliveryDate && order.expectedDeliveryDate.trim() !== ""
      )
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(order =>
        Object.entries(order).some(([key, value]) => {
          if (key === 'id' || key === 'rowIndex' || key === 'rawData') return false
          return value && value.toString().toLowerCase().includes(term)
        })
      )
    }
    
    return filtered
  }, [orders, user, activeTab, filterFirm, searchTerm])

  // Handle order selection
  const handleOrderSelection = useCallback((orderId, checked) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId])
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId))
      setDeliveryDates(prev => {
        const newDates = { ...prev }
        delete newDates[orderId]
        return newDates
      })
    }
  }, [])

  // Handle delivery date change
  const handleDeliveryDateChange = useCallback((orderId, date) => {
    setDeliveryDates(prev => ({
      ...prev,
      [orderId]: date
    }))
  }, [])

  // Handle bulk selection
  const handleSelectAll = useCallback(() => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([])
      setDeliveryDates({})
    } else {
      const allIds = filteredOrders.map(order => order.id)
      setSelectedOrders(allIds)
      // Set default delivery dates for all
      const defaultDate = new Date().toISOString().split('T')[0]
      const dates = {}
      allIds.forEach(id => {
        dates[id] = defaultDate
      })
      setDeliveryDates(dates)
    }
  }, [filteredOrders, selectedOrders.length])

  // Submit expected delivery dates
  const handleSubmit = async () => {
    if (selectedOrders.length === 0) return
    
    try {
      const updates = []
      
      // Prepare all updates
      for (const orderId of selectedOrders) {
        const order = orders.find(o => o.id === orderId)
        const date = deliveryDates[orderId]
        
        if (!date || !order) continue
        
        // Format date for Google Sheets (DD/MM/YYYY)
        const [year, month, day] = date.split('-')
        const formattedDate = `${day}/${month}/${year}`
        
        // Get current date in DD/MM/YYYY format
        const now = new Date()
        const currentDay = now.getDate().toString().padStart(2, '0')
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0')
        const currentYear = now.getFullYear()
        const currentDate = `${currentDay}/${currentMonth}/${currentYear}`
        
        updates.push({
          rowIndex: order.rowIndex,
          expectedDate: formattedDate,
          actualDate: currentDate
        })
      }
      
      // Send updates to Google Sheets
      for (const update of updates) {
        // Update Expected Delivery Date (column 47, 1-indexed)
        const expectedDateParams = new URLSearchParams({
          action: 'updateCell',
          sheetName: 'ORDER RECEIPT',
          rowIndex: update.rowIndex.toString(),
          columnIndex: '48', // Expected Delivery Date is column 48 (1-indexed)
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
          columnIndex: '46', // Actual 1 is column 46 (1-indexed)
          value: update.actualDate
        })
        
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: actualDateParams
        })
      }
      
      // Clear selections
      setSelectedOrders([])
      setDeliveryDates({})
      
      // Show success message
      alert(`Successfully updated ${selectedOrders.length} order(s)!`)
      
      // Refresh data
      fetchData(true)
      
      // Navigate to Check for Delivery page if function exists
      if (onNavigate) {
        setTimeout(() => onNavigate("Check for Delivery"), 1000)
      }
    } catch (error) {
      console.error("Error updating data:", error)
      alert("Failed to update data. Please try again.")
    }
  }

  // Toggle row expansion
  const toggleRowExpansion = useCallback((orderId) => {
    setExpandedRow(expandedRow === orderId ? null : orderId)
  }, [expandedRow])

  // Render all order details
  const renderOrderDetails = (order) => {
    return (
      <div className="space-y-4 p-3 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Product Details */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Product Details
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Product:</span>
                <span className="font-medium">{order.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Quantity:</span>
                <span className="font-medium">{order.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rate:</span>
                <span className="font-medium">₹{order.rate.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Transport:</span>
                <span className="font-medium">{order.transportType}</span>
              </div>
            </div>
          </div>
          
          {/* Technical Specifications */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Technical Specs</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Alumina %:</span>
                <span className="font-medium">{order.aluminaPercent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Iron %:</span>
                <span className="font-medium">{order.ironPercent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Measurement:</span>
                <span className="font-medium">{order.measurementType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Application:</span>
                <span className="font-medium">{order.applicationType}</span>
              </div>
            </div>
          </div>
          
          {/* Payment Details */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Payment Details</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Value:</span>
                <span className="font-bold text-green-600">₹{order.totalPOValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Advance:</span>
                <span className="font-medium">₹{order.advance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Retention:</span>
                <span className="font-medium">{order.retentionPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">GST:</span>
                <span className="font-medium">{order.gstNumber}</span>
              </div>
            </div>
          </div>
          
          {/* Additional Information */}
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <h4 className="font-semibold text-sm text-gray-700">Additional Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Customer Category:</span>
                <span className="font-medium">{order.customerCategory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PI Type:</span>
                <span className="font-medium">{order.piType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Agent Order:</span>
                <Badge variant="outline" className="text-xs">
                  {order.isAgentOrder}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">FOC:</span>
                <Badge variant="outline" className="text-xs">
                  {order.freeReplacement}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reference No:</span>
                <span className="font-medium">{order.referenceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Adjusted Amt:</span>
                <span className="font-medium">₹{order.adjustedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Lead Time Payment:</span>
                <span className="font-medium">{order.leadTimePayment}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Lead Time Retention:</span>
                <span className="font-medium">{order.leadTimeRetention}</span>
              </div>
            </div>
          </div>
          
          {/* Contact Information */}
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4" />
              Contact Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex flex-col">
                <span className="text-gray-600">Contact Person:</span>
                <span className="font-medium">{order.contactPersonName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-600">WhatsApp:</span>
                <span className="font-medium">{order.contactWhatsApp}</span>
              </div>
              <div className="flex flex-col sm:col-span-2 lg:col-span-1">
                <span className="text-gray-600">Address:</span>
                <span className="font-medium">{order.address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Check PO</h1>
          <p className="text-gray-600 text-sm sm:text-base mt-1">Review and set expected delivery dates</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 text-sm"
            />
          </div>
          
          <Select value={filterFirm} onValueChange={setFilterFirm}>
            <SelectTrigger className="h-10 min-w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by Firm" />
            </SelectTrigger>
            <SelectContent>
              {firmOptions.map(firm => (
                <SelectItem key={firm} value={firm}>
                  {firm === "all" ? "All Firms" : firm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                <p className="text-sm text-gray-600">Pending Delivery</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredOrders.filter(order => !order.actualDate || order.actualDate.trim() === "").length}
                </p>
              </div>
              <div className="bg-amber-500 rounded-full p-2 sm:p-3">
                <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredOrders.filter(order => order.actualDate && order.actualDate.trim() !== "").length}
                </p>
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
            <CardTitle className="text-xl">Purchase Orders</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Showing {filteredOrders.length} of {orders.length} orders
              {filterFirm !== "all" && ` • Filtered by: ${filterFirm}`}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button 
              onClick={fetchData} 
              variant="outline" 
              size="sm"
              className="h-9 flex items-center justify-center gap-2"
              disabled={loading}
            >
              <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            
            {selectedOrders.length > 0 && (
              <Button 
                onClick={handleSubmit} 
                size="sm" 
                className="h-9 bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
                disabled={loading}
              >
                <CheckCircle2 className="w-4 h-4" />
                Submit ({selectedOrders.length})
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Tabs */}
            <div className="px-4 sm:px-6 pt-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pending" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-sm">
                    Pending ({filteredOrders.filter(order => !order.actualDate || order.actualDate.trim() === "").length})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-sm">
                    History ({filteredOrders.filter(order => order.actualDate && order.actualDate.trim() !== "").length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Table with Horizontal Scroll */}
            <div className="relative overflow-x-auto">
              <div className="min-w-[1400px]"> {/* Increased minimum width for horizontal scroll */}
                <Table className="w-full">
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      {activeTab === "pending" && (
                        <TableHead className="w-12 px-4">
                          <Checkbox
                            checked={selectedOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                      )}
                      {activeTab === "pending" && (
                        <TableHead className="px-4 min-w-[180px]">Expected Delivery</TableHead>
                      )}
                      <TableHead className="px-4 min-w-[120px]">DO Number</TableHead>
                      <TableHead className="px-4 min-w-[100px]">Firm</TableHead>
                      <TableHead className="px-4 min-w-[120px]">PO Number</TableHead>
                      <TableHead className="px-4 min-w-[100px]">Party Name</TableHead>
                      <TableHead className="px-4 min-w-[120px]">Product Name</TableHead>
                      <TableHead className="px-4 min-w-[80px]">Qty</TableHead>
                      <TableHead className="px-4 min-w-[100px]">Total Value</TableHead>
                      <TableHead className="px-4 min-w-[100px]">Planned Date</TableHead>
                      {activeTab === "history" && (
                        <TableHead className="px-4 min-w-[120px]">Delivered On</TableHead>
                      )}
                      <TableHead className="px-4 w-12">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={activeTab === "pending" ? 12 : 11} 
                          className="text-center py-12 text-gray-500"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Search className="w-12 h-12 text-gray-300" />
                            <p className="text-lg">No orders found</p>
                            <p className="text-sm text-gray-400">
                              {searchTerm ? "Try a different search term" : "No data available"}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order) => (
                        <>
                          <TableRow 
                            key={order.id} 
                            className={`hover:bg-gray-50 transition-colors ${
                              selectedOrders.includes(order.id) ? "bg-blue-50" : ""
                            }`}
                          >
                            {activeTab === "pending" && (
                              <TableCell className="px-4">
                                <Checkbox
                                  checked={selectedOrders.includes(order.id)}
                                  onCheckedChange={(checked) => handleOrderSelection(order.id, checked)}
                                />
                              </TableCell>
                            )}
                            {activeTab === "pending" && (
                              <TableCell className="px-4 min-w-[180px]">
                                <Input
                                  type="date"
                                  disabled={!selectedOrders.includes(order.id)}
                                  value={deliveryDates[order.id] || ""}
                                  onChange={(e) => handleDeliveryDateChange(order.id, e.target.value)}
                                  className="h-9 text-sm w-full"
                                />
                              </TableCell>
                            )}
                            <TableCell className="px-4 min-w-[120px]">
                              <Badge variant="outline" className="rounded-md bg-gray-50">
                                {order.doNumber}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 min-w-[100px]">
                              <div className="flex items-center gap-2">
                                <Building className="w-3 h-3 text-gray-500" />
                                <span className="truncate">{order.firmName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 min-w-[120px] font-medium">
                              {order.partyPONumber}
                            </TableCell>
                            <TableCell className="px-4 min-w-[100px]">
                              <div className="truncate">{order.partyName}</div>
                            </TableCell>
                            <TableCell className="px-4 min-w-[120px]">
                              <div className="truncate">{order.productName}</div>
                            </TableCell>
                            <TableCell className="px-4 min-w-[80px] font-bold">
                              {order.quantity}
                            </TableCell>
                            <TableCell className="px-4 min-w-[100px] font-bold text-green-600">
                              ₹{order.totalPOValue.toLocaleString()}
                            </TableCell>
                            <TableCell className="px-4 min-w-[100px]">
                              <Badge variant="outline" className="border-amber-200 text-amber-700">
                                {order.plannedDate}
                              </Badge>
                            </TableCell>
                            {activeTab === "history" && (
                              <TableCell className="px-4 min-w-[120px]">
                                <Badge className="bg-green-500 text-white">
                                  {order.expectedDeliveryDate}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="px-4 w-12">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => toggleRowExpansion(order.id)}
                              >
                                {expandedRow === order.id ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expandedRow === order.id && (
                            <TableRow>
                              <TableCell colSpan={activeTab === "pending" ? 12 : 11} className="p-0">
                                <div className="p-4">
                                  {renderOrderDetails(order)}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Footer - Outside the scrollable area */}
            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="text-center sm:text-left">
                  Showing {filteredOrders.length} of {orders.length} orders
                  {selectedOrders.length > 0 && ` • ${selectedOrders.length} selected`}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedOrders([])
                      setDeliveryDates({})
                    }}
                    disabled={selectedOrders.length === 0}
                    className="text-xs"
                  >
                    Clear Selection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8," + 
                        filteredOrders.map(order => 
                          Object.values(order).slice(0, 10).join(",")
                        ).join("\n")
                      const encodedUri = encodeURI(csvContent)
                      const link = document.createElement("a")
                      link.setAttribute("href", encodedUri)
                      link.setAttribute("download", `orders_${new Date().toISOString().split('T')[0]}.csv`)
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    className="text-xs flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}