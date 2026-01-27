"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Calendar, Upload, FileText, Loader2, Eye } from "lucide-react"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"
const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-"

export default function MaterialReceiptPage({ user }) {
  const [postDeliveryData, setPostDeliveryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    materialReceivedDate: "",
    imageOfReceivedBill: "",
    grnNumber: "",
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [file, setFile] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch data from POST DELIVERY sheet
      const response = await fetch(`${SCRIPT_URL}?sheet=POST%20DELIVERY`)
      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.data) {
          const transformedData = transformPostDeliveryData(data.data)
          setPostDeliveryData(transformedData)
          console.log("POST DELIVERY data loaded:", transformedData.length)
        }
      }
      
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const transformPostDeliveryData = (sheetData) => {
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
      console.log("No headers found in POST DELIVERY sheet")
      return []
    }
    
    // Get column indices for POST DELIVERY sheet
    const indices = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes("timestamp")),
      orderNo: headers.findIndex(h => h.toLowerCase().includes("order no")),
      typeOfBill: headers.findIndex(h => h.toLowerCase().includes("type of bill")),
      billNo: headers.findIndex(h => h.toLowerCase().includes("bill no")),
      billDate: headers.findIndex(h => h.toLowerCase().includes("bill date")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party name")),
      totalBillAmount: headers.findIndex(h => h.toLowerCase().includes("total bill amount")),
      totalTruckQty: headers.findIndex(h => h.toLowerCase().includes("total truck qty")),
      copyOfBill: headers.findIndex(h => h.toLowerCase().includes("copy of bill")),
      planned: headers.findIndex(h => h.toLowerCase().includes("planned") && !h.toLowerCase().includes("actual") && !h.toLowerCase().includes("delay")),
      actual: headers.findIndex(h => h.toLowerCase().includes("actual") && !h.toLowerCase().includes("planned") && !h.toLowerCase().includes("delay")),
      delay: headers.findIndex(h => h.toLowerCase().includes("delay") && !h.toLowerCase().includes("planned") && !h.toLowerCase().includes("actual")),
      materialReceivedDate: headers.findIndex(h => h.toLowerCase().includes("material received date")),
      imageOfReceivedBill: headers.findIndex(h => h.toLowerCase().includes("image of received bill") || h.toLowerCase().includes("image of received bill / audio")),
      imageOfMaterialReceipt: headers.findIndex(h => h.toLowerCase().includes("image of material receipt") || h.toLowerCase().includes("image of material")),
      grnNumber: headers.findIndex(h => h.toLowerCase().includes("grn number")),
    }
    
    console.log("POST DELIVERY Column indices:", indices)
    
    const transformedData = []
    
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
      const orderNo = getVal(indices.orderNo)
      const billNo = getVal(indices.billNo)
      const planned = getVal(indices.planned)
      const actual = getVal(indices.actual)
      
      // Only add if it has some data
      if (timestamp || orderNo || billNo) {
        const entry = {
          id: i,
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          timestamp: timestamp,
          "Order No.": orderNo,
          "Type of Bill": getVal(indices.typeOfBill),
          "Bill No": billNo,
          "Bill Date": getVal(indices.billDate),
          "Party Name": getVal(indices.partyName),
          "Total Bill Amount": getVal(indices.totalBillAmount),
          "Total Truck Qty": getVal(indices.totalTruckQty),
          "Copy Of Bill": getVal(indices.copyOfBill),
          "Planned ": planned, // Note the space at the end to match your header
          "Actual": actual,
          "Delay": getVal(indices.delay),
          "Material Received Date": getVal(indices.materialReceivedDate),
          "Image Of Received Bill / Audio": getVal(indices.imageOfReceivedBill),
          "Image Of Material Receipt": getVal(indices.imageOfMaterialReceipt),
          "Grn Number": getVal(indices.grnNumber),
        }
        
        transformedData.push(entry)
      }
    }
    
    console.log("Total POST DELIVERY entries found:", transformedData.length)
    return transformedData
  }

  // Filter POST DELIVERY data: Planned not null and Actual is null
  const getPendingEntries = () => {
    return postDeliveryData.filter(entry => {
      if (!entry || typeof entry !== 'object') return false
      
      const planned = entry["Planned "]
      const actual = entry["Actual"]
      
      // Check if Planned exists and is not empty
      const hasPlanned = planned !== null && 
                        planned !== undefined && 
                        planned !== "" && 
                        planned.toString().trim() !== ""
      
      // Check if Actual is empty or null
      const isEmptyActual = !actual || 
                           actual === "" || 
                           actual.toString().trim() === ""
      
      return hasPlanned && isEmptyActual
    })
  }

  const getHistoryEntries = () => {
    return postDeliveryData.filter(entry => {
      if (!entry || typeof entry !== 'object') return false
      
      const actual = entry["Actual"]
      
      // Check if Actual exists and is not empty
      return actual && 
             actual !== "" && 
             actual.toString().trim() !== ""
    })
  }

  const pendingEntries = getPendingEntries()
  const historyEntries = getHistoryEntries()

  console.log("Pending entries count:", pendingEntries.length)
  console.log("History entries count:", historyEntries.length)

  // Apply search filter
  const searchFilteredEntries = (entriesList) => {
    if (!searchTerm.trim()) return entriesList
    
    return entriesList.filter((entry) =>
      Object.values(entry).some((value) => 
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayEntries = activeTab === "pending" 
    ? searchFilteredEntries(pendingEntries) 
    : searchFilteredEntries(historyEntries)

  const handleMaterialEntry = (entry) => {
    console.log("Selected entry:", entry)
    setSelectedEntry(entry)
    setFormData({
      materialReceivedDate: entry["Material Received Date"] || "",
      imageOfReceivedBill: entry["Image Of Received Bill / Audio"] || "",
      grnNumber: entry["Grn Number"] || "",
    })
    setFile(null)
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

  const handleImageUpload = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("File size should be less than 5MB")
      return
    }
    
    setFile(selectedFile)
    setUploadingImage(true)
    
    try {
      const base64Data = await fileToBase64(selectedFile)
      
      const formDataToSend = new FormData()
      formDataToSend.append('action', 'uploadFile')
      formDataToSend.append('base64Data', base64Data)
      formDataToSend.append('fileName', `material_receipt_${selectedEntry["Bill No"]}_${Date.now()}.${selectedFile.name.split('.').pop()}`)
      formDataToSend.append('mimeType', selectedFile.type)
      formDataToSend.append('folderId', FOLDER_ID)
      
      const uploadResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: formDataToSend,
      })
      
      const uploadResult = await uploadResponse.json()
      
      if (uploadResult.success && uploadResult.fileUrl) {
        setFormData(prev => ({
          ...prev,
          imageOfReceivedBill: uploadResult.fileUrl
        }))
        alert("✓ Image uploaded successfully!")
      } else {
        throw new Error(uploadResult.error || "Upload failed")
      }
    } catch (error) {
      console.error("Image upload failed:", error)
      alert("✗ Failed to upload image")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedEntry) {
      alert("No entry selected")
      return
    }
    
    if (!formData.materialReceivedDate) {
      alert("Please select Material Received Date")
      return
    }
    
    if (!formData.grnNumber) {
      alert("Please enter GRN Number")
      return
    }

    try {
      setSubmitting(true)
      
      const now = new Date()
      const currentDateTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      
      // Find column indices by fetching headers
      const sheetResponse = await fetch(`${SCRIPT_URL}?sheet=POST%20DELIVERY`)
      if (!sheetResponse.ok) throw new Error("Failed to fetch sheet data")
      
      const sheetData = await sheetResponse.json()
      if (!sheetData.success) throw new Error("Failed to fetch sheet data")
      
      // Get headers
      let headers = []
      for (let i = 0; i < sheetData.data.length; i++) {
        const row = sheetData.data[i]
        if (row && row.length > 0) {
          const hasTimestamp = row.some(cell => 
            cell && cell.toString().trim().toLowerCase().includes("timestamp")
          )
          if (hasTimestamp) {
            headers = row.map(h => h?.toString().trim() || "")
            break
          }
        }
      }
      
      // Get column indices
      const columnIndices = {
        actual: headers.findIndex(h => h.toLowerCase().includes("actual") && !h.toLowerCase().includes("planned") && !h.toLowerCase().includes("delay")),
        materialReceivedDate: headers.findIndex(h => h.toLowerCase().includes("material received date")),
        imageOfReceivedBill: headers.findIndex(h => h.toLowerCase().includes("image of received bill") || h.toLowerCase().includes("image of received bill / audio")),
        grnNumber: headers.findIndex(h => h.toLowerCase().includes("grn number")),
      }
      
      console.log("Column indices:", columnIndices)
      
      // Prepare row data - create array with all columns
      const rowIndex = selectedEntry.rowIndex
      const rowData = []
      
      // Initialize with empty values for all columns
      for (let i = 0; i < headers.length; i++) {
        rowData.push("")
      }
      
      // Update only the specific columns we need
      if (columnIndices.actual >= 0) rowData[columnIndices.actual] = currentDateTime
      if (columnIndices.materialReceivedDate >= 0) rowData[columnIndices.materialReceivedDate] = formData.materialReceivedDate
      if (columnIndices.imageOfReceivedBill >= 0) rowData[columnIndices.imageOfReceivedBill] = formData.imageOfReceivedBill
      if (columnIndices.grnNumber >= 0) rowData[columnIndices.grnNumber] = formData.grnNumber
      
      console.log("Updating row", rowIndex, "with data:", rowData)
      
      // Update POST DELIVERY sheet using 'update' action (not 'updateRow')
      const updateResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'update',
          sheetName: 'POST DELIVERY',
          rowIndex: rowIndex.toString(),
          rowData: JSON.stringify(rowData)
        })
      })

      if (!updateResponse.ok) {
        throw new Error(`HTTP error! status: ${updateResponse.status}`)
      }

      const result = await updateResponse.json()
      console.log("Update response:", result)

      if (result.success) {
        // Refresh data
        await fetchData()
        
        // Reset form and selection
        setSelectedEntry(null)
        setFormData({
          materialReceivedDate: "",
          imageOfReceivedBill: "",
          grnNumber: "",
        })
        setFile(null)
        
        alert("✓ Material receipt submitted successfully!")
        
      } else {
        throw new Error(result.error || "Failed to update POST DELIVERY sheet")
      }
      
    } catch (error) {
      console.error("Error submitting material receipt:", error)
      alert(`✗ Failed to submit. Error: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedEntry(null)
    setFormData({
      materialReceivedDate: "",
      imageOfReceivedBill: "",
      grnNumber: "",
    })
    setFile(null)
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString || dateString === "" || dateString === " ") return "N/A"
    
    try {
      // Handle different date formats
      const date = new Date(dateString)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // If not a valid date, try to parse dd/mm/yyyy format
        const parts = dateString.split('/')
        if (parts.length === 3) {
          const [day, month, year] = parts.map(part => parseInt(part, 10))
          const newDate = new Date(year, month - 1, day)
          if (!isNaN(newDate.getTime())) {
            return newDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          }
        }
        return dateString.toString()
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch (e) {
      console.error("Date formatting error:", e)
      return dateString ? dateString.toString() : "N/A"
    }
  }

  // Format datetime for display
  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === "" || dateTimeString === " ") return "N/A"
    
    try {
      const date = new Date(dateTimeString)
      
      if (isNaN(date.getTime())) {
        // Try to parse dd/mm/yyyy hh:mm:ss format
        const datePart = dateTimeString.split(' ')[0]
        const timePart = dateTimeString.split(' ')[1] || '00:00:00'
        const parts = datePart.split('/')
        
        if (parts.length === 3) {
          const [day, month, year] = parts.map(part => parseInt(part, 10))
          const [hours = 0, minutes = 0, seconds = 0] = timePart.split(':').map(part => parseInt(part, 10))
          const newDate = new Date(year, month - 1, day, hours, minutes, seconds)
          if (!isNaN(newDate.getTime())) {
            return newDate.toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          }
        }
        return dateTimeString.toString()
      }
      
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return dateTimeString ? dateTimeString.toString() : "N/A"
    }
  }

  // Function to handle Google Drive URL - FIXED
 // Function to handle Google Drive URL - UPDATED to handle t=view&id= format
const getDriveUrl = (driveLink) => {
  if (!driveLink || driveLink.trim() === "") return null;
  
  const link = driveLink.trim();
  
  console.log("Processing drive link:", link); // Debug log
  
  // Check if it's already a full URL
  if (link.startsWith('http://') || link.startsWith('https://')) {
    return link;
  }
  
  // NEW: Check for t=view&id= format (from your image)
  if (link.includes('t=view&id=')) {
    const match = link.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      console.log("Found t=view&id format, extracted ID:", match[1]); // Debug log
      return `https://drive.google.com/file/d/${match[1]}/view`;
    }
  }
  
  // Check if it contains a file ID pattern
  if (link.includes('/d/')) {
    const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      console.log("Found /d/ format, extracted ID:", match[1]); // Debug log
      return `https://drive.google.com/file/d/${match[1]}/view`;
    }
  }
  
  // Check if it's just a file ID
  if (link.match(/^[a-zA-Z0-9_-]{25,}$/)) {
    console.log("Found file ID format:", link); // Debug log
    return `https://drive.google.com/file/d/${link}/view`;
  }
  
  // If it's a partial URL
  if (link.startsWith('file/d/')) {
    const fileId = link.replace('file/d/', '').split('/')[0];
    console.log("Found file/d/ format, extracted ID:", fileId); // Debug log
    return `https://drive.google.com/file/d/${fileId}/view`;
  }
  
  console.log("No matching format found, returning as is:", link); // Debug log
  // Return as is (might be a direct link or another format)
  return link;
};



  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading material receipt data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Desktop Header */}
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-gray-900">POST DELIVERY Material Receipt</h1>
        <p className="text-gray-600 mt-2">Manage material receipts for POST DELIVERY entries</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <Badge className="bg-yellow-100 text-yellow-800">Pending: {pendingEntries.length}</Badge>
          <Badge className="bg-green-100 text-green-800">Completed: {historyEntries.length}</Badge>
          <Badge className="bg-blue-100 text-blue-800">Total: {postDeliveryData.length}</Badge>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">POST DELIVERY Material Receipt</h1>
        <p className="text-sm text-gray-600 mt-1">Manage material receipts for POST DELIVERY entries</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge className="bg-yellow-100 text-yellow-800 text-xs">Pending: {pendingEntries.length}</Badge>
          <Badge className="bg-green-100 text-green-800 text-xs">Done: {historyEntries.length}</Badge>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Material Receipt Management</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            {activeTab === "pending" 
              ? `Showing ${pendingEntries.length} entries with Planned date but missing Actual date`
              : `Showing ${historyEntries.length} completed material receipts`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-t-lg">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "pending"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending ({pendingEntries.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "history"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                History ({historyEntries.length})
              </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by Order No, Party Name, Bill No..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50 w-full"
                />
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              {displayEntries.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No entries found
                  </h3>
                  <p className="text-gray-600">
                    {activeTab === "pending" 
                      ? "All POST DELIVERY entries have been processed" 
                      : "No completed material receipts found"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                      {activeTab === "pending" && (
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                      )}
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Order No.</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Type of Bill</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill No</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill Date</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Amount</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Copy Of Bill</TableHead>
                      {activeTab === "history" && (
                        <>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6">Received Date</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6">GRN Number</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-4 px-6">Material Receipt</TableHead>

                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayEntries.map((entry, index) => {
                      // Safely get all values
                      const orderNo = entry["Order No."] || "N/A"
                      const billType = entry["Type of Bill"] || "N/A"
                      const billNo = entry["Bill No"] || "N/A"
                      const billDate = entry["Bill Date"]
                      const partyName = entry["Party Name"] || "N/A"
                      const amount = entry["Total Bill Amount"] || "0"
                      const planned = entry["Planned "]
                      const actual = entry["Actual"]
                      const copyOfBill = entry["Copy Of Bill"]
                      const receivedDate = entry["Material Received Date"]
                      const grnNumber = entry["Grn Number"]

                      // Get proper Drive URL
                      const driveUrl = getDriveUrl(copyOfBill);

                      return (
                        <TableRow key={`${orderNo}-${index}`} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                          {activeTab === "pending" && (
                            <TableCell className="py-4 px-6">
                              <Button
                                size="sm"
                                onClick={() => handleMaterialEntry(entry)}
                                className="bg-blue-600 hover:bg-blue-700"
                                disabled={submitting}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Receipt
                              </Button>
                            </TableCell>
                          )}
                          <TableCell className="font-medium py-4 px-6">
                            <Badge className="bg-blue-500 text-white rounded-full px-3">
                              {orderNo}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6">{billType}</TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge className="bg-green-500 text-white rounded-full">
                              {billNo}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6">{formatDate(billDate)}</TableCell>
                          <TableCell className="py-4 px-6 font-medium">{partyName}</TableCell>
                          <TableCell className="py-4 px-6 font-bold text-gray-900">
                            ₹{amount}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              {formatDateTime(planned)}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            {driveUrl ? (
                              <a 
                                href={driveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 hover:underline"
                              >
                                <Eye className="w-4 h-4" />
                                View Bill
                              </a>
                            ) : (
                              <span className="text-gray-500 text-sm">No bill</span>
                            )}
                          </TableCell>
                          {activeTab === "history" && (
                            <>
                              <TableCell className="py-4 px-6">
                                <span className="text-gray-700">{formatDateTime(actual)}</span>
                              </TableCell>
                              <TableCell className="py-4 px-6">
                                <span className="text-gray-700">{formatDate(receivedDate)}</span>
                              </TableCell>
                              <TableCell className="py-4 px-6">
                                <span className="text-gray-700 font-medium">{grnNumber || "N/A"}</span>
                              </TableCell>
                               <TableCell className="py-4 px-6">
                        {entry["Image Of Material Receipt"] ? (
                          <a 
                            href={getDriveUrl(entry["Image Of Material Receipt"])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 hover:underline"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">No image</span>
                        )}
                      </TableCell>
                            </>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {displayEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-gray-500">No entries found</p>
                  </div>
                ) : (
                  displayEntries.map((entry, index) => {
                    const orderNo = entry["Order No."] || "N/A"
                    const billType = entry["Type of Bill"] || "N/A"
                    const billNo = entry["Bill No"] || "N/A"
                    const billDate = entry["Bill Date"]
                    const partyName = entry["Party Name"] || "N/A"
                    const amount = entry["Total Bill Amount"] || "0"
                    const planned = entry["Planned "]
                    const actual = entry["Actual"]
                    const copyOfBill = entry["Copy Of Bill"]
                    const receivedDate = entry["Material Received Date"]
                    const grnNumber = entry["Grn Number"]

                    // Get proper Drive URL
                    const driveUrl = getDriveUrl(copyOfBill);

                    return (
                      <div
                        key={`${orderNo}-${index}`}
                        className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <Badge className="bg-blue-500 text-white text-xs mb-1">
                              Order #{orderNo}
                            </Badge>
                            <p className="font-semibold text-gray-900">{partyName}</p>
                            <p className="text-xs text-gray-500">{formatDate(billDate)}</p>
                          </div>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {billType}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Bill #:</span>
                            <Badge className="bg-green-500 text-white text-xs">
                              {billNo}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Amount:</span>
                            <span className="font-bold">₹{amount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Planned:</span>
                            <span className="text-yellow-700">{formatDateTime(planned)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Bill Copy:</span>
                            {driveUrl ? (
                              <a 
                                href={driveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </a>
                            ) : (
                              <span className="text-xs text-gray-500">No bill</span>
                            )}
                          </div>
                          {activeTab === "history" && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Actual:</span>
                                <span className="text-gray-700">{formatDateTime(actual)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Received:</span>
                                <span className="text-gray-700">{formatDate(receivedDate)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">GRN #:</span>
                                <span className="text-gray-700 font-medium">{grnNumber || "N/A"}</span>
                              </div>
                                <div className="flex justify-between">
                            <span className="text-gray-600">Material Receipt:</span>
                            {entry["Image Of Material Receipt"] ? (
                              <a 
                                href={getDriveUrl(entry["Image Of Material Receipt"])}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </a>
                            ) : (
                              <span className="text-xs text-gray-500">No image</span>
                            )}
                          </div>
                            </>
                          )}
                        </div>

                        {activeTab === "pending" && (
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <Button
                              size="sm"
                              onClick={() => handleMaterialEntry(entry)}
                              className="w-full bg-blue-600 hover:bg-blue-700"
                              disabled={submitting}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Submit Receipt
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Results Count */}
            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayEntries.length} of{" "}
              {activeTab === "pending" ? pendingEntries.length : historyEntries.length} entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Material Receipt Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <div>
                <CardTitle className="text-lg lg:text-xl">Submit Material Receipt</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Order: {selectedEntry["Order No."] || "N/A"}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-6">
                {/* Entry Information */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Entry Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">Order No: </span>
                      <span className="font-bold">{selectedEntry["Order No."] || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Bill No: </span>
                      <span className="font-bold">{selectedEntry["Bill No"] || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Party Name: </span>
                      <span>{selectedEntry["Party Name"] || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Total Amount: </span>
                      <span className="font-bold">₹{selectedEntry["Total Bill Amount"] || "0"}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Planned Date: </span>
                      <Badge className="bg-yellow-500 text-white ml-2">
                        {formatDateTime(selectedEntry["Planned "])}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Bill Date: </span>
                      <span>{formatDate(selectedEntry["Bill Date"])}</span>
                    </div>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">
                      Material Received Date *
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <p className="text-xs text-gray-500 mb-2">Date when materials were physically received</p>
                    <Input
                      type="date"
                      value={formData.materialReceivedDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, materialReceivedDate: e.target.value }))}
                      className="h-10"
                      required
                      disabled={submitting}
                    />
                  </div>

                 <div>
  <Label className="text-sm font-medium">Image Of Received Bill / Audio *</Label>
  <p className="text-xs text-gray-500 mb-2">Upload image or audio proof of receipt (required)</p>
  <div className="flex items-center gap-3">
    <div className="relative">
      <Input
        type="file"
        accept="image/*,.pdf,.mp3,.wav"
        onChange={handleImageUpload}
        className="hidden"
        id="file-upload"
        disabled={uploadingImage || submitting}
      />
      <button
        type="button"
        onClick={() => document.getElementById('file-upload')?.click()}
        disabled={uploadingImage || submitting}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
      >
        <Upload className="w-4 h-4 mr-2" />
        {uploadingImage ? "Uploading..." : "Upload File *"}
      </button>
    </div>
    
    {formData.imageOfReceivedBill && (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        ✓ File uploaded
      </Badge>
    )}
    {file && (
      <span className="text-sm truncate max-w-[150px]">{file.name}</span>
    )}
  </div>
  <p className="text-xs text-gray-500 mt-2">
    Required. Accepts image, PDF, or audio files (max 5MB)
  </p>
</div>

                  <div>
                    <Label className="text-sm font-medium">
                      GRN Number *
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <p className="text-xs text-gray-500 mb-2">Goods Received Note number</p>
                    <Input
                      value={formData.grnNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, grnNumber: e.target.value }))}
                      placeholder="Enter GRN number"
                      className="h-10"
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handleCancel} disabled={submitting} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={!formData.materialReceivedDate || !formData.grnNumber || submitting}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Submit Material Receipt
                      </>
                    )}
                  </Button>
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
          disabled={loading || submitting}
        >
          <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>
    </div>
  )
}