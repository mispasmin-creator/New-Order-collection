"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Search, Loader2 } from "lucide-react"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"
const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-"

// Transportation type options
const TRANSPORT_TYPES = [
  "Ex Factory",
  "For",
  "Ex Factory but paid by us",
  "Direct supply dont submit the delay"
]

// Column indices based on your DISPATCH sheet structure
const COLUMN_INDICES = {
  TIMESTAMP: 0,
  DSR_NUMBER: 1,
  DELIVERY_ORDER_NO: 2,
  PARTY_NAME: 3,
  PRODUCT_NAME: 4,
  QTY_TO_BE_DISPATCHED: 5,
  TYPE_OF_TRANSPORTING: 6,
  DATE_OF_DISPATCH: 7,
  TO_BE_RECONFIRM: 8,
  PLANNED1: 9,
  ACTUAL1: 10,
  DELAY1: 11,
  LGST_NUMBER: 12,
  ACTUAL_TRUCK_QTY: 13,
  TYPE_OF_TRANSPORTING_LOGISTIC: 14,
  TRANSPORTER_NAME: 15,
  TRUCK_NO: 16,
  DRIVER_MOBILE: 17,
  VEHICLE_IMAGE: 18,
  BILTY_NO: 19,
  TYPE_OF_RATE: 20,
  TRANSPORT_RATE: 21,
  FIXED_AMOUNT: 22
}

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
    typeOfTransporting: "",
    typeOfRate: "",
    transportRatePerTon: "",
    fixedAmount: "",
  })

  // Memoized transporter list
  const transporterOptions = useMemo(() => {
    return transporters.length > 0 
      ? transporters 
      : ["Owned Truck", "External Transporter"]
  }, [transporters])

  // Fetch data with error handling and caching
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch DISPATCH sheet data
      const dispatchResponse = await fetch(`${SCRIPT_URL}?sheet=DISPATCH&cache=${Date.now()}`)
      if (dispatchResponse.ok) {
        const dispatchData = await dispatchResponse.json()
        
        if (dispatchData.success && dispatchData.data) {
          const allOrders = dispatchData.data
          
          // Skip header rows - start from row 6 (0-indexed)
          const pendingOrders = getPendingOrders(allOrders)
          setOrders(pendingOrders)
          
          const historyOrders = getHistoryOrders(allOrders)
          setHistoryOrders(historyOrders)
        }
      }
      
      // Fetch transporters from MASTER sheet
      const masterResponse = await fetch(`${SCRIPT_URL}?sheet=MASTER&cache=${Date.now()}`)
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
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Extract transporters from MASTER sheet
  const extractTransporters = useCallback((sheetData) => {
    if (!sheetData) return []
    
    const transportersSet = new Set()
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (row) {
        for (let j = 0; j < row.length; j++) {
          const cell = row[j]
          if (cell && typeof cell === 'string' && 
              cell.toLowerCase().includes('transporter') && 
              !cell.toLowerCase().includes('type')) {
            transportersSet.add(cell.trim())
          }
        }
      }
    }
    
    return Array.from(transportersSet).filter(t => t && t.trim() !== '')
  }, [])

  // Get pending orders (Planned1 has value, Actual1 is empty)
  const getPendingOrders = useCallback((sheetData) => {
    if (!sheetData || sheetData.length < 7) return [] // Skip first 6 rows
    
    const pendingOrders = []
    
    // Start from row 6 (index 5) to skip header rows
    for (let i = 6; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const planned1 = row[COLUMN_INDICES.PLANNED1]?.toString().trim()
      const actual1 = row[COLUMN_INDICES.ACTUAL1]?.toString().trim()
      
      // Check if Planned1 has value and Actual1 is empty
const dSr = row[COLUMN_INDICES.DSR_NUMBER]?.toString().toLowerCase()

if (
  planned1 &&
  planned1 !== "" &&
  (!actual1 || actual1 === "") &&
  dSr &&
  !dSr.includes("d-sr") &&       // skip header row
  !dSr.includes("number")        // skip header row
) {
        pendingOrders.push({
          id: i,
          rowIndex: i + 1,
          dSrNumber: row[COLUMN_INDICES.DSR_NUMBER] || "",
          deliveryOrderNo: row[COLUMN_INDICES.DELIVERY_ORDER_NO] || "",
          partyName: row[COLUMN_INDICES.PARTY_NAME] || "",
          productName: row[COLUMN_INDICES.PRODUCT_NAME] || "",
          qtyToBeDispatched: row[COLUMN_INDICES.QTY_TO_BE_DISPATCHED] || "",
          typeOfTransporting: row[COLUMN_INDICES.TYPE_OF_TRANSPORTING] || "",
          dateOfDispatch: row[COLUMN_INDICES.DATE_OF_DISPATCH] || "",
          planned1: planned1,
        })
      }
    }
    
    return pendingOrders
  }, [])

  // Get history orders (Actual1 has value)
  const getHistoryOrders = useCallback((sheetData) => {
    if (!sheetData || sheetData.length < 7) return []
    
    const historyOrders = []
    
    // Start from row 6 (index 5) to skip header rows
    for (let i = 7; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const actual1 = row[COLUMN_INDICES.ACTUAL1]?.toString().trim()
      
      // Show only rows where Actual1 has value
      if (actual1 && actual1 !== "") {
        const lgstNumber = row[COLUMN_INDICES.LGST_NUMBER]?.toString().trim()
        
        historyOrders.push({
          id: i,
          rowIndex: i + 1,
          dSrNumber: row[COLUMN_INDICES.DSR_NUMBER] || "",
          deliveryOrderNo: row[COLUMN_INDICES.DELIVERY_ORDER_NO] || "",
          partyName: row[COLUMN_INDICES.PARTY_NAME] || "",
          productName: row[COLUMN_INDICES.PRODUCT_NAME] || "",
          lgstSrNumber: lgstNumber || `LGST-${String(i + 1).padStart(3, '0')}`,
          actual1: actual1,
          actualTruckQty: row[COLUMN_INDICES.ACTUAL_TRUCK_QTY] || "",
          typeOfTransporting: row[COLUMN_INDICES.TYPE_OF_TRANSPORTING_LOGISTIC] || "",
          transporterName: row[COLUMN_INDICES.TRANSPORTER_NAME] || "",
          truckNo: row[COLUMN_INDICES.TRUCK_NO] || "",
          driverMobileNo: row[COLUMN_INDICES.DRIVER_MOBILE] || "",
          typeOfRate: row[COLUMN_INDICES.TYPE_OF_RATE] || "",
          transportRatePerTon: row[COLUMN_INDICES.TRANSPORT_RATE] || "",
          fixedAmount: row[COLUMN_INDICES.FIXED_AMOUNT] || "",
        })
      }
    }
    
    return historyOrders
  }, [])

  // Generate LGST number
  const generateLGSTNumber = useCallback(() => {
    if (historyOrders.length === 0) return "LGST-001"
    
    let maxNumber = 0
    for (const order of historyOrders) {
      if (order.lgstSrNumber) {
        const match = order.lgstSrNumber.match(/LGST-(\d+)/i)
        if (match) {
          const num = parseInt(match[1], 10)
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num
          }
        }
      }
    }
    
    return `LGST-${String(maxNumber + 1).padStart(3, '0')}`
  }, [historyOrders])

  // Filter orders based on search term
  const searchFilteredOrders = useCallback((ordersList) => {
    if (!searchTerm.trim()) return ordersList
    
    const term = searchTerm.toLowerCase()
    return ordersList.filter((order) => {
      return Object.values(order).some((value) => 
        value?.toString().toLowerCase().includes(term)
      )
    })
  }, [searchTerm])

  // Memoized display orders
  const displayOrders = useMemo(() => {
    const ordersList = activeTab === "pending" ? orders : historyOrders
    return searchFilteredOrders(ordersList)
  }, [activeTab, orders, historyOrders, searchFilteredOrders])

  const handleLogistic = useCallback((order) => {
    setSelectedOrder(order)
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
  }, [])

  // File to Base64 conversion
  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)
      
      const lgstNumber = generateLGSTNumber()
      const now = new Date()
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
      
      // Get current row data
      const response = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      if (!response.ok) throw new Error("Failed to fetch sheet data")
      
      const result = await response.json()
      if (!result.success || !result.data) throw new Error("Failed to get sheet data")
      
      // Get the current row
      const currentRow = result.data[selectedOrder.rowIndex - 1] || []
      const updatedRow = [...currentRow]
      
      // Ensure we have enough columns
      while (updatedRow.length < 35) updatedRow.push("")
      
      // Set only the required columns (NO Planned1 or Delay1 updates)
      updatedRow[COLUMN_INDICES.ACTUAL1] = actualDate // Set actual date
      updatedRow[COLUMN_INDICES.LGST_NUMBER] = lgstNumber // Set LGST number
      updatedRow[COLUMN_INDICES.ACTUAL_TRUCK_QTY] = formData.actualTruckQty || ""
      updatedRow[COLUMN_INDICES.TYPE_OF_TRANSPORTING_LOGISTIC] = formData.typeOfTransporting || ""
      updatedRow[COLUMN_INDICES.TRANSPORTER_NAME] = formData.transporterName || ""
      updatedRow[COLUMN_INDICES.TRUCK_NO] = formData.truckNo || ""
      updatedRow[COLUMN_INDICES.DRIVER_MOBILE] = formData.driverMobileNo || ""
      updatedRow[COLUMN_INDICES.VEHICLE_IMAGE] = vehicleImageUrl || ""
      updatedRow[COLUMN_INDICES.BILTY_NO] = formData.biltyNo || ""
      updatedRow[COLUMN_INDICES.TYPE_OF_RATE] = formData.typeOfRate || ""
      
      // Set rate based on type
      if (formData.typeOfRate === "Per Matric Ton rate") {
        updatedRow[COLUMN_INDICES.TRANSPORT_RATE] = formData.transportRatePerTon || ""
        updatedRow[COLUMN_INDICES.FIXED_AMOUNT] = ""
      } else if (formData.typeOfRate === "Fixed Amount") {
        updatedRow[COLUMN_INDICES.TRANSPORT_RATE] = ""
        updatedRow[COLUMN_INDICES.FIXED_AMOUNT] = formData.fixedAmount || ""
      } else if (formData.typeOfRate === "Ex Factory Transporter") {
        updatedRow[COLUMN_INDICES.TRANSPORT_RATE] = "0"
        updatedRow[COLUMN_INDICES.FIXED_AMOUNT] = "0"
      }

      // Update the row
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
  }, [selectedOrder, formData, generateLGSTNumber, fileToBase64, fetchData])

  const handleCancel = useCallback(() => {
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
  }, [])

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
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">LGST-Sr No</TableHead>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">D-Sr Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    
                    {activeTab === "pending" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Qty To Be Dispatched</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Type Of Transporting</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Date Of Dispatch</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned Date</TableHead>
                      </>
                    )}
                    
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
                        colSpan={activeTab === "pending" ? 10 : 13} 
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
                          <TableCell className="py-4 px-6 font-medium text-blue-600">
                            {order.lgstSrNumber}
                          </TableCell>
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
                        
                        {activeTab === "pending" && (
                          <>
                            <TableCell className="py-4 px-6 font-medium">
                              {order.qtyToBeDispatched}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {order.typeOfTransporting}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {order.dateOfDispatch}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {order.planned1}
                            </TableCell>
                          </>
                        )}
                        
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
                          {activeTab === "pending" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Qty: {order.qtyToBeDispatched} | Type: {order.typeOfTransporting}
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
                        
                        {activeTab === "pending" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Dispatch Date:</span>
                              <span>{order.dateOfDispatch}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Planned Date:</span>
                              <span>{order.planned1}</span>
                            </div>
                          </>
                        )}
                        
                        {activeTab === "history" && (
                          <>
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

      {/* Logistic Form Modal */}
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
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{selectedOrder.partyName}</p>
                  <p className="text-sm text-gray-600">
                    DO: {selectedOrder.deliveryOrderNo} | DS: {selectedOrder.dSrNumber}
                  </p>
                  <p className="text-sm text-gray-600">Product: {selectedOrder.productName}</p>
                  <p className="text-sm text-blue-600 font-medium mt-1">
                    LGST Number: {generateLGSTNumber()}
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
                        {transporterOptions.map((transporter, index) => (
                          <SelectItem key={index} value={transporter}>
                            {transporter}
                          </SelectItem>
                        ))}
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