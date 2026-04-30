"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Search, Loader2, CheckCircle2, Truck, ChevronDown, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { groupRowsByPo } from "@/lib/workflowGrouping"

const TRANSPORT_TYPES = [
  "FOR",
  "Ex Factory",
  "Ex Factory But paid by Us",
  "Owned Truck",
  "Direct Supply",
]

const DB_COLUMNS = {
  TIMESTAMP: "Timestamp",
  DSR_NUMBER: "D-Sr Number",
  DELIVERY_ORDER_NO: "Delivery Order No.",
  PARTY_NAME: "Party Name",
  PRODUCT_NAME: "Product Name",
  QTY_TO_BE_DISPATCHED: "Qty To Be Dispatched",
  TYPE_OF_TRANSPORTING: "Type Of Transporting",
  DATE_OF_DISPATCH: "Date Of Dispatch",
  PLANNED1: "Planned1",
  ACTUAL1: "Actual1",
  LGST_SR_NUMBER: "LGST-Sr Number",
  ACTUAL_TRUCK_QTY: "Actual Truck Qty",
  TYPE_OF_TRANSPORTING_LOGISTIC: "Type Of Transporting  ",
  TRANSPORTER_NAME: "Transporter Name",
  TRUCK_NO: "Truck No.",
  DRIVER_MOBILE: "Driver Mobile No.",
  VEHICLE_IMAGE: "Vehicle No. Plate Image",
  BILTY_NO: "Bilty No.",
  TYPE_OF_RATE: "Type Of Rate",
  TRANSPORT_RATE: "Transport Rate @Per Matric Ton",
  FIXED_AMOUNT: "Fixed Amount",
}

const formatDate = (value) => {
  if (!value) return ""
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return String(value)
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return String(value)
  }
}

export default function LogisticPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [transporters, setTransporters] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    transporterName: "",
    truckNo: "",
    driverMobileNo: "",
    vehicleNoPlateImage: null,
    biltyNo: "",
    typeOfTransporting: "",
    typeOfRate: "",
    transportRatePerTon: "",
    fixedAmount: "",
  })
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const userFirms = user?.role !== "ADMIN"
        ? (user?.firm ? user.firm.split(',').map(f => f.trim()).filter(Boolean) : [])
        : null
      const shouldFilter = userFirms && !userFirms.includes('all') && userFirms.length > 0

      let orderQuery = supabase.from("ORDER RECEIPT").select('id, "PARTY PO NO (As Per Po Exact)", "Party Names"')
      if (shouldFilter) orderQuery = orderQuery.in('Firm Name', userFirms)
      const { data: orderData, error: orderError } = await orderQuery

      if (orderError) throw orderError

      const allowedPoIds = (orderData || []).map(r => r.id)

      let dispatchQuery = supabase.from("DISPATCH").select("*").order("id", { ascending: false })
      if (shouldFilter) dispatchQuery = dispatchQuery.in('po_id', allowedPoIds)

      const [
        { data: dispatchData, error: dispatchError },
        { data: approvedSplitsData, error: approvedSplitsError },
      ] = await Promise.all([
        dispatchQuery,
        supabase.from("po_logistics_splits").select("id, payment_term_status, accounts_remarks").eq("status", "Accounts Approved"),
      ])

      if (dispatchError) throw dispatchError
      if (approvedSplitsError) throw approvedSplitsError

      const orderMap = new Map()
      ;(orderData || []).forEach((row) => orderMap.set(row.id, row))

      // Map of split id → accounts info for approved splits
      const approvedSplitMap = new Map()
      ;(approvedSplitsData || []).forEach((s) => approvedSplitMap.set(s.id, s))

      const pending = []
      const history = []

      ;(dispatchData || []).forEach((row) => {
        const order = row.po_id ? orderMap.get(row.po_id) : null
        const splitId = row.logistics_split_id || null
        const splitInfo = splitId ? approvedSplitMap.get(splitId) : null

        // Gate: only show DISPATCH records whose split is Accounts Approved
        // (if no split linked, allow through for legacy data)
        if (splitId && !splitInfo) return

        const mapped = {
          id: row.id,
          partyPONumber: order?.["PARTY PO NO (As Per Po Exact)"] || "",
          dSrNumber: row[DB_COLUMNS.DSR_NUMBER] || "",
          deliveryOrderNo: row[DB_COLUMNS.DELIVERY_ORDER_NO] || "",
          partyName: row[DB_COLUMNS.PARTY_NAME] || order?.["Party Names"] || "",
          productName: row[DB_COLUMNS.PRODUCT_NAME] || "",
          qtyToBeDispatched: row[DB_COLUMNS.QTY_TO_BE_DISPATCHED] || "",
          typeOfTransporting: row[DB_COLUMNS.TYPE_OF_TRANSPORTING] || "",
          dateOfDispatch: formatDate(row[DB_COLUMNS.DATE_OF_DISPATCH]),
          planned1: formatDate(row[DB_COLUMNS.PLANNED1]),
          lgstSrNumber: row[DB_COLUMNS.LGST_SR_NUMBER] || "",
          actual1: formatDate(row[DB_COLUMNS.ACTUAL1]),
          actualTruckQty: row[DB_COLUMNS.ACTUAL_TRUCK_QTY] || "",
          logisticTransportType: row[DB_COLUMNS.TYPE_OF_TRANSPORTING_LOGISTIC] || "",
          transporterName: row[DB_COLUMNS.TRANSPORTER_NAME] || "",
          truckNo: row[DB_COLUMNS.TRUCK_NO] || "",
          driverMobileNo: row[DB_COLUMNS.DRIVER_MOBILE] || "",
          typeOfRate: row[DB_COLUMNS.TYPE_OF_RATE] || "",
          transportRatePerTon: row[DB_COLUMNS.TRANSPORT_RATE] || "",
          fixedAmount: row[DB_COLUMNS.FIXED_AMOUNT] || "",
          logisticsSplitId: splitId,
          logisticsPlanId: row.logistics_plan_id || null,
          paymentTermStatus: splitInfo?.payment_term_status || "",
          accountsRemarks: splitInfo?.accounts_remarks || "",
        }

        if (row[DB_COLUMNS.PLANNED1] && !row[DB_COLUMNS.ACTUAL1]) {
          pending.push(mapped)
        } else if (row[DB_COLUMNS.PLANNED1] && row[DB_COLUMNS.ACTUAL1]) {
          history.push(mapped)
        }
      })

      setOrders(pending)
      setHistoryOrders(history)

      const { data: masterData, error: masterError } = await supabase
        .from("MASTER")
        .select('"Transporter Name"')
        .not("Transporter Name", "is", null)

      if (!masterError) {
        const list = [...new Set((masterData || []).map((row) => row["Transporter Name"]).filter(Boolean))]
        setTransporters(list)
      }
    } catch (error) {
      console.error("Error fetching logistic data:", error)
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const transporterOptions = useMemo(
    () => (transporters.length > 0 ? transporters : ["Owned Truck", "External Transporter"]),
    [transporters]
  )

  const displayOrders = useMemo(() => {
    const source = activeTab === "pending" ? orders : historyOrders
    if (!searchTerm.trim()) return source
    const term = searchTerm.toLowerCase()
    return source.filter((row) =>
      Object.values(row).some((value) =>
        value?.toString().toLowerCase().includes(term)
      )
    )
  }, [activeTab, historyOrders, orders, searchTerm])
  const groupedDisplayOrders = useMemo(() => groupRowsByPo(displayOrders), [displayOrders])

  const generateLGSTNumbers = useCallback((count) => {
    let maxNumber = 0
    historyOrders.forEach((order) => {
      const match = order.lgstSrNumber?.match(/LGST-(\d+)/i)
      if (match) maxNumber = Math.max(maxNumber, parseInt(match[1], 10))
    })
    return Array.from({ length: count }, (_, i) =>
      `LGST-${String(maxNumber + 1 + i).padStart(3, "0")}`
    )
  }, [historyOrders])

  const handleOpen = (group) => {
    const firstRow = group.rows[0]
    const types = [...new Set(group.rows.map(r => r.typeOfTransporting).filter(Boolean))]
    const sharedType = types.length === 1 ? types[0] : ""
    setSelectedGroup(group)
    setFormData({
      transporterName: firstRow.transporterName || "",
      truckNo: "",
      driverMobileNo: "",
      vehicleNoPlateImage: null,
      biltyNo: "",
      typeOfTransporting: sharedType,
      typeOfRate: "",
      transportRatePerTon: "",
      fixedAmount: "",
    })
  }

  const handleClose = () => {
    setSelectedGroup(null)
    setFormData({
      transporterName: "",
      truckNo: "",
      driverMobileNo: "",
      vehicleNoPlateImage: null,
      biltyNo: "",
      typeOfTransporting: "",
      typeOfRate: "",
      transportRatePerTon: "",
      fixedAmount: "",
    })
  }

  const isFor = formData.typeOfTransporting === "FOR"

  const handleSubmit = async () => {
    if (!selectedGroup) return

    try {
      setSubmitting(true)

      const actualDate = getISTTimestamp()
      const lgstNumbers = generateLGSTNumbers(selectedGroup.rows.length)

      let vehicleImageUrl = ""
      if (formData.vehicleNoPlateImage) {
        const file = formData.vehicleNoPlateImage
        const fileExt = file.name.split(".").pop()
        const fileName = `logistic/${lgstNumbers[0]}_${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from("images").upload(fileName, file)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(fileName)
        vehicleImageUrl = publicUrl
      }

      const baseUpdates = {
        [DB_COLUMNS.ACTUAL1]: actualDate,
        [DB_COLUMNS.TYPE_OF_TRANSPORTING_LOGISTIC]: formData.typeOfTransporting,
        [DB_COLUMNS.TRANSPORTER_NAME]: formData.transporterName,
        [DB_COLUMNS.TRUCK_NO]: formData.truckNo,
        [DB_COLUMNS.DRIVER_MOBILE]: formData.driverMobileNo,
        [DB_COLUMNS.VEHICLE_IMAGE]: vehicleImageUrl,
        [DB_COLUMNS.BILTY_NO]: formData.biltyNo,
        [DB_COLUMNS.TYPE_OF_RATE]: isFor ? null : formData.typeOfRate,
        [DB_COLUMNS.TRANSPORT_RATE]: null,
        [DB_COLUMNS.FIXED_AMOUNT]: null,
      }

      if (!isFor) {
        if (formData.typeOfRate === "Per Matric Ton rate") {
          baseUpdates[DB_COLUMNS.TRANSPORT_RATE] = parseFloat(formData.transportRatePerTon) || null
        } else if (formData.typeOfRate === "Fixed Amount") {
          baseUpdates[DB_COLUMNS.FIXED_AMOUNT] = parseFloat(formData.fixedAmount) || null
        } else if (formData.typeOfRate === "Ex Factory Transporter") {
          baseUpdates[DB_COLUMNS.TRANSPORT_RATE] = 0
          baseUpdates[DB_COLUMNS.FIXED_AMOUNT] = 0
        }
      }

      await Promise.all(
        selectedGroup.rows.map((row, i) => {
          const lgstNumber = lgstNumbers[i]
          return supabase
            .from("DISPATCH")
            .update({
              ...baseUpdates,
              [DB_COLUMNS.LGST_SR_NUMBER]: lgstNumber,
              [DB_COLUMNS.ACTUAL_TRUCK_QTY]: parseFloat(row.qtyToBeDispatched) || null,
            })
            .eq("id", row.id)
        })
      )

      await Promise.all(
        selectedGroup.rows
          .filter((row) => row.logisticsSplitId)
          .map((row, i) =>
            supabase
              .from("po_logistics_splits")
              .update({ status: "Logistic Completed", lgst_sr_number: lgstNumbers[i] })
              .eq("id", row.logisticsSplitId)
          )
      )

      toast({
        title: "Success",
        description: `Logistic submitted for PO ${selectedGroup.poNumber}. LGST: ${lgstNumbers.join(", ")}`,
      })

      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Error submitting logistic details:", error)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading logistic data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistic</h1>
          <p className="text-gray-600">Manage dispatch logistics per approved split row</p>
        </div>
      </div>

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
              <p className="text-sm font-medium text-green-600">Completed Logistic</p>
              <div className="text-2xl font-bold text-green-900">{historyOrders.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Transporters</p>
              <div className="text-2xl font-bold text-purple-900">{transporters.length}</div>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search dispatch rows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full"
              />
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" className="h-10 px-3" disabled={loading || submitting}>
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Pending ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            History ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="w-8" />
                {activeTab === "pending" && <TableHead>Action</TableHead>}
                {activeTab === "history" && <TableHead>LGST-Sr</TableHead>}
                <TableHead>PO Number</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>{activeTab === "pending" ? "Planned" : "Actual"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No rows found</TableCell>
                </TableRow>
              ) : (
                groupedDisplayOrders.map((group) => {
                  const isExpanded = expandedGroup === group.key
                  return (
                    <Fragment key={group.key}>
                      {/* PO group header — clickable */}
                      <TableRow
                        className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                      >
                        <TableCell className="text-gray-400 pl-3">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                          }
                        </TableCell>
                        {activeTab === "pending" && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" onClick={() => handleOpen(group)} className="bg-blue-600 hover:bg-blue-700">
                              Handle
                            </Button>
                          </TableCell>
                        )}
                        {activeTab === "history" && (
                          <TableCell className="font-mono text-xs text-gray-600">
                            {group.rows.map((r) => r.lgstSrNumber).filter(Boolean).join(", ") || "—"}
                          </TableCell>
                        )}
                        <TableCell className="font-semibold text-slate-900">{group.poNumber}</TableCell>
                        <TableCell className="text-slate-700">{group.partyName}</TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500">
                            {group.rows.length} product{group.rows.length > 1 ? "s" : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {activeTab === "pending" ? group.rows[0]?.planned1 : group.rows[0]?.actual1}
                        </TableCell>
                      </TableRow>

                      {/* Expanded: detail cards per product */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0 border-b border-slate-200">
                            <div className="bg-slate-50/80 px-6 py-4 space-y-3">
                              {group.rows.map((row) => (
                                <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-gray-800">{row.productName}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Qty: {row.qtyToBeDispatched}
                                      </span>
                                      {row.paymentTermStatus === "Not Followed" && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                          ⚠ Payment Term Not Followed
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">D-Sr Number</span>
                                      <p className="font-mono font-medium text-gray-800">{row.dSrNumber || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">DO Number</span>
                                      <p className="font-mono font-medium text-gray-800">{row.deliveryOrderNo || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Transport Type</span>
                                      <p className="font-medium text-gray-800">{row.typeOfTransporting || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Transporter</span>
                                      <p className="font-medium text-gray-800">{row.transporterName || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Date of Dispatch</span>
                                      <p className="font-medium text-gray-800">{row.dateOfDispatch || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Planned</span>
                                      <p className="font-medium text-gray-800">{row.planned1 || "—"}</p>
                                    </div>
                                    {row.actual1 && (
                                      <div>
                                        <span className="text-gray-500">Actual</span>
                                        <p className="font-medium text-green-700">{row.actual1}</p>
                                      </div>
                                    )}
                                    {row.lgstSrNumber && (
                                      <div>
                                        <span className="text-gray-500">LGST-Sr</span>
                                        <p className="font-mono font-medium text-gray-800">{row.lgstSrNumber}</p>
                                      </div>
                                    )}
                                    {row.truckNo && (
                                      <div>
                                        <span className="text-gray-500">Truck No.</span>
                                        <p className="font-medium text-gray-800">{row.truckNo}</p>
                                      </div>
                                    )}
                                    {row.driverMobileNo && (
                                      <div>
                                        <span className="text-gray-500">Driver Mobile</span>
                                        <p className="font-medium text-gray-800">{row.driverMobileNo}</p>
                                      </div>
                                    )}
                                    {row.accountsRemarks && (
                                      <div className="col-span-2">
                                        <span className="text-gray-500">Accounts Remarks</span>
                                        <p className="font-medium text-red-600 italic">{row.accountsRemarks}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
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
              <CardTitle className="text-lg">Logistic Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">PO: {selectedGroup.poNumber}</p>
                  <span className="text-xs text-blue-600 font-medium">
                    LGST: {generateLGSTNumbers(selectedGroup.rows.length).join(", ")}
                  </span>
                </div>
                <p className="text-gray-600">Party: {selectedGroup.partyName}</p>
                <div className="border rounded-md overflow-hidden mt-1">
                  {(() => {
                    const types = [...new Set(selectedGroup.rows.map(r => r.typeOfTransporting).filter(Boolean))]
                    const isMixed = types.length > 1
                    return (
                      <>
                        {isMixed && (
                          <div className="mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                            Mixed transport types in this PO. Select the type that applies to this logistic submission.
                          </div>
                        )}
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left px-2 py-1 font-medium text-gray-600">D-Sr</th>
                              <th className="text-left px-2 py-1 font-medium text-gray-600">Product</th>
                              <th className="text-right px-2 py-1 font-medium text-gray-600">Qty</th>
                              <th className="text-left px-2 py-1 font-medium text-gray-600">Transport</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedGroup.rows.map((row) => (
                              <tr key={row.id} className="bg-white">
                                <td className="px-2 py-1 text-gray-700">{row.dSrNumber}</td>
                                <td className="px-2 py-1 text-gray-700">{row.productName}</td>
                                <td className="px-2 py-1 text-gray-700 text-right">{row.qtyToBeDispatched}</td>
                                <td className="px-2 py-1">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${row.typeOfTransporting === "FOR" ? "bg-blue-100 text-blue-700" : row.typeOfTransporting === "Direct Supply" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                    {row.typeOfTransporting || "—"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )
                  })()}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Type of Transporting *</Label>
                  <Select
                    value={formData.typeOfTransporting}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, typeOfTransporting: value }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Transport Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>


                {!isFor && (
                  <div className="space-y-2">
                    <Label className="text-sm">Transporter Name *</Label>
                    <Select
                      value={formData.transporterName}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, transporterName: value }))}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Transporter" />
                      </SelectTrigger>
                      <SelectContent>
                        {transporterOptions.map((transporter) => (
                          <SelectItem key={transporter} value={transporter}>{transporter}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Truck No. *</Label>
                  <Input
                    value={formData.truckNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, truckNo: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Driver Mobile No. *</Label>
                  <Input
                    value={formData.driverMobileNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, driverMobileNo: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>

                {!isFor && (
                  <div className="space-y-2">
                    <Label className="text-sm">Type Of Rate *</Label>
                    <Select
                      value={formData.typeOfRate}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          typeOfRate: value,
                          transportRatePerTon: value === "Ex Factory Transporter" ? "0" : "",
                          fixedAmount: value === "Ex Factory Transporter" ? "0" : "",
                        }))
                      }
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Rate Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                        <SelectItem value="Per Matric Ton rate">Per Matric Ton rate</SelectItem>
                        <SelectItem value="Ex Factory Transporter">Ex Factory Transporter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!isFor && formData.typeOfRate === "Per Matric Ton rate" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Transport Rate @Per Matric Ton *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.transportRatePerTon}
                      onChange={(e) => setFormData((prev) => ({ ...prev, transportRatePerTon: e.target.value }))}
                      className="h-10"
                      disabled={submitting}
                    />
                  </div>
                )}

                {!isFor && formData.typeOfRate === "Fixed Amount" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Fixed Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.fixedAmount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fixedAmount: e.target.value }))}
                      className="h-10"
                      disabled={submitting}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Vehicle Plate Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setFormData((prev) => ({ ...prev, vehicleNoPlateImage: file }))
                      }
                    }}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Bilty No.</Label>
                  <Input
                    value={formData.biltyNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, biltyNo: e.target.value }))}
                    className="h-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={
                    submitting ||
                    !formData.typeOfTransporting ||
                    !formData.transporterName ||
                    !formData.truckNo ||
                    !formData.driverMobileNo ||
                    (!isFor && !formData.typeOfRate) ||
                    (!isFor && formData.typeOfRate === "Per Matric Ton rate" && !formData.transportRatePerTon) ||
                    (!isFor && formData.typeOfRate === "Fixed Amount" && !formData.fixedAmount)
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Logistic"
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
