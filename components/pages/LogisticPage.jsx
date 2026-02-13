"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { getISTDisplayDate, getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Search, Loader2, CheckCircle2, Truck } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-"

// Transportation type options
const TRANSPORT_TYPES = [
  "Ex Factory",
  "For",
  "Ex Factory but paid by us",
  "Direct supply dont submit the delay"
]

// Supabase column names matching the provided schema
const DB_COLUMNS = {
  ID: "id",
  TIMESTAMP: "Timestamp",
  DSR_NUMBER: "D-Sr Number",
  DELIVERY_ORDER_NO: "Delivery Order No.",
  PARTY_NAME: "Party Name",
  PRODUCT_NAME: "Product Name",
  QTY_TO_BE_DISPATCHED: "Qty To Be Dispatched",
  TYPE_OF_TRANSPORTING: "Type Of Transporting",
  DATE_OF_DISPATCH: "Date Of Dispatch",
  TO_BE_RECONFIRM: "To Be Reconfirm",
  PLANNED1: "Planned1",
  ACTUAL1: "Actual1",
  DELAY1: "Delay1",
  LGST_SR_NUMBER: "LGST-Sr Number",
  ACTUAL_TRUCK_QTY: "Actual Truck Qty",
  TYPE_OF_TRANSPORTING_LOGISTIC: "Type Of Transporting  ", // Note: Schema has 2 trailing spaces
  TRANSPORTER_NAME: "Transporter Name",
  TRUCK_NO: "Truck No.",
  DRIVER_MOBILE: "Driver Mobile No.",
  VEHICLE_IMAGE: "Vehicle No. Plate Image",
  BILTY_NO: "Bilty No.",
  TYPE_OF_RATE: "Type Of Rate",
  TRANSPORT_RATE: "Transport Rate @Per Matric Ton",
  FIXED_AMOUNT: "Fixed Amount"
}

export default function LogisticPage({ user }) {
  const [orders, setOrders] = useState([])
  const [historyOrders, setHistoryOrders] = useState([])
  const [transporters, setTransporters] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    transporterName: "",
    truckNo: "",
    driverMobileNo: "",
    vehicleNoPlateImage: null,
    biltyNo: "",
    actualTruckQty: "",
    typeOfTransporting: "",
    typeOfRate: "",
    transportRatePerTon: "",
    fixedAmount: "",
  })

  // Memoized transporter list
  const transporterOptions = useMemo(() => {
    return transporters.length > 0
      ? transporters
      : ["Owned Truck", "External Transporter"]
  }, [transporters])

  // Fetch data with error handling and caching
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch DISPATCH table data from Supabase
      const { data: dispatchData, error: dispatchError } = await supabase
        .from('DISPATCH')
        .select('*')
        .order('id', { ascending: false })

      if (dispatchError) throw dispatchError

      if (dispatchData) {
        const pendingOrders = getPendingOrders(dispatchData)
        setOrders(pendingOrders)

        const historyOrders = getHistoryOrders(dispatchData)
        setHistoryOrders(historyOrders)
      }

      // Fetch transporters from Supabase Master table
      const { data: masterData, error } = await supabase
        .from('MASTER')
        .select('*')

      if (error) {
        console.error("Error fetching Master data:", error)
      } else if (masterData) {
        const transportersList = extractTransporters(masterData)
        setTransporters(transportersList)
      }

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Extract transporters from Supabase Master data
  const extractTransporters = useCallback((data) => {
    if (!data || data.length === 0) return []

    // Find key for Transporter Name
    const keys = Object.keys(data[0])
    const transporterKey = keys.find(k =>
      k.toLowerCase().includes('transporter') &&
      !k.toLowerCase().includes('type')
    )

    if (!transporterKey) return []

    const transportersSet = new Set()

    data.forEach(row => {
      const val = row[transporterKey]
      if (val && typeof val === 'string' && val.trim() !== '') {
        transportersSet.add(val.trim())
      }
    })

    return Array.from(transportersSet)
  }, [])

  // Get pending orders (Planned1 has value, Actual1 is empty/null)
  const getPendingOrders = useCallback((data) => {
    if (!data) return []

    return data.filter(row => {
      const planned1 = row[DB_COLUMNS.PLANNED1]
      const actual1 = row[DB_COLUMNS.ACTUAL1]

      // Check if Planned1 has value AND Actual1 is empty/null
      return (
        planned1 &&
        String(planned1).trim() !== "" &&
        (!actual1 || String(actual1).trim() === "")
      )
    }).map(row => ({
      id: row.id,
      rowIndex: row.id, // Supabase ID is the reference
      dSrNumber: row[DB_COLUMNS.DSR_NUMBER] || "",
      deliveryOrderNo: row[DB_COLUMNS.DELIVERY_ORDER_NO] || "",
      partyName: row[DB_COLUMNS.PARTY_NAME] || "",
      productName: row[DB_COLUMNS.PRODUCT_NAME] || "",
      qtyToBeDispatched: row[DB_COLUMNS.QTY_TO_BE_DISPATCHED] || "",
      typeOfTransporting: row[DB_COLUMNS.TYPE_OF_TRANSPORTING] || "",
      dateOfDispatch: row[DB_COLUMNS.DATE_OF_DISPATCH] || "",
      planned1: row[DB_COLUMNS.PLANNED1] || "",
    }))
  }, [])

  // Get history orders (Both Planned1 and Actual1 have value)
  const getHistoryOrders = useCallback((data) => {
    if (!data) return []

    return data.filter(row => {
      const planned1 = row[DB_COLUMNS.PLANNED1]
      const actual1 = row[DB_COLUMNS.ACTUAL1]

      // Check if BOTH Planned1 and Actual1 are filled (not null/empty)
      return (
        planned1 &&
        String(planned1).trim() !== "" &&
        actual1 &&
        String(actual1).trim() !== ""
      )
    }).map(row => ({
      id: row.id,
      rowIndex: row.id,
      dSrNumber: row[DB_COLUMNS.DSR_NUMBER] || "",
      deliveryOrderNo: row[DB_COLUMNS.DELIVERY_ORDER_NO] || "",
      partyName: row[DB_COLUMNS.PARTY_NAME] || "",
      productName: row[DB_COLUMNS.PRODUCT_NAME] || "",
      lgstSrNumber: row[DB_COLUMNS.LGST_SR_NUMBER] || "",
      actual1: row[DB_COLUMNS.ACTUAL1] || "",
      actualTruckQty: row[DB_COLUMNS.ACTUAL_TRUCK_QTY] || "",
      typeOfTransporting: row[DB_COLUMNS.TYPE_OF_TRANSPORTING_LOGISTIC] || "",
      transporterName: row[DB_COLUMNS.TRANSPORTER_NAME] || "",
      truckNo: row[DB_COLUMNS.TRUCK_NO] || "",
      driverMobileNo: row[DB_COLUMNS.DRIVER_MOBILE] || "",
      typeOfRate: row[DB_COLUMNS.TYPE_OF_RATE] || "",
      transportRatePerTon: row[DB_COLUMNS.TRANSPORT_RATE] || "",
      fixedAmount: row[DB_COLUMNS.FIXED_AMOUNT] || "",
    }))
  }, [])

  // Generate LGST number
  const generateLGSTNumber = useCallback(() => {
    if (historyOrders.length === 0) return "LGST-001"

    let maxNumber = 0
    for (const order of historyOrders) {
      if (order.lgstSrNumber) {
        const match = order.lgstSrNumber.match(/LGST-(\d+)/i)
        if (match) {
          const num = parseInt(match[1], 10)
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num
          }
        }
      }
    }

    return `LGST-${String(maxNumber + 1).padStart(3, '0')}`
  }, [historyOrders])

  // Filter orders based on search term
  const searchFilteredOrders = useCallback((ordersList) => {
    if (!searchTerm.trim()) return ordersList

    const term = searchTerm.toLowerCase()
    return ordersList.filter((order) => {
      return Object.values(order).some((value) =>
        value?.toString().toLowerCase().includes(term)
      )
    })
  }, [searchTerm])

  // Memoized display orders
  const displayOrders = useMemo(() => {
    const ordersList = activeTab === "pending" ? orders : historyOrders
    return searchFilteredOrders(ordersList)
  }, [activeTab, orders, historyOrders, searchFilteredOrders])

  const handleLogistic = useCallback((order) => {
    setSelectedOrder(order)
    setFormData({
      transporterName: "",
      truckNo: "",
      driverMobileNo: "",
      vehicleNoPlateImage: null,
      biltyNo: "",
      actualTruckQty: "",
      typeOfTransporting: "",
      typeOfRate: "",
      transportRatePerTon: "",
      fixedAmount: "",
    })
  }, [])

  // File to Base64 conversion
  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!selectedOrder) return

    try {
      setSubmitting(true)

      const lgstNumber = generateLGSTNumber()
      const actualDate = getISTTimestamp()

      let vehicleImageUrl = ""

      // Upload image to Supabase Storage if selected
      if (formData.vehicleNoPlateImage) {
        try {
          const file = formData.vehicleNoPlateImage
          const fileExt = file.name.split('.').pop()
          const fileName = `logistic/${lgstNumber}_${Date.now()}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(fileName, file)

          if (uploadError) {
            throw uploadError
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(fileName)

          vehicleImageUrl = publicUrl
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError)
          toast({
            variant: "destructive",
            title: "Image Upload Failed",
            description: "Could not upload vehicle image. Proceeding with text data."
          })
        }
      }

      // Helper to sanitize numeric inputs
      const safeFloat = (val) => {
        const num = parseFloat(val)
        return isNaN(num) ? null : num
      }

      // Prepare updates for Supabase
      const updates = {
        [DB_COLUMNS.ACTUAL1]: actualDate,
        [DB_COLUMNS.LGST_SR_NUMBER]: lgstNumber,
        [DB_COLUMNS.ACTUAL_TRUCK_QTY]: safeFloat(formData.actualTruckQty),
        [DB_COLUMNS.TYPE_OF_TRANSPORTING_LOGISTIC]: formData.typeOfTransporting,
        [DB_COLUMNS.TRANSPORTER_NAME]: formData.transporterName,
        [DB_COLUMNS.TRUCK_NO]: formData.truckNo,
        [DB_COLUMNS.DRIVER_MOBILE]: formData.driverMobileNo,
        [DB_COLUMNS.VEHICLE_IMAGE]: vehicleImageUrl,
        [DB_COLUMNS.BILTY_NO]: formData.biltyNo,
        [DB_COLUMNS.TYPE_OF_RATE]: formData.typeOfRate,
      }

      // Set rate based on type
      if (formData.typeOfRate === "Per Matric Ton rate") {
        updates[DB_COLUMNS.TRANSPORT_RATE] = safeFloat(formData.transportRatePerTon)
        updates[DB_COLUMNS.FIXED_AMOUNT] = null // Use null for numeric columns in DB
      } else if (formData.typeOfRate === "Fixed Amount") {
        updates[DB_COLUMNS.TRANSPORT_RATE] = null
        updates[DB_COLUMNS.FIXED_AMOUNT] = safeFloat(formData.fixedAmount)
      } else if (formData.typeOfRate === "Ex Factory Transporter") {
        updates[DB_COLUMNS.TRANSPORT_RATE] = 0
        updates[DB_COLUMNS.FIXED_AMOUNT] = 0
      }

      // Update the row in Supabase
      const { error } = await supabase
        .from('DISPATCH')
        .update(updates)
        .eq('id', selectedOrder.id)

      if (error) throw error

      await fetchData()
      setSelectedOrder(null)
      setFormData({
        transporterName: "",
        truckNo: "",
        driverMobileNo: "",
        vehicleNoPlateImage: null,
        biltyNo: "",
        actualTruckQty: "",
        typeOfTransporting: "",
        typeOfRate: "",
        transportRatePerTon: "",
        fixedAmount: "",
      })

      toast({
        title: "Success",
        description: `Logistic details submitted successfully! LGST Number: ${lgstNumber}`,
      })

    } catch (error) {
      console.error("Error submitting:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }, [selectedOrder, formData, generateLGSTNumber, fetchData, toast])

  const handleCancel = useCallback(() => {
    setSelectedOrder(null)
    setFormData({
      transporterName: "",
      truckNo: "",
      driverMobileNo: "",
      vehicleNoPlateImage: null,
      biltyNo: "",
      actualTruckQty: "",
      typeOfTransporting: "",
      typeOfRate: "",
      transportRatePerTon: "",
      fixedAmount: "",
    })
  }, [])

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
          <p className="text-gray-600">Manage logistics</p>
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
            History ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        {/* Mobile View - Cards */}
        <div className="block lg:hidden p-4 space-y-4 bg-gray-50">
          {displayOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-dashed">
              <div className="flex flex-col items-center gap-2">
                <span className="text-lg">No {activeTab} orders found</span>
              </div>
            </div>
          ) : (
            displayOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{order.partyName}</h3>
                    <p className="text-xs text-gray-500">DO: {order.deliveryOrderNo} | DS: {order.dSrNumber}</p>
                  </div>
                  {activeTab === "history" && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                      {order.lgstSrNumber}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm border-t border-b border-gray-100 py-3">
                  <div>
                    <p className="text-xs text-gray-500">Product</p>
                    <p className="font-medium text-gray-900 truncate">{order.productName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Transport</p>
                    <p className="font-medium text-gray-900 truncate">{order.typeOfTransporting}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Qty</p>
                    <p className="font-medium text-gray-900">
                      {activeTab === "pending" ? order.qtyToBeDispatched : order.actualTruckQty}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="font-medium text-gray-900">
                      {activeTab === "pending" ? order.dateOfDispatch : (order.actual1 ? order.actual1.split(' ')[0] : 'N/A')}
                    </p>
                  </div>
                </div>

                {activeTab === "history" && (
                  <div className="grid grid-cols-2 gap-3 text-sm pb-2">
                    <div>
                      <p className="text-xs text-gray-500">Transporter</p>
                      <p className="font-medium text-gray-900 truncate">{order.transporterName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Truck No</p>
                      <p className="font-medium text-gray-900 truncate">{order.truckNo}</p>
                    </div>
                  </div>
                )}

                {activeTab === "pending" && (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 h-9 mt-1"
                    onClick={() => handleLogistic(order)}
                    disabled={submitting}
                  >
                    Handle Logistic
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
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Action</TableHead>
                )}
                {activeTab === "history" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">LGST-Sr No</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">D-Sr Number</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Delivery Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Product Name</TableHead>

                {activeTab === "pending" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Qty To Be Dispatched</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Type Of Transporting</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Date Of Dispatch</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Planned Date</TableHead>
                  </>
                )}

                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Actual Truck Qty</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Transport Type</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Transporter</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Truck No</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Driver Mobile</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Type of Rate</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Rate/Amount</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === "pending" ? 10 : 13}
                    className="text-center py-8 text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No {activeTab} orders found</span>
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
                          onClick={() => handleLogistic(order)}
                          className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                          disabled={submitting}
                        >
                          Handle
                        </Button>
                      </TableCell>
                    )}

                    {activeTab === "history" && (
                      <TableCell className="py-2 px-4 min-w-[120px] font-medium text-blue-600">
                        {order.lgstSrNumber}
                      </TableCell>
                    )}

                    <TableCell className="py-2 px-4 min-w-[120px] font-medium">
                      {order.dSrNumber}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      {order.deliveryOrderNo}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      {order.partyName}
                    </TableCell>
                    <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                      {order.productName}
                    </TableCell>

                    {activeTab === "pending" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[120px] font-medium text-sm">
                          {order.qtyToBeDispatched}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                          {order.typeOfTransporting}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                          {order.dateOfDispatch}
                        </TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                          {order.planned1}
                        </TableCell>
                      </>
                    )}

                    {activeTab === "history" && (
                      <>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.actualTruckQty}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.typeOfTransporting}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[150px] text-sm">{order.transporterName}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[100px] text-sm">{order.truckNo}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.driverMobileNo}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">{order.typeOfRate}</TableCell>
                        <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                          {order.typeOfRate === "Per Matric Ton rate"
                            ? `${order.transportRatePerTon} per ton`
                            : order.typeOfRate === "Fixed Amount"
                              ? `${order.fixedAmount} fixed`
                              : "Ex Factory"}
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

      {/* Logistic Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg">Logistic Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-900">{selectedOrder.partyName}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    DO: {selectedOrder.deliveryOrderNo} | DS: {selectedOrder.dSrNumber}
                  </p>
                  <p className="text-sm text-gray-600">Product: {selectedOrder.productName}</p>
                  <p className="text-sm text-blue-600 font-medium mt-1">
                    LGST Number: {generateLGSTNumber()}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Type of Transporting *</Label>
                    <Select
                      value={formData.typeOfTransporting}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        typeOfTransporting: value
                      }))}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Transport Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSPORT_TYPES.map((type, index) => (
                          <SelectItem key={index} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Actual Truck Qty *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.actualTruckQty}
                      onChange={(e) => setFormData(prev => ({ ...prev, actualTruckQty: e.target.value }))}
                      className="h-10"
                      placeholder="Enter quantity"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Transporter Name *</Label>
                    <Select
                      value={formData.transporterName}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, transporterName: value }))}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select Transporter" />
                      </SelectTrigger>
                      <SelectContent>
                        {transporterOptions.map((transporter, index) => (
                          <SelectItem key={index} value={transporter}>
                            {transporter}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Truck No. *</Label>
                    <Input
                      value={formData.truckNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, truckNo: e.target.value }))}
                      className="h-10"
                      placeholder="Enter truck number"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Driver Mobile No. *</Label>
                    <Input
                      type="tel"
                      value={formData.driverMobileNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, driverMobileNo: e.target.value }))}
                      className="h-10"
                      placeholder="Enter driver mobile"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Type Of Rate *</Label>
                    <Select
                      value={formData.typeOfRate}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        typeOfRate: value,
                        transportRatePerTon: value === "Ex Factory Transporter" ? "0" : "",
                        fixedAmount: value === "Ex Factory Transporter" ? "0" : ""
                      }))}
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

                  {formData.typeOfRate === "Per Matric Ton rate" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Transport Rate @Per Matric Ton *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.transportRatePerTon}
                        onChange={(e) => setFormData(prev => ({ ...prev, transportRatePerTon: e.target.value }))}
                        className="h-10"
                        placeholder="Enter rate per ton"
                        disabled={submitting}
                      />
                    </div>
                  )}

                  {formData.typeOfRate === "Fixed Amount" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Fixed Amount *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.fixedAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, fixedAmount: e.target.value }))}
                        className="h-10"
                        placeholder="Enter fixed amount"
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
                            vehicleNoPlateImage: file
                          }))
                        }
                      }}
                      className="h-10"
                      disabled={submitting}
                    />
                    {formData.vehicleNoPlateImage && (
                      <p className="text-sm text-green-600 mt-1">
                        ✓ {formData.vehicleNoPlateImage.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Bilty No.</Label>
                    <Input
                      value={formData.biltyNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, biltyNo: e.target.value }))}
                      className="h-10"
                      placeholder="Enter bilty number"
                      disabled={submitting}
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
                        !formData.typeOfTransporting ||
                        !formData.actualTruckQty ||
                        !formData.transporterName ||
                        !formData.truckNo ||
                        !formData.driverMobileNo ||
                        !formData.typeOfRate ||
                        (formData.typeOfRate === "Per Matric Ton rate" && !formData.transportRatePerTon) ||
                        (formData.typeOfRate === "Fixed Amount" && !formData.fixedAmount) ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Logistic`
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