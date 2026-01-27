"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, CheckCircle2, Loader2, X, AlertCircle } from "lucide-react"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

export default function MakeInvoicePage({ user }) {
  const [orders, setOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
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
      
      const response = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.data) {
        const { pending, completed } = getPendingOrdersForInvoice(data.data)
        setOrders(pending)
        setCompletedOrders(completed)
      } else {
        console.error("Failed to load DISPATCH data:", data)
      }
    } catch (error) {
      console.error("Error fetching invoice data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getPendingOrdersForInvoice = (sheetData) => {
    if (!sheetData || sheetData.length < 2) {
      return { pending: [], completed: [] }
    }
    
    let headerRowIndex = -1
    let headers = []
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (row && row.length > 0) {
        const hasTimestamp = row.some(cell => 
          cell && cell.toString().trim().toLowerCase().includes("timestamp")
        )
        if (hasTimestamp) {
          headerRowIndex = i
          headers = row.map(h => h?.toString().trim() || "")
          break
        }
      }
    }
    
    if (headerRowIndex === -1) {
      return { pending: [], completed: [] }
    }
    
    const findIndex = (patterns) => {
      for (const pattern of patterns) {
        const index = headers.findIndex(h => {
          if (!h) return false
          const headerLower = h.toString().toLowerCase().trim()
          const patternLower = pattern.toLowerCase().trim()
          return headerLower.includes(patternLower) || patternLower.includes(headerLower)
        })
        if (index !== -1) return index
      }
      return -1
    }
    
    const indices = {
      timestamp: findIndex(["timestamp"]),
      dSrNumber: findIndex(["d-sr", "dsr", "dispatch no", "dispatch"]),
      deliveryOrderNo: findIndex(["delivery order", "do no", "do"]),
      partyName: findIndex(["party name", "party"]),
      productName: findIndex(["product name", "product"]),
      qtyToBeDispatched: findIndex(["qty to be dispatched", "quantity"]),
      transporterName: findIndex(["transporter name", "transporter"]),
      truckNo: findIndex(["truck no", "truck number", "truck"]),
      driverMobileNo: findIndex(["driver mobile", "driver"]),
      biltyNo: findIndex(["bilty no", "bilty"]),
      lgstSrNumber: findIndex(["lgst-sr", "lgst sr", "lgst", "logistics sr"]),
      actualTruckQty: findIndex(["actual truck qty", "actual qty", "truck qty"]),
      planned3: findIndex(["planned3", "planned 3"]),
      actual3: findIndex(["actual3", "actual 3"])
    }
    
    const pendingOrders = []
    const completedOrders = []
    
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const getVal = (index) => {
        if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
          return row[index].toString().trim()
        }
        return ""
      }
      
      const planned3 = getVal(indices.planned3)
      const actual3 = getVal(indices.actual3)
      const lgstSrNumber = getVal(indices.lgstSrNumber)
      const dSrNumber = getVal(indices.dSrNumber)
      
      if (!lgstSrNumber || lgstSrNumber === "" || 
          lgstSrNumber.toLowerCase().includes("lgst-sr") || 
          lgstSrNumber.toLowerCase() === "lgst-sr number" || 
          lgstSrNumber.toLowerCase().includes("header")) {
        continue
      }
      
      if (dSrNumber && (dSrNumber.toLowerCase().includes("d-sr") || dSrNumber.toLowerCase().includes("number"))) {
        continue
      }
      
      const isPlanned3NotNull = planned3 && 
                                planned3.trim() !== "" && 
                                planned3.toLowerCase() !== "null" &&
                                planned3.toLowerCase() !== "n/a" &&
                                planned3.toLowerCase() !== "pending" &&
                                !planned3.toLowerCase().includes("undefined") &&
                                !planned3.toLowerCase().includes("planned")
      
      const isActual3Null = !actual3 || 
                           actual3.trim() === "" || 
                           actual3.toLowerCase() === "null" ||
                           actual3.toLowerCase() === "n/a" ||
                           actual3.toLowerCase() === "pending" ||
                           actual3.toLowerCase().includes("undefined") ||
                           actual3.toLowerCase().includes("actual")
      
      const isActual3NotNull = actual3 && 
                              actual3.trim() !== "" && 
                              actual3.toLowerCase() !== "null" &&
                              actual3.toLowerCase() !== "n/a" &&
                              actual3.toLowerCase() !== "pending" &&
                              !actual3.toLowerCase().includes("undefined") &&
                              !actual3.toLowerCase().includes("actual")
      
      const order = {
        id: i,
        rowIndex: i + 1,
        timestamp: getVal(indices.timestamp),
        dSrNumber: dSrNumber,
        deliveryOrderNo: getVal(indices.deliveryOrderNo),
        dispatchNo: getVal(indices.dSrNumber),
        lgstSrNumber: lgstSrNumber,
        partyName: getVal(indices.partyName),
        productName: getVal(indices.productName),
        qtyToBeDispatched: getVal(indices.qtyToBeDispatched),
        actualTruckQty: getVal(indices.actualTruckQty),
        transporterName: getVal(indices.transporterName),
        truckNo: getVal(indices.truckNo),
        driverMobileNo: getVal(indices.driverMobileNo),
        biltyNo: getVal(indices.biltyNo),
        planned3: planned3,
        actual3: actual3
      }
      
      if (isPlanned3NotNull) {
        if (isActual3Null) {
          order.isPending = true
          order.isCompleted = false
          pendingOrders.push(order)
        } else if (isActual3NotNull) {
          order.isPending = false
          order.isCompleted = true
          completedOrders.push(order)
        }
      }
    }
    
    pendingOrders.sort((a, b) => {
      if (!a.planned3) return 1
      if (!b.planned3) return -1
      return new Date(b.planned3) - new Date(a.planned3)
    })
    
    completedOrders.sort((a, b) => {
      if (!a.actual3) return 1
      if (!b.actual3) return -1
      return new Date(b.actual3) - new Date(a.actual3)
    })
    
    return { pending: pendingOrders, completed: completedOrders }
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
      
      const now = new Date()
      const actualDateTime = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/(\d+)\/(\d+)\/(\d+), (\d+:\d+:\d+)/, '$1/$2/$3 $4')
      
      const headersResponse = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      if (!headersResponse.ok) {
        throw new Error(`HTTP error! status: ${headersResponse.status}`)
      }
      
      const headersData = await headersResponse.json()
      
      if (!headersData.success || !headersData.data) {
        throw new Error("Failed to fetch sheet headers")
      }
      
      let headerRowIndex = -1
      let headers = []
      
      for (let i = 0; i < headersData.data.length; i++) {
        const row = headersData.data[i]
        if (row && row.length > 0) {
          const hasTimestamp = row.some(cell => 
            cell && cell.toString().trim().toLowerCase().includes("timestamp")
          )
          
          if (hasTimestamp) {
            headerRowIndex = i
            headers = row.map(h => h?.toString().trim() || "")
            break
          }
        }
      }
      
      if (headerRowIndex === -1) {
        throw new Error("Could not find headers in DISPATCH sheet")
      }
      
      const findIndex = (patterns) => {
        for (const pattern of patterns) {
          const index = headers.findIndex(h => {
            if (!h) return false
            const headerLower = h.toString().toLowerCase().trim()
            const patternLower = pattern.toLowerCase().trim()
            return headerLower.includes(patternLower) || patternLower.includes(headerLower)
          })
          if (index !== -1) return index + 1
        }
        return -1
      }
      
      const actual3ColIndex = findIndex(["actual3", "actual 3"])
      
      if (actual3ColIndex === -1) {
        throw new Error("Could not find 'Actual3' column in DISPATCH sheet")
      }
      
      const updateData = {
        action: 'updateCell',
        sheetName: 'DISPATCH',
        rowIndex: selectedOrder.rowIndex,
        columnIndex: actual3ColIndex,
        value: actualDateTime
      }
      
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(updateData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        await fetchInvoiceData()
        handleCloseConfirmDialog()
        alert(`✓ Order ${selectedOrder.lgstSrNumber} marked as done!`)
      } else {
        throw new Error(result.error || "Failed to update")
      }
      
    } catch (error) {
      console.error("Error marking as done:", error)
      alert(`✗ Failed to mark as done. Error: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const displayOrders = activeTab === "pending" 
    ? searchFilteredOrders(orders) 
    : searchFilteredOrders(completedOrders)

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Make Invoice</h1>
        <p className="text-gray-600">Mark orders as done by updating Actual3 column</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Order Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Pending: {orders.length} | Completed: {completedOrders.length}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            <div className="flex bg-gray-100 p-1 rounded-t-lg">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "pending"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "history"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                History ({completedOrders.length})
              </button>
            </div>

            <div className="bg-white p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50 w-full"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                    {activeTab === "pending" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">LGST-Sr Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Truck Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Transporter</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Truck No</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 9 : 8} 
                        className="text-center py-8 text-gray-500"
                      >
                        {activeTab === "pending" 
                          ? "No pending orders found."
                          : "No completed orders found."
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <Button
                              size="sm"
                              onClick={() => handleOpenConfirmDialog(order)}
                              className="bg-green-600 hover:bg-green-700"
                              disabled={submitting}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Mark as Done
                            </Button>
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-blue-500 text-white rounded-full">
                            {order.lgstSrNumber || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className="font-medium">{order.deliveryOrderNo || "N/A"}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <p>{order.partyName || "N/A"}</p>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span>{order.productName || "N/A"}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium">
                          {order.actualTruckQty || "N/A"}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span>{order.transporterName || "N/A"}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge variant="outline" className="rounded-full">
                            {order.truckNo || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium whitespace-nowrap">
                          {order.planned3 ? (
                            <span className="text-orange-600">{order.planned3}</span>
                          ) : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} of {activeTab === "pending" ? orders.length : completedOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
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
                <AlertCircle className="w-6 h-6 text-yellow-500 mr-3 mt-0.5" />
                <div>
                  <p className="text-gray-700 mb-2">
                    Are you sure you want to mark this order as done?
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm font-medium text-gray-900">Order Details:</p>
                    <p className="text-sm text-gray-600">LGST-Sr: {selectedOrder.lgstSrNumber}</p>
                    <p className="text-sm text-gray-600">Party: {selectedOrder.partyName}</p>
                    <p className="text-sm text-gray-600">Product: {selectedOrder.productName}</p>
                    <p className="text-sm text-gray-600">Planned: {selectedOrder.planned3}</p>
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
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Button 
          onClick={fetchInvoiceData} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
          disabled={submitting || loading}
        >
          <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>
    </div>
  )
}