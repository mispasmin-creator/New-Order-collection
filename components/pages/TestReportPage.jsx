"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Search, CheckCircle2, Loader2, Upload, Eye, Trash2 } from "lucide-react"

// Correct SCRIPT URL - using the same one from your reference code
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"
const DRIVE_FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-"

export default function LoadMaterialPage({ user }) {
  const [orders, setOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    loadingImage1: null,
    loadingImage2: null,
    loadingImage3: null
  })
  const [uploadingImages, setUploadingImages] = useState({
    loadingImage1: false,
    loadingImage2: false,
    loadingImage3: false
  })
  const [uploadedUrls, setUploadedUrls] = useState({
    loadingImage1: "",
    loadingImage2: "",
    loadingImage3: ""
  })
  
  const fileInputRef1 = useRef(null)
  const fileInputRef2 = useRef(null)
  const fileInputRef3 = useRef(null)

  useEffect(() => {
    fetchLoadMaterialData()
  }, [])

  const fetchLoadMaterialData = async () => {
    try {
      setLoading(true)
      
      // Using the same fetch pattern from your reference code
      const response = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log("Raw DISPATCH API response:", data)
      
      if (data.success && data.data) {
        const { pending, completed } = transformDispatchData(data.data)
        setOrders(pending)
        setCompletedOrders(completed)
        console.log("Load Material data loaded:", pending.length, "pending,", completed.length, "completed")
      } else {
        console.error("Failed to load DISPATCH data:", data)
      }
    } catch (error) {
      console.error("Error fetching load material data:", error)
    } finally {
      setLoading(false)
    }
  }

  const transformDispatchData = (sheetData) => {
    if (!sheetData || sheetData.length === 0) {
      console.log("No sheet data available")
      return { pending: [], completed: [] }
    }
    
    console.log("Raw DISPATCH sheet data length:", sheetData.length)
    
    // Find the header row
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
          console.log("Found headers row at index:", i)
          console.log("Headers:", headers)
          break
        }
      }
    }
    
    if (headerRowIndex === -1) {
      console.error("Could not find header row")
      return { pending: [], completed: [] }
    }
    
    // Find column indices
    const indices = {
      timestamp: headers.findIndex(h => h && h.toString().toLowerCase().includes("timestamp")),
      dSrNumber: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("d-sr") || 
        h.toString().toLowerCase().includes("dsr") || 
        h.toString().toLowerCase().includes("dispatch no") ||
        h.toString().toLowerCase().includes("dispatch")
      )),
      deliveryOrderNo: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("delivery order") || 
        h.toString().toLowerCase().includes("do no") || 
        h.toString().toLowerCase().includes("do")
      )),
      partyName: headers.findIndex(h => h && h.toString().toLowerCase().includes("party name")),
      productName: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("product name") || 
        h.toString().toLowerCase().includes("product")
      )),
      qtyToBeDispatched: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("qty to be") || 
        h.toString().toLowerCase().includes("quantity")
      )),
      typeOfTransporting: headers.findIndex(h => h && h.toString().toLowerCase().includes("type of transporting")),
      transporterName: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("transporter name") || 
        h.toString().toLowerCase().includes("transporter")
      )),
      truckNo: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("truck no") || 
        h.toString().toLowerCase().includes("truck number") || 
        h.toString().toLowerCase().includes("truck")
      )),
      driverMobileNo: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("driver mobile") || 
        h.toString().toLowerCase().includes("driver")
      )),
      vehicleNoPlateImage: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("vehicle no") || 
        h.toString().toLowerCase().includes("vehicle")
      )),
      biltyNo: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("bilty no") || 
        h.toString().toLowerCase().includes("bilty")
      )),
      lgstSrNumber: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("lgst-sr") || 
        h.toString().toLowerCase().includes("lgst sr") || 
        h.toString().toLowerCase().includes("lgst") ||
        h.toString().toLowerCase().includes("logistics sr")
      )),
      actualTruckQty: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("actual truck qty") || 
        h.toString().toLowerCase().includes("actual qty") || 
        h.toString().toLowerCase().includes("truck qty")
      )),
      fixedAmount: headers.findIndex(h => h && h.toString().toLowerCase().includes("fixed amount")),
      planned2: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("planned2") || 
        h.toString().toLowerCase().includes("planned 2")
      )),
      actual2: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("actual2") || 
        h.toString().toLowerCase().includes("actual 2")
      )),
      delay2: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("delay2") || 
        h.toString().toLowerCase().includes("delay 2")
      )),
      loadingImage1: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("loading image 1") || 
        h.toString().toLowerCase().includes("image 1")
      )),
      loadingImage2: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("loading image 2") || 
        h.toString().toLowerCase().includes("image 2")
      )),
      loadingImage3: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("loading image 3") || 
        h.toString().toLowerCase().includes("image 3")
      )),
      remarks: headers.findIndex(h => h && (
        h.toString().toLowerCase().includes("remarks") || 
        h.toString().toLowerCase().includes("comment")
      ))
    }
    
    console.log("DISPATCH Column indices found:", indices)
    
    const pendingOrders = []
    const completedOrders = []
    
    // Process data rows starting from the row after headers
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const getVal = (index) => {
        if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
          const value = row[index].toString().trim()
          return value
        }
        return ""
      }
      
      // Get LGST-Sr Number
      const lgstSrNumber = getVal(indices.lgstSrNumber)
      
      // Skip rows without LGST-Sr number or header rows
      if (!lgstSrNumber || lgstSrNumber === "" || 
          lgstSrNumber.toLowerCase().includes("lgst-sr") || 
          lgstSrNumber.toLowerCase() === "lgst-sr number" || 
          lgstSrNumber.toLowerCase().includes("header")) {
        continue
      }
      
      const planned2 = getVal(indices.planned2)
      const actual2 = getVal(indices.actual2)
      const loadingImage1 = getVal(indices.loadingImage1)
      const loadingImage2 = getVal(indices.loadingImage2)
      const loadingImage3 = getVal(indices.loadingImage3)
      const remarks = getVal(indices.remarks)
      
      // Create order object
      const order = {
        id: i,
        rowIndex: i + 1, // Google Sheets row number (1-indexed)
        timestamp: getVal(indices.timestamp),
        dSrNumber: getVal(indices.dSrNumber),
        deliveryOrderNo: getVal(indices.deliveryOrderNo),
        dispatchNo: getVal(indices.dSrNumber),
        lgstSrNumber: lgstSrNumber,
        partyName: getVal(indices.partyName),
        productName: getVal(indices.productName),
        qtyToBeDispatched: getVal(indices.qtyToBeDispatched),
        actualTruckQty: getVal(indices.actualTruckQty),
        typeOfTransporting: getVal(indices.typeOfTransporting),
        transporterName: getVal(indices.transporterName),
        truckNo: getVal(indices.truckNo),
        driverMobileNo: getVal(indices.driverMobileNo),
        vehicleNoPlateImage: getVal(indices.vehicleNoPlateImage),
        biltyNo: getVal(indices.biltyNo),
        fixedAmount: getVal(indices.fixedAmount),
        planned2: planned2,
        actual2: actual2,
        delay2: getVal(indices.delay2),
        loadingImage1: loadingImage1,
        loadingImage2: loadingImage2,
        loadingImage3: loadingImage3,
        remarks: remarks
      }
      
      // Debug log for each row
      console.log(`Row ${i+1}: LGST="${lgstSrNumber}", Planned2="${planned2}", Actual2="${actual2}"`)
      
      // Check if Planned2 is NOT null/empty
      const isPlanned2NotNull = planned2 && 
                                 planned2.trim() !== "" && 
                                 planned2.toLowerCase() !== "null" &&
                                 planned2.toLowerCase() !== "n/a" &&
                                 planned2.toLowerCase() !== "pending" &&
                                 !planned2.toLowerCase().includes("undefined") &&
                                 !planned2.toLowerCase().includes("planned")
      
      // Check if Actual2 is null/empty
      const isActual2Null = !actual2 || 
                           actual2.trim() === "" || 
                           actual2.toLowerCase() === "null" ||
                           actual2.toLowerCase() === "n/a" ||
                           actual2.toLowerCase() === "pending" ||
                           actual2.toLowerCase().includes("undefined") ||
                           actual2.toLowerCase().includes("actual")
      
      // Check if Actual2 is NOT null/empty
      const isActual2NotNull = actual2 && 
                              actual2.trim() !== "" && 
                              actual2.toLowerCase() !== "null" &&
                              actual2.toLowerCase() !== "n/a" &&
                              actual2.toLowerCase() !== "pending" &&
                              !actual2.toLowerCase().includes("undefined") &&
                              !actual2.toLowerCase().includes("actual")
      
      // LOGIC:
      // 1. PENDING: Planned2 is NOT null AND Actual2 is null
      // 2. COMPLETED: Planned2 is NOT null AND Actual2 is NOT null
      // 3. SKIP: Planned2 is null
      
      if (isPlanned2NotNull) {
        if (isActual2Null) {
          // PENDING: Planned2 has value, but Actual2 is empty/null
          order.isPending = true
          order.isCompleted = false
          pendingOrders.push(order)
          console.log(`  -> ADDED to PENDING (Planned2=${planned2}, Actual2 is null)`)
        } else if (isActual2NotNull) {
          // COMPLETED: Both Planned2 and Actual2 have values
          order.isPending = false
          order.isCompleted = true
          completedOrders.push(order)
          console.log(`  -> ADDED to COMPLETED (Planned2=${planned2}, Actual2=${actual2})`)
        }
      } else {
        console.log(`  -> SKIPPED - Planned2 is null or invalid`)
      }
    }
    
    console.log(`Transformation complete - Pending: ${pendingOrders.length}, Completed: ${completedOrders.length}`)
    
    // Sort pending orders by Planned2 date (most recent first)
    pendingOrders.sort((a, b) => {
      if (!a.planned2) return 1
      if (!b.planned2) return -1
      return new Date(b.planned2) - new Date(a.planned2)
    })
    
    // Sort completed orders by Actual2 date (most recent first)
    completedOrders.sort((a, b) => {
      if (!a.actual2) return 1
      if (!b.actual2) return -1
      return new Date(b.actual2) - new Date(a.actual2)
    })
    
    return { pending: pendingOrders, completed: completedOrders }
  }

  // Filter pending and history orders
  const pendingOrders = orders
  const historyOrders = completedOrders

  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm) return ordersList
    
    return ordersList.filter((order) =>
      Object.values(order).some((value) => 
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayOrders = activeTab === "pending" 
    ? searchFilteredOrders(pendingOrders) 
    : searchFilteredOrders(historyOrders)

  const handleLoadMaterial = (order) => {
    setSelectedOrder(order)
    setFormData({
      loadingImage1: null,
      loadingImage2: null,
      loadingImage3: null
    })
    setUploadedUrls({
      loadingImage1: "",
      loadingImage2: "",
      loadingImage3: ""
    })
  }

  const handleFileSelect = async (event, imageNumber) => {
    const file = event.target.files[0]
    if (!file) return
    
    const imageKey = `loadingImage${imageNumber}`
    
    if (file.size > 5 * 1024 * 1024) {
      alert("File size should be less than 5MB")
      return
    }
    
    if (!file.type.startsWith('image/')) {
      alert("Please select an image file")
      return
    }
    
    setUploadingImages(prev => ({ ...prev, [imageKey]: true }))
    
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = reader.result
        
        const uploadData = {
          action: 'uploadFile',
          base64Data: base64String,
          fileName: `load_material_${selectedOrder.lgstSrNumber}_img${imageNumber}_${Date.now()}.${file.name.split('.').pop()}`,
          mimeType: file.type,
          folderId: DRIVE_FOLDER_ID
        }
        
        const response = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(uploadData)
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        if (result.success) {
          setUploadedUrls(prev => ({ ...prev, [imageKey]: result.fileUrl }))
          setFormData(prev => ({ ...prev, [imageKey]: result.fileUrl }))
          alert(`✓ Image ${imageNumber} uploaded successfully!`)
        }
      }
      
      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Error uploading file:", error)
      alert(`✗ Failed to upload image ${imageNumber}`)
    } finally {
      setUploadingImages(prev => ({ ...prev, [imageKey]: false }))
    }
  }

  const removeImage = (imageNumber) => {
    const imageKey = `loadingImage${imageNumber}`
    setFormData(prev => ({ ...prev, [imageKey]: null }))
    setUploadedUrls(prev => ({ ...prev, [imageKey]: "" }))
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    if (!formData.loadingImage1 && !formData.loadingImage2 && !formData.loadingImage3) {
      alert("Please upload at least one loading image (Loading Image 1 is mandatory)")
      return
    }

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
      
      // Get the current sheet data to find correct column indices
      const headersResponse = await fetch(`${SCRIPT_URL}?sheet=DISPATCH`)
      if (!headersResponse.ok) {
        throw new Error(`HTTP error! status: ${headersResponse.ok}`)
      }
      
      const headersData = await headersResponse.json()
      
      if (!headersData.success || !headersData.data) {
        throw new Error("Failed to fetch sheet headers")
      }
      
      // Find headers row
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
      
      // Find column indices
      const findIndex = (patterns) => {
        for (const pattern of patterns) {
          const index = headers.findIndex(h => {
            if (!h) return false
            const headerLower = h.toString().toLowerCase().trim()
            const patternLower = pattern.toLowerCase().trim()
            return headerLower.includes(patternLower)
          })
          if (index !== -1) return index + 1 // +1 for Google Sheets 1-indexed columns
        }
        return -1
      }
      
      const actual2ColIndex = findIndex(["actual2"])
      const loadingImage1ColIndex = findIndex(["loading image 1"])
      const loadingImage2ColIndex = findIndex(["loading image 2"])
      const loadingImage3ColIndex = findIndex(["loading image 3"])
      
      console.log("Column indices for update:", {
        actual2ColIndex,
        loadingImage1ColIndex,
        loadingImage2ColIndex,
        loadingImage3ColIndex
      })
      
      if (actual2ColIndex === -1) {
        throw new Error("Could not find 'Actual2' column in DISPATCH sheet")
      }
      
      // Update Actual2 column
      const updateActual2Data = {
        action: 'updateCell',
        sheetName: 'DISPATCH',
        rowIndex: selectedOrder.id + 1, // +1 for Google Sheets 1-indexed rows
        columnIndex: actual2ColIndex,
        value: actualDateTime
      }
      
      console.log("Updating Actual2 column:", updateActual2Data)
      
      const actual2Response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(updateActual2Data)
      })

      if (!actual2Response.ok) {
        throw new Error(`HTTP error! status: ${actual2Response.status}`)
      }

      const actual2Result = await actual2Response.json()
      console.log("Google Apps Script response for Actual2:", actual2Result)

      // Update other columns if they exist
      const updateColumns = [
        { colIndex: loadingImage1ColIndex, value: formData.loadingImage1 || "" },
        { colIndex: loadingImage2ColIndex, value: formData.loadingImage2 || "" },
        { colIndex: loadingImage3ColIndex, value: formData.loadingImage3 || "" }
      ]

      for (const column of updateColumns) {
        if (column.colIndex !== -1 && column.value !== undefined) {
          const updateData = {
            action: 'updateCell',
            sheetName: 'DISPATCH',
            rowIndex: selectedOrder.id + 1,
            columnIndex: column.colIndex,
            value: column.value
          }
          
          console.log(`Updating column ${column.colIndex}:`, updateData)
          
          const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(updateData)
          })

          if (!response.ok) {
            console.warn(`Failed to update column ${column.colIndex}, but continuing...`)
          }
        }
      }

      if (actual2Result.success) {
        // Refresh data
        await fetchLoadMaterialData()
        
        // Clear form
        setSelectedOrder(null)
        setFormData({
          loadingImage1: null,
          loadingImage2: null,
          loadingImage3: null
        })
        setUploadedUrls({
          loadingImage1: "",
          loadingImage2: "",
          loadingImage3: ""
        })
        
        alert("✓ Load Material submitted successfully!")
      } else {
        throw new Error(actual2Result.error || "Failed to submit to Google Sheets")
      }
      
    } catch (error) {
      console.error("Error submitting load material:", error)
      alert(`✗ Failed to submit. Error: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      loadingImage1: null,
      loadingImage2: null,
      loadingImage3: null
    })
    setUploadedUrls({
      loadingImage1: "",
      loadingImage2: "",
      loadingImage3: ""
    })
  }

  const openImage = (url) => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading material data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-gray-900">Load Material</h1>
        <p className="text-gray-600">Upload loading images and complete material loading process</p>
      </div>

      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Load Material</h1>
        <p className="text-sm text-gray-600 mt-1">Upload loading images and complete material loading process</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Load Material Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Pending: {pendingOrders.length} | Completed: {historyOrders.length}
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
                Pending ({pendingOrders.length})
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

            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                    {activeTab === "pending" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">LGST-Sr Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Delivery Order No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Dispatch No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Truck Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Transporter</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Truck No</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned2</TableHead>
                    {activeTab === "history" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Loading Images</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 10 : 11} 
                        className="text-center py-8 text-gray-500"
                      >
                        {activeTab === "pending" 
                          ? "No pending load material orders found."
                          : "No completed load material orders found."
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && (
                          <TableCell className="py-4 px-6">
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleLoadMaterial(order)}
                                className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                                disabled={submitting}
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Load Material
                              </Button>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-blue-500 text-white rounded-full whitespace-nowrap">
                            {order.lgstSrNumber || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="max-w-[120px]">
                            <span className="font-medium break-words">{order.deliveryOrderNo || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-purple-500 text-white rounded-full whitespace-nowrap">
                            {order.dispatchNo || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="max-w-[180px]">
                            <p className="break-words">{order.partyName || "N/A"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="max-w-[150px]">
                            <span className="break-words">{order.productName || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium">
                          {order.actualTruckQty || "N/A"}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="max-w-[120px]">
                            <span className="break-words">{order.transporterName || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge variant="outline" className="rounded-full">
                            {order.truckNo || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium whitespace-nowrap">
                          {order.planned2 ? (
                            <span className="text-orange-600">{order.planned2}</span>
                          ) : "N/A"}
                        </TableCell>
                        {activeTab === "history" && (
                          <TableCell className="py-4 px-6 max-w-[250px]">
                            <div className="flex flex-wrap gap-2">
                              {order.loadingImage1 && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-blue-50"
                                  onClick={() => openImage(order.loadingImage1)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Image 1
                                </Badge>
                              )}
                              {order.loadingImage2 && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-blue-50"
                                  onClick={() => openImage(order.loadingImage2)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Image 2
                                </Badge>
                              )}
                              {order.loadingImage3 && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-blue-50"
                                  onClick={() => openImage(order.loadingImage3)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Image 3
                                </Badge>
                              )}
                              {!order.loadingImage1 && !order.loadingImage2 && !order.loadingImage3 && (
                                <span className="text-gray-400 text-sm">No images</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {displayOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    {activeTab === "pending" 
                      ? "No pending load material orders found."
                      : "No completed load material orders found."
                    }
                  </p>
                ) : (
                  displayOrders.map((order) => (
                    <div key={order.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Badge className="bg-blue-500 text-white text-xs mb-1">
                            {order.lgstSrNumber || "N/A"}
                          </Badge>
                          <p className="font-semibold text-gray-900">{order.partyName || "N/A"}</p>
                          <p className="text-xs text-gray-500">
                            DO: {order.deliveryOrderNo || "N/A"} | Dispatch: {order.dispatchNo || "N/A"}
                          </p>
                        </div>
                        <div className="text-right">
                          {activeTab === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => handleLoadMaterial(order)}
                              className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                              disabled={submitting}
                            >
                              <Upload className="w-3 h-3 mr-1" />
                              Load
                            </Button>
                          ) : (
                            <Badge className="bg-green-500 text-white text-xs">
                              ✓ Completed
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Product:</span>
                          <span className="font-medium text-right break-words max-w-[60%]">
                            {order.productName || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Truck Qty:</span>
                          <span className="font-medium">{order.actualTruckQty || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transporter:</span>
                          <span className="font-medium">{order.transporterName || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Truck No:</span>
                          <span className="font-medium">{order.truckNo || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned:</span>
                          <span className="font-medium text-orange-600">
                            {order.planned2 || "N/A"}
                          </span>
                        </div>
                        {activeTab === "history" && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Images:</span>
                            <div className="flex gap-1">
                              {order.loadingImage1 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => openImage(order.loadingImage1)}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              )}
                              {order.loadingImage2 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => openImage(order.loadingImage2)}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              )}
                              {order.loadingImage3 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => openImage(order.loadingImage3)}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} of {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-4xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Complete Load Material</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Order Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-500">LGST-Sr Number</Label>
                      <p className="font-medium">{selectedOrder.lgstSrNumber || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Delivery Order No.</Label>
                      <p className="font-medium">{selectedOrder.deliveryOrderNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Dispatch No.</Label>
                      <p className="font-medium">{selectedOrder.dispatchNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Party Name</Label>
                      <p className="font-medium">{selectedOrder.partyName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Product Name</Label>
                      <p className="font-medium">{selectedOrder.productName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Actual Truck Qty</Label>
                      <p className="font-medium">{selectedOrder.actualTruckQty || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Transporter</Label>
                      <p className="font-medium">{selectedOrder.transporterName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Truck No</Label>
                      <p className="font-medium">{selectedOrder.truckNo || "N/A"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-sm text-gray-500">Planned Date/Time</Label>
                      <p className="font-medium text-orange-600">
                        {selectedOrder.planned2 || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-3">Upload Loading Images</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload at least one loading image. Image 1 is mandatory. Max file size: 5MB each.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {[1, 2, 3].map((num) => (
                      <div key={num} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            Loading Image {num} {num === 1 && "*"}
                            {uploadingImages[`loadingImage${num}`] && (
                              <Loader2 className="w-3 h-3 ml-2 animate-spin inline" />
                            )}
                          </Label>
                          {uploadedUrls[`loadingImage${num}`] && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => openImage(uploadedUrls[`loadingImage${num}`])}
                                title="View Image"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => removeImage(num)}
                                title="Remove Image"
                                disabled={submitting}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <Input
                          type="file"
                          accept="image/*"
                          ref={num === 1 ? fileInputRef1 : num === 2 ? fileInputRef2 : fileInputRef3}
                          onChange={(e) => handleFileSelect(e, num)}
                          className="hidden"
                          disabled={submitting}
                        />
                        <Button
                          variant="outline"
                          className="w-full h-24 border-dashed"
                          onClick={() => {
                            if (num === 1) fileInputRef1.current.click()
                            else if (num === 2) fileInputRef2.current.click()
                            else fileInputRef3.current.click()
                          }}
                          disabled={submitting || uploadingImages[`loadingImage${num}`]}
                        >
                          <div className="flex flex-col items-center">
                            <Upload className="w-6 h-6 mb-2 text-gray-400" />
                            <span className="text-sm">
                              {uploadedUrls[`loadingImage${num}`] ? "✓ Uploaded" : `Upload Image ${num}`}
                            </span>
                          </div>
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> The "Actual2" field will be auto-populated with the current date/time when you submit.
                    </p>
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
                      disabled={submitting || !formData.loadingImage1}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Complete Load Material
                        </>
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
          onClick={fetchLoadMaterialData} 
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