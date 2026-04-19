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
  const [activeTab, setActiveTab] = useState("pending-bilty")
  const { toast } = useToast()
  const { updateCount } = useNotification()

  // Selected for modals
  const [selectedBiltyOrder, setSelectedBiltyOrder] = useState(null)
  const [selectedReceiptEntry, setSelectedReceiptEntry] = useState(null)

  // Form states
  const [biltyFormData, setBiltyFormData] = useState({ biltyNo: "", biltyCopy: null })
  const [receiptFormData, setReceiptFormData] = useState({ 
    materialReceivedDate: "", 
    grnNumber: "", 
    receiptFile: null,
    previewUrl: "" 
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
      const pendingBilty = (deliveryRes.data || []).filter(d => !d.Actual3).length
      updateCount?.("Bilty Entry", pendingBilty)

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

  // Filtering logic
  const filteredShipments = useMemo(() => {
    let list = shipments
    if (activeTab === "pending-bilty") {
      list = shipments.filter(s => !s.isBiltyDone)
    } else if (activeTab === "pending-receipt") {
      list = shipments.filter(s => s.isBiltyDone && !s.isReceiptDone)
    } else {
      list = shipments.filter(s => s.isReceiptDone)
    }

    if (!searchTerm.trim()) return list
    return list.filter(item => 
      Object.values(item).some(v => v?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [shipments, activeTab, searchTerm])

  // Handlers for Bilty Entry
  const openBiltyModal = (order) => {
    setSelectedBiltyOrder(order)
    setBiltyFormData({ biltyNo: order["Bilty No."] || "", biltyCopy: null })
  }

  const handleBiltySubmit = async () => {
    try {
      setSubmitting(true)
      let biltyUrl = selectedBiltyOrder.biltyCopy || ""

      if (biltyFormData.biltyCopy) {
        const timestamp = Date.now()
        const path = `bilty/${selectedBiltyOrder.id}_${timestamp}_${biltyFormData.biltyCopy.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('images').upload(path, biltyFormData.biltyCopy)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
        biltyUrl = publicUrl
      }

      const { error: updateError } = await supabase
        .from('DELIVERY')
        .update({
          "Actual3": getISTTimestamp(),
          "Bilty No.": biltyFormData.biltyNo,
          "Bilty Copy": biltyUrl
        })
        .eq('id', selectedBiltyOrder.id)

      if (updateError) throw updateError

      // NEW: Initialize the POST DELIVERY record for the Next Stage (Receipt)
      const { error: postError } = await supabase
        .from('POST DELIVERY')
        .insert([{
          "Order No.": selectedBiltyOrder.orderNo,
          "Bill No.": selectedBiltyOrder.billNo,
          "Party Name": selectedBiltyOrder.partyName,
          "Bill Date": selectedBiltyOrder.billDate,
          "Total Bill Amount": (selectedBiltyOrder["Rate Of Material"] || 0) * (selectedBiltyOrder["Quantity Delivered."] || 0),
          "Planned": getISTTimestamp()
        }])

      if (postError) {
        console.warn("Could not auto-initialize POST DELIVERY, user will manually create on receipt:", postError)
      }

      toast({ title: "Bilty Recorded", description: "Documentation updated and moved to Transit" })
      setSelectedBiltyOrder(null)
      fetchEverything()
    } catch (e) {
      toast({ variant: "destructive", title: "Submission Failed", description: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Handlers for Receipt Entry
  const openReceiptModal = (order) => {
    setSelectedReceiptEntry(order)
    setReceiptFormData({
      materialReceivedDate: "",
      grnNumber: order.grnNumber || "",
      receiptFile: null,
      previewUrl: ""
    })
  }

  const handleReceiptSubmit = async () => {
    try {
      setSubmitting(true)
      let receiptUrl = selectedReceiptEntry.receiptCopy || ""

      if (receiptFormData.receiptFile) {
        const timestamp = Date.now()
        const path = `material_receipt/${selectedReceiptEntry.id}_${timestamp}_${receiptFormData.receiptFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('images').upload(path, receiptFormData.receiptFile)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
        receiptUrl = publicUrl
      }

      let res;
      if (selectedReceiptEntry.receiptId) {
        // Update existing record
        res = await supabase
          .from('POST DELIVERY')
          .update({
            "Actual": getISTTimestamp(),
            "Material Received Date": receiptFormData.materialReceivedDate,
            "Grn Number": receiptFormData.grnNumber,
            "Image Of Received Bill / Audio": receiptUrl
          })
          .eq('id', selectedReceiptEntry.receiptId)
      } else {
        // Create missing record on the fly
        res = await supabase
          .from('POST DELIVERY')
          .insert([{
            "Order No.": selectedReceiptEntry.orderNo,
            "Bill No.": selectedReceiptEntry.billNo,
            "Party Name": selectedReceiptEntry.partyName,
            "Bill Date": selectedReceiptEntry.billDate,
            "Total Bill Amount": selectedReceiptEntry.amount || 0,
            "Actual": getISTTimestamp(),
            "Material Received Date": receiptFormData.materialReceivedDate,
            "Grn Number": receiptFormData.grnNumber,
            "Image Of Received Bill / Audio": receiptUrl
          }])
      }

      if (res.error) throw res.error

      toast({ title: "Receipt Recorded", description: "Material entry finalized" })
      setSelectedReceiptEntry(null)
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
          <h1 className="text-2xl font-bold text-gray-900">Unified Logistics fulfillment</h1>
          <p className="text-gray-600">Monitor and manage shipments from dispatch to receipt</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-amber-50 border-amber-100 cursor-pointer" onClick={() => setActiveTab("pending-bilty")}>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Bilty</p>
              <div className="text-2xl font-bold text-amber-900">{shipments.filter(s => !s.isBiltyDone).length}</div>
            </div>
            <FileText className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100 cursor-pointer" onClick={() => setActiveTab("pending-receipt")}>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">In-Transit</p>
              <div className="text-2xl font-bold text-blue-900">{shipments.filter(s => s.isBiltyDone && !s.isReceiptDone).length}</div>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
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
              { id: "pending-bilty", label: "Documentation", icon: FileText },
              { id: "pending-receipt", label: "Receipt", icon: Clock },
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
              <TableHead className="w-[150px]">Shipment Details</TableHead>
              <TableHead>Party Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Bilty Stage</TableHead>
              <TableHead>Receipt Stage</TableHead>
              <TableHead className="text-right">Action</TableHead>
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
                  <TableCell className="text-right">
                    {!s.isBiltyDone ? (
                      <Button size="sm" onClick={() => openBiltyModal(s)} className="bg-amber-600 hover:bg-amber-700 h-8">
                        Bilty Entry
                      </Button>
                    ) : !s.isReceiptDone ? (
                      <Button size="sm" onClick={() => openReceiptModal(s)} className="bg-blue-600 hover:bg-blue-700 h-8">
                        Receipt Entry
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-gray-400 group" disabled>
                        Done <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bilty Entry Modal */}
      {selectedBiltyOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50 rounded-t-xl">
              <CardTitle className="text-lg">Bilty Entry Documentation</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedBiltyOrder(null)} disabled={submitting}><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div><span className="text-gray-500 font-medium">Order No:</span> <span className="font-bold">{selectedBiltyOrder.orderNo}</span></div>
                  <div><span className="text-gray-500 font-medium">Bill No:</span> <span className="font-bold">{selectedBiltyOrder.billNo}</span></div>
                  <div className="col-span-2"><span className="text-gray-500 font-medium">Party Name:</span> <span className="text-gray-900">{selectedBiltyOrder.partyName}</span></div>
                  <div className="col-span-2"><span className="text-gray-500 font-medium">Product:</span> <span className="text-gray-900">{selectedBiltyOrder.productName}</span></div>
                  <div><span className="text-gray-500 font-medium">Bill Date:</span> <span className="text-gray-900">{formatDate(selectedBiltyOrder.billDate)}</span></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Bilty Number *</Label>
                  <Input 
                    placeholder="Enter consignment/bilty no." 
                    value={biltyFormData.biltyNo}
                    onChange={(e) => setBiltyFormData(p => ({...p, biltyNo: e.target.value}))}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scan/Copy of Bilty</Label>
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept="image/*,.pdf" 
                      className="hidden" 
                      id="bilty-upload"
                      onChange={(e) => setBiltyFormData(p => ({...p, biltyCopy: e.target.files[0]}))}
                      disabled={submitting}
                    />
                    <label 
                      htmlFor="bilty-upload"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm font-medium text-gray-600">{biltyFormData.biltyCopy ? biltyFormData.biltyCopy.name : "Click to select file"}</span>
                      <span className="text-[10px] text-gray-400 mt-1">Images or PDF (Max 5MB)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedBiltyOrder(null)} disabled={submitting}>Cancel</Button>
                <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleBiltySubmit} disabled={submitting || !biltyFormData.biltyNo}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Submit Docs"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt Entry Modal */}
      {selectedReceiptEntry && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50 rounded-t-xl">
              <CardTitle className="text-lg">Submit Material Receipt</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedReceiptEntry(null)} disabled={submitting}><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div><span className="text-gray-500 font-medium">Order No:</span> <span className="font-bold">{selectedReceiptEntry.orderNo}</span></div>
                  <div><span className="text-gray-500 font-medium">Bill No:</span> <span className="font-bold">{selectedReceiptEntry.billNo}</span></div>
                  <div className="col-span-2"><span className="text-gray-500 font-medium">Party Name:</span> <span className="text-gray-900">{selectedReceiptEntry.partyName}</span></div>
                  <div><span className="text-gray-500 font-medium">Total Amount:</span> <span className="font-bold text-blue-600">₹{selectedReceiptEntry.amount}</span></div>
                  <div className="text-gray-700 font-medium">{formatDateTime(selectedReceiptEntry.plannedDate)}</div>
                  <div className="col-span-2"><span className="text-gray-500 font-medium">Bill Date:</span> <span className="text-gray-900">{formatDate(selectedReceiptEntry.billDate)}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Receipt Date *</Label>
                  <Input 
                    type="date" 
                    value={receiptFormData.materialReceivedDate}
                    onChange={(e) => setReceiptFormData(p => ({...p, materialReceivedDate: e.target.value}))}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>GRN Number *</Label>
                  <Input 
                    placeholder="Enter GRN reference" 
                    value={receiptFormData.grnNumber}
                    onChange={(e) => setReceiptFormData(p => ({...p, grnNumber: e.target.value}))}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Arrival Proof (Bill/Receipt/Audio)</Label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="file" 
                    accept="image/*,.pdf,.mp3,.wav" 
                    className="flex-1"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file && file.type.startsWith('image/')) {
                        setReceiptFormData(p => ({...p, receiptFile: file, previewUrl: URL.createObjectURL(file)}))
                      } else {
                        setReceiptFormData(p => ({...p, receiptFile: file, previewUrl: ""}))
                      }
                    }}
                    disabled={submitting}
                  />
                  {receiptFormData.previewUrl && (
                    <div className="h-12 w-12 rounded border overflow-hidden shrink-0"><img src={receiptFormData.previewUrl} className="h-full w-full object-cover" /></div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 border-t pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedReceiptEntry(null)} disabled={submitting}>Cancel</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 font-bold" onClick={handleReceiptSubmit} disabled={submitting || !receiptFormData.materialReceivedDate || !receiptFormData.grnNumber}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Complete Fulfillment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
