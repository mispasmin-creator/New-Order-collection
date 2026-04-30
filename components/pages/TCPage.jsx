"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { useNotification } from "@/components/providers/NotificationProvider"
import { getSignedUrl } from "@/lib/storageUtils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, Loader2, Upload, FileCheck, CheckCircle2, X, Eye, ChevronDown, ChevronRight } from "lucide-react"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]

export default function TCPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [formData, setFormData] = useState({
    tcFile: null,
  })
  const { toast } = useToast()
  const { updateCount } = useNotification()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const userFirms = user?.role !== "ADMIN"
        ? (user?.firm ? user.firm.split(',').map(f => f.trim()).filter(Boolean) : [])
        : null
      const shouldFilter = userFirms && !userFirms.includes('all') && userFirms.length > 0

      let orQuery = supabase
        .from("ORDER RECEIPT")
        .select('id, "DO-Delivery Order No.", "Rate Of Material"')
      if (shouldFilter) orQuery = orQuery.in('Firm Name', userFirms)
      const { data: orderReceiptData, error: orderReceiptError } = await orQuery

      if (orderReceiptError) {
        console.error("Error fetching ORDER RECEIPT data:", orderReceiptError)
      }

      const allowedPoIds = (orderReceiptData || []).map(r => r.id)

      let dispatchQuery = supabase.from("DISPATCH").select('*').not('Actual4', 'is', null)
      if (shouldFilter) dispatchQuery = dispatchQuery.in('po_id', allowedPoIds)

      const { data: dispatchData, error: dispatchError } = await dispatchQuery

      if (dispatchError) throw dispatchError

      const { data: deliveryData, error: deliveryError } = await supabase
        .from("DELIVERY")
        .select('id, "D-Sr Number", Timestamp')

      if (deliveryError) throw deliveryError

      const rateMap = new Map()
      orderReceiptData?.forEach(row => {
        const deliveryOrderNo = row["DO-Delivery Order No."]
        if (deliveryOrderNo) {
          rateMap.set(deliveryOrderNo, row["Rate Of Material"] || null)
        }
      })

      const deliveryMap = new Map()
      deliveryData?.forEach(row => {
        const dispatchNumber = row["D-Sr Number"]
        if (dispatchNumber) {
          deliveryMap.set(dispatchNumber, row)
        }
      })

      const pendingOrders = []
      const completedOrders = []

      dispatchData?.forEach(row => {
        const dispatchNumber = row["D-Sr Number"]
        const deliveryRow = deliveryMap.get(dispatchNumber)
        const order = {
          id: row.id,
          dSrNumber: dispatchNumber || "",
          deliveryOrderNo: row["Delivery Order No."] || "",
          partyName: row["Party Name"] || "",
          productName: row["Product Name"] || "",
          qtyToBeDispatched: row["Qty To Be Dispatched"] || "",
          typeOfTransporting: row["Type Of Transporting"] || row["Type Of Transporting  "] || "",
          transporterName: row["Transporter Name"] || "",
          truckNo: row["Truck No."] || "",
          biltyNo: row["Bilty No."] || "",
          planned4: row["Planned4"] || "",
          actual4: row["Actual4"] || "",
          tcFileUrl: row["Trust Certificate Made"] || "",
          tcRequired: row["TC Required"] || "",
          billNumber: row["Bill Number"] || "",
          rateOfMaterial: rateMap.get(row["Delivery Order No."]) || null,
          deliveryCreatedAt: deliveryRow?.Timestamp || "",
          movedToDelivery: !!deliveryRow,
        }

        if (order.movedToDelivery) {
          completedOrders.push(order)
        } else {
          pendingOrders.push(order)
        }
      })

      setOrders(pendingOrders.sort((a, b) => b.id - a.id))
      setHistoryOrders(completedOrders.sort((a, b) => b.id - a.id))
      updateCount?.("TC", pendingOrders.length)
    } catch (error) {
      console.error("Error fetching Test Certificate data:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch Test Certificate data",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateValue) => {
    if (!dateValue) return "N/A"
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return dateValue
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const searchFilteredOrders = (ordersList) => {
    if (!searchTerm.trim()) return ordersList

    return ordersList.filter(order =>
      Object.values(order).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayOrders = activeTab === "pending"
    ? searchFilteredOrders(orders)
    : searchFilteredOrders(historyOrders)

  const groupedByInvoice = useMemo(() => {
    const map = {}
    displayOrders.forEach(order => {
      const key = order.billNumber || `__no_invoice_${order.id}`
      if (!map[key]) map[key] = { invoiceNo: order.billNumber || "", partyName: order.partyName, rows: [] }
      map[key].rows.push(order)
    })
    return Object.values(map)
  }, [displayOrders])

  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))

  const handleOpenModal = (order) => {
    setSelectedGroup({ invoiceNo: order.billNumber, partyName: order.partyName, rows: [order] })
    setFormData({ tcFile: null })
  }

  const handleCancel = () => {
    setSelectedGroup(null)
    setFormData({ tcFile: null })
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "File size should be less than 5MB",
      })
      event.target.value = ""
      return
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Only PDF, JPG, PNG, and WEBP files are allowed",
      })
      event.target.value = ""
      return
    }

    setFormData({
      tcFile: file,
    })
  }

  const openTCFile = async (url) => {
    if (!url) return
    const signedUrl = await getSignedUrl(url)
    window.open(signedUrl, "_blank")
  }

  const uploadTCFile = async (order, file) => {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "_")
    const filePath = `tc/${order.id}_${order.dSrNumber}_${Date.now()}_${safeFileName}`

    const { error } = await supabase.storage
      .from("images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from("images")
      .getPublicUrl(filePath)

    return publicUrl
  }

  const handleSubmit = async () => {
    if (!selectedGroup) return

    if (!formData.tcFile) {
      toast({ variant: "destructive", title: "Upload required", description: "Please upload a Test Certificate file before submitting" })
      return
    }

    try {
      setSubmitting(true)

      let tcFileUrl = ""
      if (formData.tcFile) {
        const file = formData.tcFile
        const safeInvoice = (selectedGroup.invoiceNo || "noinvoice").replace(/[^a-zA-Z0-9]/g, "_")
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "_")
        const filePath = `tc/invoice_${safeInvoice}_${Date.now()}_${safeFileName}`
        const { error: uploadError } = await supabase.storage.from("images").upload(filePath, file, { cacheControl: "3600", upsert: false })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(filePath)
        tcFileUrl = publicUrl
      }

      // Update all dispatch rows in the group
      await Promise.all(
        selectedGroup.rows.map(row =>
          supabase.from("DISPATCH").update({ "Trust Certificate Made": tcFileUrl }).eq("id", row.id)
        )
      )

      // Insert DELIVERY records for all rows
      const timestamp = getISTTimestamp()
      const { error: deliveryInsertError } = await supabase.from("DELIVERY").insert(
        selectedGroup.rows.map(row => ({
          "Timestamp": timestamp,
          "Bill Date": null,
          "Delivery Order No.": row.deliveryOrderNo,
          "Party Name": row.partyName,
          "Product Name": row.productName,
          "Quantity Delivered.": row.qtyToBeDispatched ? parseFloat(row.qtyToBeDispatched) : null,
          "Bill No.": selectedGroup.invoiceNo || "",
          "Losgistic no.": row.dSrNumber || "",
          "Rate Of Material": row.rateOfMaterial,
          "Type Of Transporting": row.typeOfTransporting || "",
          "Transporter Name": row.transporterName || "",
          "Vehicle Number.": row.truckNo || "",
          "Bilty Number.": row.biltyNo || "",
          "Giving From Where": "",
          "D-Sr Number": row.dSrNumber || "",
        }))
      )

      if (deliveryInsertError) throw deliveryInsertError

      await fetchData()
      handleCancel()
      toast({ title: "Success", description: `TC uploaded and ${selectedGroup.rows.length} row(s) moved to delivery` })
    } catch (error) {
      console.error("Error submitting Test Certificate:", error)
      toast({ variant: "destructive", title: "Error", description: `Failed to submit: ${error.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading Test Certificate entries...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Certificate</h1>
          <p className="text-gray-600">Upload test certificates and move completed invoices to delivery</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Entries</p>
              <div className="text-2xl font-bold text-blue-900">{orders.length + historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <FileCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Test Certificate</p>
              <div className="text-2xl font-bold text-amber-900">{orders.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <Upload className="h-6 w-6" />
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
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search entries..."
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
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Pending ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Completed ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="w-8" />
                {activeTab === "pending" && <TableHead className="font-semibold text-gray-900 py-3 px-4">Action</TableHead>}
                <TableHead className="font-semibold text-gray-900 py-3 px-4">Invoice No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4">Products</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4">TC Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByInvoice.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No {activeTab} Test Certificate entries found
                  </TableCell>
                </TableRow>
              ) : (
                groupedByInvoice.map(group => {
                  const groupKey = group.invoiceNo || group.rows[0]?.id
                  const isExpanded = !!expandedGroups[groupKey]
                  const allTCDone = group.rows.every(r => r.tcFileUrl)
                  const someTCDone = group.rows.some(r => r.tcFileUrl)
                  return (
                    <>
                      {/* Group header row */}
                      <TableRow
                        key={`group-${groupKey}`}
                        className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <TableCell className="text-gray-400 pl-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </TableCell>
                        {activeTab === "pending" && <TableCell />}
                        <TableCell className="py-2 px-4 font-semibold text-slate-900">
                          {group.invoiceNo ? (
                            <Badge className="bg-indigo-500 text-white rounded-sm text-xs">{group.invoiceNo}</Badge>
                          ) : (
                            <span className="text-gray-400 text-xs italic">No Invoice</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-slate-700">{group.partyName}</TableCell>
                        <TableCell className="py-2 px-4 text-xs text-slate-500">
                          {group.rows.length} product{group.rows.length > 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="py-2 px-4">
                          {allTCDone ? (
                            <span className="text-green-600 text-xs font-medium">All Uploaded</span>
                          ) : someTCDone ? (
                            <span className="text-amber-600 text-xs font-medium">Partial</span>
                          ) : (
                            <span className="text-amber-600 text-xs font-medium">Pending</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded rows */}
                      {isExpanded && group.rows.map(order => (
                        <TableRow key={order.id} className="bg-white hover:bg-gray-50 border-b border-gray-100">
                          <TableCell />
                          {activeTab === "pending" && (
                            <TableCell onClick={e => e.stopPropagation()}>
                              {!order.tcFileUrl && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenModal(order)}
                                  className="bg-blue-600 hover:bg-blue-700 h-7 text-xs px-2"
                                  disabled={submitting}
                                >
                                  Upload TC
                                </Button>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="py-2 px-4">
                            <Badge className="bg-blue-500 text-white rounded-sm text-xs">{order.dSrNumber || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="py-2 px-4 text-sm text-gray-600">{order.productName || "N/A"}</TableCell>
                          <TableCell className="py-2 px-4 text-sm text-gray-600">Qty: {order.qtyToBeDispatched || "N/A"} · DO: {order.deliveryOrderNo || "N/A"}</TableCell>
                          <TableCell className="py-2 px-4">
                            {order.tcFileUrl ? (
                              <button onClick={() => openTCFile(order.tcFileUrl)} className="text-blue-600 hover:text-blue-800 underline text-xs flex items-center gap-1">
                                <Eye className="w-3 h-3" /> View TC
                              </button>
                            ) : (
                              <span className="text-amber-600 text-xs font-medium">Pending</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Upload Test Certificate</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm space-y-1">
                  {(() => {
                    const row = selectedGroup.rows[0]
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900">{row.partyName}</p>
                          {selectedGroup.invoiceNo && (
                            <Badge className="bg-indigo-500 text-white text-xs">{selectedGroup.invoiceNo}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600 mt-1">
                          <span>D-Sr: <span className="font-medium text-gray-800">{row.dSrNumber || "N/A"}</span></span>
                          <span>Product: <span className="font-medium text-gray-800">{row.productName || "N/A"}</span></span>
                          <span>Qty: <span className="font-medium text-gray-800">{row.qtyToBeDispatched || "N/A"}</span></span>
                          <span>DO: <span className="font-medium text-gray-800">{row.deliveryOrderNo || "N/A"}</span></span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Test Certificate File *</Label>
                  <Input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="h-10"
                    disabled={submitting}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className={formData.tcFile ? "text-green-600" : "text-amber-600"}>
                      {formData.tcFile ? "File selected" : "No file selected"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Accepted: PDF, JPG, PNG, WEBP · Max 5MB</p>
                </div>

                <div className="border-t pt-4 flex flex-col gap-3">
                  <Button variant="outline" onClick={handleCancel} disabled={submitting}>Cancel</Button>
                  <Button
                    onClick={handleSubmit}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!formData.tcFile || submitting}
                  >
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit & Move to Delivery"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
