"use client"

import { useState, useEffect } from "react"
import { getISTFullDisplayDateTime } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, Calendar, FileText, Truck } from "lucide-react"

import { useNotification } from "@/components/providers/NotificationProvider"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"

export default function DispatchPlanningPage({ user }) {
  const { updateCount } = useNotification()
  const [orders, setOrders] = useState([])
  const [dispatchHistory, setDispatchHistory] = useState([]) // New state for dispatch history
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    qtyToBeDispatched: "",
    typeOfTransporting: "",
    dateOfDispatch: "",
    toBeReconfirm: "Yes",
    trustCertificateMade: "No",
    trustCertificateFile: null,
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const pendingCount = orders.filter((order) =>
      order.planned4 &&
      order.planned4.trim() !== "" &&
      (!order.actual4 || order.actual4.trim() === "")
    ).length
    updateCount("Dispatch Planning", pendingCount)
  }, [orders, updateCount])

  const fetchData = async () => {
    try {
      setLoading(true)

      // 1. Fetch orders from ORDER RECEIPT
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

      const { data: ordersData, error: ordersError } = await query

      if (ordersError) throw ordersError

      if (ordersData) {
        const transformedOrders = ordersData.map((row) => {
          const qty = parseFloat(row["Quantity"]) || 0
          const delivered = parseFloat(row["Delivered"]) || 0
          let pending = parseFloat(row["Pending Qty"])
          if (row["Pending Qty"] === null || row["Pending Qty"] === undefined || isNaN(pending)) {
            pending = qty - delivered
          }

          return {
            id: row.id,
            rowIndex: row.id,
            deliveryOrderNo: row["DO-Delivery Order No."] || "",
            partyPONumber: row["PARTY PO NO (As Per Po Exact)"] || "",
            partyName: row["Party Names"] || "",
            productName: row["Product Name"] || "",
            quantity: qty,
            quantityDelivered: delivered,
            pendingQty: pending,
            status: row["Status"] || "Pending",
            firmName: row["Firm Name"] || "",
            planned4: formatDate(row["Planned 4"]),
            actual4: formatDate(row["Actual 4"]),
            typeOfTransporting: row["Type Of Transporting"] || "",
            dateOfDispatch: formatDate(row["Expected Delivery Date"]),
            timestamp: formatDate(row["Actual 4"]),
          }
        })

        setOrders(transformedOrders)

        // 2. Fetch dispatch history from DISPATCH table
        // We fetch this AFTER orders so we can filter by firm if needed
        const { data: dispatchData, error: dispatchError } = await supabase
          .from('DISPATCH')
          .select('*')
          .order('id', { ascending: false })

        if (dispatchError) throw dispatchError

        if (dispatchData) {
          const transformedDispatch = dispatchData.map(row => ({
            id: row.id,
            timestamp: formatDate(row["Timestamp"]),
            dSrNumber: row["D-Sr Number"] || "",
            deliveryOrderNo: row["Delivery Order No."] || "",
            partyName: row["Party Name"] || "",
            productName: row["Product Name"] || "",
            qtyToBeDispatched: row["Qty To Be Dispatched"] || 0,
            typeOfTransporting: row["Type Of Transporting"] || "",
            dateOfDispatch: formatDate(row["Date Of Dispatch"]),
            toBeReconfirm: row["To Be Reconfirm"] || "",
          }))
          setDispatchHistory(transformedDispatch)
        }
      }

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error loading data",
        description: "Failed to fetch data: " + error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ""
    try {
      if (typeof dateString === 'string' && dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
        return dateString.split(' ')[0]
      }
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

  // Filter orders: Show only if Planned 4 is set and Actual 4 is NOT set
  const getPendingOrders = () => {
    return orders.filter((order) =>
      order.planned4 &&
      order.planned4.trim() !== "" &&
      (!order.actual4 || order.actual4.trim() === "")
    )
  }

  // History orders: Show entries from DISPATCH table
  const getHistoryOrders = () => {
    // If master, show all. If not, filtered by checking if deliveryOrderNo exists in user's accessible orders
    if (user.role === "master") {
      return dispatchHistory
    }

    // Create a set of accessible DO numbers for faster lookup
    const userDOs = new Set(orders.map(o => o.deliveryOrderNo))

    return dispatchHistory.filter(d =>
      d.deliveryOrderNo && userDOs.has(d.deliveryOrderNo)
    )
  }

  const pendingOrders = getPendingOrders()
  const historyOrders = getHistoryOrders()

  // Calculate counts for summary cards
  const completedOrdersCount = orders.filter(o =>
    o.planned4 &&
    o.planned4.trim() !== "" &&
    o.actual4 &&
    o.actual4.trim() !== ""
  ).length

  const totalOrdersCount = pendingOrders.length + completedOrdersCount

  // Apply search filter
  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm) return ordersList
    const term = searchTerm.toLowerCase()
    return ordersList.filter((order) =>
      Object.values(order).some((value) =>
        value?.toString().toLowerCase().includes(term)
      )
    )
  }

  const displayOrders =
    activeTab === "pending" ? searchFilteredOrders(pendingOrders) : searchFilteredOrders(historyOrders)


  const handlePlanning = (order) => {
    setSelectedOrder(order)
    setFormData({
      qtyToBeDispatched: order.pendingQty || "0",
      typeOfTransporting: order.typeOfTransporting || "",
      dateOfDispatch: "",
      toBeReconfirm: "Yes",
    })
  }

  const generateNewDSrNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('DISPATCH')
        .select('"D-Sr Number"')
        .order('id', { ascending: false })
        .limit(1)

      if (error) {
        console.error("Error fetching max D-Sr Number:", error)
        return "D-01" // Fallback
      }

      if (data && data.length > 0 && data[0]["D-Sr Number"]) {
        const lastSr = data[0]["D-Sr Number"]
        const match = lastSr.match(/D-(\d+)/i)
        if (match) {
          const num = parseInt(match[1], 10)
          return `D-${String(num + 1).padStart(2, '0')}`
        }
      }

      return "D-01"
    } catch (error) {
      console.error("Error generating D-Sr Number:", error)
      return "D-01"
    }
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)

      const timestamp = getISTTimestamp()
      const dSrNumber = await generateNewDSrNumber()

      // Upload trust certificate file if provided
      let trustCertificateUrl = ""
      if (formData.trustCertificateMade === "Yes" && formData.trustCertificateFile) {
        try {
          const file = formData.trustCertificateFile
          const fileExt = file.name.split('.').pop()
          const fileName = `${dSrNumber}_trust_cert_${Date.now()}.${fileExt}`
          const filePath = `dispatch/trust-certificates/${fileName}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) throw uploadError

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filePath)

          trustCertificateUrl = publicUrl
        } catch (uploadError) {
          console.error("Error uploading trust certificate:", uploadError)
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload trust certificate file"
          })
          throw uploadError
        }
      }

      // Calculate quantities
      const dispatchQty = parseFloat(formData.qtyToBeDispatched) || 0
      const currentDelivered = parseFloat(selectedOrder.quantityDelivered) || 0
      const totalQty = parseFloat(selectedOrder.quantity) || 0

      // Ensure we don't dispatch more than pending - DISABLED at User Request
      /* if (dispatchQty > selectedOrder.pendingQty) {
        throw new Error(`Cannot dispatch more than pending quantity (${selectedOrder.pendingQty})`)
      } */

      const newDelivered = currentDelivered + dispatchQty
      const newPending = totalQty - newDelivered

      // 1. Insert into DISPATCH table
      const dispatchPayload = {
        "Timestamp": timestamp,
        "D-Sr Number": dSrNumber,
        "Delivery Order No.": selectedOrder.deliveryOrderNo || "",
        "Party Name": selectedOrder.partyName || "",
        "Product Name": selectedOrder.productName || "",
        "Qty To Be Dispatched": dispatchQty,
        "Type Of Transporting": formData.typeOfTransporting,
        "Date Of Dispatch": formData.dateOfDispatch,
        "To Be Reconfirm": formData.toBeReconfirm,
        "Trust Certificate Made": trustCertificateUrl || null
      }

      const { error: dispatchError } = await supabase
        .from('DISPATCH')
        .insert([dispatchPayload])

      if (dispatchError) throw dispatchError

      // 2. Update ORDER RECEIPT table
      // Always update Delivered and Pending Qty
      const updates = {
        "Delivered": newDelivered
      }

      // Only mark as completed (Actual 4) if fully dispatched
      // Use a small epsilon to handle floating point precision issues
      if (newPending <= 0.01) {
        updates["Actual 4"] = timestamp
        updates["Pending Qty"] = 0 // Ensure it's exactly 0 in DB
      } else {
        updates["Pending Qty"] = newPending
      }

      const { error: orderError } = await supabase
        .from('ORDER RECEIPT')
        .update(updates)
        .eq('id', selectedOrder.id)

      if (orderError) throw orderError

      toast({
        title: "Success",
        description: `Dispatch submitted successfully! D-Sr: ${dSrNumber}`,
      })

      // Refresh data immediately
      await fetchData()

      // Clear form and selection
      setSelectedOrder(null)
      setFormData({
        qtyToBeDispatched: "",
        typeOfTransporting: "",
        dateOfDispatch: "",
        toBeReconfirm: "Yes",
        trustCertificateMade: "No",
        trustCertificateFile: null,
      })

    } catch (error) {
      console.error("Error submitting dispatch:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit. Error: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      qtyToBeDispatched: "",
      typeOfTransporting: "",
      dateOfDispatch: "",
      toBeReconfirm: "Yes",
      trustCertificateMade: "No",
      trustCertificateFile: null,
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch Planning</h1>
          <p className="text-gray-600">Plan and schedule order dispatches</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-100 shadow-sm relative overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between z-10 relative">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">Total Orders</p>
              <h2 className="text-3xl font-bold text-gray-900">{totalOrdersCount}</h2>
            </div>
            <div className="p-3 bg-blue-500 rounded-full text-white shadow-md">
              <FileText className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-100 shadow-sm relative overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between z-10 relative">
            <div>
              <p className="text-sm font-medium text-orange-600 mb-1">Pending Check</p>
              <h2 className="text-3xl font-bold text-gray-900">{pendingOrders.length}</h2>
            </div>
            <div className="p-3 bg-orange-500 rounded-full text-white shadow-md">
              <Loader2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm relative overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between z-10 relative">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Completed Check</p>
              <h2 className="text-3xl font-bold text-gray-900">{completedOrdersCount}</h2>
            </div>
            <div className="p-3 bg-green-500 rounded-full text-white shadow-md">
              <CheckCircle2 className="w-6 h-6" />
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
            onClick={() => fetchData()}
            variant="outline"
            className="h-10 px-3"
            disabled={loading || submitting}
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
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
      </div>

      <div className="mt-4">
        {displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <div className="bg-gray-50 p-4 rounded-full mb-3">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No {activeTab === "pending" ? "pending orders" : "dispatch history"} found
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              {activeTab === "pending"
                ? "All orders have been dispatched or no plan exists."
                : "No dispatch records available yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="block lg:hidden space-y-4">
              {displayOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{order.partyName}</h3>
                      <p className="text-xs text-gray-500">DO: {order.deliveryOrderNo}</p>
                    </div>
                    {activeTab === "history" ? (
                      <Badge variant="outline" className="font-mono bg-purple-50 text-purple-700 border-purple-200">
                        {order.dSrNumber}
                      </Badge>
                    ) : (
                      <Badge className={`rounded-sm text-xs ${order.status.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                        {order.status}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm border-t border-b border-gray-100 py-3">
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Product</p>
                      <p className="font-medium text-gray-900 truncate">{order.productName}</p>
                    </div>

                    {activeTab === "pending" ? (
                      <>
                        <div>
                          <p className="text-xs text-gray-500">Ordered</p>
                          <p className="font-medium text-gray-900">{order.quantity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Delivered</p>
                          <p className="font-medium text-green-600">{order.quantityDelivered}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Pending</p>
                          <p className="font-bold text-orange-600">{order.pendingQty}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Transport</p>
                          <p className="font-medium text-gray-900 truncate">{order.typeOfTransporting || "N/A"}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs text-gray-500">Qty Dispatched</p>
                          <p className="font-bold text-gray-900">{order.qtyToBeDispatched}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Dispatch Date</p>
                          <p className="font-medium text-gray-900">{order.dateOfDispatch ? order.dateOfDispatch.split(' ')[0] : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Transport</p>
                          <p className="font-medium text-gray-900 truncate">{order.typeOfTransporting}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Reconfirm</p>
                          <Badge className={`text-[10px] px-1 ${order.toBeReconfirm === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {order.toBeReconfirm}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>

                  {activeTab === "pending" && (
                    <Button
                      onClick={() => handlePlanning(order)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9"
                      size="sm"
                      disabled={submitting}
                    >
                      <Truck className="w-3 h-3 mr-2" />
                      Dispatch
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden lg:block bg-white rounded-md border shadow-sm overflow-hidden">
              {activeTab === "history" ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>D-Sr No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Party Name</TableHead>
                        <TableHead>DO No.</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Transport</TableHead>
                        <TableHead>Dispatch Date</TableHead>
                        <TableHead>Reconfirm</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-gray-50">
                          <TableCell>
                            <Badge variant="outline" className="font-mono bg-purple-50 text-purple-700 border-purple-200">
                              {order.dSrNumber}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-600 text-sm">
                            {order.timestamp ? order.timestamp.split(' ')[0] : "N/A"}
                          </TableCell>
                          <TableCell className="font-medium text-gray-900">
                            {order.partyName}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-gray-600">
                            {order.deliveryOrderNo}
                          </TableCell>
                          <TableCell className="text-gray-600 max-w-[200px] truncate" title={order.productName}>
                            {order.productName}
                          </TableCell>
                          <TableCell className="font-bold text-gray-900">
                            {order.qtyToBeDispatched}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {order.typeOfTransporting}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {order.dateOfDispatch ? order.dateOfDispatch.split(' ')[0] : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge className={order.toBeReconfirm === 'Yes' ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100'}>
                              {order.toBeReconfirm}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Action</TableHead>
                        <TableHead>Party Name</TableHead>
                        <TableHead>DO No.</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Ordered</TableHead>
                        <TableHead>Delivered</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Type Of Transporting</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-gray-50">
                          <TableCell>
                            <Button
                              onClick={() => handlePlanning(order)}
                              className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                              size="sm"
                              disabled={submitting}
                            >
                              <Truck className="w-3 h-3 mr-2" />
                              Dispatch
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium text-gray-900">
                            {order.partyName}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-gray-600">
                            {order.deliveryOrderNo}
                          </TableCell>
                          <TableCell className="text-gray-600 max-w-[200px] truncate" title={order.productName}>
                            {order.productName}
                          </TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell className="text-green-600">{order.quantityDelivered}</TableCell>
                          <TableCell className={`font-bold ${order.pendingQty > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                            {order.pendingQty}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {order.typeOfTransporting || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`rounded-sm text-xs ${order.status.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                              {order.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dispatch Form Modal */}
      {
        selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
            <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
                <CardTitle className="text-lg lg:text-xl">Dispatch Planning</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 lg:p-6">
                <div className="space-y-6">
                  {/* Order Info */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Order Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-gray-500">Party Name</Label>
                        <p className="font-medium">{selectedOrder.partyName}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Delivery Order No.</Label>
                        <p className="font-medium">{selectedOrder.deliveryOrderNo || "N/A"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Product Name</Label>
                        <p className="font-medium">{selectedOrder.productName}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Order Quantity</Label>
                        <p className="font-medium">{selectedOrder.quantity}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Already Delivered</Label>
                        <p className="font-medium text-green-600">{selectedOrder.quantityDelivered}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Pending Quantity</Label>
                        <p className="font-medium text-orange-600">{selectedOrder.pendingQty}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-3">Dispatch Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Quantity to Dispatch *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.qtyToBeDispatched}
                          onChange={(e) => setFormData(prev => ({ ...prev, qtyToBeDispatched: e.target.value }))}
                          className="h-10"
                          placeholder="Enter quantity"
                          disabled={submitting}
                          min="0"
                        />
                        <p className="text-xs text-gray-500">
                          Max: {selectedOrder.pendingQty} units available
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Transport Type *</Label>
                        <Select
                          value={formData.typeOfTransporting}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, typeOfTransporting: value }))}
                          disabled={submitting}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="For">For</SelectItem>
                            <SelectItem value="Ex Factory">Ex Factory</SelectItem>
                            <SelectItem value="Ex Factory But Paid By US">Ex Factory But Paid By US</SelectItem>
                            <SelectItem value="direct Suply">direct Suply</SelectItem>
                            <SelectItem value="Owned Truck">Owned Truck</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Dispatch Date *</Label>
                        <Input
                          type="date"
                          value={formData.dateOfDispatch}
                          onChange={(e) => setFormData(prev => ({ ...prev, dateOfDispatch: e.target.value }))}
                          className="h-10"
                          disabled={submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Reconfirm *</Label>
                        <Select
                          value={formData.toBeReconfirm}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, toBeReconfirm: value }))}
                          disabled={submitting}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Trust Certificate Made */}
                      <div className="space-y-2">
                        <Label className="text-sm">Trust Certificate Made *</Label>
                        <Select
                          value={formData.trustCertificateMade}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, trustCertificateMade: value, trustCertificateFile: value === "No" ? null : prev.trustCertificateFile }))}
                          disabled={submitting}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Trust Certificate File Upload - Only show if Yes */}
                      {formData.trustCertificateMade === "Yes" && (
                        <div className="space-y-2 col-span-2">
                          <Label className="text-sm">Upload Trust Certificate *</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                const file = e.target.files[0]
                                if (file) {
                                  if (file.size > 5 * 1024 * 1024) {
                                    toast({
                                      variant: "destructive",
                                      title: "Error",
                                      description: "File size should be less than 5MB",
                                    })
                                    e.target.value = ""
                                    return
                                  }
                                  setFormData(prev => ({ ...prev, trustCertificateFile: file }))
                                }
                              }}
                              className="h-10"
                              disabled={submitting}
                            />
                            {formData.trustCertificateFile && (
                              <span className="text-sm text-green-600 truncate flex-shrink-0">
                                ✓ Selected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">Accepts image or PDF files (max 5MB)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <div className="flex flex-col sm:flex-row justify-end gap-3">
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
                        disabled={
                          !formData.qtyToBeDispatched ||
                          parseFloat(formData.qtyToBeDispatched) <= 0 ||
                          !formData.typeOfTransporting ||
                          !formData.dateOfDispatch ||
                          !formData.toBeReconfirm ||
                          !formData.trustCertificateMade ||
                          (formData.trustCertificateMade === "Yes" && !formData.trustCertificateFile) ||
                          submitting
                        }
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          `Submit Dispatch`
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }
    </div >
  )
}