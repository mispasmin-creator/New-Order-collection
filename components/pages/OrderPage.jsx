"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import OrderForm from "../forms/OrderForm"
import { useNotification } from "@/components/providers/NotificationProvider"
import { Plus, FileText, TrendingUp, CheckCircle, Search, Filter, Eye, RefreshCw, Loader2, X } from "lucide-react"
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
import { supabase } from "@/lib/supabaseClient"

export default function OrderPage({ user }) {
  const [showForm, setShowForm] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [firmFilter, setFirmFilter] = useState("all")
  const { toast } = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

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

  // Fetch orders from Supabase
  const fetchOrders = async () => {
    try {
      setLoading(true)
      setRefreshing(true)

      console.log("Fetching orders from Supabase...")

      const { data, error } = await supabase
        .from('ORDER RECEIPT')
        .select('*')
        .order('id', { ascending: false }) // Newest first

      if (error) {
        throw error
      }

      if (data) {
        console.log("Data received from Supabase:", data.length)
        const transformedData = data.map(row => ({
          id: row.id,
          // DB Columns mapping to component state keys
          timestamp: row["Timestamp"],
          doNumber: row["DO-Delivery Order No."],
          partyPONumber: row["PARTY PO NO (As Per Po Exact)"],
          partyPODate: formatDate(row["Party PO Date"]),
          partyName: row["Party Names"],
          productName: row["Product Name"],
          quantity: parseFloat(row["Quantity"]) || 0,
          rate: parseFloat(row["Rate Of Material"]) || 0,
          typeOfTransporting: row["Type Of Transporting"],
          uploadSO: row["Upload SO"],
          isAgent: row["Is This Order Through Some Agent"],
          orderReceivedFrom: row["Order Received From"],
          typeOfMeasurement: row["Type Of Measurement"],
          contactPerson: row["Contact Person Name"],
          contactWhatsapp: row["Contact Person WhatsApp No."],
          alumina: parseFloat(row["Alumina%"]) || 0,
          iron: parseFloat(row["Iron%"]) || 0,
          typeOfPI: row["Type Of PI"],
          leadTimeFinalPayment: row["Lead Time For Collection Of Final Payment"],
          typeOfApplication: row["Type Of Application"],
          customerCategory: row["Customer Category"],
          foc: row["Free Replacement (FOC)"],
          gstNumber: row["Gst Number"],
          address: row["Address"],
          firmName: row["Firm Name"],
          totalValue: parseFloat(row["Total PO Basic Value"]) || 0,
          paymentToBeTaken: row["Payment to Be Taken"],
          advance: parseFloat(row["Advance"]) || 0,
          basic: parseFloat(row["Basic"]) || 0,
          retentionPayment: row["Retention Payment"],
          retentionPercentage: parseFloat(row["Retention Percentage"]) || 0,
          leadTimeRetention: row["Lead Time for Retention"],
          specificConcern: row["Specific Concern"],
          referenceNo: row["Reference No."],
          adjustedAmount: parseFloat(row["Adjusted Amount"]) || 0,
          marketingManager: row["Marketing Mangager Name"],

          // Status and Tracking
          status: row["Status"] || "New Order",
          delivered: parseFloat(row["Delivered"]) || 0,
          pendingQty: parseFloat(row["Pending Qty"]) || 0,
          materialReturn: row["Material Return"],
          completeDate: formatDate(row["Complete Date"]),
          crmCustomer: row["Crm For The Customer"],
          mail: row["Mail"],

          // Planning Dates
          planned1: formatDate(row["Planned 1"]),
          actual1: formatDate(row["Actual 1"]),
          timeDelay1: row["Time Delay 1"],
          expectedDelivery: formatDate(row["Expected Delivery Date"]),

          planned2: formatDate(row["Planned 2"]),
          actual2: formatDate(row["Actual 2"]),
          timeDelay2: row["Time Delay 2"],

          planned3: formatDate(row["Planned 3"]),
          actual3: formatDate(row["Actual 3"]),
          timeDelay3: row["Time Delay 3"],

          inStockOrNot: row["In Stock Or Not"],
          productionOrderNo: row["Order Number Of The Production"],
          qtyTransferred: parseFloat(row["Qty Transferred"]) || 0,
          batchRemarks: row["Batch Number In Remarks"],

          planned4: formatDate(row["Planned 4"]),
          actual4: formatDate(row["Actual 4"]),
          timeDelay4: row["Time Delay 4"],

          rawData: row // Store raw data if needed
        }))
        setOrders(transformedData)
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      // Don't clear orders on error, maybe show notification
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initialize - fetch orders on component mount
  useEffect(() => {
    fetchOrders()
  }, [])

  const { updateCount } = useNotification()

  useEffect(() => {
    if (orders) {
      updateCount("Order", orders.length)
    }
  }, [orders, updateCount])

  // Function to manually refresh orders
  const refreshOrders = async () => {
    setRefreshing(true)
    await fetchOrders()
  }

  const handleSendToDispatch = async (order) => {
    try {
      // Update status to "Dispatched" in Supabase
      const { error } = await supabase
        .from('ORDER RECEIPT')
        .update({ "Status": "Dispatched" })
        .eq('id', order.id)

      if (error) throw error

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === order.id ? { ...o, status: "Dispatched" } : o
        )
      )
    } catch (error) {
      console.error("Error sending to dispatch:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update status. Please try again.",
      })
    }
  }

  // Filter orders based on user role and search/filters
  const getFilteredOrders = () => {
    let filtered = orders



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

  // Calculate stats based on current firm filter (ignoring status/search)
  const statsOrders = orders.filter(order => {
    if (firmFilter !== "all" && user.role === "master") {
      return order.firmName === firmFilter
    }
    return true
  })

  // Calculate totals
  const totalValue = statsOrders.reduce((sum, order) => {
    return sum + (order.totalValue || 0)
  }, 0)

  const totalQuantity = statsOrders.reduce((sum, order) => {
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
        <span className="text-gray-600">Loading orders...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">Manage your orders</p>
        </div>
        <div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 shadow-md flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add New Order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Orders</p>
              <div className="text-2xl font-bold text-blue-900">{statsOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-blue-200 shadow-lg">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Total Value</p>
              <div className="text-2xl font-bold text-green-900">₹{totalValue.toLocaleString('en-IN')}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-green-200 shadow-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Quantity</p>
              <div className="text-2xl font-bold text-purple-900">{totalQuantity}</div>
            </div>
            <div className="h-10 w-10 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-purple-200 shadow-lg">
              <CheckCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>


      </div>

      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {user.role === "master" && (
              <Select value={firmFilter} onValueChange={setFirmFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Firm" />
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
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Status" />
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
              }} className="h-9 px-3">
                <Filter className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                onClick={refreshOrders}
                disabled={refreshing}
                className="h-9 px-3"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
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
      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold text-gray-700">Order List</h2>
          <span className="text-sm text-gray-500">
            {filteredOrders.length} orders
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 font-medium">
              No orders found
            </p>
            {searchTerm && (
              <Button variant="link" onClick={() => setSearchTerm("")} className="mt-2">
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
                  <TableRow key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => viewOrderDetails(order)}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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