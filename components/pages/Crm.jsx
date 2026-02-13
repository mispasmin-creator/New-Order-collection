"use client"

import { useState, useEffect } from "react"
import { getISTDisplayDate, getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { X, Search, CheckCircle2, Loader2, FileText, CheckSquare, Layers } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useNotification } from "@/components/providers/NotificationProvider"

export default function CRMDonePage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const { updateCount } = useNotification()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('DELIVERY')
        .select('*')
        .not('Planned 4', 'is', null)

      if (error) throw error

      if (data) {
        const pendingOrders = []
        const historyOrdersData = []

        data.forEach(row => {
          const order = {
            id: row.id,
            rowIndex: row.id,
            timestamp: row["Timestamp"],
            billDate: row["Bill Date"],
            deliveryOrderNo: row["Delivery Order No."],
            partyName: row["Party Name"],
            productName: row["Product Name"],
            quantityDelivered: row["Quantity Delivered."] || row["Quantity Delivered"],
            billNo: row["Bill No."],
            logisticNo: row["Losgistic no."] || row["Logistic No."],
            rateOfMaterial: row["Rate Of Material"],
            typeOfTransporting: row["Type Of Transporting"],
            transporterName: row["Transporter Name"],
            vehicleNumber: row["Vehicle Number."] || row["Vehicle Number"],
            biltyNumber: row["Bilty Number."] || row["Bilty Number"],
            givingFromWhere: row["Giving From Where"],

            planned1: row["Planned 1"],
            actual1: row["Actual 1"],
            planned2: row["Planned 2"],
            actual2: row["Actual 2"],
            planned3: row["Planned 3"],
            actual3: row["Actual3"],

            // CRM (Level 4)
            planned4: row["Planned 4"],
            actual4: row["Actual4"], // Using Actual4 (no space)
            rawActual4: row["Actual4"],

            delay4: row["Delay4"],
          }

          if (!order.rawActual4) {
            pendingOrders.push(order)
          } else {
            historyOrdersData.push(order)
          }
        })

        setOrders(pendingOrders.sort((a, b) => b.id - a.id))
        setHistoryOrders(historyOrdersData.sort((a, b) => b.id - a.id))

        console.log("Pending CRM orders:", pendingOrders.length, "History CRM orders:", historyOrdersData.length)

        // Update notification count
        updateCount?.("CRM", pendingOrders.length)
      }

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch data from Supabase"
      })
    } finally {
      setLoading(false)
    }
  }

  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm.trim()) return ordersList

    return ordersList.filter((order) =>
      Object.values(order).some((value) =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayOrders = activeTab === "pending"
    ? searchFilteredOrders(orders)
    : searchFilteredOrders(historyOrders)

  const handleCRMDone = (order) => {
    setSelectedOrder(order)
  }

  // Format date to dd/mm/yyyy - SAFE VERSION
  const formatDate = (dateString) => {
    // Handle all possible cases
    if (!dateString) return "N/A"

    // Convert to string if it's not already
    const str = typeof dateString === 'string' ? dateString : String(dateString)

    // Trim if it's a string, otherwise use as is
    const trimmedStr = str.trim ? str.trim() : str

    if (trimmedStr === "" || trimmedStr === "N/A" || trimmedStr === "null" || trimmedStr === "undefined") {
      return "N/A"
    }

    try {
      // Check if it's already in dd/mm/yyyy format
      if (trimmedStr.includes('/')) {
        return trimmedStr.split(' ')[0]
      }

      const date = new Date(trimmedStr)
      if (!isNaN(date.getTime())) {
        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
      }

      return trimmedStr
    } catch (e) {
      return trimmedStr
    }
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)

      // Use the same timestamp format as other modules (YYYY-MM-DD HH:MM:SS)
      const actual4Time = getISTTimestamp()

      // 1. FIRST: Insert into POST DELIVERY table (so the trigger can UPDATE it)
      const postDeliveryPayload = {
        "Timestamp": actual4Time,
        "Order No.": selectedOrder.deliveryOrderNo || "",
        "Type of Bill": "",
        "Bill No.": selectedOrder.billNo || "",
        "Bill Date": selectedOrder.billDate || null,
        "Party Name": selectedOrder.partyName || "",
        "Total Bill Amount": (parseFloat(selectedOrder.quantityDelivered || 0) * parseFloat(selectedOrder.rateOfMaterial || 0)),
        "Total Truck Qty": parseFloat(selectedOrder.quantityDelivered || 0),
        "Copy Of Bill": "",
        "Planned": null,  // Trigger will set this
        "Actual": null,
        "Delay": null,
        "Material Received Date": null,
        "Image Of Received Bill / Audio": "",
        "Grn Number": ""
      }

      const { error: insertError } = await supabase
        .from('POST DELIVERY')
        .insert([postDeliveryPayload])

      if (insertError) {
        console.error("POST DELIVERY Insert Error:", insertError)
        throw insertError
      }

      // 2. THEN: Update DELIVERY table - Set Actual4 (trigger will update POST DELIVERY.Planned)
      const { error: updateError } = await supabase
        .from('DELIVERY')
        .update({ "Actual4": actual4Time })
        .eq('id', selectedOrder.id)

      if (updateError) {
        console.error("DELIVERY Update Error:", updateError)
        throw updateError
      }

      await fetchData()
      setSelectedOrder(null)

      toast({
        title: "Success",
        description: `CRM Done marked successfully!`,
      })

    } catch (error) {
      console.error("Error marking CRM done:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading CRM data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Done</h1>
          <p className="text-gray-600">Mark orders as CRM completed</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Entries</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length + historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <FileText className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending CRM</p>
              <div className="text-2xl font-bold text-amber-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Layers className="h-6 w-6" />
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
              <CheckSquare className="h-6 w-6" />
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
            Pending ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Completed ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Action</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Bill No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Bill Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Delivery Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Product Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Quantity</TableHead>
                {activeTab === "pending" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Planned4 Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Rate</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Total Amount</TableHead>
                  </>
                )}
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Actual4 Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Status</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === "pending" ? 11 : 8}
                    className="text-center py-8 text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No {activeTab === "pending" ? "pending" : "completed"} CRM orders found</span>
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
                          onClick={() => handleCRMDone(order)}
                          className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs"
                          disabled={submitting}
                        >
                          CRM Done
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="py-2 px-4 min-w-[100px]">
                      <Badge className="bg-green-500 text-white rounded-sm text-xs">
                        {order.billNo}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                      {formatDate(order.billDate)}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] font-medium text-sm">
                      {order.deliveryOrderNo}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.partyName}</TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      {order.productName}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] font-medium text-sm">{order.quantityDelivered}</TableCell>
                    {activeTab === "pending" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{formatDate(order.planned4)}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px] text-sm">₹{order.rateOfMaterial || "0"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] font-bold text-sm">
                          ₹{(
                            parseFloat(order.quantityDelivered || 0) *
                            parseFloat(order.rateOfMaterial || 0)
                          ).toFixed(2)}
                        </TableCell>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                          {formatDate(order.actual4)}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px]">
                          <Badge className="bg-green-500 text-white rounded-sm text-xs">
                            Completed
                          </Badge>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4 p-4">
          {displayOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-lg">No {activeTab === "pending" ? "pending" : "completed"} CRM orders found</span>
            </div>
          ) : (
            displayOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className="bg-green-500 text-white rounded-sm text-xs mb-2">
                          {order.billNo}
                        </Badge>
                        <p className="text-sm font-medium text-gray-900">{order.partyName}</p>
                      </div>
                      {activeTab === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => handleCRMDone(order)}
                          className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs"
                          disabled={submitting}
                        >
                          CRM Done
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Bill Date:</span>
                        <p className="font-medium">{formatDate(order.billDate)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">DO No:</span>
                        <p className="font-medium font-mono text-xs">{order.deliveryOrderNo}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Product:</span>
                        <p className="font-medium truncate">{order.productName}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <p className="font-medium">{order.quantityDelivered}</p>
                      </div>
                      {activeTab === "pending" && (
                        <>
                          <div>
                            <span className="text-gray-500">Planned4:</span>
                            <p className="font-medium">{formatDate(order.planned4)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Rate:</span>
                            <p className="font-medium">₹{order.rateOfMaterial || "0"}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Total Amount:</span>
                            <p className="font-bold text-base">
                              ₹{(parseFloat(order.quantityDelivered || 0) * parseFloat(order.rateOfMaterial || 0)).toFixed(2)}
                            </p>
                          </div>
                        </>
                      )}
                      {activeTab === "history" && (
                        <>
                          <div>
                            <span className="text-gray-500">Actual4 Date:</span>
                            <p className="font-medium">{formatDate(order.actual4)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <Badge className="bg-green-500 text-white rounded-sm text-xs">
                              Completed
                            </Badge>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Simplified CRM Done Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Mark as CRM Done</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Order Info */}
                <div className="space-y-4">
                  <div className="text-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Confirm CRM Completion
                    </h3>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Party Name:</span>
                      <span className="font-medium">{selectedOrder.partyName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Bill No:</span>
                      <Badge className="bg-green-500 text-white">
                        {selectedOrder.billNo}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Delivery Order No:</span>
                      <span className="font-medium">{selectedOrder.deliveryOrderNo}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Product:</span>
                      <span>{selectedOrder.productName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Quantity:</span>
                      <span className="font-medium">{selectedOrder.quantityDelivered}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Planned4 Date:</span>
                      <span className="font-medium text-blue-600">{formatDate(selectedOrder.planned4)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-bold">
                        ₹{(
                          parseFloat(selectedOrder.quantityDelivered || 0) *
                          parseFloat(selectedOrder.rateOfMaterial || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-800 text-center">
                      Actual4 will be set to: <span className="font-bold">{formatDate(new Date())}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-1 text-center">
                      Delay4 will be automatically calculated
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <Button
                    onClick={handleSubmit}
                    className="w-full bg-green-600 hover:bg-green-700 h-10"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      '✓ Mark as CRM Done'
                    )}
                  </Button>

                  <Button
                    onClick={handleCancel}
                    className="w-full h-10"
                    variant="outline"
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}