"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { getISTDisplayDate, getISTTimestamp } from "@/lib/dateUtils"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, FileText } from "lucide-react"
import { useNotification } from "@/components/providers/NotificationProvider"

// Your Google Apps Script web app URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

export default function CheckDeliveryPage({ user, onNavigate }) {
  const { updateCount } = useNotification()
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
  const { toast } = useToast()
  const [submitSuccess, setSubmitSuccess] = useState(false)

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

  // Cache for orders data
  const [cachedOrders, setCachedOrders] = useState([])
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const CACHE_DURATION = 30000 // 30 seconds

  // Fetch data from Supabase with caching
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
        const transformedOrders = data.map((row) => ({
          id: row.id,
          doNumber: row["DO-Delivery Order No."] || "",
          partyPONumber: row["PARTY PO NO (As Per Po Exact)"] || "",
          partyPODate: formatDate(row["Party PO Date"]),
          partyName: row["Party Names"] || "",
          productName: row["Product Name"] || "",
          quantity: parseFloat(row["Quantity"]) || 0,
          rate: parseFloat(row["Rate Of Material"]) || 0,
          firmName: row["Firm Name"] || "",
          contactPersonName: row["Contact Person Name"] || "",
          planned3: formatDate(row["Planned 3"]),
          actual3: formatDate(row["Actual 3"]),
          inStockOrNot: row["In Stock Or Not"] || "",
          orderNumberProduction: row["Order Number Of The Production"] || "",
          qtyTransferred: row["Qty Transferred"] || "",
          batchNumberRemarks: row["Batch Number In Remarks"] || "",
          indentSelfBatchNumber: row["Indent/Self Batch Number"] || "",
          rawData: row
        }))

        // Filter orders where Planned 3 has a value (similar to previous sheet logic)
        const validOrders = transformedOrders.filter(order => order.planned3 && order.planned3.trim() !== "")

        setOrders(validOrders)
        setCachedOrders(validOrders)
        setLastFetchTime(now)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error loading data",
        description: "Failed to fetch orders from Supabase: " + error.message,
        variant: "destructive",
      })
      // Use cached data if available
      if (cachedOrders.length > 0) {
        setOrders(cachedOrders)
      }
    } finally {
      setLoading(false)
    }
  }, [cachedOrders, lastFetchTime, user, formatDate, toast])

  useEffect(() => {
    fetchData()
  }, [])



  // Get filtered orders with memoization
  const filteredOrders = useMemo(() => {
    let filtered = orders.filter((order) =>
      order.planned3 &&
      order.planned3.trim() !== "" &&
      (!order.actual3 || order.actual3.trim() === "")
    )

    if (user.role !== "master") {
      // Handle multiple firms (comma separated)
      const userFirms = user.firm ? user.firm.split(',').map(f => f.trim().toLowerCase()) : []

      filtered = filtered.filter((order) => {
        if (userFirms.includes('all')) return true
        const orderFirm = order.firmName ? order.firmName.trim().toLowerCase() : ""
        return userFirms.includes(orderFirm)
      })
    }
    return filtered
  }, [orders, user])

  const pendingOrders = filteredOrders

  useEffect(() => {
    updateCount("Check for Delivery", pendingOrders.length)
  }, [pendingOrders, updateCount])

  // History orders: Both Planned 3 and Actual 3 are not null
  const historyOrders = useMemo(() => {
    return orders.filter((order) =>
      order.planned3 &&
      order.planned3.trim() !== "" &&
      order.actual3 &&
      order.actual3.trim() !== "" &&
      (user.role === "master" || (user.firm &&
        (user.firm.toLowerCase().includes('all') ||
          user.firm.split(',').map(f => f.trim().toLowerCase()).includes(order.firmName ? order.firmName.trim().toLowerCase() : ""))
      ))
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

      const timestamp = getISTTimestamp()

      // Base updates
      const updates = {
        "Actual 3": timestamp,
        "In Stock Or Not": formData.inStockOrNot
      }

      // Conditional updates
      if (formData.inStockOrNot === "In Stock") {
        if (formData.orderNumberProduction) {
          updates["Order Number Of The Production"] = formData.orderNumberProduction
        }
        if (formData.qtyTransferred) {
          updates["Qty Transferred"] = formData.qtyTransferred
        }
        if (formData.batchNumberRemarks) {
          updates["Batch Number In Remarks"] = formData.batchNumberRemarks
        }
      } else if (formData.inStockOrNot === "From Purchase") {
        // Indent/Self Batch Number column is not in the schema, skipping update
        console.warn("Skipping Indent/Self Batch Number update as column missing in schema")
      }

      const { error } = await supabase
        .from('ORDER RECEIPT')
        .update(updates)
        .eq('id', selectedOrder.id)

      if (error) throw error

      setSubmitSuccess(true)
      toast({
        title: "Success",
        description: "Delivery check submitted successfully!",
      })

      // Refresh data after successful submission
      setTimeout(() => {
        fetchData(true) // Force refresh
        handleCancel()
        setSubmitSuccess(false)
      }, 1500)

    } catch (error) {
      console.error("Error updating data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit. Please try again.",
      })
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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check for Delivery</h1>
          <p className="text-gray-600">Verify stock & delivery readiness</p>
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
              <p className="text-sm font-medium text-amber-600">Pending Check</p>
              <div className="text-2xl font-bold text-amber-900">{pendingOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Completed Check</p>
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
                className="pl-10 h-10 w-full"
              />
            </div>
          </div>

          <Button
            onClick={() => fetchData(true)}
            variant="outline"
            className="h-10 px-3"
            disabled={loading}
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center flex items-center gap-2 ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Pending ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center flex items-center gap-2 ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            History ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Action</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">DO Number</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Firm Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Party PO Number</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Contact Person</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Planned Date</TableHead>
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Actual Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">In Stock Or Not</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Order Number Production</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Qty Transferred</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Batch Number Remarks</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Indent/Self Batch No</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeTab === "pending" ? 7 : 13} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No {activeTab === "pending" ? "pending" : "historical"} orders found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    {activeTab === "pending" && (
                      <TableCell className="py-2 px-4 min-w-[100px]">
                        <Button
                          size="sm"
                          onClick={() => handleCheck(order)}
                          className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                        >
                          Check
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="py-2 px-4 min-w-[120px] font-mono text-xs">
                      {order.doNumber}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] text-sm">
                      {order.firmName}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.partyPONumber}</TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] text-sm truncate max-w-[150px]">{order.partyName}</TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] text-sm truncate max-w-[150px]">{order.contactPersonName}</TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] text-sm">
                      {order.planned3}
                    </TableCell>
                    {activeTab === "history" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[100px] text-sm">
                          {order.actual3}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                          {order.inStockOrNot || "Not Set"}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.orderNumberProduction || "-"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px] text-sm">{order.qtyTransferred || "-"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.batchNumberRemarks || "-"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.indentSelfBatchNumber || "-"}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden divide-y">
          {displayOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No orders found
            </div>
          ) : (
            displayOrders.map((order) => (
              <div key={order.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {order.doNumber}
                    </span>
                    <div className="font-medium mt-1">{order.productName}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">{order.firmName}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>Party: {order.partyName}</div>
                  <div>Contact: {order.contactPersonName}</div>
                  <div>Planned: {order.planned3}</div>
                  {activeTab === "history" && (
                    <>
                      <div>Actual: {order.actual3}</div>
                      <div>Status: {order.inStockOrNot}</div>
                    </>
                  )}
                </div>

                {activeTab === "pending" && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleCheck(order)}
                      className="w-full bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                    >
                      Check
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

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