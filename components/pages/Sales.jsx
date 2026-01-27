"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, Calendar } from "lucide-react"
import { format } from "date-fns"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

export default function SalesFormPage({ user }) {
  const [orders, setOrders] = useState([])
  const [deliveryHistory, setDeliveryHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    billDate: format(new Date(), "yyyy-MM-dd"),
    deliveryOrderNo: "",
    partyName: "",
    productName: "",
    quantityDelivered: "",
    billNo: "",
    logisticNo: "",
    rateOfMaterial: "",
    typeOfTransporting: "",
    transporterName: "",
    vehicleNumber: "",
    biltyNumber: "",
    givingFromWhere: "",
    indentNo: "",
    qty: "",
    planned4: "",
    actual4: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch from DISPATCH sheet to get pending orders
      const dispatchResponse = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      if (dispatchResponse.ok) {
        const dispatchData = await dispatchResponse.json()
        
        if (dispatchData.success && dispatchData.data) {
          const pendingOrders = getPendingOrders(dispatchData.data)
          setOrders(pendingOrders)
          console.log("Pending orders loaded:", pendingOrders.length)
        }
      }
      
      // Fetch from DELIVERY sheet for history
      const deliveryResponse = await fetch(`${SCRIPT_URL}?sheet=DELIVERY`)
      if (deliveryResponse.ok) {
        const deliveryData = await deliveryResponse.json()
        
        if (deliveryData.success && deliveryData.data) {
          const history = transformDeliveryData(deliveryData.data)
          setDeliveryHistory(history)
          console.log("Delivery history loaded:", history.length)
        }
      }
      
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Get pending orders from DISPATCH sheet where Planned4 has value but Actual4 is empty
  const getPendingOrders = (sheetData) => {
    if (!sheetData || sheetData.length < 2) return []
    
    // Find header row
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
      console.log("No headers found in DISPATCH sheet")
      return []
    }
    
    // Get column indices
    const indices = {
      dSrNumber: headers.findIndex(h => h.toLowerCase().includes("d-sr")),
      deliveryOrderNo: headers.findIndex(h => h.toLowerCase().includes("delivery order")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party name")),
      productName: headers.findIndex(h => h.toLowerCase().includes("product name")),
      planned4: headers.findIndex(h => h.trim() === "Planned4" || h.toLowerCase().includes("planned4")),
      actual4: headers.findIndex(h => h.trim() === "Actual4" || h.toLowerCase().includes("actual4")),
      qtyToBeDispatched: headers.findIndex(h => h.toLowerCase().includes("qty to be dispatched")),
      typeOfTransporting: headers.findIndex(h => h.toLowerCase().includes("type of transporting")),
      transporterName: headers.findIndex(h => h.toLowerCase().includes("transporter name")),
      truckNo: headers.findIndex(h => h.toLowerCase().includes("truck no")),
      biltyNo: headers.findIndex(h => h.toLowerCase().includes("bilty no")),
      lgstNumber: headers.findIndex(h => h.toLowerCase().includes("lgst")),
      actualTruckQty: headers.findIndex(h => h.toLowerCase().includes("actual truck qty")),
    }
    
    console.log("DISPATCH Column indices:", indices)
    
    const pendingOrders = []
    
    // Start from row after header
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const getVal = (index) => {
        if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
          return row[index].toString().trim()
        }
        return ""
      }
      
      const planned4 = getVal(indices.planned4)
      const actual4 = getVal(indices.actual4)
      
      // Check if Planned4 has value and Actual4 is empty
      if (planned4 && planned4 !== "" && (!actual4 || actual4 === "")) {
        const order = {
          id: i,
          rowIndex: i + 1,
          dSrNumber: getVal(indices.dSrNumber),
          deliveryOrderNo: getVal(indices.deliveryOrderNo),
          partyName: getVal(indices.partyName),
          productName: getVal(indices.productName),
          qtyToBeDispatched: getVal(indices.qtyToBeDispatched),
          typeOfTransporting: getVal(indices.typeOfTransporting),
          transporterName: getVal(indices.transporterName),
          truckNo: getVal(indices.truckNo),
          biltyNo: getVal(indices.biltyNo),
          lgstNumber: getVal(indices.lgstNumber),
          actualTruckQty: getVal(indices.actualTruckQty),
          planned4: planned4,
          actual4: actual4,
        }
        
        pendingOrders.push(order)
      }
    }
    
    console.log("Total pending orders found:", pendingOrders.length)
    return pendingOrders
  }

  const transformDeliveryData = (sheetData) => {
    if (!sheetData || sheetData.length === 0) return []
    
    // Find header row
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
      console.log("No headers found in DELIVERY sheet")
      return []
    }
    
    // Get column indices for DELIVERY sheet
    const indices = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes("timestamp")),
      billDate: headers.findIndex(h => h.toLowerCase().includes("bill date")),
      deliveryOrderNo: headers.findIndex(h => h.toLowerCase().includes("delivery order")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party name")),
      productName: headers.findIndex(h => h.toLowerCase().includes("product name")),
      quantityDelivered: headers.findIndex(h => h.toLowerCase().includes("quantity delivered")),
      billNo: headers.findIndex(h => h.toLowerCase().includes("bill no")),
      logisticNo: headers.findIndex(h => h.toLowerCase().includes("losgistic no") || h.toLowerCase().includes("logistic no")),
      rateOfMaterial: headers.findIndex(h => h.toLowerCase().includes("rate of material")),
      typeOfTransporting: headers.findIndex(h => h.toLowerCase().includes("type of transporting")),
      transporterName: headers.findIndex(h => h.toLowerCase().includes("transporter name")),
      vehicleNumber: headers.findIndex(h => h.toLowerCase().includes("vehicle number")),
      biltyNumber: headers.findIndex(h => h.toLowerCase().includes("bilty number")),
      givingFromWhere: headers.findIndex(h => h.toLowerCase().includes("giving from where")),
      actual4: headers.findIndex(h => h.toLowerCase().includes("actual4")),
    }
    
    const historyOrders = []
    
    // Start from row after header
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const getVal = (index) => {
        if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
          return row[index].toString().trim()
        }
        return ""
      }
      
      const timestamp = getVal(indices.timestamp)
      const billDate = getVal(indices.billDate)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      
      // Only add if it has some data
      if (timestamp || billDate || deliveryOrderNo) {
        const historyOrder = {
          id: i,
          timestamp: timestamp,
          billDate: billDate,
          deliveryOrderNo: deliveryOrderNo,
          partyName: getVal(indices.partyName),
          productName: getVal(indices.productName),
          quantityDelivered: getVal(indices.quantityDelivered),
          billNo: getVal(indices.billNo),
          logisticNo: getVal(indices.logisticNo),
          rateOfMaterial: getVal(indices.rateOfMaterial),
          typeOfTransporting: getVal(indices.typeOfTransporting),
          transporterName: getVal(indices.transporterName),
          vehicleNumber: getVal(indices.vehicleNumber),
          biltyNumber: getVal(indices.biltyNumber),
          givingFromWhere: getVal(indices.givingFromWhere),
          actual4: getVal(indices.actual4),
        }
        
        historyOrders.push(historyOrder)
      }
    }
    
    console.log("Total delivery history orders found:", historyOrders.length)
    return historyOrders
  }

  const handleSales = (order) => {
    const now = new Date()
    const formattedDate = format(now, "yyyy-MM-dd")
    
    setSelectedOrder(order)
    setFormData({
      billDate: formattedDate,
      deliveryOrderNo: order.deliveryOrderNo || "",
      partyName: order.partyName || "",
      productName: order.productName || "",
      quantityDelivered: order.actualTruckQty || order.qtyToBeDispatched || "",
      billNo: "",
      logisticNo: order.lgstNumber || "",
      rateOfMaterial: "",
      typeOfTransporting: order.typeOfTransporting || "",
      transporterName: order.transporterName || "",
      vehicleNumber: order.truckNo || "",
      biltyNumber: order.biltyNo || "",
      givingFromWhere: "",
      indentNo: "",
      qty: "",
      planned4: order.planned4 || "",
    })
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)
      
      const now = new Date()
      const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      
      // Prepare DELIVERY sheet row data (simplified - without removed fields)
      const deliveryRowData = [
        timestamp,                                     // 1. Timestamp
        formData.billDate,                             // 2. Bill Date
        formData.deliveryOrderNo,                      // 3. Delivery Order No.
        formData.partyName,                            // 4. Party Name
        formData.productName,                          // 5. Product Name
        formData.quantityDelivered,                    // 6. Quantity Delivered.
        formData.billNo,                               // 7. Bill No. (manual input)
        formData.logisticNo,                           // 8. Losgistic no.
        formData.rateOfMaterial,                       // 9. Rate Of Material
        formData.typeOfTransporting,                   // 10. Type Of Transporting
        formData.transporterName,                      // 11. Transporter Name
        formData.vehicleNumber,                        // 12. Vehicle Number.
        formData.biltyNumber,                          // 13. Bilty Number.
        formData.givingFromWhere,                      // 14. Giving From Where
        formData.indentNo,                             // 15. Indent No.
        formData.qty,                                  // 16. Qty
                                   // 37-40: Empty columns for future use
      ]

      console.log("Submitting to DELIVERY sheet:", deliveryRowData)

      // Submit to DELIVERY sheet
      const deliveryResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'insert',
          sheetName: 'DELIVERY',
          rowData: JSON.stringify(deliveryRowData)
        })
      })

      if (!deliveryResponse.ok) {
        throw new Error(`HTTP error! status: ${deliveryResponse.status}`)
      }

      const deliveryResult = await deliveryResponse.json()
      console.log("DELIVERY sheet response:", deliveryResult)

      if (deliveryResult.success) {
        // Update DISPATCH sheet to set Actual4
        const dispatchUpdateResponse = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            action: 'updateCell',
            sheetName: 'DISPATCH',
            rowIndex: selectedOrder.rowIndex.toString(),
            columnIndex: "33", // Actual4 is at column 33 (0-indexed, adjust if needed)
            value: format(now, "dd/MM/yyyy") + " 18:00:00"
          })
        })

        if (!dispatchUpdateResponse.ok) {
          console.error("Failed to update DISPATCH sheet")
        }

        // Refresh data
        await fetchData()
        
        // Clear form and selection
        setSelectedOrder(null)
        setFormData({
          billDate: format(new Date(), "yyyy-MM-dd"),
          deliveryOrderNo: "",
          partyName: "",
          productName: "",
          quantityDelivered: "",
          billNo: "",
          logisticNo: "",
          rateOfMaterial: "",
          typeOfTransporting: "",
          transporterName: "",
          vehicleNumber: "",
          biltyNumber: "",
          givingFromWhere: "",
          indentNo: "",
          qty: "",
          planned4: "",
          actual4: "",
        })
        
        alert(`✓ Sales form submitted successfully!`)
        
      } else {
        throw new Error(deliveryResult.error || "Failed to submit to DELIVERY sheet")
      }
      
    } catch (error) {
      console.error("Error submitting sales form:", error)
      alert(`✗ Failed to submit. Error: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      billDate: format(new Date(), "yyyy-MM-dd"),
      deliveryOrderNo: "",
      partyName: "",
      productName: "",
      quantityDelivered: "",
      billNo: "",
      logisticNo: "",
      rateOfMaterial: "",
      typeOfTransporting: "",
      transporterName: "",
      vehicleNumber: "",
      biltyNumber: "",
      givingFromWhere: "",
      indentNo: "",
      qty: "",
      planned4: "",
      actual4: "",
    })
  }

  // Apply search filter
  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm.trim()) return ordersList
    
    return ordersList.filter((order) =>
      Object.values(order).some((value) => 
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const pendingOrders = searchFilteredOrders(orders)
  const historyOrders = searchFilteredOrders(deliveryHistory)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading sales data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-gray-900">Sales Form</h1>
        <p className="text-gray-600">Create and manage sales deliveries</p>
      </div>

      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Sales Form</h1>
        <p className="text-sm text-gray-600 mt-1">Manage sales deliveries</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Sales Delivery Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Pending: {orders.length} | History: {deliveryHistory.length}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            <div className="flex bg-gray-100 p-1 rounded-t-lg">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                History ({deliveryHistory.length})
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

            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                    {activeTab === "pending" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill No.</TableHead>
                      </>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">D-Sr Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    {activeTab === "pending" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Transport Type</TableHead>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Quantity Delivered</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Rate of Material</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Source</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {(activeTab === "pending" ? pendingOrders : historyOrders).length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 8 : 9} 
                        className="text-center py-8 text-gray-500"
                      >
                        No {activeTab === "pending" ? "pending" : "history"} orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    (activeTab === "pending" ? pendingOrders : historyOrders).map((order) => {
                      if (activeTab === "pending") {
                        return (
                          <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                            <TableCell className="py-4 px-6">
                              <Button
                                size="sm"
                                onClick={() => handleSales(order)}
                                className="bg-green-600 hover:bg-green-700"
                                disabled={submitting}
                              >
                                Sales Form
                              </Button>
                            </TableCell>
                             <TableCell className="py-4 px-6">
                              <Badge variant="outline" className="rounded-full">
                                {order.dSrNumber}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <span className="font-medium">{order.deliveryOrderNo || "N/A"}</span>
                            </TableCell>
                            <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                            <TableCell className="py-4 px-6">{order.productName}</TableCell>
                           
                            <TableCell className="py-4 px-6">{order.planned4}</TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge variant="outline" className="rounded-full">
                                {order.typeOfTransporting}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      } else {
                        return (
                          <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                            <TableCell className="py-4 px-6 whitespace-nowrap">
                              {order.billDate ? order.billDate.split(' ')[0] : "N/A"}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge className="bg-purple-500 text-white rounded-full">
                                {order.billNo}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <span className="font-medium">{order.deliveryOrderNo}</span>
                            </TableCell>
                            <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                            <TableCell className="py-4 px-6">{order.productName}</TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge variant="outline" className="rounded-full">
                                {order.logisticNo || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 px-6 font-medium">{order.quantityDelivered}</TableCell>
                            <TableCell className="py-4 px-6">
                              ₹{order.rateOfMaterial || "0"}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge className={`rounded-full ${
                                order.givingFromWhere === 'Production' ? 'bg-blue-500' : 'bg-green-500'
                              } text-white`}>
                                {order.givingFromWhere || "N/A"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      }
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {(activeTab === "pending" ? pendingOrders : historyOrders).length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No {activeTab === "pending" ? "pending" : "history"} orders found
                  </p>
                ) : (
                  (activeTab === "pending" ? pendingOrders : historyOrders).map((order) => {
                    if (activeTab === "pending") {
                      return (
                        <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-semibold text-gray-900">{order.partyName}</p>
                              <p className="text-xs text-gray-500">
                                DO: {order.deliveryOrderNo} | DS: {order.dSrNumber}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Planned: {order.planned4}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSales(order)}
                              className="bg-green-600 hover:bg-green-700"
                              disabled={submitting}
                            >
                              Sales
                            </Button>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Product:</span>
                              <span className="font-medium">{order.productName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transport:</span>
                              <Badge variant="outline" className="text-xs">
                                {order.typeOfTransporting}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transporter:</span>
                              <span className="text-right">{order.transporterName}</span>
                            </div>
                          </div>
                        </div>
                      )
                    } else {
                      return (
                        <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-purple-500 text-white text-xs">
                                  {order.billNo}
                                </Badge>
                                <Badge className={`text-xs ${
                                  order.givingFromWhere === 'Production' ? 'bg-blue-500' : 'bg-green-500'
                                } text-white`}>
                                  {order.givingFromWhere}
                                </Badge>
                              </div>
                              <p className="font-semibold text-gray-900">{order.partyName}</p>
                              <p className="text-xs text-gray-500">
                                DO: {order.deliveryOrderNo} | Bill Date: {order.billDate?.split(' ')[0]}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{order.quantityDelivered} units</p>
                              <p className="text-xs text-gray-500">
                                ₹{order.rateOfMaterial || "0"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Product:</span>
                              <span>{order.productName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">LGST No:</span>
                              <span>{order.logisticNo || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transport:</span>
                              <span>{order.typeOfTransporting}</span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  })
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Sales Delivery Form</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-6">
                {/* Order Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Order Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-500">Delivery Order No.</Label>
                      <p className="font-medium">{selectedOrder.deliveryOrderNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">D-Sr Number</Label>
                      <p className="font-medium">{selectedOrder.dSrNumber}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Party Name</Label>
                      <p className="font-medium">{selectedOrder.partyName}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Product Name</Label>
                      <p className="font-medium">{selectedOrder.productName}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">LGST Number</Label>
                      <p className="font-medium text-blue-600">{selectedOrder.lgstNumber || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Planned4 Date</Label>
                      <p className="font-medium">{selectedOrder.planned4}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Actual Truck Qty</Label>
                      <p className="font-medium">{selectedOrder.actualTruckQty || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Transporter</Label>
                      <p className="font-medium">{selectedOrder.transporterName || "N/A"}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-3">Sales Details *</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Bill Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-10 justify-start text-left font-normal",
                              !formData.billDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {formData.billDate ? format(new Date(formData.billDate), "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={new Date(formData.billDate)}
                            onSelect={(date) => 
                              setFormData(prev => ({ 
                                ...prev, 
                                billDate: format(date, "yyyy-MM-dd") 
                              }))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Quantity Delivered *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.quantityDelivered}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantityDelivered: e.target.value }))}
                        className="h-10"
                        placeholder="Enter quantity"
                        disabled={submitting}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Rate Of Material *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.rateOfMaterial}
                        onChange={(e) => setFormData(prev => ({ ...prev, rateOfMaterial: e.target.value }))}
                        className="h-10"
                        placeholder="Enter rate"
                        disabled={submitting}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Giving From Where *</Label>
                      <Select
                        value={formData.givingFromWhere}
                        onValueChange={(value) => {
                          setFormData(prev => ({ 
                            ...prev, 
                            givingFromWhere: value,
                            qty: value === "Production" ? "" : "0" // Reset if Production, set 0 for Purchase
                          }))
                        }}
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Production">Production</SelectItem>
                          <SelectItem value="Purchase">Purchase</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {formData.givingFromWhere === "Production" && (
                      <div className="space-y-2">
                        <Label className="text-sm">Quantity *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.qty}
                          onChange={(e) => setFormData(prev => ({ ...prev, qty: e.target.value }))}
                          className="h-10"
                          placeholder="Enter production quantity"
                          disabled={submitting}
                        />
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Bill No. *</Label>
                      <Input
                        value={formData.billNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, billNo: e.target.value }))}
                        className="h-10"
                        placeholder="Enter bill number"
                        disabled={submitting}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Logistic No.</Label>
                      <Input
                        value={formData.logisticNo}
                        className="h-10"
                        disabled
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Type of Transporting</Label>
                      <Input
                        value={formData.typeOfTransporting}
                        className="h-10"
                        disabled
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Transporter Name</Label>
                      <Input
                        value={formData.transporterName}
                        className="h-10"
                        disabled
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Vehicle Number</Label>
                      <Input
                        value={formData.vehicleNumber}
                        className="h-10"
                        disabled
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Bilty Number</Label>
                      <Input
                        value={formData.biltyNumber}
                        className="h-10"
                        disabled
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Indent No.</Label>
                      <Input
                        value={formData.indentNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, indentNo: e.target.value }))}
                        className="h-10"
                        placeholder="Enter indent number"
                        disabled={submitting}
                      />
                    </div>
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
                      className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                      disabled={
                        !formData.billDate ||
                        !formData.quantityDelivered ||
                        !formData.rateOfMaterial ||
                        !formData.givingFromWhere ||
                        !formData.billNo || // Bill No. is now required
                        (formData.givingFromWhere === "Production" && !formData.qty) ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Sales`
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-center">
        <Button 
          onClick={fetchData} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
          disabled={submitting}
        >
          <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>
    </div>
  )
}