"use client"

import { useState, useEffect } from "react"
import { getISTDisplayDate, getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, Upload, FileText, FileCheck, CheckSquare, Clock } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabaseClient"
import { useNotification } from "@/components/providers/NotificationProvider"
import { getSignedUrl } from "@/lib/storageUtils"

export default function BiltyEntryPage({ user }) {
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
    biltyCopy: null,
    biltyNo: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('DELIVERY')
        .select('*')
        .not('Planned 3', 'is', null)

      if (error) throw error

      if (data) {
        const pendingOrders = []
        const historyOrdersData = []

        data.forEach(row => {
          const order = {
            id: row.id,
            rowIndex: row.id,
            timestamp: row["Timestamp"],
            billDate: row["Bill Date"], // Assuming date type or string
            deliveryOrderNo: row["Delivery Order No."],
            partyName: row["Party Name"],
            productName: row["Product Name"],
            quantityDelivered: row["Quantity Delivered."] || row["Quantity Delivered"],
            billNo: row["Bill No."],
            logisticNo: row["Losgistic no."] || row["Logistic No."],
            dSrNumber: row["D-Sr Number"],
            rateOfMaterial: row["Rate Of Material"],
            typeOfTransporting: row["Type Of Transporting"],
            transporterName: row["Transporter Name"],
            vehicleNumber: row["Vehicle Number."] || row["Vehicle Number"],
            biltyNumber: row["Bilty Number."] || row["Bilty Number"], // Existing Bilty Number col?
            givingFromWhere: row["Giving From Where"],
            // Level 1, 2
            planned1: row["Planned 1"],
            actual1: row["Actual 1"],
            planned2: row["Planned 2"],
            actual2: row["Actual 2"],
            // Level 3 (Bilty Entry)
            planned3: row["Planned 3"] ? formatDisplayDate(row["Planned 3"]) : "",
            actual3: row["Actual3"] ? formatDisplayDate(row["Actual3"]) : "",
            rawActual3: row["Actual3"],
            delay3: row["Delay3"],

            // Bilty details
            biltyCopy: row["Bilty Copy"],
            biltyNo: row["Bilty No."],
            hasBiltyCopy: !!row["Bilty Copy"],
            existingBiltyNo: row["Bilty No."],
          }

          // Logic: Pending if Planned 3 exists (guaranteed by query) AND Actual3 is null
          if (!order.rawActual3) {
            pendingOrders.push(order)
          } else {
            // History: Both not null
            historyOrdersData.push(order)
          }
        })

        setOrders(pendingOrders.sort((a, b) => b.id - a.id))
        setHistoryOrders(historyOrdersData.sort((a, b) => b.id - a.id))

        console.log("Pending orders:", pendingOrders.length, "History orders:", historyOrdersData.length)

        // Update notification count
        updateCount?.("Bilty Entry", pendingOrders.length)
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

  // Helper function to format date
  const formatDisplayDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === "") return "N/A"
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return format(date, "dd/MM/yyyy")
    }
    return dateStr
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

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)

      const actual3Time = getISTTimestamp()
      let biltyCopyUrl = ""

      // Upload bilty copy if provided
      if (formData.biltyCopy) {
        try {
          // Create unique file path
          const timestamp = Date.now()
          const safeFileName = formData.biltyCopy.name.replace(/[^a-zA-Z0-9.]/g, '_')
          const filePath = `bilty/${selectedOrder.id}_bilty_${timestamp}_${safeFileName}`

          const publicUrl = await uploadFileToSupabase(formData.biltyCopy, filePath)
          if (publicUrl) biltyCopyUrl = publicUrl

        } catch (uploadError) {
          console.error("Error uploading bilty copy:", uploadError)
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload bilty copy"
          })
        }
      }

      // Update DELIVERY table
      const updatePayload = {
        "Actual3": actual3Time,
        "Bilty No.": formData.biltyNo || "",
        "Bilty Copy": biltyCopyUrl || selectedOrder.biltyCopy || "", // Prepare to keep old one if not new? current logic overwrites or sets new. logic above: biltyCopyUrl starts empty. if not provided, we might want to keep existing? 
        // Logic: if formData.biltyCopy is present, use new URL. Else use existing?
        // Form logic: setFormData({ biltyCopy: null }). 
        // So if user didn't select file, biltyCopyUrl is "".
        // Unlike FullKitting, here we might update an existing record (if re-editing?). 
        // But user flow "Bilty Entry" implies first time?
        // Let's assume on first entry, existing is null.
        // If checking history, maybe re-upload?
        // I'll check `selectedOrder.biltyCopy` if exists and preserve if no new file?
        // Code: `biltyCopyUrl || selectedOrder.biltyCopy || ""`
      }

      // If no new file uploaded, but existing exists, we keep it? 
      // Actually `formData.biltyCopy` is file object.
      // If user doesn't upload new, `biltyCopyUrl` is empty.
      // We should probably NOT overwrite with empty if we want to preserve. 
      // But typically this action is "Submit Entry".
      // I'll set it.
      if (!biltyCopyUrl && selectedOrder.biltyCopy) {
        updatePayload["Bilty Copy"] = selectedOrder.biltyCopy
      } else if (biltyCopyUrl) {
        updatePayload["Bilty Copy"] = biltyCopyUrl
      }

      const { error: updateError } = await supabase
        .from('DELIVERY')
        .update(updatePayload)
        .eq('id', selectedOrder.id)

      if (updateError) throw updateError

      await fetchData()
      handleCancel()

      // Update notification count - usually handled by fetchData but explicit call ensures immediacy if we optimized fetchData away
      // Here fetchData is called, so count is updated there. No extra call needed unless fetchData fails.

      toast({
        title: "Success",
        description: `Bilty entry submitted successfully!`,
      })

    } catch (error) {
      console.error("Error submitting bilty entry:", error)
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
      biltyCopy: null,
      biltyNo: "",
    })
  }

  const handleViewBilty = async (url) => {
    if (!url) return
    const signedUrl = await getSignedUrl(url)
    window.open(signedUrl, '_blank')
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bilty Entry</h1>
          <p className="text-gray-600">Manage bilty documentation entries</p>
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
              <FileText className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Bilty</p>
              <div className="text-2xl font-bold text-amber-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Completed</p>
              <div className="text-2xl font-bold text-green-900">{historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckSquare className="h-6 w-6" />
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
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Action</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Bill No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Bill Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Delivery Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Product Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Logistic No</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">D-Sr Number</TableHead>
                {activeTab === "pending" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Planned Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Transporter</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Vehicle No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Existing Bilty No.</TableHead>
                  </>
                )}
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Bilty No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Bilty Copy</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === "pending" ? 13 : 11}
                    className="text-center py-8 text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No entries found</span>
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
                          onClick={() => handleBiltyEntry(order)}
                          className="bg-orange-600 hover:bg-orange-700 h-8 text-xs"
                          disabled={submitting}
                        >
                          Bilty Entry
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="py-2 px-4 min-w-[100px]">
                      <Badge className="bg-green-500 text-white rounded-sm text-xs">
                        {order.billNo}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                      {formatDisplayDate(order.billDate)}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm font-mono">
                      {order.deliveryOrderNo}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.partyName}</TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      <div className="truncate max-w-[150px]">{order.productName}</div>
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.logisticNo || "N/A"}</TableCell>
                    <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.dSrNumber || "N/A"}</TableCell>
                    {activeTab === "pending" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.planned3 || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.transporterName || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.vehicleNumber || "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px]">
                          {order.biltyNumber ? (
                            <Badge variant="outline" className="text-xs">
                              {order.biltyNumber}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </TableCell>
                      </>
                    )}
                    {activeTab === "history" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.actual3 ? order.actual3.split(' ')[0] : "N/A"}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px]">
                          {order.biltyNo ? (
                            <Badge className="bg-blue-500 text-white text-xs rounded-sm">
                              {order.biltyNo}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px]">
                          {order.hasBiltyCopy ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:bg-blue-50 h-8 px-2"
                              onClick={() => handleViewBilty(order.biltyCopy)}
                            >
                              View
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-xs text-center block">No copy</span>
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

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4 p-4">
          {displayOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-lg">No entries found</span>
            </div>
          ) : (
            displayOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className="bg-green-500 text-white rounded-sm text-xs mb-2">
                          {order.billNo}
                        </Badge>
                        <p className="text-sm font-medium text-gray-900">{order.partyName}</p>
                      </div>
                      {activeTab === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => handleBiltyEntry(order)}
                          className="bg-orange-600 hover:bg-orange-700 h-8 text-xs"
                          disabled={submitting}
                        >
                          Bilty Entry
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Bill Date:</span>
                        <p className="font-medium">{formatDisplayDate(order.billDate)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">DO No:</span>
                        <p className="font-medium font-mono text-xs">{order.deliveryOrderNo}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Product:</span>
                        <p className="font-medium truncate">{order.productName}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Logistic No:</span>
                        <p className="font-medium">{order.logisticNo || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">D-Sr Number:</span>
                        <p className="font-medium">{order.dSrNumber || "N/A"}</p>
                      </div>
                      {activeTab === "pending" && (
                        <>
                          <div>
                            <span className="text-gray-500">Planned:</span>
                            <p className="font-medium">{order.planned3 || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Transporter:</span>
                            <p className="font-medium">{order.transporterName || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Vehicle:</span>
                            <p className="font-medium">{order.vehicleNumber || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Existing Bilty:</span>
                            {order.biltyNumber ? (
                              <Badge variant="outline" className="text-xs">
                                {order.biltyNumber}
                              </Badge>
                            ) : (
                              <p className="text-gray-400 text-xs">N/A</p>
                            )}
                          </div>
                        </>
                      )}
                      {activeTab === "history" && (
                        <>
                          <div>
                            <span className="text-gray-500">Date:</span>
                            <p className="font-medium">{order.actual3 ? order.actual3.split(' ')[0] : "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Bilty No:</span>
                            {order.biltyNo ? (
                              <Badge className="bg-blue-500 text-white text-xs rounded-sm">
                                {order.biltyNo}
                              </Badge>
                            ) : (
                              <p className="text-gray-400 text-xs">N/A</p>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500">Bilty Copy:</span>
                            {order.hasBiltyCopy ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-blue-600 hover:bg-blue-50 h-6 px-2 text-xs"
                                onClick={() => handleViewBilty(order.biltyCopy)}
                              >
                                View
                              </Button>
                            ) : (
                              <p className="text-gray-400 text-xs">No copy</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

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
                <div className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-200">
                  <p className="font-medium text-gray-900">{selectedOrder.partyName}</p>
                  <p className="text-gray-600 mt-1">
                    Bill: {selectedOrder.billNo} | DO: {selectedOrder.deliveryOrderNo}
                  </p>
                  <p className="text-gray-600">Product: {selectedOrder.productName}</p>
                  <p className="text-gray-600">
                    Planned3: {selectedOrder.planned3}
                  </p>
                  <p className="text-green-600 font-medium mt-1">
                    Actual3 will be set to: {getISTDisplayDate()}
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
                              biltyCopy: file
                            }))
                          }
                        }}
                        className="h-10"
                        disabled={submitting}
                      />
                      {formData.biltyCopy && (
                        <span className="text-sm text-green-600 truncate flex-shrink-0">
                          ✓ Selected
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
    </div>
  )
}