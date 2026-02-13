"use client"

import { useState, useEffect } from "react"
import { getISTDisplayDate } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Search, CheckCircle2, Loader2, Upload, Eye } from "lucide-react"

import { supabase } from "@/lib/supabaseClient"
import { getISTDate } from "@/lib/dateUtils"
import { useNotification } from "@/components/providers/NotificationProvider"
import { Package, Truck, Scale } from "lucide-react"
import { getSignedUrl } from "@/lib/storageUtils"

export default function WeighmentEntryPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const { updateCount } = useNotification()
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

      // Fetch from DELIVERY table where Planned 1 is not null
      const { data, error } = await supabase
        .from('DELIVERY')
        .select('*')
        .not('Planned 1', 'is', null)

      if (error) throw error

      if (data) {
        const pendingOrders = []
        const historyOrdersData = []

        data.forEach(row => {
          // Map row to order object
          const order = {
            id: row.id,
            rowIndex: row.id, // Using ID as reference
            timestamp: row["Timestamp"],
            billDate: formatDate(row["Bill Date"]),
            deliveryOrderNo: row["Delivery Order No."],
            dSrNumber: row["D-Sr Number"],
            partyName: row["Party Name"],
            productName: row["Product Name"],
            // Note: Sales.jsx uses "Quantity Delivered."
            quantityDelivered: row["Quantity Delivered."] || row["Quantity Delivered"] || "",
            billNo: row["Bill No."],
            logisticNo: row["Losgistic no."] || row["Logistic No."] || "", // Handled typo from Sales.jsx
            rateOfMaterial: row["Rate Of Material"],
            typeOfTransporting: row["Type Of Transporting"],
            transporterName: row["Transporter Name"],
            vehicleNumber: row["Vehicle Number."] || row["Vehicle Number"],
            biltyNumber: row["Bilty Number."] || row["Bilty Number"],
            givingFromWhere: row["Giving From Where"],

            // Weighment specific columns
            planned1: formatDate(row["Planned 1"]),
            actual1: row["Actual 1"] ? formatDate(row["Actual 1"]) : "",
            rawActual1: row["Actual 1"],

            imageOfSlip: row["Image Of Slip"] || row["Loading Image 1"],
            imageOfSlip2: row["Image Of Slip2"] || row["Loading Image 2"],
            imageOfSlip3: row["Image Of Slip3"] || row["Loading Image 3"],
            remarks: row["Remarks"],
            actualQtyLoadedInTruck: row["Actual Qty loaded In Truck (Total Qty)"] || row["Actual Truck Qty"],
            actualQtyAsPerWeighmentSlip: row["Actual Qty As Per Weighment Slip"],

            // Helper booleans
            hasImageOfSlip: !!(row["Image Of Slip"] || row["Loading Image 1"]),
            hasImageOfSlip2: !!(row["Image Of Slip2"] || row["Loading Image 2"]),
            hasImageOfSlip3: !!(row["Image Of Slip3"] || row["Loading Image 3"]),
          }

          // Logic: Pending if Planned 1 exists (query ensures this) AND Actual 1 is null.
          if (!order.rawActual1) {
            pendingOrders.push(order)
          } else {
            historyOrdersData.push(order)
          }
        })

        // Sort by ID descending
        setOrders(pendingOrders.sort((a, b) => b.id - a.id))
        setHistoryOrders(historyOrdersData.sort((a, b) => b.id - a.id))

        // Update notification count for sidebar
        updateCount?.("Weighment Entry", pendingOrders.length)

        console.log("Supabase Delivery Data - Pending:", pendingOrders.length, "History:", historyOrdersData.length)
      }

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch data from Supabase"
      })
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

  const handleWeighment = (order) => {
    const actual1Date = getISTDate()

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



  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)

      const actual1Date = getISTDate() // Used standardized date utility

      // Helper function to upload file to Supabase Storage
      const uploadFileToSupabase = async (file, path) => {
        try {
          const { data, error } = await supabase.storage
            .from('images')
            .upload(path, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (error) throw error

          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(path)

          return publicUrl
        } catch (error) {
          console.error("Error uploading file:", error)
          throw error
        }
      }

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
            // Create a unique file path
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const safeFileName = fileField.field.name.replace(/[^a-zA-Z0-9.]/g, '_')
            const filePath = `weighment/${selectedOrder.id}_${fileField.name}_${dateStr}_${safeFileName}`

            const publicUrl = await uploadFileToSupabase(fileField.field, filePath)

            if (publicUrl) {
              uploadedFiles.push({
                type: fileField.type,
                url: publicUrl
              })
            }
          } catch (uploadError) {
            console.error(`Error uploading ${fileField.type}:`, uploadError)
            toast({
              variant: "destructive",
              title: "Upload Failed",
              description: `Failed to upload ${fileField.type}. proceeding without it.`
            })
          }
        }
      }

      // Update DELIVERY table in Supabase
      const updatePayload = {
        "Actual 1": actual1Date,
        "Remarks": formData.remarks || "",
        "Actual Qty loaded In Truck (Total Qty)": formData.actualQtyLoadedInTruck ? parseFloat(formData.actualQtyLoadedInTruck) : null,
        "Actual Qty As Per Weighment Slip": formData.actualQtyAsPerWeighmentSlip ? parseFloat(formData.actualQtyAsPerWeighmentSlip) : null,
      }

      // Add uploaded file URLs if they exist
      const slip1Url = uploadedFiles.find(f => f.type === "Image Of Slip")?.url
      if (slip1Url) updatePayload["Image Of Slip"] = slip1Url

      const slip2Url = uploadedFiles.find(f => f.type === "Image Of Slip2")?.url
      if (slip2Url) updatePayload["Image Of Slip2"] = slip2Url

      const slip3Url = uploadedFiles.find(f => f.type === "Image Of Slip3")?.url
      if (slip3Url) updatePayload["Image Of Slip3"] = slip3Url

      const { error: updateError } = await supabase
        .from('DELIVERY')
        .update(updatePayload)
        .eq('id', selectedOrder.id)

      if (updateError) throw updateError

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

      toast({
        title: "Success",
        description: `Weighment entry submitted successfully! Actual1 Date: ${actual1Date}`,
      })

    } catch (error) {
      console.error("Error submitting weighment entry:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit: ${error.message}`,
      })
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

  // Function to open Google Drive link or Signed Supabase URL
  const openImageLink = async (url) => {
    if (url && url.trim() !== "") {
      const signedUrl = await getSignedUrl(url)
      window.open(signedUrl, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading weighment data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weighment Entry</h1>
          <p className="text-gray-600">Manage weighment entries</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Entries</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length + historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <Package className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Weighment</p>
              <div className="text-2xl font-bold text-amber-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Scale className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">History</p>
              <div className="text-2xl font-bold text-green-900">{historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
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
            onClick={() => fetchData()}
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
            Completed ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        {/* Mobile View - Cards */}
        <div className="block lg:hidden p-4 space-y-4 bg-gray-50">
          {displayOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-dashed">
              <div className="flex flex-col items-center gap-2">
                <span className="text-lg">No {activeTab} weighment entries found</span>
              </div>
            </div>
          ) : (
            displayOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{order.partyName}</h3>
                    <p className="text-xs text-gray-500">DO: {order.deliveryOrderNo} | DS: {order.dSrNumber || "N/A"}</p>
                  </div>
                  <Badge className="bg-green-500 text-white rounded-sm text-xs h-6">
                    {order.billNo}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm border-t border-b border-gray-100 py-3">
                  <div>
                    <p className="text-xs text-gray-500">Product</p>
                    <p className="font-medium text-gray-900 truncate">{order.productName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Qty</p>
                    <p className="font-medium text-gray-900">{order.quantityDelivered}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Bill Date</p>
                    <p className="font-medium text-gray-900">{order.billDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Planned1</p>
                    <p className="font-medium text-gray-900">{order.planned1}</p>
                  </div>
                </div>

                {activeTab === "pending" && (
                  <div className="grid grid-cols-2 gap-3 text-sm pb-2">
                    <div>
                      <p className="text-xs text-gray-500">Transporter</p>
                      <p className="font-medium text-gray-900 truncate">{order.transporterName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Vehicle</p>
                      <p className="font-medium text-gray-900 truncate">{order.vehicleNumber || "N/A"}</p>
                    </div>
                  </div>
                )}

                {activeTab === "pending" && (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 h-9 mt-1"
                    onClick={() => handleWeighment(order)}
                    disabled={submitting}
                  >
                    Entry
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Action</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Delivery Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">D-Sr Number</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Bill Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Bill No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Product Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Quantity</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Planned1</TableHead>
                {activeTab === "pending" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Logistic No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Transporter</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Vehicle No.</TableHead>
                  </>
                )}
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Actual1</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Truck Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Weighment Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Slips</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Remarks</TableHead>
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
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No {activeTab} weighment entries found</span>
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
                          onClick={() => handleWeighment(order)}
                          className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                          disabled={submitting}
                        >
                          Entry
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="py-2 px-4 min-w-[150px] font-medium text-sm">
                      {order.deliveryOrderNo}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                      <Badge variant="outline" className="font-mono bg-purple-50 text-purple-700 border-purple-200">
                        {order.dSrNumber || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                      {order.billDate}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px]">
                      <Badge className="bg-green-500 text-white rounded-sm text-xs">
                        {order.billNo}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.partyName}</TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      <div className="max-w-[200px]">
                        <span className="break-words">{order.productName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] font-medium text-sm">{order.quantityDelivered}</TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.planned1 || "N/A"}</TableCell>
                    {activeTab === "pending" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.logisticNo || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.transporterName || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.vehicleNumber || "N/A"}</TableCell>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.actual1}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px] text-sm">{order.actualQtyLoadedInTruck || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.actualQtyAsPerWeighmentSlip || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px]">
                          <div className="flex gap-1 flex-wrap">
                            {order.imageOfSlip && (
                              <Badge
                                className="bg-blue-500 text-white text-[10px] cursor-pointer hover:bg-blue-600 rounded-sm px-1 py-0.5"
                                onClick={() => openImageLink(order.imageOfSlip)}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Slip1
                              </Badge>
                            )}
                            {order.imageOfSlip2 && (
                              <Badge
                                className="bg-blue-500 text-white text-[10px] cursor-pointer hover:bg-blue-600 rounded-sm px-1 py-0.5"
                                onClick={() => openImageLink(order.imageOfSlip2)}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Slip2
                              </Badge>
                            )}
                            {order.imageOfSlip3 && (
                              <Badge
                                className="bg-blue-500 text-white text-[10px] cursor-pointer hover:bg-blue-600 rounded-sm px-1 py-0.5"
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
                        <TableCell className="py-2 px-4 max-w-[150px] text-sm">
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
      </div>

      {/* Weighment Entry Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Weighment Entry Form</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-900">DO: {selectedOrder.deliveryOrderNo}</p>
                  <p className="text-sm text-gray-600 mt-1">
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
                              toast({
                                variant: "destructive",
                                title: "Error",
                                description: "File size should be less than 5MB",
                              })
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
                        <span className="text-sm text-green-600 truncate flex-shrink-0">
                          ✓ Selected
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
                              toast({
                                variant: "destructive",
                                title: "Error",
                                description: "File size should be less than 5MB",
                              })
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
                        <span className="text-sm text-green-600 truncate flex-shrink-0">
                          ✓ Selected
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
                              toast({
                                variant: "destructive",
                                title: "Error",
                                description: "File size should be less than 5MB",
                              })
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
                        <span className="text-sm text-green-600 truncate flex-shrink-0">
                          ✓ Selected
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
    </div>
  )
}