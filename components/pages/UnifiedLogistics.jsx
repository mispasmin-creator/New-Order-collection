"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  X, Search, Loader2, Upload, FileText,
  CheckCircle2, Clock, Truck, Eye, ArrowRight,
  PackageCheck, ListFilter, ChevronDown, ChevronRight, Download, Building, User, Pencil
} from "lucide-react"
import { exportToExcel } from "@/lib/exportUtils"
import { format } from "date-fns"

export default function UnifiedLogistics({ user }) {
  const [deliveryData, setDeliveryData] = useState([])
  const [postDeliveryData, setPostDeliveryData] = useState([])
  const [dispatchTCMap, setDispatchTCMap] = useState({})
  const [dispatchExtraMap, setDispatchExtraMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [filterFirm, setFilterFirm] = useState("all")
  const [filterParty, setFilterParty] = useState("all")
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

      const userFirms = user?.role !== "ADMIN"
        ? (user?.firm ? user.firm.split(',').map(f => f.trim()).filter(Boolean) : [])
        : null
      const shouldFilter = userFirms && !userFirms.includes('all') && userFirms.length > 0

      let allowedDoNumbers = []
      const firmMapCombined = {}
      const doNumberPartyFirmMap = {}
      const doNumberFirms = {}
      const poIdFirmMap = new Map()

      let orQuery = supabase
        .from('ORDER RECEIPT')
        .select('id, "DO-Delivery Order No.", "Firm Name", "Party Names"')

      if (shouldFilter) {
        orQuery = orQuery.in('Firm Name', userFirms)
      }

      const { data: orRows } = await orQuery

      orRows?.forEach(r => {
        if (r.id && r['Firm Name']) poIdFirmMap.set(r.id, r['Firm Name'])
        const doNo = (r['DO-Delivery Order No.'] || '').trim()
        const firm = r['Firm Name']
        const party = (r['Party Names'] || '').trim()

        if (doNo) {
          allowedDoNumbers.push(doNo)

          if (party && firm) {
            firmMapCombined[`${doNo}|${party.toLowerCase()}`] = firm
            if (!doNumberPartyFirmMap[doNo]) doNumberPartyFirmMap[doNo] = []
            doNumberPartyFirmMap[doNo].push({ party, firm })
          }

          if (!doNumberFirms[doNo]) doNumberFirms[doNo] = new Set()
          if (firm) doNumberFirms[doNo].add(firm)
        }
      })

      const firmMapByDoOnly = {}
      Object.entries(doNumberFirms).forEach(([doNo, firms]) => {
        if (firms.size === 1) {
          firmMapByDoOnly[doNo] = [...firms][0]
        }
      })

      let deliveryQuery = supabase.from('DELIVERY').select('*').not('Planned 3', 'is', null)
      if (shouldFilter && allowedDoNumbers.length > 0) deliveryQuery = deliveryQuery.in('"Delivery Order No."', allowedDoNumbers)

      let postDeliveryQuery = supabase.from('POST DELIVERY').select('*')
      if (shouldFilter && allowedDoNumbers.length > 0) postDeliveryQuery = postDeliveryQuery.in('"Order No."', allowedDoNumbers)

      const [deliveryRes, postDeliveryRes, dispatchRes] = await Promise.all([
        deliveryQuery,
        postDeliveryQuery,
        supabase.from('DISPATCH').select('"D-Sr Number", "Trust Certificate Made", "Delivery Order No.", "Party Name", po_id, "LGST-Sr Number", "Transport Rate @Per Matric Ton", "Fixed Amount", "Type Of Rate"')
      ])

      if (deliveryRes.error) throw deliveryRes.error
      if (postDeliveryRes.error) throw postDeliveryRes.error

      const tcMap = {}
      const extraMap = {}
      const dispatchFirmMapCombined = {}
      const dispatchFirmMapByDo = {}

      dispatchRes.data?.forEach(row => {
        const dSr = (row["D-Sr Number"] || "").toString().trim()
        const doNo = (row["Delivery Order No."] || "").toString().trim()
        const party = (row["Party Name"] || "").toString().trim().toLowerCase()

        if (dSr) {
          tcMap[dSr] = row["Trust Certificate Made"] || ""
          extraMap[dSr] = {
            lgstSrNumber: row["LGST-Sr Number"] || "",
            transportRatePerTon: row["Transport Rate @Per Matric Ton"] || "",
            fixedAmount: row["Fixed Amount"] || "",
            typeOfRate: row["Type Of Rate"] || "",
          }
          if (row.po_id && poIdFirmMap.has(row.po_id)) {
            const firm = poIdFirmMap.get(row.po_id)
            if (party) dispatchFirmMapCombined[`${dSr}|${party}`] = firm
            if (doNo) dispatchFirmMapByDo[`${dSr}|${doNo}`] = firm
          }
        }
      })
      setDispatchTCMap(tcMap)
      setDispatchExtraMap(extraMap)

      const resolveFirm = (poId, doNo, partyName, dSrNo) => {
        // 1. Direct po_id lookup (highest accuracy)
        if (poId && poIdFirmMap.has(poId)) {
          return poIdFirmMap.get(poId)
        }

        const cleanDSr = (dSrNo || "").toString().trim()
        const cleanDo = (doNo || "").toString().trim()
        const cleanParty = (partyName || "").toString().trim().toLowerCase()

        // 2. D-Sr Number + Party Name match from DISPATCH
        if (cleanDSr && cleanParty && dispatchFirmMapCombined[`${cleanDSr}|${cleanParty}`]) {
          return dispatchFirmMapCombined[`${cleanDSr}|${cleanParty}`]
        }

        // 3. D-Sr Number + DO Number match from DISPATCH
        if (cleanDSr && cleanDo && dispatchFirmMapByDo[`${cleanDSr}|${cleanDo}`]) {
          return dispatchFirmMapByDo[`${cleanDSr}|${cleanDo}`]
        }

        // 4. DO Number + Party Name match from ORDER RECEIPT
        if (cleanDo && cleanParty) {
          const exactKey = `${cleanDo}|${cleanParty}`
          if (firmMapCombined[exactKey]) return firmMapCombined[exactKey]

          if (doNumberPartyFirmMap[cleanDo]) {
            for (const entry of doNumberPartyFirmMap[cleanDo]) {
              const entryParty = entry.party.toLowerCase()
              if (entryParty.includes(cleanParty) || cleanParty.includes(entryParty)) {
                return entry.firm
              }
            }
          }
        }

        // 5. Single DO Fallback
        if (cleanDo && firmMapByDoOnly[cleanDo]) {
          return firmMapByDoOnly[cleanDo]
        }

        return ""
      }

      const taggedDelivery = (deliveryRes.data || []).map(del => {
        const poId = del.po_id || del["po_id"] || del["Order Receipt id"]
        const dSr = del["D-Sr Number"] || del["Losgistic no."] || ""
        return {
          ...del,
          firmName: resolveFirm(poId, del["Delivery Order No."], del["Party Name"], dSr)
        }
      })
      setDeliveryData(taggedDelivery)

      const billToFirmMap = {}
      taggedDelivery.forEach(del => {
        if (del["Bill No."] && del.firmName) {
          billToFirmMap[del["Bill No."]] = del.firmName
        }
      })

      const taggedPostDelivery = (postDeliveryRes.data || []).map(pd => {
        const poId = pd.po_id || pd["po_id"]
        let firm = resolveFirm(poId, pd["Order No."], pd["Party Name"], "")
        if (!firm && pd["Bill No."] && billToFirmMap[pd["Bill No."]]) {
          firm = billToFirmMap[pd["Bill No."]]
        }
        return {
          ...pd,
          firmName: firm
        }
      })
      setPostDeliveryData(taggedPostDelivery)

      // Update notifications
      const activePendingShipments = taggedDelivery
        .filter(del => {
          const type = del["Type Of Transporting"] || "";
          return type.toLowerCase().trim() !== "ex-factory" && type.toLowerCase().trim() !== "ex factory";
        })
        .map(del => {
          const receipt = taggedPostDelivery.find(pd => {
            if (del["Bill No."]) {
              return pd["Bill No."] === del["Bill No."] && (pd.firmName === del.firmName || !pd.firmName || !del.firmName)
            }
            return pd["Order No."] && pd["Order No."] === del["Delivery Order No."]
          })
          return {
            billNo: del["Bill No."],
            isReceiptDone: !!receipt?.["Actual"]
          }
        })
        .filter(s => !s.isReceiptDone)

      const invoiceSet = new Set()
      let strayCount = 0
      activePendingShipments.forEach(s => {
        if (s.billNo) {
          invoiceSet.add(s.billNo)
        } else {
          strayCount++
        }
      })
      const pendingGroupedCount = invoiceSet.size + strayCount

      updateCount?.("Bilty Update", pendingGroupedCount)
      updateCount?.("Bilty Entry", pendingGroupedCount)

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

  // Auto-reset filters when switching tabs
  useEffect(() => {
    setFilterFirm("all")
    setFilterParty("all")
    setSearchTerm("")
  }, [activeTab])

  // Unified data joining logic
  const shipments = useMemo(() => {
    return deliveryData
      .filter(del => {
        const type = del["Type Of Transporting"] || "";
        return type.toLowerCase().trim() !== "ex-factory" && type.toLowerCase().trim() !== "ex factory";
      })
      .map(del => {
      // Find matching receipt by Bill No (scoped to the same firm) or DO No if Bill No is missing.
      // Bill No. is not unique across firms, so matching by Bill No. alone can pull in another firm's receipt.
      const receipt = postDeliveryData.find(pd => {
        if (del["Bill No."]) {
          return pd["Bill No."] === del["Bill No."] && pd.firmName === del.firmName
        }
        return pd["Order No."] && pd["Order No."] === del["Delivery Order No."]
      })

      const dSrNumber = del["D-Sr Number"] || del["Losgistic no."] || ""

      return {
        ...del,
        id: del.id,
        orderNo: del["Delivery Order No."],
        billNo: del["Bill No."],
        partyName: del["Party Name"],
        productName: del["Product Name"],
        typeOfTransporting: del["Type Of Transporting"] || "",
        transporterName: del["Transporter Name"] || "",
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
        lgstSrNumber: dSrNumber ? (dispatchExtraMap[dSrNumber]?.lgstSrNumber || "") : "",
        truckQty: del["Quantity Delivered."] ?? "",
        truckNo: del["Vehicle Number."] || "",
        transporterRate: (() => {
          const extra = dSrNumber ? dispatchExtraMap[dSrNumber] : null
          if (!extra) return ""
          const perMt = Number(extra.transportRatePerTon) || 0
          const fixed = Number(extra.fixedAmount) || 0
          if (perMt > 0) return `₹${perMt.toLocaleString("en-IN")} / MT`
          if (fixed > 0) return `₹${fixed.toLocaleString("en-IN")} fixed`
          return ""
        })(),
      }
    })
  }, [deliveryData, postDeliveryData, dispatchTCMap, dispatchExtraMap])

  // Grouped counts for cards
  const pendingGroupedCount = useMemo(() => {
    const pendingList = shipments.filter(s => !s.isReceiptDone)
    const invoiceSet = new Set()
    let strayCount = 0
    pendingList.forEach(s => {
      if (s.billNo) {
        invoiceSet.add(s.billNo)
      } else {
        strayCount++
      }
    })
    return invoiceSet.size + strayCount
  }, [shipments])

  const completedGroupedCount = useMemo(() => {
    const completedList = shipments.filter(s => s.isReceiptDone)
    const invoiceSet = new Set()
    let strayCount = 0
    completedList.forEach(s => {
      if (s.billNo) {
        invoiceSet.add(s.billNo)
      } else {
        strayCount++
      }
    })
    return invoiceSet.size + strayCount
  }, [shipments])

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
    let list = activeTab === "pending"
      ? shipments.filter(s => !s.isReceiptDone)
      : shipments.filter(s => s.isReceiptDone)

    if (filterFirm !== "all") {
      list = list.filter(s => s.firmName === filterFirm)
    }
    if (filterParty !== "all") {
      list = list.filter(s => s.partyName === filterParty)
    }

    if (!searchTerm.trim()) return list
    const term = searchTerm.toLowerCase()
    return list.filter(item =>
      Object.values(item).some(v => v?.toString().toLowerCase().includes(term))
    )
  }, [shipments, activeTab, searchTerm, filterFirm, filterParty])

  const firmOptions = useMemo(() => {
    const list = activeTab === "pending"
      ? shipments.filter(s => !s.isReceiptDone)
      : shipments.filter(s => s.isReceiptDone)
    const firms = [...new Set(list.map(s => s.firmName).filter(Boolean))]
    return ["all", ...firms]
  }, [shipments, activeTab])

  const partyOptions = useMemo(() => {
    const list = activeTab === "pending"
      ? shipments.filter(s => !s.isReceiptDone)
      : shipments.filter(s => s.isReceiptDone)
    const parties = [...new Set(list.map(s => s.partyName).filter(Boolean))]
    return ["all", ...parties]
  }, [shipments, activeTab])

  // Group by firm + billNo — Bill No. is not unique across firms, so grouping by
  // billNo alone would merge different firms' invoices into one update. Rows without
  // billNo are individual strays.
  const groupedShipments = useMemo(() => {
    const groups = []
    const invoiceMap = {}
    filteredShipments.forEach(s => {
      if (s.billNo) {
        const key = `${s.firmName || ""}::${s.billNo}`
        if (!invoiceMap[key]) {
          invoiceMap[key] = { billNo: s.billNo, partyName: s.partyName, firmName: s.firmName, rows: [] }
          groups.push(invoiceMap[key])
        }
        invoiceMap[key].rows.push(s)
      } else {
        groups.push({ billNo: "", partyName: s.partyName, firmName: s.firmName, rows: [s], stray: true })
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
      materialReceivedDate: group.rows[0]?.receiptActual ? new Date(group.rows[0].receiptActual).toISOString().split("T")[0] : "",
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

  const handleExport = () => {
    exportToExcel(filteredShipments, `BiltyUpdate_${activeTab}`)
  }

  // Single submit: Documentation + Receipt in one go (handles group of rows)
  const handleCombinedSubmit = async () => {
    if (!combinedForm.biltyNo.trim()) {
      toast({ variant: "destructive", title: "Validation", description: "Bilty number is required." }); return
    }
    const existingBiltyCopy = selectedGroup?.rows?.[0]?.biltyCopy
    if (!combinedForm.biltyCopy && !existingBiltyCopy) {
      toast({ variant: "destructive", title: "Validation", description: "Bilty copy is required." }); return
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
      await Promise.all(rows.map(row => {
        const delPayload = { "Bilty No.": combinedForm.biltyNo, "Bilty Copy": biltyUrl }
        if (!row.Actual3) delPayload["Actual3"] = now
        return supabase.from('DELIVERY')
          .update(delPayload)
          .eq('id', row.id)
      }))

      // Also update DISPATCH table for matching D-Sr Numbers
      const dSrNumbers = [...new Set(rows.map(r => r.dSrNumber || r["D-Sr Number"] || r["Losgistic no."]).filter(Boolean))]
      if (dSrNumbers.length > 0) {
        await supabase.from('DISPATCH')
          .update({ "Bilty No.": combinedForm.biltyNo, "Bilty Copy": biltyUrl })
          .in('D-Sr Number', dSrNumbers)
      }

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
              <div className="text-2xl font-bold text-amber-900">{pendingGroupedCount}</div>
            </div>
            <Truck className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 cursor-pointer" onClick={() => setActiveTab("history")}>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Completed</p>
              <div className="text-2xl font-bold text-green-900">{completedGroupedCount}</div>
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

          <Select value={filterFirm} onValueChange={setFilterFirm}>
            <SelectTrigger className="h-10 w-[180px] bg-white">
              <Building className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Firm" />
            </SelectTrigger>
            <SelectContent>
              {firmOptions.map(firm => (
                <SelectItem key={firm} value={firm}>
                  {firm === "all" ? "All Firms" : firm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterParty} onValueChange={setFilterParty}>
            <SelectTrigger className="h-10 w-[180px] bg-white">
              <User className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Party" />
            </SelectTrigger>
            <SelectContent>
              {partyOptions.map(party => (
                <SelectItem key={party} value={party}>
                  {party === "all" ? "All Parties" : party}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
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
            <Button onClick={handleExport} variant="outline" className="h-9 px-3 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="w-8" />
                <TableHead>Action</TableHead>
                <TableHead>Invoice / Shipment</TableHead>
                <TableHead>Firm Name</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Transporter Type</TableHead>
                <TableHead>Transporter Name</TableHead>
                <TableHead>Bilty Stage</TableHead>
                <TableHead>Receipt Stage</TableHead>
                <TableHead>LGST-Sr</TableHead>
                <TableHead>Truck Qty</TableHead>
                <TableHead>Transporter Rate</TableHead>
                <TableHead>Truck No</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedShipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center text-gray-500">No shipments found for this tab.</TableCell>
                </TableRow>
              ) : (
                groupedShipments.map((group, gi) => {
                  const groupKey = group.billNo ? `${group.firmName || ""}::${group.billNo}` : `stray-${gi}`
                  const isExpanded = !!expandedGroups[groupKey]
                  const isStray = group.stray
                  const allDone = group.rows.every(r => r.isReceiptDone)
                  const biltyDone = group.rows.every(r => r.isBiltyDone)

                  return (
                    <Fragment key={`group-${groupKey}`}>
                      {/* Group / stray header row */}
                      <TableRow
                        className={`transition-colors cursor-pointer ${isStray ? "bg-white hover:bg-gray-50/80" : "bg-slate-50 hover:bg-slate-100"}`}
                        onClick={() => !isStray && toggleGroup(groupKey)}
                      >
                        <TableCell className="pl-3 text-gray-400">
                          {!isStray && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {!allDone || user?.role === "ADMIN" ? (
                            <Button size="sm" onClick={() => openModal(group)} className="bg-blue-600 hover:bg-blue-700 h-8">
                              {allDone ? "Edit Details" : "Fill Details"}
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
                        <TableCell className="text-sm font-medium text-gray-700">{group.firmName || group.rows[0]?.firmName || "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{group.partyName}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {[...new Set(group.rows.map(r => r.typeOfTransporting).filter(Boolean))].join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {[...new Set(group.rows.map(r => r.transporterName).filter(Boolean))].join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          {biltyDone ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-xs font-medium text-green-700">{group.rows[0]?.biltyNo}</span>
                              {group.rows[0]?.biltyCopy && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewFile(group.rows[0].biltyCopy)}><Eye className="h-3 w-3" /></Button>}
                              {user?.role === "ADMIN" && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600 hover:text-amber-800" title="Edit Bilty" onClick={(e) => { e.stopPropagation(); openModal(group); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-amber-600">Pending</span>
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
                            <span className="text-xs font-medium text-gray-400">Pending</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {[...new Set(group.rows.map(r => r.lgstSrNumber).filter(Boolean))].join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {group.rows.reduce((sum, r) => sum + (Number(r.truckQty) || 0), 0) || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {[...new Set(group.rows.map(r => r.transporterRate).filter(Boolean))].join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {[...new Set(group.rows.map(r => r.truckNo).filter(Boolean))].join(", ") || "—"}
                        </TableCell>
                      </TableRow>

                      {/* Expanded product rows (only for invoice groups) */}
                      {!isStray && isExpanded && group.rows.map(s => (
                        <TableRow key={s.id} className="bg-white hover:bg-gray-50/50 border-b border-gray-100">
                          <TableCell />
                          <TableCell />
                          <TableCell className="py-2 text-xs text-gray-500 font-mono">{s.orderNo}</TableCell>
                          <TableCell className="py-2 text-sm text-gray-700 font-medium">{s.firmName || "—"}</TableCell>
                          <TableCell className="py-2 text-sm text-gray-700">{s.productName}</TableCell>
                          <TableCell className="py-2 text-sm text-gray-600">{s.typeOfTransporting || "—"}</TableCell>
                          <TableCell className="py-2 text-sm text-gray-600">{s.transporterName || "—"}</TableCell>
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
                          <TableCell className="py-2 text-xs text-gray-500">
                            {s.lgstSrNumber ? <Badge className="bg-blue-500 text-white text-[10px]">{s.lgstSrNumber}</Badge> : "—"}
                          </TableCell>
                          <TableCell className="py-2 text-sm text-gray-600">{s.truckQty || "—"}</TableCell>
                          <TableCell className="py-2 text-sm text-gray-600">{s.transporterRate || "—"}</TableCell>
                          <TableCell className="py-2 text-sm text-gray-600">{s.truckNo || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
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
                  <Label>Bilty Copy <span className="text-red-500">*</span></Label>
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
                disabled={
                  submitting ||
                  !combinedForm.biltyNo.trim() ||
                  (!combinedForm.biltyCopy && !selectedGroup?.rows?.[0]?.biltyCopy) ||
                  !combinedForm.materialReceivedDate ||
                  !combinedForm.grnNumber.trim()
                }
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
