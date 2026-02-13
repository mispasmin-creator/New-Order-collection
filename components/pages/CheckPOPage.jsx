"use client"

import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
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
import { useNotification } from "@/components/providers/NotificationProvider"

export default function CheckPOPage({ user, onNavigate }) {
  const { updateCount } = useNotification()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState([])
  const [deliveryDates, setDeliveryDates] = useState({})
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterFirm, setFilterFirm] = useState("all")
  const [expandedRow, setExpandedRow] = useState(null)

  // Cache for orders data
  const [cachedOrders, setCachedOrders] = useState([])
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const CACHE_DURATION = 30000 // 30 seconds

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

  // Check if date is pending (has planned date but no actual date)
  const isPending = useCallback((order) => {
    return order.plannedDate && order.plannedDate.trim() !== "" &&
      (!order.actualDate || order.actualDate.trim() === "")
  }, [])

  // Fetch data from Supabase with caching
  const fetchData = useCallback(async (forceRefresh = false) => {
    const now = Date.now()

    if (!forceRefresh && cachedOrders.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
      setOrders(cachedOrders)
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('ORDER RECEIPT')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error

      if (data) {
        const transformedOrders = data.map((row) => ({
          id: row.id,
          doNumber: row["DO-Delivery Order No."],
          partyPONumber: row["PARTY PO NO (As Per Po Exact)"],
          partyPODate: formatDate(row["Party PO Date"]),
          partyName: row["Party Names"],
          productName: row["Product Name"],
          quantity: parseFloat(row["Quantity"]) || 0,
          rate: parseFloat(row["Rate Of Material"]) || 0,
          transportType: row["Type Of Transporting"],
          isAgentOrder: row["Is This Order Through Some Agent"],
          orderReceivedFrom: row["Order Received From"],
          measurementType: row["Type Of Measurement"],
          contactPersonName: row["Contact Person Name"],
          contactWhatsApp: row["Contact Person WhatsApp No."],
          aluminaPercent: row["Alumina%"],
          ironPercent: row["Iron%"],
          piType: row["Type Of PI"],
          leadTimePayment: row["Lead Time For Collection Of Final Payment"],
          applicationType: row["Type Of Application"],
          customerCategory: row["Customer Category"],
          freeReplacement: row["Free Replacement (FOC)"],
          gstNumber: row["Gst Number"],
          address: row["Address"],
          firmName: row["Firm Name"],
          totalPOValue: parseFloat(row["Total PO Basic Value"]) || 0,
          paymentToBeTaken: row["Payment to Be Taken"],
          advance: parseFloat(row["Advance"]) || 0,
          basic: parseFloat(row["Basic"]) || 0,
          retentionPayment: row["Retention Payment"],
          retentionPercentage: parseFloat(row["Retention Percentage"]) || 0,
          leadTimeRetention: row["Lead Time for Retention"],
          specificConcern: row["Specific Concern"],
          referenceNo: row["Reference No."],
          adjustedAmount: parseFloat(row["Adjusted Amount"]) || 0,
          plannedDate: formatDate(row["Planned 1"]),
          actualDate: formatDate(row["Actual 1"]),
          expectedDeliveryDate: formatDate(row["Expected Delivery Date"]),
          status: row["Status"] || "Pending",
          rawData: row
        }))

        setOrders(transformedOrders)
        setCachedOrders(transformedOrders)
        setLastFetchTime(now)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      if (cachedOrders.length > 0) {
        setOrders(cachedOrders)
      }
    } finally {
      setLoading(false)
    }
  }, [cachedOrders, lastFetchTime, formatDate])

  useEffect(() => {
    fetchData()
  }, [])

  // Get unique firm names for filter
  const firmOptions = useMemo(() => {
    const firms = [...new Set(orders.map(order => order.firmName).filter(Boolean))]
    return ["all", ...firms]
  }, [orders])

  // Filter orders
  const baseFilteredOrders = useMemo(() => {
    let filtered = orders

    if (user.role !== "master") {
      const userFirms = user.firm ? user.firm.split(',').map(f => f.trim().toLowerCase()) : []
      filtered = filtered.filter(order => {
        if (userFirms.includes('all')) return true
        const orderFirm = order.firmName ? order.firmName.trim().toLowerCase() : ""
        return userFirms.includes(orderFirm)
      })
    }

    if (filterFirm !== "all") {
      filtered = filtered.filter(order => order.firmName === filterFirm)
    }

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
  }, [orders, user, filterFirm, searchTerm])

  const pendingOrders = useMemo(() => {
    return baseFilteredOrders.filter(order =>
      order.plannedDate && order.plannedDate.trim() !== "" &&
      (!order.actualDate || order.actualDate.trim() === "")
    )
  }, [baseFilteredOrders])

  const historyOrders = useMemo(() => {
    return baseFilteredOrders.filter(order =>
      order.plannedDate && order.plannedDate.trim() !== "" &&
      order.actualDate && order.actualDate.trim() !== ""
    )
  }, [baseFilteredOrders])

  useEffect(() => {
    updateCount("Check PO", pendingOrders.length)
  }, [pendingOrders, updateCount])

  const filteredOrders = activeTab === "pending" ? pendingOrders : historyOrders

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

  const handleDeliveryDateChange = useCallback((orderId, date) => {
    setDeliveryDates(prev => ({
      ...prev,
      [orderId]: date
    }))
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([])
      setDeliveryDates({})
    } else {
      const allIds = filteredOrders.map(order => order.id)
      setSelectedOrders(allIds)
      const defaultDate = new Date().toISOString().split('T')[0]
      const dates = {}
      allIds.forEach(id => {
        dates[id] = defaultDate
      })
      setDeliveryDates(dates)
    }
  }, [filteredOrders, selectedOrders.length])

  const handleSubmit = async () => {
    if (selectedOrders.length === 0) return

    setLoading(true)
    try {
      const now = getISTTimestamp()

      const updates = selectedOrders.map(orderId => {
        const order = orders.find(o => o.id === orderId)
        const selectedDate = deliveryDates[orderId]

        return supabase
          .from('ORDER RECEIPT')
          .update({
            "Actual 1": now,
            "Expected Delivery Date": selectedDate ? new Date(selectedDate).toISOString() : null
          })
          .eq('id', orderId)
      })

      await Promise.all(updates)

      setSelectedOrders([])
      setDeliveryDates({})
      fetchData(true)

      toast({
        title: "Success",
        description: `Successfully updated ${selectedOrders.length} order(s)!`,
      })


    } catch (error) {
      console.error("Error updating data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update data. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleRowExpansion = useCallback((orderId) => {
    setExpandedRow(expandedRow === orderId ? null : orderId)
  }, [expandedRow])

  const renderOrderDetails = (order) => {
    return (
      <div className="space-y-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Product Details
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Product:</span>
                <span className="font-medium text-right">{order.productName}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Quantity:</span>
                <span className="font-medium text-right">{order.quantity}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Rate:</span>
                <span className="font-medium text-right">₹{order.rate.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Transport:</span>
                <span className="font-medium text-right">{order.transportType}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Technical Specs</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Alumina %:</span>
                <span className="font-medium text-right">{order.aluminaPercent}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Iron %:</span>
                <span className="font-medium text-right">{order.ironPercent}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Measurement:</span>
                <span className="font-medium text-right">{order.measurementType}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Application:</span>
                <span className="font-medium text-right">{order.applicationType}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Payment Details</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Total Value:</span>
                <span className="font-bold text-green-600 text-right">₹{order.totalPOValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Advance:</span>
                <span className="font-medium text-right">₹{order.advance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">Retention:</span>
                <span className="font-medium text-right">{order.retentionPercentage}%</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-600">GST:</span>
                <span className="font-medium text-right">{order.gstNumber}</span>
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
        <span className="text-gray-600">Loading orders...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check PO</h1>
          <p className="text-gray-600">Review and set expected delivery dates</p>
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
              <p className="text-sm font-medium text-amber-600">Pending Delivery</p>
              <div className="text-2xl font-bold text-amber-900">{pendingOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Truck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Completed</p>
              <div className="text-2xl font-bold text-green-900">{historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
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
                className="pl-10 h-10 text-sm w-full"
              />
            </div>
          </div>

          <Select value={filterFirm} onValueChange={setFilterFirm}>
            <SelectTrigger className="h-10 w-[180px]">
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

          <Button
            onClick={() => fetchData(true)}
            variant="outline"
            className="h-10 px-3"
            disabled={loading}
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center border-r border-gray-200 ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
            >
              Pending ({pendingOrders.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
            >
              History ({historyOrders.length})
            </button>
          </div>



          <div className="flex gap-2">
            {selectedOrders.length > 0 && (
              <Button
                onClick={handleSubmit}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 h-9 shadow-sm"
                disabled={loading}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Submit ({selectedOrders.length})
              </Button>
            )}

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
              className="h-9 px-3"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <div className="min-w-[1400px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  {activeTab === "pending" && (
                    <TableHead className="w-12 px-4">
                      <Checkbox
                        checked={selectedOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                  )}
                  {activeTab === "pending" && (
                    <TableHead className="px-4 min-w-[180px] font-semibold text-gray-900">PO Date</TableHead>
                  )}
                  <TableHead className="px-4 min-w-[120px] font-semibold text-gray-900">DO Number</TableHead>
                  <TableHead className="px-4 min-w-[100px] font-semibold text-gray-900">Firm</TableHead>
                  <TableHead className="px-4 min-w-[120px] font-semibold text-gray-900">PO Number</TableHead>
                  <TableHead className="px-4 min-w-[100px] font-semibold text-gray-900">Party Name</TableHead>
                  <TableHead className="px-4 min-w-[120px] font-semibold text-gray-900">Product Name</TableHead>
                  <TableHead className="px-4 min-w-[80px] font-semibold text-gray-900">Qty</TableHead>
                  <TableHead className="px-4 min-w-[100px] font-semibold text-gray-900">Total Value</TableHead>
                  <TableHead className="px-4 min-w-[100px] font-semibold text-gray-900">Planned Date</TableHead>
                  {activeTab === "history" && (
                    <>
                      <TableHead className="px-4 min-w-[120px] font-semibold text-gray-900">PO Date</TableHead>
                      <TableHead className="px-4 min-w-[120px] font-semibold text-gray-900">Actual Date</TableHead>
                    </>
                  )}
                  <TableHead className="px-4 w-12 font-semibold text-gray-900">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="text-center py-12 text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-lg">No orders found</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <Fragment key={order.id}>
                      <TableRow
                        key={order.id}
                        className={`hover:bg-gray-50 transition-colors border-b border-gray-100 ${selectedOrders.includes(order.id) ? "bg-blue-50" : ""
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
                              className="h-8 text-sm w-full bg-white"
                            />
                          </TableCell>
                        )}
                        <TableCell className="px-4 min-w-[120px] font-mono text-xs">
                          {order.doNumber}
                        </TableCell>
                        <TableCell className="px-4 min-w-[100px] text-sm">
                          {order.firmName}
                        </TableCell>
                        <TableCell className="px-4 min-w-[120px] font-medium text-sm">
                          {order.partyPONumber}
                        </TableCell>
                        <TableCell className="px-4 min-w-[100px] text-sm">
                          <div className="truncate max-w-[150px]">{order.partyName}</div>
                        </TableCell>
                        <TableCell className="px-4 min-w-[120px] text-sm">
                          <div className="truncate max-w-[150px]">{order.productName}</div>
                        </TableCell>
                        <TableCell className="px-4 min-w-[80px] font-bold text-sm">
                          {order.quantity}
                        </TableCell>
                        <TableCell className="px-4 min-w-[100px] font-bold text-green-600 text-sm">
                          ₹{order.totalPOValue.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-4 min-w-[100px] text-sm">
                          {order.plannedDate}
                        </TableCell>
                        {activeTab === "history" && (
                          <>
                            <TableCell className="px-4 min-w-[120px] text-sm">
                              {order.expectedDeliveryDate}
                            </TableCell>
                            <TableCell className="px-4 min-w-[120px] text-sm">
                              {order.actualDate}
                            </TableCell>
                          </>
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
                          <TableCell colSpan={activeTab === "pending" ? 11 : 13} className="p-0 border-b border-gray-100 bg-gray-50/50">
                            <div className="p-4">
                              {renderOrderDetails(order)}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}