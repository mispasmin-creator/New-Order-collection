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
  PackageCheck, ListFilter, ChevronDown, ChevronRight
} from "lucide-react"
import { format } from "date-fns"

export default function UnifiedLogistics({ user }) {
  const [deliveryData, setDeliveryData] = useState([])
  const [postDeliveryData, setPostDeliveryData] = useState([])
  const [dispatchTCMap, setDispatchTCMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const { toast } = useToast()
  const { updateCount } = useNotification()

  // Single modal for combined Documentation + Receipt entry
  const [selectedGroup, setSelectedGroup] = useState(null) // { billNo, rows[] }
  const [expandedGroups, setExpandedGroups] = useState({})
  const [selectedOrder, setSelectedOrder] = useState(null) // kept for compat reference inside modal
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
      const [deliveryRes, postDeliveryRes, dispatchRes] = await Promise.all([
        supabase.from('DELIVERY').select('*').not('Planned 3', 'is', null),
        supabase.from('POST DELIVERY').select('*'),
        supabase.from('DISPATCH').select('"D-Sr Number", "Trust Certificate Made"')
      ])

      if (deliveryRes.error) throw deliveryRes.error
      if (postDeliveryRes.error) throw postDeliveryRes.error

      setDeliveryData(deliveryRes.data || [])
      setPostDeliveryData(postDeliveryRes.data || [])

      const tcMap = {}
      dispatchRes.data?.forEach(row => {
        const key = row["D-Sr Number"]
        if (key) tcMap[key] = row["Trust Certificate Made"] || ""
      })
      setDispatchTCMap(tcMap)

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

      const dSrNumber = del["D-Sr Number"] || del["Losgistic no."] || ""

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
        isReceiptDone: !!receipt?.["Actual"],
        tcFileUrl: dSrNumber ? (dispatchTCMap[dSrNumber] || "") : "",
      }
    })
  }, [deliveryData, postDeliveryData, dispatchTCMap])

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

  // Group by billNo — rows without billNo are individual strays
  const groupedShipments = useMemo(() => {
    const groups = []
    const invoiceMap = {}
    filteredShipments.forEach(s => {
      if (s.billNo) {
        if (!invoiceMap[s.billNo]) {
          invoiceMap[s.billNo] = { billNo: s.billNo, partyName: s.partyName, rows: [] }
          groups.push(invoiceMap[s.billNo])
        }
        invoiceMap[s.billNo].rows.push(s)
      } else {
        groups.push({ billNo: "", partyName: s.partyName, rows: [s], stray: true })
      }
    })
    return groups
  }, [filteredShipments])

  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))

  // Open the combined modal
  const openModal = (group) => {
    setSelectedGroup(group)
    setSelectedOrder(group.rows[0]) // for backward compat in form
    setCombinedForm({
      biltyNo: group.rows[0]?.biltyNo || "",
      biltyCopy: null,
      materialReceivedDate: "",
      grnNumber: group.rows[0]?.grnNumber || "",
      receiptFile: null,
      receiptPreviewUrl: "",
    })
  }

  const closeModal = () => {
    setSelectedGroup(null)
    setSelectedOrder(null)
    setCombinedForm({ biltyNo: "", biltyCopy: null, materialReceivedDate: "", grnNumber: "", receiptFile: null, receiptPreviewUrl: "" })
  }

  // Single submit: Documentation + Receipt in one go (handles group of rows)
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

    const rows = selectedGroup.rows
    try {
      setSubmitting(true)
      const now = getISTTimestamp()

      // Upload bilty copy once for the whole group
      let biltyUrl = rows[0]?.biltyCopy || ""
      if (combinedForm.biltyCopy) {
        const path = `bilty/invoice_${(selectedGroup.billNo || rows[0]?.id).toString().replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${combinedForm.biltyCopy.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('images').upload(path, combinedForm.biltyCopy)
        if (upErr) throw upErr
        biltyUrl = supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }

      // Upload receipt copy once for the whole group
      let receiptUrl = rows[0]?.receiptCopy || ""
      if (combinedForm.receiptFile) {
        const path = `material_receipt/invoice_${(selectedGroup.billNo || rows[0]?.id).toString().replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${combinedForm.receiptFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('images').upload(path, combinedForm.receiptFile)
        if (upErr) throw upErr
        receiptUrl = supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }

      // 1. Update all DELIVERY rows in the group
      await Promise.all(rows.map(row =>
        supabase.from('DELIVERY')
          .update({ "Actual3": now, "Bilty No.": combinedForm.biltyNo, "Bilty Copy": biltyUrl })
          .eq('id', row.id)
      ))

      // 2. Upsert POST DELIVERY for each row
      await Promise.all(rows.map(row => {
        const receiptPayload = {
          "Order No.": row.orderNo,
          "Bill No.": row.billNo,
          "Party Name": row.partyName,
          "Bill Date": row.billDate,
          "Total Bill Amount": row.amount || 0,
          "Actual": now,
          "Planned": now,
          "Material Received Date": combinedForm.materialReceivedDate,
          "Grn Number": combinedForm.grnNumber,
          "Image Of Received Bill / Audio": receiptUrl,
        }
        if (row.receiptId) {
          return supabase.from('POST DELIVERY').update(receiptPayload).eq('id', row.receiptId)
        } else {
          return supabase.from('POST DELIVERY').insert([receiptPayload])
        }
      }))

      toast({ title: "Submitted", description: `Documentation and receipt recorded for ${rows.length} row${rows.length > 1 ? "s" : ""}.` })
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
              <TableHead className="w-8" />
              <TableHead>Action</TableHead>
              <TableHead>Invoice / Shipment</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Bilty Stage</TableHead>
              <TableHead>Receipt Stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedShipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-gray-500">No shipments found for this tab.</TableCell>
              </TableRow>
            ) : (
              groupedShipments.map((group, gi) => {
                const groupKey = group.billNo || `stray-${gi}`
                const isExpanded = !!expandedGroups[groupKey]
                const isStray = group.stray
                const allDone = group.rows.every(r => r.isReceiptDone)
                const biltyDone = group.rows.every(r => r.isBiltyDone)

                return (
                  <>
                    {/* Group / stray header row */}
                    <TableRow
                      key={`group-${groupKey}`}
                      className={`transition-colors cursor-pointer ${isStray ? "bg-white hover:bg-gray-50/80" : "bg-slate-50 hover:bg-slate-100"}`}
                      onClick={() => !isStray && toggleGroup(groupKey)}
                    >
                      <TableCell className="pl-3 text-gray-400">
                        {!isStray && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {!allDone ? (
                          <Button size="sm" onClick={() => openModal(group)} className="bg-blue-600 hover:bg-blue-700 h-8">
                            Fill Details
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-green-600" disabled>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Done
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {group.billNo ? (
                            <Badge className="bg-indigo-500 text-white text-xs w-fit">{group.billNo}</Badge>
                          ) : (
                            <span className="text-gray-400 text-xs italic">No Invoice</span>
                          )}
                          {!isStray && (
                            <span className="text-[10px] text-slate-500">{group.rows.length} product{group.rows.length > 1 ? "s" : ""}</span>
                          )}
                          {isStray && (
                            <span className="text-xs text-gray-500">{group.rows[0]?.orderNo}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{group.partyName}</TableCell>
                      <TableCell>
                        {biltyDone ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-medium text-green-700">{group.rows[0]?.biltyNo}</span>
                            {group.rows[0]?.biltyCopy && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewFile(group.rows[0].biltyCopy)}><Eye className="h-3 w-3" /></Button>}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">Pending Docs</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {allDone ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-medium text-green-700">{group.rows[0]?.grnNumber}</span>
                            {group.rows[0]?.receiptCopy && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewFile(group.rows[0].receiptCopy)}><Eye className="h-3 w-3" /></Button>}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-gray-400 bg-gray-50 border-gray-200 font-normal">
                            {biltyDone ? "Awaiting GRN" : "Waiting for Bilty"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded product rows (only for invoice groups) */}
                    {!isStray && isExpanded && group.rows.map(s => (
                      <TableRow key={s.id} className="bg-white hover:bg-gray-50/50 border-b border-gray-100">
                        <TableCell />
                        <TableCell />
                        <TableCell className="py-2 text-xs text-gray-500 font-mono">{s.orderNo}</TableCell>
                        <TableCell className="py-2 text-sm text-gray-700">{s.productName}</TableCell>
                        <TableCell className="py-2">
                          {s.isBiltyDone ? (
                            <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{s.biltyNo}</span>
                          ) : (
                            <span className="text-xs text-amber-500">Pending</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {s.isReceiptDone ? (
                            <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{s.grnNumber}</span>
                          ) : (
                            <span className="text-xs text-gray-400">Pending</span>
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

      {/* Combined Documentation + Receipt Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50 rounded-t-xl shrink-0">
              <CardTitle className="text-lg">Fill Shipment Details</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeModal} disabled={submitting}><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6 overflow-y-auto flex-1">

              {/* Shipment info */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{selectedGroup.partyName}</span>
                  {selectedGroup.billNo && <Badge className="bg-indigo-500 text-white text-xs">{selectedGroup.billNo}</Badge>}
                </div>
                <table className="w-full text-xs mt-1">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium text-gray-600">Order No</th>
                      <th className="text-left px-2 py-1 font-medium text-gray-600">Product</th>
                      <th className="text-left px-2 py-1 font-medium text-gray-600">Test Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedGroup.rows.map(row => (
                      <tr key={row.id} className="bg-white">
                        <td className="px-2 py-1 font-mono text-gray-600">{row.orderNo}</td>
                        <td className="px-2 py-1 text-gray-700">{row.productName}</td>
                        <td className="px-2 py-1">
                          {row.tcFileUrl ? (
                            <button
                              onClick={() => handleViewFile(row.tcFileUrl)}
                              className="text-blue-600 hover:text-blue-800 underline flex items-center gap-0.5"
                            >
                              <Eye className="w-3 h-3" /> View TC
                            </button>
                          ) : (
                            <span className="text-gray-400 italic">No TC uploaded</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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