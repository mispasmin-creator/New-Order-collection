"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, CheckCircle2, Loader2, X, AlertCircle, Truck } from "lucide-react"



export default function MakeInvoicePage({ user }) {
  const [orders, setOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    fetchInvoiceData()
  }, [])

  const fetchInvoiceData = async () => {
    try {
      setLoading(true)

      // Fetch DISPATCH data
      const { data, error } = await supabase
        .from('DISPATCH')
        .select('*')
        .not('Planned3', 'is', null)

      if (error) {
        throw error
      }

      // Fetch ORDER RECEIPT data to get GST and Address
      const { data: orderReceiptData, error: orderReceiptError } = await supabase
        .from('ORDER RECEIPT')
        .select('*')

      if (orderReceiptError) {
        console.error("Error fetching ORDER RECEIPT:", orderReceiptError)
      }

      // Create a map of DO Number to GST/Address for quick lookup
      const orderReceiptMap = new Map()
      if (orderReceiptData) {
        orderReceiptData.forEach(row => {
          const doNumber = row["DO-Delivery Order No."]
          if (doNumber) {
            orderReceiptMap.set(doNumber, {
              gstNumber: row["Gst Number"] || "",
              address: row["Address"] || ""
            })
          }
        })
      }

      const pending = []
      const history = []

      data.forEach(row => {
        const deliveryOrderNo = row["Delivery Order No."]
        const orderReceiptInfo = orderReceiptMap.get(deliveryOrderNo) || {}

        const order = {
          id: row.id,
          timestamp: row["Timestamp"],
          dSrNumber: row["D-Sr Number"],
          deliveryOrderNo: deliveryOrderNo,
          dispatchNo: row["D-Sr Number"],
          lgstSrNumber: row["LGST-Sr Number"],
          partyName: row["Party Name"],
          productName: row["Product Name"],
          qtyToBeDispatched: row["Qty To Be Dispatched"],
          typeOfTransporting: row["Type Of Transporting  "],
          actualTruckQty: row["Actual Truck Qty"],
          transporterName: row["Transporter Name"],
          truckNo: row["Truck No."],
          driverMobileNo: row["Driver Mobile No."],
          typeOfRate: row["Type Of Rate"],
          vehiclePlateImage: row["Vehicle No. Plate Image"],
          biltyNo: row["Bilty No."],
          gstNumber: orderReceiptInfo.gstNumber || "N/A",
          address: orderReceiptInfo.address || "N/A",
          planned3: row["Planned3"],
          actual3: row["Actual3"]
        }

        if (order.actual3 === null || order.actual3 === "" || order.actual3 === " ") {
          pending.push(order)
        } else {
          history.push(order)
        }
      })

      // Sort pending orders by Planned3 date (most recent first)
      pending.sort((a, b) => {
        if (!a.planned3) return 1
        if (!b.planned3) return -1
        return new Date(b.planned3) - new Date(a.planned3)
      })

      // Sort completed orders by Actual3 date (most recent first)
      history.sort((a, b) => {
        if (!a.actual3) return 1
        if (!b.actual3) return -1
        return new Date(b.actual3) - new Date(a.actual3)
      })

      setOrders(pending)
      setCompletedOrders(history)
    } catch (error) {
      console.error("Error fetching invoice data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch invoice data"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === "" || dateTimeString === " ") return "N/A"
    try {
      const date = new Date(dateTimeString)
      if (isNaN(date.getTime())) return dateTimeString
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch (e) {
      return dateTimeString
    }
  }

  const formatDateOnly = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === "" || dateTimeString === " ") return "N/A"
    try {
      const date = new Date(dateTimeString)
      if (isNaN(date.getTime())) return dateTimeString
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch (e) {
      return dateTimeString
    }
  }

  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm) return ordersList

    return ordersList.filter((order) =>
      Object.values(order).some((value) =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const handleOpenConfirmDialog = (order) => {
    setSelectedOrder(order)
    setShowConfirmDialog(true)
  }

  const handleCloseConfirmDialog = () => {
    setSelectedOrder(null)
    setShowConfirmDialog(false)
  }

  const handleMarkAsDone = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)
      const actualDateTime = getISTTimestamp()

      const { error } = await supabase
        .from('DISPATCH')
        .update({
          "Actual3": actualDateTime
        })
        .eq('id', selectedOrder.id)

      if (error) {
        throw error
      }

      await fetchInvoiceData()
      handleCloseConfirmDialog()
      toast({
        title: "Success",
        description: `Order ${selectedOrder.lgstSrNumber} marked as done!`,
      })

    } catch (error) {
      console.error("Error marking as done:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to mark as done. Error: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const displayOrders = activeTab === "pending"
    ? searchFilteredOrders(orders)
    : searchFilteredOrders(completedOrders)

  const totalParties = new Set([...orders, ...completedOrders].map(o => o.partyName)).size

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading invoice data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Make Invoice</h1>
          <p className="text-gray-600">Mark orders as done by updating Actual3 column</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Pending Invoices</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Completed Invoices</p>
              <div className="text-2xl font-bold text-green-900">{completedOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Parties</p>
              <div className="text-2xl font-bold text-purple-900">{totalParties}</div>
            </div>
            <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
              <Truck className="h-6 w-6" />
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
            onClick={() => fetchInvoiceData()}
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
            History ({completedOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Action</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">LGST-Sr</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">DO No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Product Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Truck Qty</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Type Of Transporting</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">GST Number</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[200px]">Address</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Transporter</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Truck No</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Driver Mobile</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Type Of Rate</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Vehicle Image</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Bilty No</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Planned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === "pending" ? 16 : 15}
                    className="text-center py-8 text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No {activeTab} orders found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    {activeTab === "pending" && (
                      <TableCell className="py-2 px-4 min-w-[120px]">
                        <Button
                          size="sm"
                          onClick={() => handleOpenConfirmDialog(order)}
                          className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                          disabled={submitting}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Mark Done
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="py-2 px-4 min-w-[100px]">
                      <Badge className="bg-blue-500 text-white rounded-sm text-xs">
                        {order.lgstSrNumber || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm font-medium">
                      {order.deliveryOrderNo || "N/A"}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      <div className="truncate max-w-[150px]">{order.partyName || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      <div className="truncate max-w-[150px]">{order.productName || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] text-sm font-medium">
                      {order.actualTruckQty || "N/A"}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      <div className="truncate max-w-[150px]">{order.typeOfTransporting || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      <div className="truncate max-w-[150px] font-mono text-xs">{order.gstNumber || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[200px] text-sm">
                      <div className="truncate max-w-[200px]" title={order.address}>{order.address || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                      <div className="truncate max-w-[120px]">{order.transporterName || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px]">
                      <Badge variant="outline" className="rounded-sm text-xs">
                        {order.truckNo || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                      <div className="truncate max-w-[120px]">{order.driverMobileNo || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                      <div className="truncate max-w-[120px]">{order.typeOfRate || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] text-center">
                      {order.vehiclePlateImage ? (
                        <a
                          href={order.vehiclePlateImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline text-xs"
                        >
                          View
                        </a>
                      ) : "N/A"}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                      <div className="truncate max-w-[120px]">{order.biltyNo || "N/A"}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm font-medium">
                      {order.planned3 ? (
                        <span className="text-orange-600">{formatDateOnly(order.planned3)}</span>
                      ) : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Confirm Action</h3>
                <button
                  onClick={handleCloseConfirmDialog}
                  className="text-gray-400 hover:text-gray-500"
                  disabled={submitting}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-start mb-6">
                <AlertCircle className="w-6 h-6 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-700 mb-2">
                    Are you sure you want to mark this order as done?
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md text-sm">
                    <p className="font-medium text-gray-900 mb-1">Order Details:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                      <span>LGST-Sr:</span> <span className="text-gray-900">{selectedOrder.lgstSrNumber}</span>
                      <span>Party:</span> <span className="text-gray-900 truncate">{selectedOrder.partyName}</span>
                      <span>Product:</span> <span className="text-gray-900 truncate">{selectedOrder.productName}</span>
                      <span>Planned:</span> <span className="text-gray-900">{formatDateTime(selectedOrder.planned3)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={handleCloseConfirmDialog}
                  disabled={submitting}
                  className="min-w-[80px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleMarkAsDone}
                  className="bg-green-600 hover:bg-green-700 min-w-[80px]"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}