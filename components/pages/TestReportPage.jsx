"use client"

import { Fragment, useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, Upload, Eye, Trash2, Truck, Download, Pencil } from "lucide-react"
import { exportToExcel } from "@/lib/exportUtils"
import { getSignedUrl } from "@/lib/storageUtils"
import { Checkbox } from "@/components/ui/checkbox"
import { groupRowsByPo } from "@/lib/workflowGrouping"

// Image storage constants
const STORAGE_BUCKET = "images"
const STORAGE_FOLDER = "load-material"

const getTransporterRateDisplay = (row) => {
  const perMt = Number(row.transportRatePerTon) || 0
  const fixed = Number(row.fixedAmount) || 0
  if (perMt > 0) return `₹${perMt.toLocaleString("en-IN")} / MT`
  if (fixed > 0) return `₹${fixed.toLocaleString("en-IN")} fixed`
  return "—"
}

export default function TestReportPage({ user }) {
  const [orders, setOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedRowIds, setSelectedRowIds] = useState(new Set())
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    loadingImage1: null,
    loadingImage2: null,
    loadingImage3: null
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

      const [{ data, error }, { data: orderData, error: orderError }] = await Promise.all([
        supabase.from('DISPATCH').select('*').not('Planned2', 'is', null),
        supabase.from('ORDER RECEIPT').select('id, "PARTY PO NO (As Per Po Exact)", "Firm Name"'),
      ])

      if (error) throw error
      if (orderError) throw orderError

      const orderMap = new Map()
      ;(orderData || []).forEach((row) => {
        orderMap.set(row.id, row)
      })

      const pending = []
      const history = []

      data.forEach(row => {
        const orderRef = row.po_id ? orderMap.get(row.po_id) : null
        const order = {
          id: row.id,
          partyPONumber: orderRef?.["PARTY PO NO (As Per Po Exact)"] || "",
          firmName: orderRef?.["Firm Name"] || "",
          timestamp: row["Timestamp"],
          dSrNumber: row["D-Sr Number"],
          deliveryOrderNo: row["Delivery Order No."],
          dispatchNo: row["D-Sr Number"],
          lgstSrNumber: row["LGST-Sr Number"],
          partyName: row["Party Name"],
          productName: row["Product Name"],
          qtyToBeDispatched: row["Qty To Be Dispatched"],
          actualTruckQty: row["Actual Truck Qty"],
          typeOfTransporting: row["Type Of Transporting  "] || row["Type Of Transporting"],
          transporterName: row["Transporter Name"],
          truckNo: row["Truck No."],
          driverMobileNo: row["Driver Mobile No."],
          vehicleNoPlateImage: row["Vehicle No. Plate Image"],
          biltyNo: row["Bilty No."],
          typeOfRate: row["Type Of Rate"],
          transportRatePerTon: row["Transport Rate @Per Matric Ton"],
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

  const handleExport = () => {
    const dataToExport = activeTab === "pending" ? orders : completedOrders
    exportToExcel(dataToExport, `TestReport_${activeTab}`)
  }

  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm) return ordersList
    return ordersList.filter((order) =>
      Object.values(order).some((value) =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayOrders = activeTab === "pending"
    ? searchFilteredOrders(orders)
    : searchFilteredOrders(completedOrders)
  const groupedDisplayOrders = useMemo(() => groupRowsByPo(displayOrders), [displayOrders])

  // ── Group-level open/close ──────────────────────────────────────────────────
  const handleOpen = (group) => {
    setSelectedGroup(group)
    setSelectedRowIds(new Set(group.rows.map((r) => r.id)))
    setFormData({ loadingImage1: null, loadingImage2: null, loadingImage3: null })
    setUploadedUrls({
      loadingImage1: group.rows[0]?.loadingImage1 || "",
      loadingImage2: group.rows[0]?.loadingImage2 || "",
      loadingImage3: group.rows[0]?.loadingImage3 || "",
    })
  }

  const toggleRow = (id) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (checked) => {
    if (checked) setSelectedRowIds(new Set(selectedGroup.rows.map((r) => r.id)))
    else setSelectedRowIds(new Set())
  }

  const handleClose = () => {
    setSelectedGroup(null)
    setSelectedRowIds(new Set())
    setFormData({ loadingImage1: null, loadingImage2: null, loadingImage3: null })
    setUploadedUrls({ loadingImage1: "", loadingImage2: "", loadingImage3: "" })
  }

  // ── Image helpers ───────────────────────────────────────────────────────────
  const handleFileSelect = async (event, imageNumber) => {
    const file = event.target.files[0]
    if (!file) return

    const imageKey = `loadingImage${imageNumber}`

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Error", description: "File size should be less than 5MB" })
      return
    }
    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Error", description: "Please select an image file" })
      return
    }

    const localUrl = URL.createObjectURL(file)
    setFormData(prev => ({ ...prev, [imageKey]: file }))
    setUploadedUrls(prev => ({ ...prev, [imageKey]: localUrl }))
  }

  const removeImage = (imageNumber) => {
    const imageKey = `loadingImage${imageNumber}`
    setFormData(prev => ({ ...prev, [imageKey]: null }))
    setUploadedUrls(prev => ({ ...prev, [imageKey]: "" }))
  }

  // ── Submit: updates ALL rows in the group ───────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedGroup) return

    if (activeTab === "pending" && !formData.loadingImage1 && !uploadedUrls.loadingImage1) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Loading Image 1 is mandatory",
      })
      return
    }

    try {
      setSubmitting(true)

      const selectedRows = selectedGroup.rows.filter((r) => selectedRowIds.has(r.id))
      if (selectedRows.length === 0) {
        toast({ title: "Validation Error", description: "Please select at least one row to submit.", variant: "destructive" })
        return
      }

      // Use the first row's LGST number as the reference for file naming
      const refLgst = selectedRows[0]?.lgstSrNumber || "unknown"

      const finalUrls = {
        loadingImage1: uploadedUrls.loadingImage1 || "",
        loadingImage2: uploadedUrls.loadingImage2 || "",
        loadingImage3: uploadedUrls.loadingImage3 || "",
      }

      // Upload images once (shared across all rows in the group)
      for (const num of [1, 2, 3]) {
        const imageKey = `loadingImage${num}`
        const file = formData[imageKey]

        if (file instanceof File) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${STORAGE_FOLDER}/load_${refLgst}_img${num}_${Date.now()}.${fileExt}`

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

      // Update every row in the group simultaneously
      await Promise.all(
        selectedRows.map((row) => {
          const updatePayload = {
            "Loading Image 1": finalUrls.loadingImage1 || "",
            "Loading Image 2": finalUrls.loadingImage2 || "",
            "Loading Image 3": finalUrls.loadingImage3 || "",
          }
          if (activeTab === "pending" || !row.actual2) {
            updatePayload["Actual2"] = actualDateTime
          }
          return supabase
            .from('DISPATCH')
            .update(updatePayload)
            .eq('id', row.id)
        })
      )

      toast({
        title: "Success",
        description: `Load Material ${activeTab === "history" ? "images updated" : "submitted"} for PO ${selectedGroup.poNumber} (${selectedRows.length} row${selectedRows.length > 1 ? "s" : ""}).`,
      })

      handleClose()
      await fetchLoadMaterialData()
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

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === "" || dateTimeString === " ") return "N/A"
    try {
      const date = new Date(dateTimeString)
      if (isNaN(date.getTime())) return dateTimeString
      return date.toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    } catch {
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
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Load Material</h1>
          <p className="text-sm text-gray-500">
            Upload loading images to move dispatches to stage 2
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-3">
          <Button onClick={handleExport} variant="outline" className="h-10 px-3 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "pending"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Pending ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "history"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              History ({completedOrders.length})
            </button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">
                Pending Orders
              </p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{orders.length}</p>
            </div>
            <div className="p-3 bg-blue-500 text-white rounded-lg">
              <Truck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 uppercase tracking-wider">
                Completed Load Material
              </p>
              <p className="text-2xl font-bold text-green-900 mt-1">{completedOrders.length}</p>
            </div>
            <div className="p-3 bg-green-500 text-white rounded-lg">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">
                Total Parties
              </p>
              <p className="text-2xl font-bold text-purple-900 mt-1">{totalParties}</p>
            </div>
            <div className="p-3 bg-purple-500 text-white rounded-lg">
              <Truck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">
                Total Records
              </p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {orders.length + completedOrders.length}
              </p>
            </div>
            <div className="p-3 bg-amber-500 text-white rounded-lg">
              <Truck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search bar */}
      <div className="bg-white p-4 rounded-md border shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by LGST Number, Delivery Order No, Party Name, Product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm mt-4">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Action</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">LGST-Sr Number</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[140px]">Firm Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Delivery Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Dispatch No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Product Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Truck Qty</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Transporter Type</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[140px]">Transporter Rate</TableHead>
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
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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
                groupedDisplayOrders.map((group) => (
                  <Fragment key={group.key}>
                    {/* ── PO group header row ── */}
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={11} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {activeTab === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleOpen(group)}
                              className="bg-blue-600 hover:bg-blue-700 h-8 text-xs shrink-0"
                              disabled={submitting}
                            >
                              <Upload className="w-3 h-3 mr-1" />
                              Load
                            </Button>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">PO Number: {group.poNumber}</span>
                            <span className="text-xs text-slate-600">Party Name: {group.partyName}</span>
                          </div>
                          <span className="text-xs text-slate-500 ml-auto">{group.rows.length} product{group.rows.length > 1 ? "s" : ""}</span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* ── Individual product rows ── */}
                    {group.rows.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        {activeTab === "pending" && <TableCell className="py-2 px-4 min-w-[100px]" />}
                        <TableCell className="py-2 px-4 min-w-[120px]">
                          <Badge className="bg-blue-500 text-white rounded-sm whitespace-nowrap text-xs">
                            {order.lgstSrNumber || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[140px] text-sm text-gray-700 font-medium">
                          {order.firmName || "N/A"}
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
                          {order.productName || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px] font-medium text-sm">
                          {order.actualTruckQty || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                          {order.typeOfTransporting || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[140px] text-sm">
                          {getTransporterRateDisplay(order)}
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
                                  <Eye className="w-3 h-3 mr-1" />Img 1
                                </Badge>
                              )}
                              {order.loadingImage2 && (
                                <Badge
                                  variant="outline"
                                  className="cursor-pointer hover:bg-blue-50 text-xs font-normal"
                                  onClick={() => openImage(order.loadingImage2)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />Img 2
                                </Badge>
                              )}
                              {order.loadingImage3 && (
                                <Badge
                                  variant="outline"
                                  className="cursor-pointer hover:bg-blue-50 text-xs font-normal"
                                  onClick={() => openImage(order.loadingImage3)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />Img 3
                                </Badge>
                              )}
                              {user?.role === "ADMIN" && (
                                <Badge
                                  variant="outline"
                                  className="cursor-pointer hover:bg-amber-50 text-amber-700 border-amber-200 text-xs font-normal"
                                  onClick={() => handleOpen(group)}
                                >
                                  <Pencil className="w-3 h-3 mr-1" />Edit Images
                                </Badge>
                              )}
                              {!order.loadingImage1 && !order.loadingImage2 && !order.loadingImage3 && user?.role !== "ADMIN" && (
                                <span className="text-gray-400 text-xs">No images</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Complete Load Material</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 space-y-6">

              {/* PO + product list */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">PO: {selectedGroup.poNumber}</p>
                  <span className="text-xs text-blue-600 font-medium">
                    {selectedRowIds.size} / {selectedGroup.rows.length} Selected
                  </span>
                </div>
                <p className="text-gray-600">Party: {selectedGroup.partyName}</p>
                <div className="border rounded-md overflow-hidden mt-1">
                  <div className="flex items-center justify-between px-2 py-1.5 bg-gray-100 border-b">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Select Rows</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">Select All</span>
                      <Checkbox 
                        checked={selectedRowIds.size === selectedGroup.rows.length} 
                        onCheckedChange={toggleAll}
                      />
                    </div>
                  </div>
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="w-8 px-2 py-1"></th>
                        <th className="text-left px-2 py-1 font-medium text-gray-600">Logistic Details</th>
                        <th className="text-left px-2 py-1 font-medium text-gray-600">Product</th>
                        <th className="text-right px-2 py-1 font-medium text-gray-600">Qty</th>
                        <th className="text-left px-2 py-1 font-medium text-gray-600">Transporter Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedGroup.rows.map((row) => (
                        <tr key={row.id} className={`transition-colors ${selectedRowIds.has(row.id) ? "bg-blue-50/30" : "bg-white opacity-60"}`}>
                          <td className="px-2 py-1 text-center">
                            <Checkbox 
                              checked={selectedRowIds.has(row.id)} 
                              onCheckedChange={() => toggleRow(row.id)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-blue-700 font-bold">{row.lgstSrNumber || "N/A"}</span>
                                <span className="text-gray-900 font-bold">{row.truckNo || "N/A"}</span>
                              </div>
                              <div className="text-[10px] text-gray-500 flex flex-wrap gap-x-2">
                                <span>{row.transporterName || "N/A"}</span>
                                <span>• Driver: {row.driverMobileNo || "N/A"}</span>
                                {row.biltyNo && <span>• Bilty: {row.biltyNo}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1 text-gray-700 font-medium">
                            <div className="flex flex-col">
                              <span>{row.productName || "N/A"}</span>
                              <span className="text-[10px] text-gray-400">{row.deliveryOrderNo}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1 text-gray-700 text-right font-bold">{row.actualTruckQty || row.qtyToBeDispatched || "N/A"}</td>
                          <td className="px-2 py-1 text-gray-700">{getTransporterRateDisplay(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Image upload section */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <span className="w-1 h-5 bg-blue-600 rounded-full inline-block" />
                  Upload Loading Images
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Images are shared across all rows in this PO. Image 1 is mandatory. Max 5MB each.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          Image {num} {num === 1 && <span className="text-red-500">*</span>}
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
                          disabled={submitting}
                        >
                          <div className="flex flex-col items-center">
                            <Upload className="w-6 h-6 mb-2 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {uploadedUrls[`loadingImage${num}`] ? "✓ Selected" : "Click to Upload"}
                            </span>
                          </div>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-md">
                  <p className="text-xs text-blue-700 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      Submitting will set <strong>Actual2</strong> to the current date/time for the {selectedRowIds.size} selected row{selectedRowIds.size > 1 ? "s" : ""}.
                    </span>
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t pt-4 flex flex-col sm:flex-row justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
