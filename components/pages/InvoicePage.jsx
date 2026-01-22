"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Search, CheckCircle2, Loader2 } from "lucide-react"

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

export default function InvoicePage({ user }) {
  const [orders, setOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    billNo: "",
    logisticNo: "",
    rateOfMaterial: "",
    remarks: ""
  })

  useEffect(() => {
    fetchInvoiceData()
  }, [])

  const fetchInvoiceData = async () => {
    try {
      setLoading(true)
      
      // Fetch from BILLING sheet
      const response = await fetch(`${SCRIPT_URL}?sheet=BILLING`)
      if (response.ok) {
        const data = await response.json()
        console.log("Raw BILLING API response for Invoice:", data)
        
        if (data.success && data.data) {
          const { pending, completed } = transformBillingDataForInvoice(data.data)
          setOrders(pending)
          setCompletedOrders(completed)
          console.log("Invoice data loaded - Pending:", pending.length, "Completed:", completed.length)
          if (pending.length > 0) {
            console.log("First pending invoice order:", pending[0])
          }
        }
      }
      
    } catch (error) {
      console.error("Error fetching invoice data:", error)
    } finally {
      setLoading(false)
    }
  }

  const transformBillingDataForInvoice = (sheetData) => {
    if (!sheetData || sheetData.length === 0) return { pending: [], completed: [] }
    
    console.log("Raw BILLING sheet data length:", sheetData.length)
    
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
          console.log("Headers with indices:")
          headers.forEach((header, idx) => {
            console.log(`  [${idx}] "${header}"`)
          })
          break
        }
      }
    }
    
    if (headerRowIndex === -1) {
      console.error("Could not find header row")
      return { pending: [], completed: [] }
    }
    
    // Find column indices
    const findIndex = (patterns, exact = false) => {
      for (const pattern of patterns) {
        const index = headers.findIndex(h => {
          if (!h) return false
          const headerLower = h.toString().toLowerCase().trim()
          const patternLower = pattern.toLowerCase().trim()
          if (exact) {
            return headerLower === patternLower
          }
          return headerLower.includes(patternLower)
        })
        if (index !== -1) {
          console.log(`Found "${pattern}" at index ${index} (header: "${headers[index]}")`)
          return index
        }
      }
      console.log(`Column not found for patterns: ${patterns}`)
      return -1
    }
    
    // Find all required columns
    const indices = {
      timestamp: findIndex(["timestamp"]),
      deliveryOrderNo: findIndex(["delivery order"]),
      dispatchNo: findIndex(["dispatch no", "dispatch"]),
      lgstSrNumber: findIndex(["lgst-sr", "lgst"]),
      partyName: findIndex(["party name"]),
      productName: findIndex(["product name"]),
      actualTruckQty: findIndex(["actual truck qty"]),
      typeOfTransporting: findIndex(["type of transporting"]),
      transporterName: findIndex(["transporter name"]),
      truckNo: findIndex(["truck no", "truck"]),
      driverMobileNo: findIndex(["driver mobile"]),
vehiclePlateImage: findIndex(["vehicle no. plate image", "vehicle no plate", "vehicle plate", "plate image", "vehicle no"]),
      biltyNo: findIndex(["bilty no", "bilty"]),
      typeOfRate: findIndex(["type of rate"]),
      transportRate: findIndex(["transport rate"]),
      fixedAmount: findIndex(["fixed amount"]),
      partyPONumber: findIndex(["party po number"]),
      partyPODate: findIndex(["party po date"]),
      rateOfMaterial: findIndex(["rate of material"]),
      planned: findIndex(["planned 2", "planned2", "planned"]),
      actual: findIndex(["actual 2", "actual2", "actual"]),
      remarks: findIndex(["remarks", "remar"]),
      timeDelay: findIndex(["time delay"])
    }
    
    // Debug column indices
    console.log("INVOICE Column indices:", indices)
    console.log("Planned 2 column index:", indices.planned)
    console.log("Actual 2 column index:", indices.actual)
    
    const pendingOrders = []
    const completedOrders = []
    
    // Process data rows
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
     const getVal = (index) => {
  if (index >= 0 && index < row.length && row[index] !== undefined && row[index] !== null) {
    const value = row[index].toString().trim()
    
    // Special handling for vehicle plate image - convert partial URLs to full Google Drive links
    if (index === indices.vehiclePlateImage && value && value !== "" && value !== "N/A") {
      console.log(`Vehicle Plate Image raw value: "${value}"`)
      
      // Check if it's a Google Drive partial URL
      if (value.includes('export=view') || value.includes('export%3Dview') || value.includes('id=')) {
        // Extract the file ID from the URL
        let fileId = '';
        
        // Try to extract from different URL patterns
        if (value.includes('id=')) {
          const idMatch = value.match(/id=([a-zA-Z0-9_-]+)/);
          if (idMatch && idMatch[1]) {
            fileId = idMatch[1];
          }
        } else if (value.includes('/d/')) {
          const idMatch = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (idMatch && idMatch[1]) {
            fileId = idMatch[1];
          }
        }
        
        // If we found a file ID, create the full Google Drive viewer URL
        if (fileId) {
          const fullUrl = `https://drive.google.com/file/d/${fileId}/view`;
          console.log(`Converted to full URL: ${fullUrl}`);
          return fullUrl;
        }
        
        // If no file ID found but looks like a partial URL, try to reconstruct
        if (value.includes('export=view') || value.includes('export%3Dview')) {
          const urlParams = new URLSearchParams(value);
          const id = urlParams.get('id') || value.split('id=')[1]?.split('&')[0];
          if (id) {
            const fullUrl = `https://drive.google.com/file/d/${id}/view`;
            console.log(`Reconstructed URL: ${fullUrl}`);
            return fullUrl;
          }
        }
      }
      
      // If it's already a full URL or couldn't parse, return as is
      return value;
    }
    
    return value;
  }
  return ""
}
      
      const planned = getVal(indices.planned)
      const actual = getVal(indices.actual)
      const remarks = getVal(indices.remarks)
      const lgstSrNumber = getVal(indices.lgstSrNumber)
      
      // Skip rows without LGST number
      if (!lgstSrNumber || lgstSrNumber === "" || lgstSrNumber.toLowerCase() === "lgst-sr number") {
        continue
      }
      
      // Create order object with all required fields
      const order = {
        id: i,
        timestamp: getVal(indices.timestamp),
        deliveryOrderNo: getVal(indices.deliveryOrderNo),
        dispatchNo: getVal(indices.dispatchNo),
        lgstSrNumber: lgstSrNumber,
        partyName: getVal(indices.partyName),
        productName: getVal(indices.productName),
        actualTruckQty: getVal(indices.actualTruckQty),
        typeOfTransporting: getVal(indices.typeOfTransporting),
        transporterName: getVal(indices.transporterName),
        truckNo: getVal(indices.truckNo),
        driverMobileNo: getVal(indices.driverMobileNo),
        vehiclePlateImage: getVal(indices.vehiclePlateImage),
        biltyNo: getVal(indices.biltyNo),
        typeOfRate: getVal(indices.typeOfRate),
        transportRate: getVal(indices.transportRate),
        fixedAmount: getVal(indices.fixedAmount),
        partyPONumber: getVal(indices.partyPONumber),
        partyPODate: getVal(indices.partyPODate),
        rateOfMaterial: getVal(indices.rateOfMaterial),
        planned: planned,
        actual: actual,
        remarks: remarks,
        timeDelay: getVal(indices.timeDelay),
        isPending: false,
        isCompleted: false
      }
      
      // Check if Planned 2 has date AND Actual 2 is empty (Invoice pending)
      const hasPlanned = planned && planned !== "" && planned !== "N/A" && planned !== "0"
      const hasActual = actual && actual !== "" && actual !== "N/A"
      
      if (hasPlanned && !hasActual) {
        order.isPending = true
        pendingOrders.push(order)
      }
      // Check if Actual 2 has date (Invoice completed)
      else if (hasActual) {
        order.isCompleted = true
        completedOrders.push(order)
      }
    }
    
    console.log("Invoice Pending orders:", pendingOrders.length)
    console.log("Invoice Completed orders:", completedOrders.length)
    
    return { pending: pendingOrders, completed: completedOrders }
  }

  const pendingOrders = orders
  const historyOrders = completedOrders

  const searchFilteredOrders = (ordersList) => {
    return ordersList.filter((order) =>
      Object.values(order).some((value) => 
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayOrders = activeTab === "pending" 
    ? searchFilteredOrders(pendingOrders) 
    : searchFilteredOrders(historyOrders)

  const handleInvoice = (order) => {
    setSelectedOrder(order)
    setFormData({
      billNo: "",
      logisticNo: "",
      rateOfMaterial: order.rateOfMaterial || "",
      remarks: order.remarks || ""
    })
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)
      
      // Prepare data for BILLING sheet update
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
      
      // First, we need to find the column numbers for "Actual 2" and "Remarks"
      const headersResponse = await fetch(`${SCRIPT_URL}?sheet=BILLING`)
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
        throw new Error("Could not find headers in BILLING sheet")
      }
      
      // Find the column indices
      const findIndex = (patterns, exact = false) => {
        for (const pattern of patterns) {
          const index = headers.findIndex(h => {
            if (!h) return false
            const headerLower = h.toString().toLowerCase().trim()
            const patternLower = pattern.toLowerCase().trim()
            if (exact) {
              return headerLower === patternLower
            }
            return headerLower.includes(patternLower)
          })
          if (index !== -1) return index + 1 // +1 because Google Sheets columns are 1-indexed
        }
        return -1
      }
      
      // Find Actual 2 column
      let actualColIndex = findIndex(["actual 2", "actual2", "actual"], true)
      if (actualColIndex === -1) {
        actualColIndex = findIndex(["actual 2", "actual2", "actual"])
      }
      
      // Find Remarks column
      let remarksColIndex = findIndex(["remarks", "remar"], false)
      
      console.log("Actual 2 column index for update:", actualColIndex)
      console.log("Remarks column index for update:", remarksColIndex)
      
      if (actualColIndex === -1) {
        throw new Error("Could not find 'Actual 2' column in BILLING sheet")
      }
      
      // Update Actual 2 column with current date/time
      const updateActualData = {
        action: 'updateCell',
        sheetName: 'BILLING',
        rowIndex: selectedOrder.id + 1, // +1 because Google Sheets rows are 1-indexed
        columnIndex: actualColIndex,
        value: actualDateTime
      }
      
      console.log("Updating Actual 2 column:", updateActualData)
      
      const actualResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(updateActualData)
      })

      if (!actualResponse.ok) {
        throw new Error(`HTTP error! status: ${actualResponse.status}`)
      }

      const actualResult = await actualResponse.json()
      console.log("Google Apps Script response for Actual 2:", actualResult)

      // Update Remarks column if user entered remarks
      if (remarksColIndex !== -1 && formData.remarks) {
        const updateRemarksData = {
          action: 'updateCell',
          sheetName: 'BILLING',
          rowIndex: selectedOrder.id + 1,
          columnIndex: remarksColIndex,
          value: formData.remarks
        }
        
        console.log("Updating Remarks column:", updateRemarksData)
        
        const remarksResponse = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(updateRemarksData)
        })

        if (!remarksResponse.ok) {
          console.warn("Failed to update remarks, but continuing...")
        }
      }

      if (actualResult.success) {
        // Refresh data
        await fetchInvoiceData()
        
        // Clear form
        setSelectedOrder(null)
        setFormData({
          billNo: "",
          logisticNo: "",
          rateOfMaterial: "",
          remarks: ""
        })
        
        alert("✓ Invoice completed successfully!")
        
      } else {
        throw new Error(actualResult.error || "Failed to submit to Google Sheets")
      }
      
    } catch (error) {
      console.error("Error completing invoice:", error)
      alert(`✗ Failed to complete invoice. Error: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      billNo: "",
      logisticNo: "",
      rateOfMaterial: "",
      remarks: ""
    })
  }

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
      {/* Desktop Header */}
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-gray-900">Invoice</h1>
        <p className="text-gray-600">Manage invoices for completed test reports</p>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
        <p className="text-sm text-gray-600 mt-1">Manage invoices for completed test reports</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Invoice Management</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Pending: {pendingOrders.length} | Completed: {historyOrders.length}
          </p>
          {pendingOrders.length === 0 && historyOrders.length > 0 && (
            <p className="text-sm text-yellow-600 mt-1">
              ℹ️ All invoices have been completed. Check if the "Actual 2" column is empty in your BILLING sheet.
            </p>
          )}
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

            {/* Search Bar */}
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
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Dispatch No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">LGST-Sr Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Product Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual Truck Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Type Of Transporting</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Transporter Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Truck No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Driver Mobile No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Vehicle Plate Image</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bilty No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Type Of Rate</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Transport Rate</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Fixed Amount</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Planned 2</TableHead>
                    {activeTab === "pending" ? (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual 2</TableHead>
                    ) : (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Actual 2</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Remarks</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={activeTab === "pending" ? 18 : 19} 
                        className="text-center py-8 text-gray-500"
                      >
                        {activeTab === "pending" 
                          ? "No pending invoices found."
                          : "No completed invoices found."
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
                                onClick={() => handleInvoice(order)}
                                className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                                disabled={submitting}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Done
                              </Button>
                            </div>
                          </TableCell>
                        )}
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
                          <Badge className="bg-blue-500 text-white rounded-full whitespace-nowrap">
                            {order.lgstSrNumber || "N/A"}
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
                            <span className="break-words">{order.typeOfTransporting || "N/A"}</span>
                          </div>
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
                        <TableCell className="py-4 px-6 font-medium">
                          {order.driverMobileNo || "N/A"}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {order.vehiclePlateImage && order.vehiclePlateImage !== "" && order.vehiclePlateImage !== "N/A" ? (
                            <a 
                              href={order.vehiclePlateImage} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline text-sm"
                            >
                              View Image
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {order.biltyNo || "N/A"}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge className="bg-orange-500 text-white rounded-full">
                            {order.typeOfRate || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium">
                          {order.transportRate || "N/A"}
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium">
                          {order.fixedAmount || "N/A"}
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium whitespace-nowrap text-orange-600">
                          {order.planned || "N/A"}
                        </TableCell>
                        {activeTab === "pending" ? (
                          <TableCell className="py-4 px-6 text-gray-400 italic">
                            Pending
                          </TableCell>
                        ) : (
                          <>
                            <TableCell className="py-4 px-6 font-medium whitespace-nowrap text-green-600">
                              {order.actual || "N/A"}
                            </TableCell>
                            <TableCell className="py-4 px-6 max-w-[200px]">
                              <p className="text-sm break-words">{order.remarks || "No remarks"}</p>
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
                    {activeTab === "pending" 
                      ? "No pending invoices found."
                      : "No completed invoices found."
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
                              onClick={() => handleInvoice(order)}
                              className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                              disabled={submitting}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Done
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
                          <span className="text-gray-600">Driver Mobile:</span>
                          <span className="font-medium">{order.driverMobileNo || "N/A"}</span>
                        </div>
                     <div className="flex justify-between">
                        <span className="text-gray-600">Vehicle Plate Image:</span>
                        <span className="font-medium">
                          {order.vehiclePlateImage && order.vehiclePlateImage !== "" && order.vehiclePlateImage !== "N/A" ? (
                            <a 
                              href={order.vehiclePlateImage} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline text-sm"
                            >
                              View Image
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </span>
                      </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bilty No:</span>
                          <span className="font-medium">{order.biltyNo || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type of Rate:</span>
                          <Badge className="bg-orange-500 text-white text-xs">
                            {order.typeOfRate || "N/A"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transport Rate:</span>
                          <span className="font-medium">{order.transportRate || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fixed Amount:</span>
                          <span className="font-medium">{order.fixedAmount || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned 2:</span>
                          <span className="font-medium text-orange-600">
                            {order.planned || "N/A"}
                          </span>
                        </div>
                        {activeTab === "pending" ? (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Actual 2:</span>
                            <span className="text-gray-400 italic">Pending</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Actual 2:</span>
                              <span className="font-medium text-green-600">
                                {order.actual || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Remarks:</span>
                              <span className="font-medium text-right break-words max-w-[60%]">
                                {order.remarks || "None"}
                              </span>
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
              Showing {displayOrders.length} of {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Complete Invoice</CardTitle>
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
                      <Label className="text-sm text-gray-500">Planned 2 Date/Time</Label>
                      <p className="font-medium text-orange-600">
                        {selectedOrder.planned || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-3">Invoice Completion</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Actual 2 Date/Time (Auto-filled)</Label>
                      <Input
                        value={new Date().toLocaleString()}
                        className="h-10 bg-gray-50"
                        disabled
                      />
                      <p className="text-xs text-gray-500">
                        Current date/time will be saved to the "Actual 2" column
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Bill No (Optional)</Label>
                      <Input
                        value={formData.billNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, billNo: e.target.value }))}
                        placeholder="Enter bill number"
                        className="h-10"
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Logistic No (Optional)</Label>
                      <Input
                        value={formData.logisticNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, logisticNo: e.target.value }))}
                        placeholder="Enter logistic number"
                        className="h-10"
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Rate of Material (Optional)</Label>
                      <Input
                        value={formData.rateOfMaterial}
                        onChange={(e) => setFormData(prev => ({ ...prev, rateOfMaterial: e.target.value }))}
                        placeholder="Enter rate of material"
                        className="h-10"
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Remarks (Optional)</Label>
                      <Textarea
                        value={formData.remarks}
                        onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                        placeholder="Enter any remarks about the invoice..."
                        className="min-h-[100px]"
                        disabled={submitting}
                      />
                      <p className="text-xs text-gray-500">
                        This will be saved to the "Remarks" column (optional)
                      </p>
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
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Complete Invoice
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