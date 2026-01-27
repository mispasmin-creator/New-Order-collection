"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Search, CheckCircle2, Loader2, Upload, Eye } from "lucide-react"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"
const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-"

export default function WetmanEntryPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    imageOfSlip: null,
    imageOfSlip2: null,
    imageOfSlip3: null,
    remarks: "",
    actualQtyLoadedInTruck: "",
    actualQtyAsPerWeighmentSlip: "",
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

  // Format date to dd/mm/yy
  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === "") return "N/A"
    
    // Try to parse different date formats
    const date = new Date(dateString)
    
    // If date is valid
    if (!isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear().toString().slice(-2) // Last 2 digits
      return `${day}/${month}/${year}`
    }
    
    // If it's already in dd/mm/yyyy format
    if (dateString.includes('/')) {
      const parts = dateString.split('/')
      if (parts.length >= 3) {
        const day = parts[0].padStart(2, '0')
        const month = parts[1].padStart(2, '0')
        const year = parts[2].slice(-2) // Last 2 digits
        return `${day}/${month}/${year}`
      }
    }
    
    // Return as is if can't parse
    return dateString
  }

  // Get pending orders from DELIVERY sheet where Planned1 has value but Actual1 is empty
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
      imageOfSlip: headers.findIndex(h => h.toLowerCase().includes("image of slip") && !h.toLowerCase().includes("2") && !h.toLowerCase().includes("3")),
      imageOfSlip2: headers.findIndex(h => h.toLowerCase().includes("image of slip2")),
      imageOfSlip3: headers.findIndex(h => h.toLowerCase().includes("image of slip3")),
      remarks: headers.findIndex(h => h.toLowerCase().includes("remarks")),
      actualQtyLoadedInTruck: headers.findIndex(h => h.toLowerCase().includes("actual qty loaded in truck")),
      actualQtyAsPerWeighmentSlip: headers.findIndex(h => h.toLowerCase().includes("actual qty as per weighment slip")),
    }
    
    console.log("DELIVERY Column indices:", indices)
    
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
      
      const planned1 = getVal(indices.planned1)
      const actual1 = getVal(indices.actual1)
      const billNo = getVal(indices.billNo)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      
      // Check if Planned1 has value, Actual1 is empty, and there's a Bill No (invoice completed)
      if (planned1 && planned1 !== "" && (!actual1 || actual1 === "") && billNo && billNo !== "") {
        const order = {
          id: i,
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          timestamp: getVal(indices.timestamp),
          billDate: formatDate(getVal(indices.billDate)),
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
          planned1: formatDate(planned1),
          actual1: actual1,
          hasImageOfSlip: getVal(indices.imageOfSlip) !== "",
          hasImageOfSlip2: getVal(indices.imageOfSlip2) !== "",
          hasImageOfSlip3: getVal(indices.imageOfSlip3) !== "",
          remarks: getVal(indices.remarks),
          actualQtyLoadedInTruck: getVal(indices.actualQtyLoadedInTruck),
          actualQtyAsPerWeighmentSlip: getVal(indices.actualQtyAsPerWeighmentSlip),
          imageOfSlip: getVal(indices.imageOfSlip),
          imageOfSlip2: getVal(indices.imageOfSlip2),
          imageOfSlip3: getVal(indices.imageOfSlip3),
        }
        
        // Filter by user firm if not master
        if (user.role === "master") {
          pendingOrders.push(order)
        } else {
          // You might need to add firm filtering if available in the data
          pendingOrders.push(order)
        }
      }
    }
    
    console.log("Total pending orders found:", pendingOrders.length)
    return pendingOrders
  }

  // Get history orders from DELIVERY sheet where Actual1 has value
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
      imageOfSlip: headers.findIndex(h => h.toLowerCase().includes("image of slip") && !h.toLowerCase().includes("2") && !h.toLowerCase().includes("3")),
      imageOfSlip2: headers.findIndex(h => h.toLowerCase().includes("image of slip2")),
      imageOfSlip3: headers.findIndex(h => h.toLowerCase().includes("image of slip3")),
      remarks: headers.findIndex(h => h.toLowerCase().includes("remarks")),
      actualQtyLoadedInTruck: headers.findIndex(h => h.toLowerCase().includes("actual qty loaded in truck")),
      actualQtyAsPerWeighmentSlip: headers.findIndex(h => h.toLowerCase().includes("actual qty as per weighment slip")),
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
      
      const actual1 = getVal(indices.actual1)
      const billNo = getVal(indices.billNo)
      const deliveryOrderNo = getVal(indices.deliveryOrderNo)
      
      // Check if Actual1 has value (wetman entry completed) and there's a Bill No
      if (actual1 && actual1 !== "" && billNo && billNo !== "") {
        const imageOfSlip = getVal(indices.imageOfSlip)
        const imageOfSlip2 = getVal(indices.imageOfSlip2)
        const imageOfSlip3 = getVal(indices.imageOfSlip3)
        
        const historyOrder = {
          id: i,
          rowIndex: i + 1,
          timestamp: getVal(indices.timestamp),
          billDate: formatDate(getVal(indices.billDate)),
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
          planned1: formatDate(getVal(indices.planned1)),
          actual1: formatDate(actual1),
          imageOfSlip: imageOfSlip,
          imageOfSlip2: imageOfSlip2,
          imageOfSlip3: imageOfSlip3,
          hasImageOfSlip: imageOfSlip !== "",
          hasImageOfSlip2: imageOfSlip2 !== "",
          hasImageOfSlip3: imageOfSlip3 !== "",
          remarks: getVal(indices.remarks),
          actualQtyLoadedInTruck: getVal(indices.actualQtyLoadedInTruck),
          actualQtyAsPerWeighmentSlip: getVal(indices.actualQtyAsPerWeighmentSlip),
        }
        
        // Filter by user firm if not master
        if (user.role === "master") {
          historyOrders.push(historyOrder)
        } else {
          // You might need to add firm filtering if available in the data
          historyOrders.push(historyOrder)
        }
      }
    }
    
    console.log("Total history orders found:", historyOrders.length)
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

  const handleWetman = (order) => {
    const now = new Date()
    const day = now.getDate().toString().padStart(2, '0')
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const year = now.getFullYear().toString().slice(-2)
    const actual1Date = `${day}/${month}/${year}`
    
    setSelectedOrder(order)
    setFormData({
      imageOfSlip: null,
      imageOfSlip2: null,
      imageOfSlip3: null,
      remarks: "",
      actualQtyLoadedInTruck: order.actualQtyLoadedInTruck || "",
      actualQtyAsPerWeighmentSlip: order.actualQtyAsPerWeighmentSlip || "",
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
      const day = now.getDate().toString().padStart(2, '0')
      const month = (now.getMonth() + 1).toString().padStart(2, '0')
      const year = now.getFullYear().toString().slice(-2)
      const actual1Date = `${day}/${month}/${year}`
      
      // Handle file uploads
      const uploadedFiles = []
      const fileFields = [
        { field: formData.imageOfSlip, name: "image_of_slip", type: "Image Of Slip" },
        { field: formData.imageOfSlip2, name: "image_of_slip2", type: "Image Of Slip2" },
        { field: formData.imageOfSlip3, name: "image_of_slip3", type: "Image Of Slip3" },
      ]
      
      for (const fileField of fileFields) {
        if (fileField.field) {
          try {
            const base64Data = await fileToBase64(fileField.field)
            
            const formDataToSend = new FormData()
            formDataToSend.append('action', 'uploadFile')
            formDataToSend.append('base64Data', base64Data)
            formDataToSend.append('fileName', `${fileField.name}_${selectedOrder.billNo}_${Date.now()}.${fileField.field.name.split('.').pop()}`)
            formDataToSend.append('mimeType', fileField.field.type)
            formDataToSend.append('folderId', FOLDER_ID)
            
            const uploadResponse = await fetch(SCRIPT_URL, {
              method: 'POST',
              body: formDataToSend,
            })
            
            const uploadResult = await uploadResponse.json()
            
            if (uploadResult.success && uploadResult.fileUrl) {
              uploadedFiles.push({
                type: fileField.type,
                url: uploadResult.fileUrl
              })
            }
          } catch (uploadError) {
            console.error(`Error uploading ${fileField.type}:`, uploadError)
          }
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
      
      // Update wetman entry columns
      // Column 17: Planned 1 (index 16) - keep as is
      // Column 18: Actual 1 (index 17)
      updatedRow[17] = actual1Date
      
      // Column 19: Delay 1 (index 18) - leave as is or calculate if needed
      // Column 20: Image Of Slip (index 19)
      const existingImageOfSlip = updatedRow[19]?.toString().trim()
      updatedRow[19] = uploadedFiles.find(f => f.type === "Image Of Slip")?.url || existingImageOfSlip || ""
      
      // Column 21: Image Of Slip2 (index 20)
      const existingImageOfSlip2 = updatedRow[20]?.toString().trim()
      updatedRow[20] = uploadedFiles.find(f => f.type === "Image Of Slip2")?.url || existingImageOfSlip2 || ""
      
      // Column 22: Image Of Slip3 (index 21)
      const existingImageOfSlip3 = updatedRow[21]?.toString().trim()
      updatedRow[21] = uploadedFiles.find(f => f.type === "Image Of Slip3")?.url || existingImageOfSlip3 || ""
      
      // Column 23: Remarks (index 22)
      updatedRow[22] = formData.remarks || ""
      
      // Column 24: Actual Qty loaded In Truck (Total Qty) (index 23)
      updatedRow[23] = formData.actualQtyLoadedInTruck || ""
      
      // Column 25: Actual Qty As Per Weighment Slip (index 24)
      updatedRow[24] = formData.actualQtyAsPerWeighmentSlip || ""

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
          imageOfSlip: null,
          imageOfSlip2: null,
          imageOfSlip3: null,
          remarks: "",
          actualQtyLoadedInTruck: "",
          actualQtyAsPerWeighmentSlip: "",
        })
        
        alert(`✓ Wetman entry submitted successfully!\nActual1 Date: ${actual1Date}`)
      } else {
        throw new Error(updateResult.error || "Update failed")
      }
      
    } catch (error) {
      console.error("Error submitting wetman entry:", error)
      alert(`✗ Failed to submit: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      imageOfSlip: null,
      imageOfSlip2: null,
      imageOfSlip3: null,
      remarks: "",
      actualQtyLoadedInTruck: "",
      actualQtyAsPerWeighmentSlip: "",
    })
  }

  // Function to open Google Drive link
  const openImageLink = (url) => {
    if (url && url.trim() !== "") {
      window.open(url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading wetman data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Wetman Entry</h1>
        <p className="text-sm text-gray-600 mt-1">Manage wetman weighment entries</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Wetman Entry Management</CardTitle>
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
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Quantity</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned1 Date</TableHead>
                    {activeTab === "pending" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Logistic No.</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Transporter</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Vehicle No.</TableHead>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual1 Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Truck Qty</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Weighment Qty</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Slips</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Remarks</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 12 : 13} 
                        className="text-center py-8 text-gray-500"
                      >
                        No {activeTab === "pending" ? "pending" : "completed"} wetman entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <Button
                              size="sm"
                              onClick={() => handleWetman(order)}
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={submitting}
                            >
                              Wetman Entry
                            </Button>
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-6">
                          <span className="font-medium">{order.deliveryOrderNo}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {order.billDate}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-green-500 text-white rounded-full">
                            {order.billNo}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="max-w-[200px]">
                            <span className="break-words">{order.productName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium">{order.quantityDelivered}</TableCell>
                        <TableCell className="py-4 px-6">{order.planned1 || "N/A"}</TableCell>
                        {activeTab === "pending" && (
                          <>
                            <TableCell className="py-4 px-6">{order.logisticNo || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">{order.transporterName || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">{order.vehicleNumber || "N/A"}</TableCell>
                          </>
                        )}
                        {activeTab === "history" && (
                          <>
                            <TableCell className="py-4 px-6">{order.actual1}</TableCell>
                            <TableCell className="py-4 px-6">{order.actualQtyLoadedInTruck || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">{order.actualQtyAsPerWeighmentSlip || "N/A"}</TableCell>
                            <TableCell className="py-4 px-6">
                              <div className="flex gap-1">
                                {order.imageOfSlip && (
                                  <Badge 
                                    className="bg-blue-500 text-white text-xs cursor-pointer hover:bg-blue-600"
                                    onClick={() => openImageLink(order.imageOfSlip)}
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    Slip1
                                  </Badge>
                                )}
                                {order.imageOfSlip2 && (
                                  <Badge 
                                    className="bg-blue-500 text-white text-xs cursor-pointer hover:bg-blue-600"
                                    onClick={() => openImageLink(order.imageOfSlip2)}
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    Slip2
                                  </Badge>
                                )}
                                {order.imageOfSlip3 && (
                                  <Badge 
                                    className="bg-blue-500 text-white text-xs cursor-pointer hover:bg-blue-600"
                                    onClick={() => openImageLink(order.imageOfSlip3)}
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    Slip3
                                  </Badge>
                                )}
                                {!order.imageOfSlip && !order.imageOfSlip2 && !order.imageOfSlip3 && (
                                  <span className="text-gray-400 text-xs">No slips</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6 max-w-[150px]">
                              <span className="truncate block">{order.remarks || "N/A"}</span>
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
                    No {activeTab === "pending" ? "pending" : "completed"} wetman entries found
                  </p>
                ) : (
                  displayOrders.map((order) => (
                    <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          {activeTab === "history" && (
                            <p className="text-green-600 font-medium text-sm mb-1">
                              Actual: {order.actual1}
                            </p>
                          )}
                          <p className="font-semibold text-gray-900">
                            DO: {order.deliveryOrderNo}
                          </p>
                          <p className="text-xs text-gray-500">
                            Bill: {order.billNo} | Date: {order.billDate}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Party: {order.partyName} | Planned: {order.planned1 || "N/A"}
                          </p>
                        </div>
                        <div className="text-right">
                          {activeTab === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => handleWetman(order)}
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={submitting}
                            >
                              Entry
                            </Button>
                          ) : (
                            <Badge className="bg-green-500 text-white">
                              Completed
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Product:</span>
                          <span>{order.productName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quantity:</span>
                          <span className="font-medium">{order.quantityDelivered}</span>
                        </div>
                        {activeTab === "pending" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Logistic No:</span>
                              <span>{order.logisticNo || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transporter:</span>
                              <span>{order.transporterName || "N/A"}</span>
                            </div>
                          </>
                        )}
                        {activeTab === "history" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Truck Qty:</span>
                              <span>{order.actualQtyLoadedInTruck || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Weighment Qty:</span>
                              <span>{order.actualQtyAsPerWeighmentSlip || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Slips:</span>
                              <div className="flex gap-1">
                                {order.imageOfSlip && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => openImageLink(order.imageOfSlip)}
                                  >
                                    <Eye className="w-3 h-3" />
                                    1
                                  </Button>
                                )}
                                {order.imageOfSlip2 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => openImageLink(order.imageOfSlip2)}
                                  >
                                    <Eye className="w-3 h-3" />
                                    2
                                  </Button>
                                )}
                                {order.imageOfSlip3 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => openImageLink(order.imageOfSlip3)}
                                  >
                                    <Eye className="w-3 h-3" />
                                    3
                                  </Button>
                                )}
                              </div>
                            </div>
                            {order.remarks && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Remarks:</span>
                                <span className="text-right text-xs">{order.remarks}</span>
                              </div>
                            )}
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

      {/* Wetman Entry Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Wetman Entry Form</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">DO: {selectedOrder.deliveryOrderNo}</p>
                  <p className="text-sm text-gray-600">
                    Bill: {selectedOrder.billNo} | Party: {selectedOrder.partyName}
                  </p>
                  <p className="text-sm text-gray-600">Product: {selectedOrder.productName}</p>
                  <p className="text-sm text-gray-600">
                    Quantity: {selectedOrder.quantityDelivered} | Planned: {selectedOrder.planned1}
                  </p>
                  <p className="text-sm text-green-600 font-medium mt-1">
                    Actual1 will be set to: {(() => {
                      const now = new Date()
                      const day = now.getDate().toString().padStart(2, '0')
                      const month = (now.getMonth() + 1).toString().padStart(2, '0')
                      const year = now.getFullYear().toString().slice(-2)
                      return `${day}/${month}/${year}`
                    })()}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Actual Qty loaded In Truck (Total Qty) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.actualQtyLoadedInTruck}
                      onChange={(e) => setFormData(prev => ({ ...prev, actualQtyLoadedInTruck: e.target.value }))}
                      className="h-10"
                      placeholder="Enter truck quantity"
                      disabled={submitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Actual Qty As Per Weighment Slip *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.actualQtyAsPerWeighmentSlip}
                      onChange={(e) => setFormData(prev => ({ ...prev, actualQtyAsPerWeighmentSlip: e.target.value }))}
                      className="h-10"
                      placeholder="Enter weighment quantity"
                      disabled={submitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Image Of Slip</Label>
                    <div className="flex items-center gap-2">
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
                              imageOfSlip: file 
                            }))
                          }
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.imageOfSlip && (
                        <span className="text-sm text-green-600 truncate">
                          ✓ {formData.imageOfSlip.name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Image Of Slip2</Label>
                    <div className="flex items-center gap-2">
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
                              imageOfSlip2: file 
                            }))
                          }
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.imageOfSlip2 && (
                        <span className="text-sm text-green-600 truncate">
                          ✓ {formData.imageOfSlip2.name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Image Of Slip3</Label>
                    <div className="flex items-center gap-2">
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
                              imageOfSlip3: file 
                            }))
                          }
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.imageOfSlip3 && (
                        <span className="text-sm text-green-600 truncate">
                          ✓ {formData.imageOfSlip3.name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Remarks</Label>
                    <Textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Enter any remarks"
                      disabled={submitting}
                      className="min-h-[80px]"
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
                        !formData.actualQtyLoadedInTruck ||
                        !formData.actualQtyAsPerWeighmentSlip ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Wetman Entry`
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