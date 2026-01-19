"use client"

import { useState, useEffect } from "react"
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
  Edit2, 
  Clock, 
  CheckCircle,
  ExternalLink,
  Filter,
  Receipt,
  FileText,
  Package,
  Truck,
  User,
  Hash,
  Eye
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function ReceivedInAccountsPage({ user, onNavigate }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrderForAction, setSelectedOrderForAction] = useState(null)
  const [selectedDate, setSelectedDate] = useState("")
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()

  // Your Google Apps Script web app URL
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

  // Fetch data from Google Sheets
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`${SCRIPT_URL}?sheet=ORDER%20RECEIPT`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.data) {
        const transformedOrders = transformSheetData(data.data)
        setOrders(transformedOrders)
        toast({
          title: "Data loaded",
          description: `Successfully loaded ${transformedOrders.length} orders`,
        })
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error loading data",
        description: "Failed to fetch orders from Google Sheets",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Function to handle Google Drive link conversion
  const getGoogleDriveViewLink = (link) => {
    if (!link || typeof link !== 'string' || link.trim() === "" || link === "N/A") {
      return null;
    }
    
    const trimmedLink = link.trim();
    
    // Check if it's already a full Google Drive URL
    if (trimmedLink.includes('drive.google.com')) {
      // Convert edit links to view links
      if (trimmedLink.includes('/edit')) {
        return trimmedLink.replace('/edit', '/view');
      }
      // Already a view link or other format
      return trimmedLink;
    }
    
    // Check for Google Drive file ID patterns
    // Pattern 1: Full Google Drive URL with id parameter
    const idMatch1 = trimmedLink.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch1 && idMatch1[1]) {
      return `https://drive.google.com/file/d/${idMatch1[1]}/view`;
    }
    
    // Pattern 2: Direct file ID (from your screenshot data like "n?id=1wDnpsSN")
    const idMatch2 = trimmedLink.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch2 && idMatch2[1]) {
      return `https://drive.google.com/file/d/${idMatch2[1]}/view`;
    }
    
    // Pattern 3: Just a file ID string
    if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmedLink)) {
      return `https://drive.google.com/file/d/${trimmedLink}/view`;
    }
    
    // Pattern 4: Check for Google Drive short URLs
    if (trimmedLink.includes('googledrive.com') || trimmedLink.includes('docs.google.com')) {
      return trimmedLink;
    }
    
    // If it's a partial URL, try to construct a full one
    if (trimmedLink.startsWith('n?id=') || trimmedLink.includes('?id=')) {
      const fileId = trimmedLink.split('id=')[1];
      if (fileId && /^[a-zA-Z0-9_-]+$/.test(fileId)) {
        return `https://drive.google.com/file/d/${fileId}/view`;
      }
    }
    
    // Return the original link if no patterns match
    return trimmedLink;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return ""
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      
      return `${day}/${month}/${year}`
    } catch {
      return dateString
    }
  }

  // Get status badge color
  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-200'
    
    switch (status.toLowerCase()) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'received':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Transform Google Sheets data to order format
  const transformSheetData = (sheetData) => {
    if (!sheetData || sheetData.length < 6) return []
    
    // Debug: Log the raw sheet data to see what we're getting
    console.log("Raw sheet data headers:", sheetData[5]);
    
    // Headers are at index 5 (6th row)
    const headers = sheetData[5].map(header => header ? header.toString().trim() : "")
    
    // Debug: Log headers to find the correct column indices
    console.log("Headers:", headers);
    
    const orders = []
    
    // Find column indices - based on screenshot fields
    const indices = {
      productName: headers.findIndex(h => 
        h.toLowerCase().includes("product name") || 
        h.toLowerCase().includes("product")
      ),
      quantity: headers.findIndex(h => 
        h.toLowerCase().includes("quantity")
      ),
      rate: headers.findIndex(h => 
        h.toLowerCase().includes("rate of material") || 
        h.toLowerCase().includes("rate")
      ),
      transport: headers.findIndex(h => 
        h.toLowerCase().includes("type of transporting") || 
        h.toLowerCase().includes("transport")
      ),
      uploadSoi: headers.findIndex(h => 
        h.toLowerCase().includes("upload soi") || 
        h.toLowerCase().includes("upload sol") ||
        h.toLowerCase().includes("upload so")
      ),
      agent: headers.findIndex(h => 
        h.toLowerCase().includes("agent") || 
        h.toLowerCase().includes("is this order through some agent")
      ),
      orderFrom: headers.findIndex(h => 
        h.toLowerCase().includes("order received from") ||
        h.toLowerCase().includes("order from")
      ),
      measurement: headers.findIndex(h => 
        h.toLowerCase().includes("type of measurement") ||
        h.toLowerCase().includes("measurement")
      ),
      contactPerson: headers.findIndex(h => 
        h.toLowerCase().includes("contact person name") ||
        h.toLowerCase().includes("contact person")
      ),
      contactWhatsapp: headers.findIndex(h => 
        h.toLowerCase().includes("contact person name whatsup no") || 
        h.toLowerCase().includes("whatsapp") ||
        h.toLowerCase().includes("contact person name whatsapp no")
      ),
      alumina: headers.findIndex(h => 
        h.toLowerCase().includes("alumina%") ||
        h.toLowerCase().includes("alumina")
      ),
      iron: headers.findIndex(h => 
        h.toLowerCase().includes("iron%") ||
        h.toLowerCase().includes("iron")
      ),
      piType: headers.findIndex(h => 
        h.toLowerCase().includes("type of pi") ||
        h.toLowerCase().includes("pi type")
      ),
      leadTime: headers.findIndex(h => 
        h.toLowerCase().includes("lead time for collect final payment") ||
        h.toLowerCase().includes("lead time")
      ),
      status: headers.findIndex(h => 
        h.toLowerCase().includes("status")
      ),
      doNumber: headers.findIndex(h => 
        h.toLowerCase().includes("do-delivery order no") ||
        h.toLowerCase().includes("do number") ||
        h.toLowerCase().includes("do#")
      ),
      planned2: headers.findIndex(h => 
        h.toLowerCase().includes("planned 2")
      ),
      actual2: headers.findIndex(h => 
        h.toLowerCase().includes("actual 2")
      )
    }
    
    // Debug: Log the indices to verify we're finding the right columns
    console.log("Column indices:", indices);
    
    // Data starts from index 6 (7th row)
    for (let i = 6; i < Math.min(sheetData.length, 50); i++) { // Limit to first 50 rows for debugging
      const row = sheetData[i]
      
      // Skip empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === "")) {
        continue;
      }
      
      // Check if Planned 2 has value and Actual 2 is empty for pending orders
      const planned2Value = indices.planned2 >= 0 && row[indices.planned2] ? row[indices.planned2].toString().trim() : ""
      const actual2Value = indices.actual2 >= 0 && row[indices.actual2] ? row[indices.actual2].toString().trim() : ""
      
      // Get Upload SOI value - check the actual value
      const uploadSoiValue = indices.uploadSoi >= 0 && row[indices.uploadSoi] ? row[indices.uploadSoi].toString().trim() : ""
      console.log(`Row ${i} Upload SOI value:`, uploadSoiValue);
      
      const order = {
        id: i,
        productName: indices.productName >= 0 && row[indices.productName] ? row[indices.productName].toString().trim() : "N/A",
        quantity: indices.quantity >= 0 && row[indices.quantity] ? row[indices.quantity].toString().trim() : "N/A",
        rate: indices.rate >= 0 && row[indices.rate] ? row[indices.rate].toString().trim() : "N/A",
        transport: indices.transport >= 0 && row[indices.transport] ? row[indices.transport].toString().trim() : "N/A",
        uploadSoi: uploadSoiValue,
        agent: indices.agent >= 0 && row[indices.agent] ? row[indices.agent].toString().trim() : "N/A",
        orderFrom: indices.orderFrom >= 0 && row[indices.orderFrom] ? row[indices.orderFrom].toString().trim() : "N/A",
        measurement: indices.measurement >= 0 && row[indices.measurement] ? row[indices.measurement].toString().trim() : "N/A",
        contactPerson: indices.contactPerson >= 0 && row[indices.contactPerson] ? row[indices.contactPerson].toString().trim() : "N/A",
        contactWhatsapp: indices.contactWhatsapp >= 0 && row[indices.contactWhatsapp] ? row[indices.contactWhatsapp].toString().trim() : "N/A",
        alumina: indices.alumina >= 0 && row[indices.alumina] ? row[indices.alumina].toString().trim() : "N/A",
        iron: indices.iron >= 0 && row[indices.iron] ? row[indices.iron].toString().trim() : "N/A",
        piType: indices.piType >= 0 && row[indices.piType] ? row[indices.piType].toString().trim() : "N/A",
        leadTime: indices.leadTime >= 0 && row[indices.leadTime] ? row[indices.leadTime].toString().trim() : "N/A",
        planned2Date: formatDate(planned2Value),
        actual2Date: formatDate(actual2Value),
        status: indices.status >= 0 && row[indices.status] ? row[indices.status].toString().trim() : "Pending",
        doNumber: indices.doNumber >= 0 && row[indices.doNumber] ? row[indices.doNumber].toString().trim() : "N/A",
        rowIndex: i + 1,
      }
      
      orders.push(order)
    }
    
    // Debug: Log first few orders to see the data
    console.log("First 3 transformed orders:", orders.slice(0, 3));
    
    return orders
  }

  // Filter orders based on user role
  const getFilteredOrders = () => {
    return orders
  }

  const filteredOrders = getFilteredOrders()
  
  // Pending orders: Planned 2 has value, Actual 2 is empty
  const pendingOrders = filteredOrders.filter((order) => 
    order.planned2Date && 
    order.planned2Date.trim() !== "" && 
    (!order.actual2Date || order.actual2Date.trim() === "")
  )
  
  // History orders: Actual 2 has value
  const historyOrders = filteredOrders.filter((order) => 
    order.actual2Date && order.actual2Date.trim() !== ""
  )

  // Apply search filter
  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm) return ordersList
    return ordersList.filter((order) =>
      Object.values(order).some((value) => 
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  // Apply status filter
  const applyStatusFilter = (ordersList) => {
    if (statusFilter === "all") return ordersList
    return ordersList.filter(order => 
      order.status?.toLowerCase() === statusFilter.toLowerCase()
    )
  }

  const displayOrders = activeTab === "pending" 
    ? applyStatusFilter(searchFilteredOrders(pendingOrders))
    : applyStatusFilter(searchFilteredOrders(historyOrders))

  



  const openActionDialog = (order) => {
    setSelectedOrderForAction(order)
    setSelectedDate("")
    setIsActionDialogOpen(true)
  }

  const handleActionSubmit = async () => {
    if (!selectedOrderForAction) {
      toast({
        title: "No order selected",
        description: "Please select an order to update",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // Update Actual 2 (column 49, 1-indexed)
      const actual2Params = new URLSearchParams({
        action: 'updateCell',
        sheetName: 'ORDER RECEIPT',
        rowIndex: selectedOrderForAction.rowIndex.toString(),
        columnIndex: '50', // Actual 2 column
        value: today
      })
      
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: actual2Params
      })
      
      // Close dialog
      setIsActionDialogOpen(false)
      setSelectedOrderForAction(null)
      setSelectedDate("")
      
      // Show success toast
      toast({
        title: "Order marked as received",
        description: `Order has been marked as received in accounts`,
        className: "bg-green-50 border-green-200 text-green-800",
      })
      
      // Refresh data
      setTimeout(() => {
        fetchData()
      }, 1500)
      
    } catch (error) {
      console.error("Error updating data:", error)
      toast({
        title: "Update failed",
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }



  const handleExport = () => {
    const exportData = displayOrders.map(order => ({
      "DO Number": order.doNumber,
      "Product Name": order.productName,
      "Quantity": order.quantity,
      "Rate": order.rate,
      "Transport": order.transport,
      "Upload SoI": order.uploadSoi,
      "Agent": order.agent,
      "Order From": order.orderFrom,
      "Measurement": order.measurement,
      "Contact Person": order.contactPerson,
      "WhatsApp": order.contactWhatsapp,
      "Alumina %": order.alumina,
      "Iron %": order.iron,
      "PI Type": order.piType,
      "Lead Time": order.leadTime,
      "Planned 2": order.planned2Date,
      "Actual 2": order.actual2Date,
      "Status": order.status
    }))
    
    if (exportData.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no orders to export",
        variant: "destructive",
      })
      return
    }
    
    const csvContent = [
      Object.keys(exportData[0]).join(","),
      ...exportData.map(row => Object.values(row).join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accounts_received_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    
    toast({
      title: "Export successful",
      description: `Exported ${exportData.length} orders to CSV`,
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading accounts data...</span>
        <p className="text-sm text-gray-500">Fetching orders from Google Sheets</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Received in Accounts</h1>
            <p className="text-gray-600">Track and confirm order receipts in accounts department</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              className="flex items-center gap-2"
              disabled={displayOrders.length === 0}
            >
              <ExternalLink className="w-4 h-4" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchData}
              className="flex items-center gap-2"
            >
              <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Orders</p>
                  <p className="text-2xl font-bold text-blue-900">{orders.length}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700">Pending Receipt</p>
                  <p className="text-2xl font-bold text-amber-900">{pendingOrders.length}</p>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Received</p>
                  <p className="text-2xl font-bold text-green-900">{historyOrders.length}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
         
        </div>
      </div>

      {/* Main Card */}
      <Card className="border shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Accounts Receipt Management
            </CardTitle>
            
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Tabs & Filters */}
          <div className="bg-white border-b">
            <div className="flex flex-col md:flex-row gap-4 p-4">
              {/* Tabs */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                    activeTab === "pending" 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Pending ({pendingOrders.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                    activeTab === "history" 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  History ({historyOrders.length})
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by Product, DO#, Contact..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-10">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  
                  <TableHead className="font-semibold">Actions</TableHead>
                  <TableHead className="font-semibold">DO Number</TableHead>
                  <TableHead className="font-semibold">Product Name</TableHead>
                  <TableHead className="font-semibold">Qty</TableHead>
                  <TableHead className="font-semibold">Rate</TableHead>
                  <TableHead className="font-semibold">Transport</TableHead>
                  <TableHead className="font-semibold">Upload SoI</TableHead>
                  <TableHead className="font-semibold">Agent</TableHead>
                  <TableHead className="font-semibold">Order From</TableHead>
                  <TableHead className="font-semibold">Measurement</TableHead>
                  <TableHead className="font-semibold">Contact Person</TableHead>
                  <TableHead className="font-semibold">WhatsApp</TableHead>
                  <TableHead className="font-semibold">Alumina%</TableHead>
                  <TableHead className="font-semibold">Iron%</TableHead>
                  <TableHead className="font-semibold">PI Type</TableHead>
                  <TableHead className="font-semibold">Lead Time</TableHead>
                  <TableHead className="font-semibold">Planned </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activeTab === "pending" ? 19 : 18} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Receipt className="w-12 h-12 text-gray-300" />
                        <p className="text-gray-500 font-medium">No orders found</p>
                        <p className="text-sm text-gray-400">
                          {searchTerm ? 'Try a different search term' : activeTab === 'pending' ? 'No pending orders' : 'No history orders'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayOrders.map((order) => {
                    const googleDriveLink = getGoogleDriveViewLink(order.uploadSoi);
                    
                    return (
                      <TableRow key={order.id} className="group hover:bg-gray-50 transition-colors">
                        
                       
                        <TableCell>
                          <div className="flex gap-1">
                            {activeTab === "pending" ? (
                              <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => openActionDialog(order)}
                                    className="flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Mark Received
                                  </Button>
                                </DialogTrigger>
                              </Dialog>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex items-center gap-1"
                                onClick={() => openActionDialog(order)}
                              >
                                <Edit2 className="w-3 h-3" />
                                View Details
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {order.doNumber !== "N/A" ? order.doNumber : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            {order.productName !== "N/A" ? order.productName : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {order.quantity !== "N/A" ? order.quantity : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {order.rate !== "N/A" ? order.rate : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Truck className="w-3 h-3 text-gray-400" />
                            <span className="text-sm">{order.transport !== "N/A" ? order.transport : "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {googleDriveLink ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                onClick={() => window.open(googleDriveLink, '_blank')}
                                title="View document in Google Drive"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">
                              {order.uploadSoi && order.uploadSoi !== "N/A" ? "Invalid link" : "N/A"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.agent === "Not" || order.agent === "No" || order.agent === "N/A" ? "outline" : "default"}>
                            {order.agent !== "N/A" ? order.agent : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.orderFrom !== "N/A" ? order.orderFrom : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.measurement !== "N/A" ? order.measurement : "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="text-sm">{order.contactPerson !== "N/A" ? order.contactPerson : "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {order.contactWhatsapp !== "N/A" ? order.contactWhatsapp : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50">
                            {order.alumina !== "N/A" ? order.alumina : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50">
                            {order.iron !== "N/A" ? order.iron : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.piType !== "N/A" ? order.piType : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {order.leadTime !== "N/A" ? `${order.leadTime} days` : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            {order.planned2Date || "Not set"}
                          </Badge>
                        </TableCell>
                        
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden">
            <div className="p-4 space-y-4">
              {displayOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-12 h-12 text-gray-300 mx-auto" />
                  <p className="text-gray-500 font-medium mt-2">No orders found</p>
                </div>
              ) : (
                displayOrders.map((order) => {
                  const googleDriveLink = getGoogleDriveViewLink(order.uploadSoi);
                  
                  return (
                    <Card key={order.id} className="border overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(order.status)}>
                                  {order.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500">
                                {order.doNumber !== "N/A" ? `DO: ${order.doNumber}` : "No DO Number"}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">{order.productName !== "N/A" ? order.productName : "-"}</Badge>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">Quantity</p>
                              <p className="font-medium">{order.quantity !== "N/A" ? order.quantity : "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Rate</p>
                              <p className="font-medium">{order.rate !== "N/A" ? order.rate : "-"}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">Transport</p>
                              <p className="font-medium">{order.transport !== "N/A" ? order.transport : "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Agent</p>
                              <p className="font-medium">{order.agent !== "N/A" ? order.agent : "-"}</p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">Upload SOI</p>
                            {googleDriveLink ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                onClick={() => window.open(googleDriveLink, '_blank')}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Document
                              </Button>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">Contact Person</p>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-400" />
                              <p className="font-medium">{order.contactPerson !== "N/A" ? order.contactPerson : "-"}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">Alumina %</p>
                              <Badge variant="outline">{order.alumina !== "N/A" ? order.alumina : "-"}</Badge>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Iron %</p>
                              <Badge variant="outline">{order.iron !== "N/A" ? order.iron : "-"}</Badge>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">Planned 2</p>
                            <Badge variant="outline" className="bg-amber-50">
                              {order.planned2Date || "Not set"}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          {activeTab === "pending" ? (
                            <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  className="w-full"
                                  onClick={() => openActionDialog(order)}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Mark as Received
                                </Button>
                              </DialogTrigger>
                            </Dialog>
                          ) : (
                            <Button 
                              variant="outline"
                              className="w-full"
                              onClick={() => openActionDialog(order)}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Results Count */}
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{displayOrders.length}</span> of{" "}
              <span className="font-medium">
                {activeTab === "pending" ? pendingOrders.length : historyOrders.length}
              </span> orders
            </div>
            <div className="flex items-center gap-2">
              
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeTab === "pending" ? "Confirm Receipt" : "Order Details"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "pending" 
                ? "Mark this order as received in accounts department"
                : "View order receipt details"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedOrderForAction && (
              <>
                <Alert>
                  <AlertTitle>Order Information</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="font-medium text-sm">Product:</p>
                        <p className="text-sm">{selectedOrderForAction.productName}</p>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Quantity:</p>
                        <p className="text-sm">{selectedOrderForAction.quantity}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="font-medium text-sm">Rate:</p>
                        <p className="text-sm">{selectedOrderForAction.rate}</p>
                      </div>
                      <div>
                        <p className="font-medium text-sm">DO Number:</p>
                        <p className="text-sm">{selectedOrderForAction.doNumber}</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Contact Person:</p>
                      <p className="text-sm">{selectedOrderForAction.contactPerson}</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Planned  Date:</p>
                      <Badge className="mt-1">
                        {selectedOrderForAction.planned2Date || "Not set"}
                      </Badge>
                    </div>
                    {selectedOrderForAction.uploadSoi && selectedOrderForAction.uploadSoi !== "N/A" && (
                      <div className="mt-2">
                        <p className="font-medium text-sm">Uploaded Document:</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-1"
                          onClick={() => {
                            const link = getGoogleDriveViewLink(selectedOrderForAction.uploadSoi);
                            if (link) {
                              window.open(link, '_blank');
                            }
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open Document
                        </Button>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
                
              </>
            )}
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsActionDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {activeTab === "pending" && (
              <Button
                onClick={handleActionSubmit}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirm Receipt
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}