"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, Upload, Eye, Trash2, Truck } from "lucide-react"
import { getSignedUrl } from "@/lib/storageUtils"

// Image storage constants
const STORAGE_BUCKET = "images"
const STORAGE_FOLDER = "load-material"

export default function TestReportPage({ user }) {
  const [orders, setOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
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

      const { data, error } = await supabase
        .from('DISPATCH')
        .select('*')
        .not('Planned2', 'is', null)

      if (error) {
        throw error
      }

      console.log("Raw DISPATCH Supabase response:", data)

      const pending = []
      const history = []

      data.forEach(row => {
        const order = {
          id: row.id,
          timestamp: row["Timestamp"],
          dSrNumber: row["D-Sr Number"],
          deliveryOrderNo: row["Delivery Order No."],
          dispatchNo: row["D-Sr Number"],
          lgstSrNumber: row["LGST-Sr Number"],
          partyName: row["Party Name"],
          productName: row["Product Name"],
          qtyToBeDispatched: row["Qty To Be Dispatched"],
          actualTruckQty: row["Actual Truck Qty"],
          typeOfTransporting: row["Type Of Transporting"],
          transporterName: row["Transporter Name"],
          truckNo: row["Truck No."],
          driverMobileNo: row["Driver Mobile No."],
          vehicleNoPlateImage: row["Vehicle No. Plate Image"],
          biltyNo: row["Bilty No."],
          fixedAmount: row["Fixed Amount"],
          planned2: row["Planned2"],
          actual2: row["Actual2"],
          delay2: row["Delay2"],
          loadingImage1: row["Loading Image 1"],
          loadingImage2: row["Loading Image 2"],
          loadingImage3: row["Loading Image 3"],
        }

        if (order.actual2 === null || order.actual2 === "") {
          pending.push(order)
        } else {
          history.push(order)
        }
      })

      // Sort pending orders by Planned2 date (most recent first)
      pending.sort((a, b) => {
        if (!a.planned2) return 1
        if (!b.planned2) return -1
        return new Date(b.planned2) - new Date(a.planned2)
      })

      // Sort completed orders by Actual2 date (most recent first)
      history.sort((a, b) => {
        if (!a.actual2) return 1
        if (!b.actual2) return -1
        return new Date(b.actual2) - new Date(a.actual2)
      })

      setOrders(pending)
      setCompletedOrders(history)
      console.log("Load Material data loaded:", pending.length, "pending,", history.length, "history")
    } catch (error) {
      console.error("Error fetching load material data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch load material data"
      })
    } finally {
      setLoading(false)
    }
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
      toast({
        variant: "destructive",
        title: "Error",
        description: "File size should be less than 5MB",
      })
      return
    }

    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an image file",
      })
      return
    }

    // Generate local preview URL
    const localUrl = URL.createObjectURL(file)

    setFormData(prev => ({ ...prev, [imageKey]: file }))
    setUploadedUrls(prev => ({ ...prev, [imageKey]: localUrl }))
  }

  const removeImage = (imageNumber) => {
    const imageKey = `loadingImage${imageNumber}`
    setFormData(prev => ({ ...prev, [imageKey]: null }))
    setUploadedUrls(prev => ({ ...prev, [imageKey]: "" }))
  }

  const handleSubmit = async () => {
    if (!selectedOrder) return

    if (!formData.loadingImage1 && !formData.loadingImage2 && !formData.loadingImage3) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please upload at least one loading image (Loading Image 1 is mandatory)",
      })
      return
    }

    try {
      setSubmitting(true)

      const finalUrls = {
        loadingImage1: "",
        loadingImage2: "",
        loadingImage3: ""
      }

      // Upload files sequentially
      for (const num of [1, 2, 3]) {
        const imageKey = `loadingImage${num}`
        const file = formData[imageKey]

        if (file && file instanceof File) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${STORAGE_FOLDER}/load_material_${selectedOrder.lgstSrNumber}_img${num}_${Date.now()}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, file)

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(fileName)

          finalUrls[imageKey] = publicUrl
        }
      }

      const actualDateTime = getISTTimestamp()

      const { error } = await supabase
        .from('DISPATCH')
        .update({
          "Actual2": actualDateTime,
          "Loading Image 1": finalUrls.loadingImage1 || "",
          "Loading Image 2": finalUrls.loadingImage2 || "",
          "Loading Image 3": finalUrls.loadingImage3 || ""
        })
        .eq('id', selectedOrder.id)

      if (error) {
        throw error
      }

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

      toast({
        title: "Success",
        description: "Load Material submitted successfully!",
      })
    } catch (error) {
      console.error("Error submitting load material:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit. Error: ${error.message}`,
      })
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

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === "" || dateTimeString === " ") return "N/A"
    try {
      const date = new Date(dateTimeString)
      if (isNaN(date.getTime())) return dateTimeString
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch (e) {
      return dateTimeString
    }
  }

  const openImage = async (url) => {
    if (url) {
      const signedUrl = await getSignedUrl(url)
      window.open(signedUrl, '_blank')
    }
  }

  const totalParties = new Set([...orders, ...completedOrders].map(o => o.partyName)).size

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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Load Material</h1>
          <p className="text-gray-600">Upload loading images and complete material loading process</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Pending</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Completed Load Material</p>
              <div className="text-2xl font-bold text-green-900">{completedOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Parties</p>
              <div className="text-2xl font-bold text-purple-900">{totalParties}</div>
            </div>
            <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
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
            onClick={() => fetchLoadMaterialData()}
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
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Pending ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            History ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Action</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">LGST-Sr Number</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Delivery Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Dispatch No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Product Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Truck Qty</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Transporter</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Truck No</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Planned2</TableHead>
                {activeTab === "history" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Loading Images</TableHead>
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
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">
                        {activeTab === "pending"
                          ? "No pending load material orders found."
                          : "No completed load material orders found."}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    {activeTab === "pending" && (
                      <TableCell className="py-2 px-4 min-w-[100px]">
                        <Button
                          size="sm"
                          onClick={() => handleLoadMaterial(order)}
                          className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                          disabled={submitting}
                        >
                          <Upload className="w-3 h-3 mr-1" />
                          Load
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="py-2 px-4 min-w-[120px]">
                      <Badge className="bg-blue-500 text-white rounded-sm whitespace-nowrap text-xs">
                        {order.lgstSrNumber || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] font-medium text-sm">
                      {order.deliveryOrderNo || "N/A"}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px]">
                      <Badge className="bg-purple-500 text-white rounded-sm whitespace-nowrap text-xs">
                        {order.dispatchNo || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      {order.partyName || "N/A"}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      {order.productName || "N/A"}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[100px] font-medium text-sm">
                      {order.actualTruckQty || "N/A"}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      {order.transporterName || "N/A"}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px]">
                      <Badge variant="outline" className="rounded-sm font-normal text-xs">
                        {order.truckNo || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] font-medium whitespace-nowrap text-sm">
                      {order.planned2 ? (
                        <span className="text-orange-600">{formatDateTime(order.planned2)}</span>
                      ) : "N/A"}
                    </TableCell>
                    {activeTab === "history" && (
                      <TableCell className="py-2 px-4 min-w-[150px]">
                        <div className="flex flex-wrap gap-1">
                          {order.loadingImage1 && (
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover:bg-blue-50 text-xs font-normal"
                              onClick={() => openImage(order.loadingImage1)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Img 1
                            </Badge>
                          )}
                          {order.loadingImage2 && (
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover:bg-blue-50 text-xs font-normal"
                              onClick={() => openImage(order.loadingImage2)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Img 2
                            </Badge>
                          )}
                          {order.loadingImage3 && (
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover:bg-blue-50 text-xs font-normal"
                              onClick={() => openImage(order.loadingImage3)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Img 3
                            </Badge>
                          )}
                          {!order.loadingImage1 && !order.loadingImage2 && !order.loadingImage3 && (
                            <span className="text-gray-400 text-xs">No images</span>
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
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Complete Load Material</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Order Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">LGST-Sr Number</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.lgstSrNumber || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Delivery Order No.</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.deliveryOrderNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Dispatch No.</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.dispatchNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Party Name</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.partyName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Product Name</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.productName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Actual Truck Qty</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.actualTruckQty || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Transporter</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.transporterName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Truck No</Label>
                      <p className="font-medium text-gray-900">{selectedOrder.truckNo || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Planned Date / Time</Label>
                      <p className="font-medium text-orange-600 font-medium">
                        {formatDateTime(selectedOrder.planned2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="w-1 h-6 bg-blue-600 rounded-full inline-block"></span>
                    Upload Loading Images
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Please upload at least one loading image. Image 1 is mandatory. Max file size: 5MB each.
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

                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            ref={num === 1 ? fileInputRef1 : num === 2 ? fileInputRef2 : fileInputRef3}
                            onChange={(e) => handleFileSelect(e, num)}
                            className="hidden"
                            disabled={submitting}
                          />
                          <Button
                            variant="outline"
                            className="w-full h-24 border-dashed bg-gray-50 hover:bg-gray-100"
                            onClick={() => {
                              if (num === 1) fileInputRef1.current.click()
                              else if (num === 2) fileInputRef2.current.click()
                              else fileInputRef3.current.click()
                            }}
                            disabled={submitting || uploadingImages[`loadingImage${num}`]}
                          >
                            <div className="flex flex-col items-center">
                              <Upload className="w-6 h-6 mb-2 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {uploadedUrls[`loadingImage${num}`] ? "✓ Uploaded" : `Click to Upload`}
                              </span>
                            </div>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                    <p className="text-sm text-blue-700 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        The "Actual2" field will be auto-populated with the current date/time when you submit.
                      </span>
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
    </div>
  )
}