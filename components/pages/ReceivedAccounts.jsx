"use client"

import { useState, useEffect, useCallback } from "react"
import { getISTDate, getISTTimestamp } from "@/lib/dateUtils"
import { supabase } from "@/lib/supabaseClient"
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
import { useNotification } from "@/components/providers/NotificationProvider"
import { getSignedUrl } from "@/lib/storageUtils"

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
  const { updateCount } = useNotification()
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const CACHE_DURATION = 30000 // 30 seconds

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async (forceRefresh = false) => {
    const now = Date.now()

    // Cache logic
    if (!forceRefresh && lastFetchTime > 0 && (now - lastFetchTime) < CACHE_DURATION) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      let query = supabase
        .from('ORDER RECEIPT')
        .select('*')
        .order('id', { ascending: false })

      // Filter by user firm if not master
      if (user.role !== "master") {
        const userFirms = user.firm ? user.firm.split(',').map(f => f.trim()) : []
        if (!userFirms.includes('all')) {
          query = query.in('Firm Name', userFirms)
        }
      }

      const { data, error } = await query

      if (error) throw error

      if (data) {
        // Transform data
        const transformedOrders = data.map((row) => ({
          id: row.id,
          productName: row["Product Name"] || "N/A",
          quantity: row["Quantity"] || 0,
          rate: row["Rate Of Material"] || 0,
          transport: row["Type Of Transporting"] || "N/A",
          uploadSoi: row["Upload SO"] || "",
          agent: row["Is This Order Through Some Agent"] || "N/A",
          orderFrom: row["Order Received From"] || "N/A",
          measurement: row["Type Of Measurement"] || "N/A",
          contactPerson: row["Contact Person Name"] || "N/A",
          contactWhatsapp: row["Contact Person WhatsApp No."] || "N/A",
          alumina: row["Alumina%"] || "N/A",
          iron: row["Iron%"] || "N/A",
          piType: row["Type Of PI"] || "N/A",
          leadTime: row["Lead Time For Collection Of Final Payment"] || "N/A",
          planned2Date: formatDate(row["Planned 2"]),
          actual2Date: formatDate(row["Actual 2"]),
          status: row["Status"] || "Pending",
          doNumber: row["DO-Delivery Order No."] || "N/A",
          firmName: row["Firm Name"] || "",
          rawData: row
        }))

        setOrders(transformedOrders)
        setLastFetchTime(now)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error loading data",
        description: "Failed to fetch orders from Supabase: " + error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Function to handle Google Drive link conversion
  const getGoogleDriveViewLink = (link) => {
    if (!link || typeof link !== 'string' || link.trim() === "" || link === "N/A") {
      return link;
    }

    const trimmedLink = link.trim();

    // If it's a direct URL (like from Supabase storage), return as is
    if (trimmedLink.startsWith('http')) {
      return trimmedLink;
    }

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
    const idMatch1 = trimmedLink.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch1 && idMatch1[1]) {
      return `https://drive.google.com/file/d/${idMatch1[1]}/view`;
    }

    // Direct file ID
    if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmedLink)) {
      return `https://drive.google.com/file/d/${trimmedLink}/view`;
    }

    return trimmedLink;
  };

  const handleView = async (url) => {
    if (!url) return;

    // First process potential Drive URL
    let target = getGoogleDriveViewLink(url);

    // If getGoogleDriveViewLink returned a drive link, it starts with https://drive.google.com...
    // If it returned the original string, we check for supabase or relative path
    // Also ensuring target is a string before checking methods
    if (target && typeof target === 'string') {
      const isSupabase = target.includes('supabase.co') || !target.startsWith('http');

      if (isSupabase) {
        const signed = await getSignedUrl(target);
        if (signed) target = signed;
      }

      window.open(target, '_blank');
    }
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

  // Filter orders based on user role
  const getFilteredOrders = () => {
    if (!user || user.role === "master") return orders

    // Handle multiple firms (comma separated)
    const userFirms = user.firm ? user.firm.split(',').map(f => f.trim().toLowerCase()) : []

    return orders.filter(order => {
      if (userFirms.includes('all')) return true
      const orderFirm = order.firmName ? order.firmName.trim().toLowerCase() : ""
      return userFirms.includes(orderFirm)
    })
  }

  const filteredOrders = getFilteredOrders()

  // Pending orders: Planned 2 has value, Actual 2 is empty
  const pendingOrders = orders.filter((order) =>
    order.planned2Date &&
    order.planned2Date.trim() !== "" &&
    (!order.actual2Date || order.actual2Date.trim() === "")
  )

  useEffect(() => {
    updateCount("Received Accounts", pendingOrders.length)
  }, [pendingOrders, updateCount])

  // History orders: Both Planned 2 and Actual 2 have values
  const historyOrders = orders.filter((order) =>
    order.planned2Date && order.planned2Date.trim() !== "" &&
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
      const timestamp = getISTTimestamp()

      const { error } = await supabase
        .from('ORDER RECEIPT')
        .update({
          "Actual 2": timestamp
        })
        .eq('id', selectedOrderForAction.id)

      if (error) throw error

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
      fetchData(true)

    } catch (error) {
      console.error("Error updating data:", error)
      toast({
        title: "Update failed",
        description: "Failed to update order status: " + error.message,
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
        <p className="text-sm text-gray-500">Fetching orders from Supabase</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Received in Accounts</h1>
          <p className="text-gray-600">Manage received orders and history</p>
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
            onClick={() => fetchData(true)}
            className="flex items-center gap-2"
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Orders</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <FileText className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Receipt</p>
              <div className="text-2xl font-bold text-amber-900">{pendingOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Received History</p>
              <div className="text-2xl font-bold text-green-900">{historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 border rounded-md shadow-sm">
        <div className="flex bg-gray-100 p-1 rounded-md shrink-0">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all flex items-center gap-2 ${activeTab === "pending"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Pending ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all flex items-center gap-2 ${activeTab === "history"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
              }`}
          >
            History ({historyOrders.length})
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 w-[200px]"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[120px]">Action</TableHead>
                <TableHead>DO No.</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>PO Copy</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Order From</TableHead>
                <TableHead>Msrmt</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Alumina%</TableHead>
                <TableHead>Iron%</TableHead>
                <TableHead>PI Type</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Planned Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center py-8 text-gray-500">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                displayOrders.map((order) => {
                  return (
                    <TableRow key={order.id} className="hover:bg-gray-50">
                      <TableCell>
                        {activeTab === "pending" ? (
                          <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openActionDialog(order)}
                                className="h-8 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                              >
                                Mark Received
                              </Button>
                            </DialogTrigger>
                          </Dialog>
                        ) : (
                          <div className="flex items-center text-green-600 gap-1 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span>Received</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{order.doNumber}</TableCell>
                      <TableCell className="text-sm">{order.productName}</TableCell>
                      <TableCell className="text-sm">{order.quantity}</TableCell>
                      <TableCell className="text-sm">{order.rate}</TableCell>
                      <TableCell className="text-sm">{order.transport}</TableCell>
                      <TableCell>
                        {order.uploadSoi ? (
                          <div
                            onClick={() => handleView(order.uploadSoi)}
                            className="text-blue-600 hover:underline text-xs cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{order.agent}</TableCell>
                      <TableCell className="text-sm">{order.orderFrom}</TableCell>
                      <TableCell className="text-sm">{order.measurement}</TableCell>
                      <TableCell className="text-sm">{order.contactPerson}</TableCell>
                      <TableCell className="text-sm">{order.contactWhatsapp}</TableCell>
                      <TableCell className="text-sm">{order.alumina}</TableCell>
                      <TableCell className="text-sm">{order.iron}</TableCell>
                      <TableCell className="text-sm">{order.piType}</TableCell>
                      <TableCell className="text-sm">{order.leadTime}</TableCell>
                      <TableCell className="text-sm">{order.planned2Date}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden divide-y">
          {displayOrders.map((order) => (
            <div key={order.id} className="p-4 space-y-2">
              <div className="flex justify-between">
                <div className="font-medium">{order.productName}</div>
                <div className="text-sm text-gray-500">DO: {order.doNumber}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>Qty: {order.quantity}</div>
                <div>Rate: {order.rate}</div>
                <div>Transport: {order.transport}</div>
                <div>Agent: {order.agent}</div>
              </div>
              {activeTab === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openActionDialog(order)}
                  className="w-full mt-2"
                >
                  Mark Received
                </Button>
              )}
            </div>
          ))}
          {displayOrders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No orders found
            </div>
          )}
        </div>
      </div>

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
                className="bg-purple-600 hover:bg-purple-700"
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