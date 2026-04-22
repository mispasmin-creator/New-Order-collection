"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"
import { getISTDisplayDate, getISTTimestamp } from "@/lib/dateUtils"
import { getSignedUrl } from "@/lib/storageUtils"
import { useNotification } from "@/components/providers/NotificationProvider"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  X, Search, Loader2, Upload, FileText,
  CheckCircle2, Clock, Truck, Eye, ArrowRight,
  PackageCheck, ListFilter
} from "lucide-react"
import { format } from "date-fns"

export default function UnifiedLogistics({ user }) {
  const [deliveryData, setDeliveryData] = useState([])
  const [postDeliveryData, setPostDeliveryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const { toast } = useToast()
  const { updateCount } = useNotification()

  // Single modal for combined Documentation + Receipt entry
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [combinedForm, setCombinedForm] = useState({
    biltyNo: "",
    biltyCopy: null,
    materialReceivedDate: "",
    // grnNumber: "",
    receiptFile: null,
    receiptPreviewUrl: "",
  })

  useEffect(() => {
    fetchEverything()
  }, [])

  const fetchEverything = async () => {
    try {
      setLoading(true)
      const [deliveryRes, postDeliveryRes] = await Promise.all([
        supabase.from('DELIVERY').select('*').not('Planned 3', 'is', null),
        supabase.from('POST DELIVERY').select('*')
      ])

      if (deliveryRes.error) throw deliveryRes.error
      if (postDeliveryRes.error) throw postDeliveryRes.error

      setDeliveryData(deliveryRes.data || [])
      setPostDeliveryData(postDeliveryRes.data || [])

      // Update notifications
      const pending = (deliveryRes.data || []).filter(d => !d.Actual3).length
      updateCount?.("Bilty Entry", pending)

    } catch (error) {
      console.error("Error fetching logistics data:", error)
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Failed to load logistics data"
      })
    } finally {
      setLoading(false)
    }
  }

  // Unified data joining logic
  const shipments = useMemo(() => {
    return deliveryData.map(del => {
      // Find matching receipt by Bill No or DO No if Bill No is missing
      const receipt = postDeliveryData.find(pd =>
        (pd["Bill No."] && pd["Bill No."] === del["Bill No."]) ||
        (pd["Order No."] && pd["Order No."] === del["Delivery Order No."])
      )

      return {
        ...del,
        id: del.id,
        orderNo: del["Delivery Order No."],
        billNo: del["Bill No."],
        partyName: del["Party Name"],
        productName: del["Product Name"],
        biltyNo: del["Bilty No."],
        biltyCopy: del["Bilty Copy"],
        isBiltyDone: !!del.Actual3,
        receiptActual: receipt?.["Actual"],
        amount: receipt?.["Total Bill Amount"] || 0,
        billDate: del["Bill Date"] || receipt?.["Bill Date"],
        plannedDate: del["Planned 3"] || receipt?.["Planned"],
        grnNumber: receipt?.["Grn Number"],
        receiptCopy: receipt?.["Image Of Received Bill / Audio"],
        receiptId: receipt?.id,
        isReceiptDone: !!receipt?.["Actual"]
      }
    })
  }, [deliveryData, postDeliveryData])

  // Formatting helpers
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === "") return "N/A"
    try {
      const date = new Date(dateStr)
      return isNaN(date.getTime()) ? dateStr : format(date, "MMM d, yyyy")
    } catch (e) { return dateStr }
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr || dateStr.trim() === "") return "N/A"
    try {
      const date = new Date(dateStr)
      return isNaN(date.getTime()) ? dateStr : format(date, "MMM d, yyyy, hh:mm a")
    } catch (e) { return dateStr }
  }

  // Filtering logic — Pending = receipt not done, History = both done
  const filteredShipments = useMemo(() => {
    const list = activeTab === "pending"
      ? shipments.filter(s => !s.isReceiptDone)
      : shipments.filter(s => s.isReceiptDone)
    if (!searchTerm.trim()) return list
    return list.filter(item =>
      Object.values(item).some(v => v?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [shipments, activeTab, searchTerm])

  // Open the combined modal
  const openModal = (order) => {
    setSelectedOrder(order)
    setCombinedForm({
      biltyNo: order.biltyNo || "",
      biltyCopy: null,
      materialReceivedDate: "",
      grnNumber: order.grnNumber || "",
      receiptFile: null,
      receiptPreviewUrl: "",
    })
  }

  const closeModal = () => {
    setSelectedOrder(null)
    setCombinedForm({ biltyNo: "", biltyCopy: null, materialReceivedDate: "", grnNumber: "", receiptFile: null, receiptPreviewUrl: "" })
  }

  // Single submit: Documentation + Receipt in one go
  const handleCombinedSubmit = async () => {
    if (!combinedForm.biltyNo.trim()) {
      toast({ variant: "destructive", title: "Validation", description: "Bilty number is required." }); return
    }
    if (!combinedForm.materialReceivedDate) {
      toast({ variant: "destructive", title: "Validation", description: "Receipt date is required." }); return
    }
    if (!combinedForm.grnNumber.trim()) {
      toast({ variant: "destructive", title: "Validation", description: "GRN number is required." }); return
    }

    try {
      setSubmitting(true)
      const now = getISTTimestamp()

      // Upload bilty copy
      let biltyUrl = selectedOrder.biltyCopy || ""
      if (combinedForm.biltyCopy) {
        const path = `bilty/${selectedOrder.id}_${Date.now()}_${combinedForm.biltyCopy.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('images').upload(path, combinedForm.biltyCopy)
        if (upErr) throw upErr
        biltyUrl = supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }

      // Upload receipt copy
      let receiptUrl = selectedOrder.receiptCopy || ""
      if (combinedForm.receiptFile) {
        const path = `material_receipt/${selectedOrder.id}_${Date.now()}_${combinedForm.receiptFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('images').upload(path, combinedForm.receiptFile)
        if (upErr) throw upErr
        receiptUrl = supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }

      // 1. Update DELIVERY (Bilty + Actual3)
      const { error: deliveryErr } = await supabase
        .from('DELIVERY')
        .update({ "Actual3": now, "Bilty No.": combinedForm.biltyNo, "Bilty Copy": biltyUrl })
        .eq('id', selectedOrder.id)
      if (deliveryErr) throw deliveryErr

      // 2. Upsert POST DELIVERY (Receipt)
      const receiptPayload = {
        "Order No.": selectedOrder.orderNo,
        "Bill No.": selectedOrder.billNo,
        "Party Name": selectedOrder.partyName,
        "Bill Date": selectedOrder.billDate,
        "Total Bill Amount": selectedOrder.amount || (selectedOrder["Rate Of Material"] || 0) * (selectedOrder["Quantity Delivered."] || 0),
        "Actual": now,
        "Planned": now,
        "Material Received Date": combinedForm.materialReceivedDate,
        "Grn Number": combinedForm.grnNumber,
        "Image Of Received Bill / Audio": receiptUrl,
      }

      let receiptRes
      if (selectedOrder.receiptId) {
        receiptRes = await supabase.from('POST DELIVERY').update(receiptPayload).eq('id', selectedOrder.receiptId)
      } else {
        receiptRes = await supabase.from('POST DELIVERY').insert([receiptPayload])
      }
      if (receiptRes.error) throw receiptRes.error

      toast({ title: "Submitted", description: "Documentation and receipt recorded successfully." })
      closeModal()
      fetchEverything()
      window.dispatchEvent(new Event('refresh-sidebar-counts'))
    } catch (e) {
      toast({ variant: "destructive", title: "Submission Failed", description: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewFile = async (url) => {
    if (!url) return
    const signed = await getSignedUrl(url)
    window.open(signed, '_blank')
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
      <span className="text-gray-600">Syncing Unified Logistics...</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bilty Update</h1>
          <p className="text-gray-600">Monitor and manage shipments from dispatch to receipt</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-amber-50 border-amber-100 cursor-pointer" onClick={() => setActiveTab("pending")}>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending</p>
              <div className="text-2xl font-bold text-amber-900">{shipments.filter(s => !s.isReceiptDone).length}</div>
            </div>
            <Truck className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 cursor-pointer" onClick={() => setActiveTab("history")}>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Completed</p>
              <div className="text-2xl font-bold text-green-900">{shipments.filter(s => s.isReceiptDone).length}</div>
            </div>
            <PackageCheck className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by Bill No, Party, or DO..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center bg-gray-200 p-1 rounded-lg">
            {[
              { id: "pending", label: "Pending", icon: Clock },
              { id: "history", label: "History", icon: ListFilter }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead>Action</TableHead>
              <TableHead className="w-[150px]">Shipment Details</TableHead>
              <TableHead>Party Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Bilty Stage</TableHead>
              <TableHead>Receipt Stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-gray-500">No shipments found for this tab.</TableCell>
              </TableRow>
            ) : (
              filteredShipments.map(s => (
                <TableRow key={s.id} className="hover:bg-gray-50/80 transition-colors">
                  <TableCell>
                    {!s.isReceiptDone ? (
                      <Button size="sm" onClick={() => openModal(s)} className="bg-blue-600 hover:bg-blue-700 h-8">
                        Fill Details
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-green-600" disabled>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Done
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 font-mono">{s.orderNo}</span>
                      <span className="font-semibold text-gray-900">{s.billNo || "No Bill"}</span>
                      {s.billDate && <span className="text-[10px] text-gray-500">{format(new Date(s.billDate), "dd MMM yyyy")}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{s.partyName}</TableCell>
                  <TableCell className="text-sm text-gray-600">{s.productName}</TableCell>
                  <TableCell>
                    {s.isBiltyDone ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-medium text-green-700">{s.biltyNo}</span>
                        {s.biltyCopy && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewFile(s.biltyCopy)}><Eye className="h-3 w-3" /></Button>}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">Pending Docs</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.isReceiptDone ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-medium text-green-700">{s.grnNumber}</span>
                        {s.receiptCopy && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewFile(s.receiptCopy)}><Eye className="h-3 w-3" /></Button>}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-gray-400 bg-gray-50 border-gray-200 font-normal">
                        {s.isBiltyDone ? "Awaiting GRN" : "Waiting for Bilty"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Combined Documentation + Receipt Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50 rounded-t-xl shrink-0">
              <CardTitle className="text-lg">Fill Shipment Details</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeModal} disabled={submitting}><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6 overflow-y-auto flex-1">

              {/* Shipment info */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm grid grid-cols-2 gap-x-6 gap-y-2">
                <div><span className="text-gray-500">Order No:</span> <span className="font-bold">{selectedOrder.orderNo}</span></div>
                <div><span className="text-gray-500">Bill No:</span> <span className="font-bold">{selectedOrder.billNo}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Party:</span> <span className="text-gray-900">{selectedOrder.partyName}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Product:</span> <span className="text-gray-900">{selectedOrder.productName}</span></div>
                {selectedOrder.billDate && <div><span className="text-gray-500">Bill Date:</span> <span>{formatDate(selectedOrder.billDate)}</span></div>}
              </div>

              {/* Section 1: Documentation */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="w-1 h-4 bg-amber-500 rounded-full" />Bilty Documentation
                </h3>
                <div className="space-y-2">
                  <Label>Bilty Number <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Enter consignment/bilty no."
                    value={combinedForm.biltyNo}
                    onChange={(e) => setCombinedForm(p => ({ ...p, biltyNo: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bilty Copy (optional)</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setCombinedForm(p => ({ ...p, biltyCopy: e.target.files[0] }))}
                    disabled={submitting}
                    className="h-10"
                  />
                  {combinedForm.biltyCopy && <p className="text-xs text-green-600">✓ {combinedForm.biltyCopy.name}</p>}
                </div>
              </div>

              {/* Section 2: Receipt */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full" />Material Receipt
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Receipt Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={combinedForm.materialReceivedDate}
                      onChange={(e) => setCombinedForm(p => ({ ...p, materialReceivedDate: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GRN Number <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="Enter GRN reference"
                      value={combinedForm.grnNumber}
                      onChange={(e) => setCombinedForm(p => ({ ...p, grnNumber: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Arrival Proof (optional)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept="image/*,.pdf,.mp3,.wav"
                      className="flex-1 h-10"
                      onChange={(e) => {
                        const file = e.target.files[0]
                        setCombinedForm(p => ({ ...p, receiptFile: file, receiptPreviewUrl: file?.type.startsWith('image/') ? URL.createObjectURL(file) : "" }))
                      }}
                      disabled={submitting}
                    />
                    {combinedForm.receiptPreviewUrl && (
                      <div className="h-12 w-12 rounded border overflow-hidden shrink-0">
                        <img src={combinedForm.receiptPreviewUrl} className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="flex gap-3 border-t p-4 shrink-0">
              <Button variant="outline" className="flex-1" onClick={closeModal} disabled={submitting}>Cancel</Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 font-semibold"
                onClick={handleCombinedSubmit}
                disabled={submitting || !combinedForm.biltyNo.trim() || !combinedForm.materialReceivedDate || !combinedForm.grnNumber.trim()}
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> : "Submit All Details"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}