"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, Upload } from "lucide-react"
import { format } from "date-fns"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"
const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-"

export default function BiltyEntryPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    biltyCopy: null,
    biltyNo: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const deliveryResponse = await fetch(`${SCRIPT_URL}?sheet=DELIVERY`)
      if (deliveryResponse.ok) {
        const deliveryData = await deliveryResponse.json()
        
        if (deliveryData.success && deliveryData.data) {
          const pendingOrders = getPendingOrders(deliveryData.data)
          setOrders(pendingOrders)
          
          const historyOrders = getHistoryOrders(deliveryData.data)
          setHistoryOrders(historyOrders)
          
          console.log("Pending orders:", pendingOrders.length, "History orders:", historyOrders.length)
        }
      }
      
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Get pending orders from DELIVERY sheet where Planned3 has value but Actual3 is empty
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
      planned1: headers.findIndex(h => h.toLowerCase().includes("planned 1")),
      actual1: headers.findIndex(h => h.toLowerCase().includes("actual 1")),
      planned2: headers.findIndex(h => h.toLowerCase().includes("planned 2")),
      actual2: headers.findIndex(h => h.toLowerCase().includes("actual 2")),
      planned3: headers.findIndex(h => h.toLowerCase().includes("planned 3")),
      actual3: headers.findIndex(h => h.toLowerCase().includes("actual3")),
      delay3: headers.findIndex(h => h.toLowerCase().includes("delay3")),
      biltyCopy: headers.findIndex(h => h.toLowerCase().includes("bilty copy")),
      biltyNo: headers.findIndex(h => h.toLowerCase().includes("bilty no.")),
    }
    
    console.log("DELIVERY Column indices for Planned3:", indices)
    
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
      
      const planned3 = getVal(indices.planned3)
      const actual3 = getVal(indices.actual3)
      const billNo = getVal(indices.billNo)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      
      // Check if Planned3 has value, Actual3 is empty, and there's a Bill No
      if (planned3 && planned3 !== "" && (!actual3 || actual3 === "") && billNo && billNo !== "") {
        const order = {
          id: i,
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          timestamp: getVal(indices.timestamp),
          billDate: getVal(indices.billDate),
          deliveryOrderNo: deliveryOrderNo,
          partyName: getVal(indices.partyName),
          productName: getVal(indices.productName),
          quantityDelivered: getVal(indices.quantityDelivered),
          billNo: billNo,
          logisticNo: getVal(indices.logisticNo),
          rateOfMaterial: getVal(indices.rateOfMaterial),
          typeOfTransporting: getVal(indices.typeOfTransporting),
          transporterName: getVal(indices.transporterName),
          vehicleNumber: getVal(indices.vehicleNumber),
          biltyNumber: getVal(indices.biltyNumber),
          givingFromWhere: getVal(indices.givingFromWhere),
          planned1: getVal(indices.planned1),
          actual1: getVal(indices.actual1),
          planned2: getVal(indices.planned2),
          actual2: getVal(indices.actual2),
          planned3: planned3,
          actual3: actual3,
          delay3: getVal(indices.delay3),
          hasBiltyCopy: getVal(indices.biltyCopy) !== "",
          existingBiltyNo: getVal(indices.biltyNo),
        }
        
        pendingOrders.push(order)
      }
    }
    
    console.log("Total pending orders for bilty entry found:", pendingOrders.length)
    return pendingOrders
  }

  // Get history orders from DELIVERY sheet where Actual3 has value
  const getHistoryOrders = (sheetData) => {
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
      planned1: headers.findIndex(h => h.toLowerCase().includes("planned 1")),
      actual1: headers.findIndex(h => h.toLowerCase().includes("actual 1")),
      planned2: headers.findIndex(h => h.toLowerCase().includes("planned 2")),
      actual2: headers.findIndex(h => h.toLowerCase().includes("actual 2")),
      planned3: headers.findIndex(h => h.toLowerCase().includes("planned 3")),
      actual3: headers.findIndex(h => h.toLowerCase().includes("actual3")),
      delay3: headers.findIndex(h => h.toLowerCase().includes("delay3")),
      biltyCopy: headers.findIndex(h => h.toLowerCase().includes("bilty copy")),
      biltyNo: headers.findIndex(h => h.toLowerCase().includes("bilty no.")),
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
      
      const actual3 = getVal(indices.actual3)
      const billNo = getVal(indices.billNo)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      
      // Check if Actual3 has value (bilty entry completed) and there's a Bill No
      if (actual3 && actual3 !== "" && billNo && billNo !== "") {
        const biltyCopyUrl = getVal(indices.biltyCopy)
        const biltyNo = getVal(indices.biltyNo)
        
        const historyOrder = {
          id: i,
          timestamp: getVal(indices.timestamp),
          billDate: getVal(indices.billDate),
          deliveryOrderNo: deliveryOrderNo,
          partyName: getVal(indices.partyName),
          productName: getVal(indices.productName),
          quantityDelivered: getVal(indices.quantityDelivered),
          billNo: billNo,
          logisticNo: getVal(indices.logisticNo),
          rateOfMaterial: getVal(indices.rateOfMaterial),
          typeOfTransporting: getVal(indices.typeOfTransporting),
          transporterName: getVal(indices.transporterName),
          vehicleNumber: getVal(indices.vehicleNumber),
          biltyNumber: getVal(indices.biltyNumber),
          givingFromWhere: getVal(indices.givingFromWhere),
          planned3: getVal(indices.planned3),
          actual3: actual3,
          delay3: getVal(indices.delay3),
          biltyCopy: biltyCopyUrl,
          biltyNo: biltyNo,
          hasBiltyCopy: biltyCopyUrl && biltyCopyUrl.includes("drive.google.com"),
        }
        
        historyOrders.push(historyOrder)
      }
    }
    
    console.log("Total history bilty entries found:", historyOrders.length)
    return historyOrders
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

  const handleBiltyEntry = (order) => {
    setSelectedOrder(order)
    setFormData({
      biltyCopy: null,
      biltyNo: order.existingBiltyNo || "",
    })
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)
      
      const now = new Date()
      const actual3Date = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} 18:00:00`
      
      let biltyCopyUrl = ""
      
      // Upload bilty copy if provided
      if (formData.biltyCopy) {
        try {
          const base64Data = await fileToBase64(formData.biltyCopy)
          
          const formDataToSend = new FormData()
          formDataToSend.append('action', 'uploadFile')
          formDataToSend.append('base64Data', base64Data)
          formDataToSend.append('fileName', `bilty_copy_${selectedOrder.billNo}_${Date.now()}.${formData.biltyCopy.name.split('.').pop()}`)
          formDataToSend.append('mimeType', formData.biltyCopy.type)
          formDataToSend.append('folderId', FOLDER_ID)
          
          const uploadResponse = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: formDataToSend,
          })
          
          const uploadResult = await uploadResponse.json()
          
          if (uploadResult.success && uploadResult.fileUrl) {
            biltyCopyUrl = uploadResult.fileUrl
          }
        } catch (uploadError) {
          console.error("Error uploading bilty copy:", uploadError)
        }
      }
      
      // Get current row data from DELIVERY sheet
      const response = await fetch(`${SCRIPT_URL}?sheet=DELIVERY`)
      if (!response.ok) throw new Error("Failed to fetch sheet data")
      
      const result = await response.json()
      if (!result.success || !result.data) throw new Error("Failed to get sheet data")
      
      // Get the current row
      const currentRow = result.data[selectedOrder.rowIndex - 1] || []
      
      // Create updated row data (40 columns based on your DELIVERY sheet structure)
      const updatedRow = [...currentRow]
      
      // Ensure we have enough columns
      while (updatedRow.length < 40) updatedRow.push("")
      
      // Update bilty entry columns
      // Column 29: Planned 3 (index 28) - keep as is (we don't submit planned date)
      // Column 30: Actual3 (index 29)
      updatedRow[29] = actual3Date
      
      // Column 31: Delay3 (index 30) - leave as is or calculate if needed
      // Column 32: Bilty Copy (index 31)
      const existingBiltyCopy = updatedRow[31]?.toString().trim()
      updatedRow[31] = biltyCopyUrl || existingBiltyCopy || ""
      
      // Column 33: Bilty No. (index 32)
      updatedRow[32] = formData.biltyNo || ""

      // Update the row in DELIVERY sheet
      const updateResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'update',
          sheetName: 'DELIVERY',
          rowIndex: selectedOrder.rowIndex.toString(),
          rowData: JSON.stringify(updatedRow)
        })
      })
      
      if (!updateResponse.ok) throw new Error(`Update failed: ${updateResponse.status}`)
      
      const updateResult = await updateResponse.json()
      
      if (updateResult.success) {
        await fetchData()
        setSelectedOrder(null)
        setFormData({
          biltyCopy: null,
          biltyNo: "",
        })
        
        alert(`✓ Bilty entry submitted successfully!\nActual3 Date: ${actual3Date.split(' ')[0]}`)
      } else {
        throw new Error(updateResult.error || "Update failed")
      }
      
    } catch (error) {
      console.error("Error submitting bilty entry:", error)
      alert(`✗ Failed to submit: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      biltyCopy: null,
      biltyNo: "",
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading bilty entry data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Bilty Entry</h1>
        <p className="text-sm text-gray-600 mt-1">Manage bilty documentation entries</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Bilty Entry Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Pending: {orders.length} | Completed: {historyOrders.length}
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
                Completed ({historyOrders.length})
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

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                    {activeTab === "pending" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    {activeTab === "pending" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned3 Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Transporter</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Vehicle No.</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Existing Bilty No.</TableHead>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual3 Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Bilty No.</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Bilty Copy</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 11 : 9} 
                        className="text-center py-8 text-gray-500"
                      >
                        No {activeTab === "pending" ? "pending" : "completed"} bilty entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <Button
                              size="sm"
                              onClick={() => handleBiltyEntry(order)}
                              className="bg-orange-600 hover:bg-orange-700"
                              disabled={submitting}
                            >
                              Bilty Entry
                            </Button>
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-green-500 text-white rounded-full">
                            {order.billNo}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {order.billDate ? order.billDate.split(' ')[0] : "N/A"}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className="font-medium">{order.deliveryOrderNo}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="max-w-[200px]">
                            <span className="break-words">{order.productName}</span>
                          </div>
                        </TableCell>
                        {activeTab === "pending" && (
                          <>
                            <TableCell className="py-4 px-6">{order.planned3 || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">{order.transporterName || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">{order.vehicleNumber || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">
                              {order.biltyNumber ? (
                                <Badge variant="outline" className="text-xs">
                                  {order.biltyNumber}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-sm">N/A</span>
                              )}
                            </TableCell>
                          </>
                        )}
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6">{order.actual3 ? order.actual3.split(' ')[0] : "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">
                              {order.biltyNo ? (
                                <Badge className="bg-blue-500 text-white text-xs">
                                  {order.biltyNo}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-sm">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {order.hasBiltyCopy ? (
                                <Badge className="bg-green-500 text-white text-xs">Uploaded</Badge>
                              ) : (
                                <span className="text-gray-400 text-xs">No copy</span>
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {displayOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No {activeTab === "pending" ? "pending" : "completed"} bilty entries found
                  </p>
                ) : (
                  displayOrders.map((order) => (
                    <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          {activeTab === "history" && (
                            <p className="text-green-600 font-medium text-sm mb-1">
                              Actual3: {order.actual3 ? order.actual3.split(' ')[0] : "N/A"}
                            </p>
                          )}
                          <p className="font-semibold text-gray-900">{order.partyName}</p>
                          <p className="text-xs text-gray-500">
                            Bill: {order.billNo} | DO: {order.deliveryOrderNo}
                          </p>
                          {activeTab === "pending" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Planned3: {order.planned3 || "N/A"}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {activeTab === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => handleBiltyEntry(order)}
                              className="bg-orange-600 hover:bg-orange-700"
                              disabled={submitting}
                            >
                              Bilty
                            </Button>
                          ) : (
                            <div className="flex flex-col items-end">
                              {order.biltyNo && (
                                <Badge className="bg-blue-500 text-white text-xs mb-1">
                                  {order.biltyNo}
                                </Badge>
                              )}
                              {order.hasBiltyCopy && (
                                <Badge className="bg-green-500 text-white text-xs">
                                  Copy
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Product:</span>
                          <span>{order.productName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bill Date:</span>
                          <span>{order.billDate ? order.billDate.split(' ')[0] : "N/A"}</span>
                        </div>
                        {activeTab === "pending" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transporter:</span>
                              <span>{order.transporterName || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Vehicle No:</span>
                              <span>{order.vehicleNumber || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Existing Bilty:</span>
                              <span>{order.biltyNumber || "N/A"}</span>
                            </div>
                          </>
                        )}
                        {activeTab === "history" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Planned3:</span>
                              <span>{order.planned3 || "N/A"}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bilty Entry Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Bilty Entry Form</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{selectedOrder.partyName}</p>
                  <p className="text-sm text-gray-600">
                    Bill: {selectedOrder.billNo} | DO: {selectedOrder.deliveryOrderNo}
                  </p>
                  <p className="text-sm text-gray-600">Product: {selectedOrder.productName}</p>
                  <p className="text-sm text-gray-600">
                    Planned3: {selectedOrder.planned3}
                  </p>
                  <p className="text-sm text-green-600 font-medium mt-1">
                    Actual3 will be set to: {format(new Date(), "dd/MM/yyyy")}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Bilty No. *</Label>
                    <Input
                      value={formData.biltyNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, biltyNo: e.target.value }))}
                      className="h-10"
                      placeholder="Enter bilty number"
                      disabled={submitting}
                    />
                    <p className="text-xs text-gray-500">
                      {selectedOrder.biltyNumber && 
                        `Existing bilty number from previous entry: ${selectedOrder.biltyNumber}`}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Bilty Copy</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files[0]
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              alert("File size should be less than 5MB")
                              e.target.value = ""
                              return
                            }
                            setFormData(prev => ({ 
                              ...prev, 
                              biltyCopy: file 
                            }))
                          }
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.biltyCopy && (
                        <span className="text-sm text-green-600 truncate">
                          ✓ {formData.biltyCopy.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Accepts image or PDF files (max 5MB)</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex flex-col gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleCancel} 
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      className="bg-orange-600 hover:bg-orange-700"
                      disabled={
                        !formData.biltyNo ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Bilty Entry`
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