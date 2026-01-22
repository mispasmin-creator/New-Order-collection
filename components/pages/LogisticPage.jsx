"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Search, Loader2, Upload } from "lucide-react"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"
const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-"

// Transportation type options
const TRANSPORT_TYPES = [
  "Ex Factory",
  "For",
  "Ex Factory but paid by us",
  "Direct supply dont submit the delay"
]

export default function LogisticPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [transporters, setTransporters] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    transporterName: "",
    truckNo: "",
    driverMobileNo: "",
    vehicleNoPlateImage: null,
    biltyNo: "",
    actualTruckQty: "",
    typeOfTransporting: "", // New field
    typeOfRate: "",
    transportRatePerTon: "",
    fixedAmount: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const dispatchResponse = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      if (dispatchResponse.ok) {
        const dispatchData = await dispatchResponse.json()
        
        if (dispatchData.success && dispatchData.data) {
          // Get all orders from DISPATCH sheet
          const allOrders = dispatchData.data
          
          // Get pending orders (where Planned1 has value but Actual1 is empty)
          const pendingOrders = getPendingOrders(allOrders)
          setOrders(pendingOrders)
          
          // Get history orders (where Actual1 has value)
          const historyOrders = getHistoryOrders(allOrders)
          setHistoryOrders(historyOrders)
        }
      }
      
      const masterResponse = await fetch(`${SCRIPT_URL}?sheet=MASTER`)
      if (masterResponse.ok) {
        const masterData = await masterResponse.json()
        if (masterData.success && masterData.data) {
          const transportersList = extractTransporters(masterData.data)
          setTransporters(transportersList)
        }
      }
      
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Function to extract pending orders
  const getPendingOrders = (sheetData) => {
    if (!sheetData || sheetData.length < 2) return []
    
    // Skip header row (index 0) and start from row 5 as per your requirement
    const PENDING_START_ROW = 6
    const PLANNED1_INDEX = 9
    const ACTUAL1_INDEX = 10
    const DSR_INDEX = 1
    const DELIVERY_ORDER_INDEX = 2
    const PARTY_NAME_INDEX = 3
    const PRODUCT_NAME_INDEX = 4
    const TRANSPORT_TYPE_INDEX = 6
    
    const pendingOrders = []
    
    // Start from row 5 (skip header and initial rows)
    for (let i = PENDING_START_ROW - 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      
      // Check if Planned1 has value and Actual1 is empty
      const planned1 = row[PLANNED1_INDEX]?.toString().trim()
      const actual1 = row[ACTUAL1_INDEX]?.toString().trim()
      
      if (planned1 && planned1 !== "" && (!actual1 || actual1 === "")) {
        pendingOrders.push({
          id: i,
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          dSrNumber: row[DSR_INDEX] || "",
          deliveryOrderNo: row[DELIVERY_ORDER_INDEX] || "",
          partyName: row[PARTY_NAME_INDEX] || "",
          productName: row[PRODUCT_NAME_INDEX] || "",
          transportTypeFromCRM: row[TRANSPORT_TYPE_INDEX] || "",
          planned1: planned1,
        })
      }
    }
    
    return pendingOrders
  }

  // Function to extract history orders
  const getHistoryOrders = (sheetData) => {
    if (!sheetData || sheetData.length < 2) return []
    
    // Fixed column indices based on your sheet structure
    const ACTUAL1_INDEX = 10
    const LGST_INDEX = 12
    const ACTUAL_TRUCK_QTY_INDEX = 13
    const TRANSPORTING_TYPE_INDEX = 14
    const TRANSPORTER_NAME_INDEX = 15
    const TRUCK_NO_INDEX = 16
    const DRIVER_MOBILE_INDEX = 17
    const VEHICLE_IMAGE_INDEX = 18
    const BILTY_NO_INDEX = 19
    const TYPE_OF_RATE_INDEX = 20
    const TRANSPORT_RATE_INDEX = 21
    const FIXED_AMOUNT_INDEX = 22
    const DSR_INDEX = 1
    const DELIVERY_ORDER_INDEX = 2
    const PARTY_NAME_INDEX = 3
    const PRODUCT_NAME_INDEX = 4
    const PLANNED1_INDEX = 9
    const DELAY1_INDEX = 11
    
    const historyOrders = []
    
    // Start from row 1 (skip header) to show all submitted data
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      
      const actual1 = row[ACTUAL1_INDEX]?.toString().trim()
      const lgstNumber = row[LGST_INDEX]?.toString().trim()
      
      // Show ALL submitted data - if Actual1 has value
      if (actual1 && actual1 !== "") {
        const vehicleImageUrl = row[VEHICLE_IMAGE_INDEX]?.toString().trim()
        
        historyOrders.push({
          id: i,
          rowIndex: i + 1,
          dSrNumber: row[DSR_INDEX] || "",
          deliveryOrderNo: row[DELIVERY_ORDER_INDEX] || "",
          partyName: row[PARTY_NAME_INDEX] || "",
          productName: row[PRODUCT_NAME_INDEX] || "",
          planned1: row[PLANNED1_INDEX] || "", // Added planned1 for reference
          actual1: actual1,
          delay1: row[DELAY1_INDEX] || "", // Added delay for reference
          lgstSrNumber: lgstNumber || `LGST-${String(i + 1).padStart(3, '0')}`, // Generate if missing
          actualTruckQty: row[ACTUAL_TRUCK_QTY_INDEX] || "",
          typeOfTransporting: row[TRANSPORTING_TYPE_INDEX] || "",
          transporterName: row[TRANSPORTER_NAME_INDEX] || "",
          truckNo: row[TRUCK_NO_INDEX] || "",
          driverMobileNo: row[DRIVER_MOBILE_INDEX] || "",
          vehicleImageUrl: vehicleImageUrl,
          hasImage: vehicleImageUrl && vehicleImageUrl.includes("drive.google.com"),
          biltyNo: row[BILTY_NO_INDEX] || "",
          typeOfRate: row[TYPE_OF_RATE_INDEX] || "",
          transportRatePerTon: row[TRANSPORT_RATE_INDEX] || "",
          fixedAmount: row[FIXED_AMOUNT_INDEX] || "",
        })
      }
    }
    
    return historyOrders
  }

  const extractTransporters = (sheetData) => {
    if (!sheetData) return []
    
    const transporters = []
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (row) {
        for (let j = 0; j < row.length; j++) {
          const cell = row[j]
          if (cell && typeof cell === 'string' && 
              cell.toLowerCase().includes('transporter') && 
              !cell.toLowerCase().includes('type')) {
            transporters.push(cell.trim())
          }
        }
      }
    }
    
    return [...new Set(transporters.filter(t => t && t.trim() !== ''))]
  }

  const generateLGSTNumber = () => {
    if (historyOrders.length === 0) return "LGST-001"
    
    const lgstNumbers = historyOrders
      .map(order => order.lgstSrNumber)
      .filter(lgst => lgst && lgst.match(/^LGST-\d+$/i))
    
    if (lgstNumbers.length === 0) return "LGST-001"
    
    let maxNumber = 0
    lgstNumbers.forEach(lgst => {
      const match = lgst.match(/LGST-(\d+)/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num
        }
      }
    })
    
    return `LGST-${String(maxNumber + 1).padStart(3, '0')}`
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

  const handleLogistic = (order) => {
    setSelectedOrder(order)
    setFormData({
      transporterName: "",
      truckNo: "",
      driverMobileNo: "",
      vehicleNoPlateImage: null,
      biltyNo: "",
      actualTruckQty: "",
      typeOfTransporting: "", // Reset to empty
      typeOfRate: "",
      transportRatePerTon: "",
      fixedAmount: "",
    })
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)
      
      const lgstNumber = generateLGSTNumber()
      const now = new Date()
      
      // Format date for Actual1 (DD/MM/YYYY)
      const actualDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
      
      let vehicleImageUrl = ""
      
      // Upload image if selected
      if (formData.vehicleNoPlateImage) {
        try {
          const base64Data = await fileToBase64(formData.vehicleNoPlateImage)
          
          const formDataToSend = new FormData()
          formDataToSend.append('action', 'uploadFile')
          formDataToSend.append('base64Data', base64Data)
          formDataToSend.append('fileName', `vehicle_plate_${lgstNumber}_${Date.now()}.${formData.vehicleNoPlateImage.name.split('.').pop()}`)
          formDataToSend.append('mimeType', formData.vehicleNoPlateImage.type)
          formDataToSend.append('folderId', FOLDER_ID)
          
          const uploadResponse = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: formDataToSend,
          })
          
          const uploadResult = await uploadResponse.json()
          
          if (uploadResult.success && uploadResult.fileUrl) {
            vehicleImageUrl = uploadResult.fileUrl
          }
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError)
        }
      }
      
      // Get current row data first
      const response = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      if (!response.ok) throw new Error("Failed to fetch sheet data")
      
      const result = await response.json()
      if (!result.success || !result.data) throw new Error("Failed to get sheet data")
      
      // Get the current row
      const currentRow = result.data[selectedOrder.rowIndex - 1] || []
      
      // Create updated row data (all 35 columns based on your sheet)
      const updatedRow = [...currentRow]
      
      // Ensure we have enough columns
      while (updatedRow.length < 35) updatedRow.push("")
      
      // DON'T update Planned1 - keep as is
      // Updated structure:
      // Column 10: Actual1
      // Column 11: Delay1 (always "0" except for direct supply)
      // Column 12: LGST Number
      
      // Set Actual1 to current date
      updatedRow[10] = actualDate // Actual1 (index 10)
      
      // Set Delay1 based on transport type
      if (formData.typeOfTransporting === "Direct supply dont submit the delay") {
        updatedRow[11] = "" // Leave empty for direct supply
      } else {
        updatedRow[11] = "0" // Delay1 (index 11) - always "0" for other types
      }
      
      // Set LGST number
      updatedRow[12] = lgstNumber // LGST-Sr Number (index 12)
      
      // Set other logistic details
      updatedRow[13] = formData.actualTruckQty || "" // Actual Truck Qty (index 13)
      updatedRow[14] = formData.typeOfTransporting || "" // Type of Transporting (index 14)
      updatedRow[15] = formData.transporterName || "" // Transporter Name (index 15)
      updatedRow[16] = formData.truckNo || "" // Truck No. (index 16)
      updatedRow[17] = formData.driverMobileNo || "" // Driver Mobile No. (index 17)
      updatedRow[18] = vehicleImageUrl || "" // Vehicle No. Plate Image (index 18)
      updatedRow[19] = formData.biltyNo || "" // Bilty No. (index 19)
      updatedRow[20] = formData.typeOfRate || "" // Type Of Rate (index 20)
      
      // Set rate based on type
      if (formData.typeOfRate === "Per Matric Ton rate") {
        updatedRow[21] = formData.transportRatePerTon || "" // Transport Rate (index 21)
        updatedRow[22] = "" // Fixed Amount (index 22)
      } else if (formData.typeOfRate === "Fixed Amount") {
        updatedRow[21] = "" // Transport Rate (index 21)
        updatedRow[22] = formData.fixedAmount || "" // Fixed Amount (index 22)
      } else if (formData.typeOfRate === "Ex Factory Transporter") {
        updatedRow[21] = "0" // Transport Rate (index 21)
        updatedRow[22] = "0" // Fixed Amount (index 22)
      }

      // Update the row using existing 'update' action
      const updateResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'update',
          sheetName: 'DISPATCH',
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
          transporterName: "",
          truckNo: "",
          driverMobileNo: "",
          vehicleNoPlateImage: null,
          biltyNo: "",
          actualTruckQty: "",
          typeOfTransporting: "",
          typeOfRate: "",
          transportRatePerTon: "",
          fixedAmount: "",
        })
        
        alert(`✓ Logistic details submitted successfully!\nLGST Number: ${lgstNumber}`)
      } else {
        throw new Error(updateResult.error || "Update failed")
      }
      
    } catch (error) {
      console.error("Error submitting:", error)
      alert(`✗ Failed to submit: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      transporterName: "",
      truckNo: "",
      driverMobileNo: "",
      vehicleNoPlateImage: null,
      biltyNo: "",
      actualTruckQty: "",
      typeOfTransporting: "",
      typeOfRate: "",
      transportRatePerTon: "",
      fixedAmount: "",
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading logistic data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Logistic</h1>
        <p className="text-sm text-gray-600 mt-1">Manage logistics</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Logistic Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Pending: {orders.length} | History: {historyOrders.length}
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
                History ({historyOrders.length})
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
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">LGST-Sr No</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Delay</TableHead>
                      </>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">D-Sr Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual Truck Qty</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Transport Type</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Transporter</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Truck No</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Driver Mobile</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Type of Rate</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Rate/Amount</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 6 : 15} 
                        className="text-center py-8 text-gray-500"
                      >
                        No {activeTab === "pending" ? "pending" : "history"} orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <Button
                              size="sm"
                              onClick={() => handleLogistic(order)}
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={submitting}
                            >
                              Handle
                            </Button>
                          </TableCell>
                        )}
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6 font-medium text-blue-600">
                              {order.lgstSrNumber}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {order.planned1}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {order.actual1}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {order.delay1 || "0"}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="py-4 px-6 font-medium">
                          {order.dSrNumber}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {order.deliveryOrderNo}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {order.partyName}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {order.productName}
                        </TableCell>
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6">{order.actualTruckQty}</TableCell>
                            <TableCell className="py-4 px-6">{order.typeOfTransporting}</TableCell>
                            <TableCell className="py-4 px-6">{order.transporterName}</TableCell>
                            <TableCell className="py-4 px-6">{order.truckNo}</TableCell>
                            <TableCell className="py-4 px-6">{order.driverMobileNo}</TableCell>
                            <TableCell className="py-4 px-6">{order.typeOfRate}</TableCell>
                            <TableCell className="py-4 px-6">
                              {order.typeOfRate === "Per Matric Ton rate" 
                                ? `${order.transportRatePerTon} per ton`
                                : order.typeOfRate === "Fixed Amount"
                                ? `${order.fixedAmount} fixed`
                                : "Ex Factory"}
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
                    No {activeTab === "pending" ? "pending" : "history"} orders found
                  </p>
                ) : (
                  displayOrders.map((order) => (
                    <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          {activeTab === "history" && (
                            <p className="text-blue-600 font-medium text-sm mb-1">
                              {order.lgstSrNumber}
                            </p>
                          )}
                          <p className="font-semibold text-gray-900">{order.partyName}</p>
                          <p className="text-xs text-gray-500">
                            DO: {order.deliveryOrderNo} | DS: {order.dSrNumber}
                          </p>
                          {activeTab === "history" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Planned: {order.planned1} | Actual: {order.actual1}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {activeTab === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => handleLogistic(order)}
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={submitting}
                            >
                              Handle
                            </Button>
                          ) : (
                            <p className="text-sm font-medium">{order.actualTruckQty} units</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Product:</span>
                          <span>{order.productName}</span>
                        </div>
                        {activeTab === "history" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Delay:</span>
                              <span>{order.delay1 || "0"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transport Type:</span>
                              <span>{order.typeOfTransporting}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transporter:</span>
                              <span>{order.transporterName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Truck No:</span>
                              <span>{order.truckNo}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Driver Mobile:</span>
                              <span>{order.driverMobileNo}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Rate Type:</span>
                              <span>{order.typeOfRate}</span>
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

      {/* Simplified Logistic Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Logistic Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Minimal Order Info */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{selectedOrder.partyName}</p>
                  <p className="text-sm text-gray-600">
                    DO: {selectedOrder.deliveryOrderNo} | DS: {selectedOrder.dSrNumber}
                  </p>
                  <p className="text-sm text-gray-600">Product: {selectedOrder.productName}</p>
                  <p className="text-sm text-blue-600 font-medium mt-1">
                    LGST Number: {generateLGSTNumber()}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Planned Date: {selectedOrder.planned1}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Type of Transporting *</Label>
                    <Select
                      value={formData.typeOfTransporting}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        typeOfTransporting: value 
                      }))}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Transport Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSPORT_TYPES.map((type, index) => (
                          <SelectItem key={index} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      {formData.typeOfTransporting === "Direct supply dont submit the delay" 
                        ? "Delay will not be submitted"
                        : "Delay will be set to '0'"}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Actual Truck Qty *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.actualTruckQty}
                      onChange={(e) => setFormData(prev => ({ ...prev, actualTruckQty: e.target.value }))}
                      className="h-10"
                      placeholder="Enter quantity"
                      disabled={submitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Transporter Name *</Label>
                    <Select
                      value={formData.transporterName}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, transporterName: value }))}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Transporter" />
                      </SelectTrigger>
                      <SelectContent>
                        {transporters.length > 0 ? (
                          transporters.map((transporter, index) => (
                            <SelectItem key={index} value={transporter}>
                              {transporter}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="Owned Truck">Owned Truck</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Truck No. *</Label>
                    <Input
                      value={formData.truckNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, truckNo: e.target.value }))}
                      className="h-10"
                      placeholder="Enter truck number"
                      disabled={submitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Driver Mobile No. *</Label>
                    <Input
                      type="tel"
                      value={formData.driverMobileNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, driverMobileNo: e.target.value }))}
                      className="h-10"
                      placeholder="Enter driver mobile"
                      disabled={submitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Type Of Rate *</Label>
                    <Select
                      value={formData.typeOfRate}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        typeOfRate: value,
                        transportRatePerTon: value === "Ex Factory Transporter" ? "0" : "",
                        fixedAmount: value === "Ex Factory Transporter" ? "0" : ""
                      }))}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Rate Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                        <SelectItem value="Per Matric Ton rate">Per Matric Ton rate</SelectItem>
                        <SelectItem value="Ex Factory Transporter">Ex Factory Transporter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.typeOfRate === "Per Matric Ton rate" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Transport Rate @Per Matric Ton *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.transportRatePerTon}
                        onChange={(e) => setFormData(prev => ({ ...prev, transportRatePerTon: e.target.value }))}
                        className="h-10"
                        placeholder="Enter rate per ton"
                        disabled={submitting}
                      />
                    </div>
                  )}
                  
                  {formData.typeOfRate === "Fixed Amount" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Fixed Amount *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.fixedAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, fixedAmount: e.target.value }))}
                        className="h-10"
                        placeholder="Enter fixed amount"
                        disabled={submitting}
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Vehicle Plate Image</Label>
                    <Input
                      type="file"
                      accept="image/*"
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
                            vehicleNoPlateImage: file 
                          }))
                        }
                      }}
                      className="h-10"
                      disabled={submitting}
                    />
                    {formData.vehicleNoPlateImage && (
                      <p className="text-sm text-green-600">
                        ✓ {formData.vehicleNoPlateImage.name}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Bilty No.</Label>
                    <Input
                      value={formData.biltyNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, biltyNo: e.target.value }))}
                      className="h-10"
                      placeholder="Enter bilty number"
                      disabled={submitting}
                    />
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
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={
                        !formData.typeOfTransporting ||
                        !formData.actualTruckQty ||
                        !formData.transporterName ||
                        !formData.truckNo ||
                        !formData.driverMobileNo ||
                        !formData.typeOfRate ||
                        (formData.typeOfRate === "Per Matric Ton rate" && !formData.transportRatePerTon) ||
                        (formData.typeOfRate === "Fixed Amount" && !formData.fixedAmount) ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Logistic`
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