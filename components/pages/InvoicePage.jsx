"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getISTTimestamp } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  CheckCircle2,
  Loader2,
  X,
  AlertCircle,
  Truck,
  FileText,
  Download,
  Building,
  Pencil,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { exportToExcel } from "@/lib/exportUtils";
import { groupRowsByPo } from "@/lib/workflowGrouping";

export default function MakeInvoicePage({ user }) {
  const [orders, setOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [reportSourceFilter, setReportSourceFilter] = useState("all");
  const [filterFirm, setFilterFirm] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Group-level modal state
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceCopyFile, setInvoiceCopyFile] = useState(null);
  // Per-product editable lines: [{ id, productName, qty, rate, gstPct }]
  const [productLines, setProductLines] = useState([]);

  // Admin edit bill modal state (History tab)
  const [adminEditBillModalOpen, setAdminEditBillModalOpen] = useState(false);
  const [adminEditBillOrder, setAdminEditBillOrder] = useState(null);
  const [adminEditBillNo, setAdminEditBillNo] = useState("");
  const [adminEditBillCopyFile, setAdminEditBillCopyFile] = useState(null);
  const [adminEditBillCopyUrl, setAdminEditBillCopyUrl] = useState("");
  const [adminEditSubmitting, setAdminEditSubmitting] = useState(false);

  useEffect(() => {
    fetchInvoiceData();
  }, []);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);

      const userFirms =
        user?.role !== "ADMIN"
          ? user?.firm
            ? user.firm
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean)
            : []
          : null;
      const shouldFilter =
        userFirms && !userFirms.includes("all") && userFirms.length > 0;

      let orQuery = supabase
        .from("ORDER RECEIPT")
        .select(
          'id, "PARTY PO NO (As Per Po Exact)", "Party Names", "Firm Name", "Gst Number", "Address", "Rate Of Material", "Upload SO", "Freight", "Freight Amount", "Marketing Mangager Name", check_delivery_in_stock_or_not, check_delivery_production_order_no, check_delivery_qty_transferred, check_delivery_batch_number_remarks, check_delivery_indent_self_batch_number, check_delivery_gp_percent',
        );
      if (shouldFilter) orQuery = orQuery.in("Firm Name", userFirms);
      const { data: orData, error: orError } = await orQuery;

      if (orError) console.error("ORDER RECEIPT fetch error:", orError);

      const allowedPoIds = (orData || []).map((r) => r.id);

      let dispatchQuery = supabase
        .from("DISPATCH")
        .select("*")
        .not("Planned4", "is", null);
      if (shouldFilter) dispatchQuery = dispatchQuery.in("po_id", allowedPoIds);

      const { data: dispatchData, error: dispatchError } = await dispatchQuery;

      if (dispatchError) throw dispatchError;

      let splits = [];
      if (allowedPoIds.length > 0) {
        const { data: splitsData, error: splitsError } = await supabase
          .from("po_logistics_splits")
          .select("id, po_id, transporter_name, rate, vehicle_details")
          .in("po_id", allowedPoIds);
        if (!splitsError && splitsData) {
          splits = splitsData;
        }
      }

      const orMap = new Map();
      (orData || []).forEach((row) => orMap.set(row.id, row));

      const pending = [];
      const history = [];

      (dispatchData || []).forEach((row) => {
        const or = row.po_id ? orMap.get(row.po_id) || {} : {};

        // Find split rate fallback
        const splitRate = (() => {
          // 1. Try to find the exact split row
          const exactSplit = splits.find(s => s.id === row.logistics_split_id);
          if (exactSplit?.rate) return { rate: exactSplit.rate, type: exactSplit.vehicle_details };
          
          // 2. Fallback: find any split for the same PO and transporter that has a rate
          const fallbackSplit = splits.find(s => 
            s.po_id === row.po_id && 
            s.transporter_name === (row["Transporter Name"] || "") && 
            s.rate
          );
          if (fallbackSplit) return { rate: fallbackSplit.rate, type: fallbackSplit.vehicle_details };
          return null;
        })();

        const order = {
          id: row.id,
          partyPONumber: or["PARTY PO NO (As Per Po Exact)"] || "",
          partyName: row["Party Name"] || or["Party Names"] || "",
          dSrNumber: row["D-Sr Number"] || "",
          deliveryOrderNo: row["Delivery Order No."] || "",
          lgstSrNumber: row["LGST-Sr Number"] || "",
          productName: row["Product Name"] || "",
          qtyToBeDispatched: parseFloat(row["Qty To Be Dispatched"]) || 0,
          actualTruckQty: parseFloat(row["Actual Truck Qty"]) || 0,
          actualQtyAsPerWeighmentSlip:
            parseFloat(row["Actual Qty As Per Weighment Slip"]) || 0,
          imageOfSlip: row["Image Of Slip"] || "",
          imageOfSlip2: row["Image Of Slip2"] || "",
          imageOfSlip3: row["Image Of Slip3"] || "",
          typeOfTransporting: row["Type Of Transporting  "] || row["Type Of Transporting"] || "",
          transporterName: row["Transporter Name"] || "",
          truckNo: row["Truck No."] || "",
          driverMobileNo: row["Driver Mobile No."] || "",
          typeOfRate: row["Type Of Rate"] || splitRate?.type || "",
          transportRatePerTon: row["Transport Rate @Per Matric Ton"] || (splitRate?.type === "Per MT" ? splitRate?.rate : ""),
          fixedAmount: row["Fixed Amount"] || (splitRate?.type === "Fixed" ? splitRate?.rate : ""),
          plannedTransporterRate: splitRate?.rate || "",
          vehiclePlateImage: row["Vehicle No. Plate Image"] || "",
          biltyNo: row["Bilty No."] || "",
          firmName: or["Firm Name"] || "",
          marketingSalesPerson: or["Marketing Mangager Name"] || "",
          inStockOrNot: or["check_delivery_in_stock_or_not"] || "",
          productionOrderNo: or["check_delivery_production_order_no"] || "",
          qtyTransferred: or["check_delivery_qty_transferred"] ?? "",
          batchNumberRemarks: or["check_delivery_batch_number_remarks"] || "",
          indentSelfBatchNumber: or["check_delivery_indent_self_batch_number"] || "",
          gpPercent: or["check_delivery_gp_percent"] ?? "",
          gstNumber: or["Gst Number"] || "",
          address: or["Address"] || "",
          rateOfMaterial: Number(or["Rate Of Material"]) || 0,
          freight: or["Freight"] || "",
          freightAmount: Number(or["Freight Amount"]) || 0,
          uploadSO: or["Upload SO"] || "",
          planned4: row["Planned4"],
          actual4: row["Actual4"],
          billNumber: row["Bill Number"] || "",
          billCopy: row["Bill Copy"] || "",
          tcRequired: row["TC Required"] || "No",
        };

        const a4 = order.actual4;
        if (!a4 || a4 === "" || a4 === " ") {
          pending.push(order);
        } else {
          history.push(order);
        }
      });

      pending.sort((a, b) => {
        if (!a.planned4) return 1;
        if (!b.planned4) return -1;
        return new Date(b.planned4) - new Date(a.planned4);
      });
      history.sort((a, b) => {
        if (!a.actual4) return 1;
        if (!b.actual4) return -1;
        return new Date(b.actual4) - new Date(a.actual4);
      });

      setOrders(pending);
      setCompletedOrders(history);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch invoice data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const dataToExport = activeTab === "pending" ? orders : completedOrders;
    exportToExcel(dataToExport, `Invoice_${activeTab}`);
  };

  // ── Formatters ─────────────────────────────────────────────────────────────
  const formatDateOnly = (s) => {
    if (!s || s === " ") return "N/A";
    try {
      const d = new Date(s);
      if (isNaN(d)) return s;
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return s;
    }
  };

  const fmt = (val) => {
    const n = Number(val);
    if (!val || isNaN(n)) return "—";
    return n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getTransporterRateDisplay = (row) => {
    const perMt = Number(row.transportRatePerTon) || 0;
    const fixed = Number(row.fixedAmount) || 0;
    const splitRate = Number(row.plannedTransporterRate) || 0;
    if (perMt > 0) return `₹${perMt.toLocaleString("en-IN")} / MT`;
    if (fixed > 0) return `₹${fixed.toLocaleString("en-IN")} fixed`;
    if (splitRate > 0) return `₹${splitRate.toLocaleString("en-IN")}`;
    return "—";
  };

  // ── Filtering & grouping ────────────────────────────────────────────────────
  const searchFilter = (list) => {
    let result = list;
    if (filterFirm !== "all") result = result.filter((o) => o.firmName === filterFirm);
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      result = result.filter((o) => {
        const d = o.actual4 ? new Date(o.actual4) : o.planned4 ? new Date(o.planned4) : null;
        return d && d >= from;
      });
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((o) => {
        const d = o.actual4 ? new Date(o.actual4) : o.planned4 ? new Date(o.planned4) : null;
        return d && d <= to;
      });
    }
    if (!searchTerm) return result;
    const term = searchTerm.toLowerCase();
    return result.filter((o) =>
      Object.values(o).some((v) => v?.toString().toLowerCase().includes(term)),
    );
  };

  const displayOrders =
    activeTab === "pending"
      ? searchFilter(orders)
      : searchFilter(completedOrders);
  const groupedDisplayOrders = useMemo(
    () => groupRowsByPo(displayOrders),
    [displayOrders],
  );

  // ── Modal open / close ──────────────────────────────────────────────────────
  const handleOpen = (group) => {
    setSelectedGroup(group);
    setSelectedRowIds(new Set(group.rows.map((r) => r.id)));
    setProductLines(
      group.rows.map((row) => ({
        id: row.id,
        productName: row.productName,
        qty: getInvoiceLineQty(row),
        rate: row.rateOfMaterial || 0,
        freight: row.freight,
        freightAmount:
          row.freight?.toString().trim().toLowerCase() === "yes"
            ? row.freightAmount || 0
            : 0,
        gstPct: 18,
        // Carry over other info for display
        lgstSrNumber: row.lgstSrNumber,
        truckNo: row.truckNo,
        transporterName: row.transporterName,
        transportRatePerTon: row.transportRatePerTon || "",
        fixedAmount: row.fixedAmount || "",
        plannedTransporterRate: row.plannedTransporterRate || "",
        deliveryOrderNo: row.deliveryOrderNo,
        actualTruckQty: row.actualTruckQty || 0,
        invoiceActualQty: getInvoiceLineQty(row),
        actualQtyAsPerWeighmentSlip: row.actualQtyAsPerWeighmentSlip || 0,
        imageOfSlip: row.imageOfSlip || "",
        imageOfSlip2: row.imageOfSlip2 || "",
        imageOfSlip3: row.imageOfSlip3 || "",
      })),
    );
    setInvoiceNo("");
    setInvoiceDate("");
    setInvoiceCopyFile(null);
  };

  const toggleRow = (id) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (checked)
      setSelectedRowIds(new Set(selectedGroup.rows.map((r) => r.id)));
    else setSelectedRowIds(new Set());
  };

  const handleClose = () => {
    setSelectedGroup(null);
    setSelectedRowIds(new Set());
    setProductLines([]);
    setInvoiceNo("");
    setInvoiceDate("");
    setInvoiceCopyFile(null);
  };

  const updateLine = (index, field, value) => {
    setProductLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ── Computed line totals ────────────────────────────────────────────────────
  const computedLines = useMemo(
    () =>
      productLines.map((line) => {
        const isSelected = selectedRowIds.has(line.id);
        const qty = Number(line.qty) || 0;
        const rate = Number(line.rate) || 0;
        const freightAmount = Number(line.freightAmount) || 0;
        const gstPct = Number(line.gstPct) || 0;
        const total = isSelected ? qty * rate + freightAmount : 0;
        const taxAmt = isSelected ? (total * gstPct) / 100 : 0;
        return {
          ...line,
          isSelected,
          total,
          taxAmt,
          amountWithTax: total + taxAmt,
        };
      }),
    [productLines, selectedRowIds],
  );

  const grandTotal = useMemo(
    () => computedLines.reduce((s, l) => s + l.total, 0),
    [computedLines],
  );
  const grandTax = useMemo(
    () => computedLines.reduce((s, l) => s + l.taxAmt, 0),
    [computedLines],
  );
  const grandWithTax = useMemo(
    () => computedLines.reduce((s, l) => s + l.amountWithTax, 0),
    [computedLines],
  );
  const hasFreightAmount = useMemo(
    () => computedLines.some((line) => Number(line.freightAmount) > 0),
    [computedLines],
  );

  const getInvoiceLineQty = (row) => {
    const actualTruckQty = parseFloat(row.actualTruckQty) || 0;
    const dispatchQty = parseFloat(row.qtyToBeDispatched) || 0;

    if (actualTruckQty > 0 && dispatchQty > 0) {
      return Math.min(actualTruckQty, dispatchQty);
    }

    return actualTruckQty || dispatchQty || 0;
  };

  const selectedInvoiceLines = useMemo(
    () => productLines.filter((line) => selectedRowIds.has(line.id)),
    [productLines, selectedRowIds],
  );
  const totalActualTruckQty = useMemo(
    () =>
      selectedInvoiceLines.reduce(
        (sum, line) => sum + (Number(line.invoiceActualQty) || 0),
        0,
      ),
    [selectedInvoiceLines],
  );
  const getWeighmentGroupKey = (line) =>
    [
      line.imageOfSlip || "",
      line.imageOfSlip2 || "",
      line.imageOfSlip3 || "",
      Number(line.actualQtyAsPerWeighmentSlip) || 0,
    ].join("|");
  const weighmentGroups = useMemo(() => {
    const groups = new Map();
    selectedInvoiceLines.forEach((line) => {
      const key = getWeighmentGroupKey(line);
      const current = groups.get(key) || {
        key,
        firstLineId: line.id,
        lines: [],
        actualQty: 0,
        weighmentQty: Number(line.actualQtyAsPerWeighmentSlip) || 0,
      };
      current.lines.push(line);
      current.actualQty += Number(line.invoiceActualQty) || 0;
      groups.set(key, current);
    });
    return Array.from(groups.values());
  }, [selectedInvoiceLines]);
  const totalWeighmentQty = useMemo(
    () => weighmentGroups.reduce((sum, group) => sum + group.weighmentQty, 0),
    [weighmentGroups],
  );
  const weighmentActualDiff = totalWeighmentQty - totalActualTruckQty;
  const getWeighmentProductLabel = (group) => {
    const products = group.lines
      .map((line) => line.productName)
      .filter(Boolean);
    return [...new Set(products)].join(", ") || "—";
  };
  const getWeighmentDeliveryLabel = (group) => {
    const deliveryNos = group.lines
      .map((line) => line.deliveryOrderNo)
      .filter(Boolean);
    return [...new Set(deliveryNos)].join(", ");
  };
  const fmtQty = (value) =>
    (Number(value) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedGroup) return;

    const selectedRows = selectedGroup.rows.filter((r) =>
      selectedRowIds.has(r.id),
    );
    if (selectedRows.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one row to submit.",
        variant: "destructive",
      });
      return;
    }

    if (!invoiceNo.trim()) {
      toast({
        variant: "destructive",
        title: "Validation",
        description: "Invoice Number is required.",
      });
      return;
    }
    if (!invoiceDate) {
      toast({
        variant: "destructive",
        title: "Validation",
        description: "Invoice Date is required.",
      });
      return;
    }
    if (!invoiceCopyFile) {
      toast({
        variant: "destructive",
        title: "Validation",
        description: "Invoice copy upload is required.",
      });
      return;
    }

    try {
      setSubmitting(true);
      const actualDateTime = getISTTimestamp();

      // Upload invoice copy once (shared for the whole PO group)
      const fileExt = invoiceCopyFile.name.split(".").pop();
      const refDsr = selectedGroup.rows[0]?.dSrNumber || "unknown";
      const fileName = `invoices/bill-copies/${refDsr}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, invoiceCopyFile, {
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl: billCopyUrl },
      } = supabase.storage.from("images").getPublicUrl(fileName);

      // Update every selected DISPATCH row in the group
      await Promise.all(
        selectedRows.map(async (row) => {
          const { error: updateErr } = await supabase
            .from("DISPATCH")
            .update({
              Actual4: actualDateTime,
              "Bill Number": invoiceNo.trim(),
              "Bill Date": invoiceDate,
              "Bill Copy": billCopyUrl,
            })
            .eq("id", row.id);
          if (updateErr) throw updateErr;

          // If TC is not required, automatically move to DELIVERY
          if (row.tcRequired === "No") {
            const { error: deliveryInsertError } = await supabase.from("DELIVERY").insert([
              {
                "Timestamp": actualDateTime,
                "Bill Date": invoiceDate,
                "Delivery Order No.": row.deliveryOrderNo,
                "Party Name": row.partyName,
                "Product Name": row.productName,
                "Quantity Delivered.": row.actualTruckQty || row.qtyToBeDispatched || null,
                "Bill No.": invoiceNo.trim(),
                "Losgistic no.": row.dSrNumber || "",
                "Rate Of Material": row.rateOfMaterial,
                "Type Of Transporting": row.typeOfTransporting || "",
                "Transporter Name": row.transporterName || "",
                "Vehicle Number.": row.truckNo || "",
                "Bilty Number.": row.biltyNo || "",
                "Giving From Where": "",
                "D-Sr Number": row.dSrNumber || "",
              }
            ]);
            if (deliveryInsertError) throw deliveryInsertError;
          }
        }),
      );

      toast({
        title: "Success",
        description: `Invoice submitted for PO ${selectedGroup.poNumber} (${selectedRows.length} row${selectedRows.length > 1 ? "s" : ""}).`,
      });

      handleClose();
      await fetchInvoiceData();
    } catch (error) {
      console.error("Error submitting invoice:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit. ${error.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAdminEditBill = (order) => {
    setAdminEditBillOrder(order);
    setAdminEditBillNo(order.billNumber || "");
    setAdminEditBillCopyUrl(order.billCopy || "");
    setAdminEditBillCopyFile(null);
    setAdminEditBillModalOpen(true);
  };

  const handleSaveAdminEditBill = async () => {
    if (!adminEditBillOrder) return;
    try {
      setAdminEditSubmitting(true);
      let newBillCopyUrl = adminEditBillCopyUrl;

      if (adminEditBillCopyFile) {
        const fileExt = adminEditBillCopyFile.name.split(".").pop();
        const fileName = `invoice/bill_${adminEditBillOrder.dSrNumber || adminEditBillOrder.id}_${Date.now()}.${fileExt}`;
        const { error: upErr } = await supabase.storage
          .from("images")
          .upload(fileName, adminEditBillCopyFile);
        if (upErr) throw upErr;

        const { data: pubData } = supabase.storage
          .from("images")
          .getPublicUrl(fileName);
        newBillCopyUrl = pubData.publicUrl;
      }

      // Update DISPATCH
      await supabase
        .from("DISPATCH")
        .update({
          "Bill Number": adminEditBillNo,
          "Bill Copy": newBillCopyUrl,
        })
        .eq("id", adminEditBillOrder.id);

      // Update DELIVERY if exists
      if (adminEditBillOrder.dSrNumber) {
        await supabase
          .from("DELIVERY")
          .update({
            "Bill No.": adminEditBillNo,
            "Bilty Copy": newBillCopyUrl,
          })
          .eq("D-Sr Number", adminEditBillOrder.dSrNumber);
      }

      // Update POST DELIVERY if exists
      if (adminEditBillOrder.deliveryOrderNo) {
        await supabase
          .from("POST DELIVERY")
          .update({
            "Bill No.": adminEditBillNo,
            "Copy Of Bill": newBillCopyUrl,
          })
          .eq("Order No.", adminEditBillOrder.deliveryOrderNo);
      }

      toast({
        title: "Bill Updated",
        description: "Bill number & copy updated successfully.",
        className: "bg-green-50 text-green-800 border-green-200",
      });

      setAdminEditBillModalOpen(false);
      fetchInvoiceData();
    } catch (err) {
      console.error("Error updating bill:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    } finally {
      setAdminEditSubmitting(false);
    }
  };

  const totalParties = useMemo(
    () => new Set([...orders, ...completedOrders].map((o) => o.partyName)).size,
    [orders, completedOrders],
  );

  const firmOptions = useMemo(() => {
    const all = [...orders, ...completedOrders];
    return ["all", ...new Set(all.map((o) => o.firmName).filter(Boolean))];
  }, [orders, completedOrders]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading invoice data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Make Invoice</h1>
          <p className="text-gray-600">
            Upload invoice copy and record invoice details per PO
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">
                Pending Invoices
              </p>
              <div className="text-2xl font-bold text-blue-900">
                {orders.length}
              </div>
            </div>
            <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">
                Completed Invoices
              </p>
              <div className="text-2xl font-bold text-green-900">
                {completedOrders.length}
              </div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">
                Total Parties
              </p>
              <div className="text-2xl font-bold text-purple-900">
                {totalParties}
              </div>
            </div>
            <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
              <Truck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Tabs */}
      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 w-full"
            />
          </div>
          <Select value={filterFirm} onValueChange={setFilterFirm}>
            <SelectTrigger className="h-10 w-[180px]">
              <Building className="w-4 h-4 mr-2 shrink-0 text-gray-500" />
              <SelectValue placeholder="All Firms" />
            </SelectTrigger>
            <SelectContent>
              {firmOptions.map((f) => (
                <SelectItem key={f} value={f}>
                  {f === "all" ? "All Firms" : f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-10 w-[145px] text-sm"
              title="From Date"
            />
            <span className="text-gray-400 text-sm shrink-0">–</span>
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-10 w-[145px] text-sm"
              title="To Date"
            />
            {(filterDateFrom || filterDateTo) && (
              <button
                onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                className="ml-1 text-gray-400 hover:text-gray-700"
                title="Clear dates"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            onClick={fetchInvoiceData}
            variant="outline"
            className="h-10 px-3"
            disabled={loading || submitting}
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            className="h-10 px-3 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
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
            History ({completedOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "report" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Invoice Report
          </button>
        </div>
      </div>

      {/* Invoice Report Tab */}
      {activeTab === "report" && (() => {
        const allReportOrders = searchFilter(completedOrders);
        const inStock = allReportOrders.filter(o => o.inStockOrNot === "In Stock");
        const fromPurchase = allReportOrders.filter(o => o.inStockOrNot === "From Purchase");
        const forProduction = allReportOrders.filter(o => o.inStockOrNot === "For Production Planning");

        const filteredOrders = reportSourceFilter === "all"
          ? allReportOrders
          : reportSourceFilter === "instock" ? inStock
          : reportSourceFilter === "purchase" ? fromPurchase
          : reportSourceFilter === "production" ? forProduction
          : allReportOrders;

        const uniqueBills = (list) => new Set(list.map(o => o.billNumber).filter(Boolean)).size;
        const totalQty = (list) => list.reduce((s, o) => s + (getInvoiceLineQty(o) || 0), 0);

        const stockBadge = (val) => {
          if (val === "In Stock") return "bg-green-100 text-green-800";
          if (val === "From Purchase") return "bg-blue-100 text-blue-800";
          if (val === "For Production Planning") return "bg-purple-100 text-purple-800";
          return "bg-gray-100 text-gray-500";
        };

        const showProductionCols = reportSourceFilter === "instock" || reportSourceFilter === "all";
        const showPurchaseCols = reportSourceFilter === "purchase" || reportSourceFilter === "all";
        const showProductionPlanCols = reportSourceFilter === "production" || reportSourceFilter === "all";

        return (
          <div className="space-y-4 mt-4">
            {/* Summary Cards (clickable filters) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div
                onClick={() => setReportSourceFilter(reportSourceFilter === "instock" ? "all" : "instock")}
                className={`cursor-pointer rounded-lg p-4 border transition-all ${reportSourceFilter === "instock" ? "bg-green-100 border-green-400 ring-2 ring-green-400" : "bg-green-50 border-green-100 hover:border-green-300"}`}
              >
                <p className="text-xs font-medium text-green-600 mb-1">In Stock</p>
                <p className="text-2xl font-bold text-green-900">{inStock.length}</p>
                <p className="text-xs text-green-600 mt-0.5">{uniqueBills(inStock)} bills · {fmtQty(totalQty(inStock))} MT</p>
              </div>
              <div
                onClick={() => setReportSourceFilter(reportSourceFilter === "purchase" ? "all" : "purchase")}
                className={`cursor-pointer rounded-lg p-4 border transition-all ${reportSourceFilter === "purchase" ? "bg-blue-100 border-blue-400 ring-2 ring-blue-400" : "bg-blue-50 border-blue-100 hover:border-blue-300"}`}
              >
                <p className="text-xs font-medium text-blue-600 mb-1">From Purchase</p>
                <p className="text-2xl font-bold text-blue-900">{fromPurchase.length}</p>
                <p className="text-xs text-blue-600 mt-0.5">{uniqueBills(fromPurchase)} bills · {fmtQty(totalQty(fromPurchase))} MT</p>
              </div>
              <div
                onClick={() => setReportSourceFilter(reportSourceFilter === "production" ? "all" : "production")}
                className={`cursor-pointer rounded-lg p-4 border transition-all ${reportSourceFilter === "production" ? "bg-purple-100 border-purple-400 ring-2 ring-purple-400" : "bg-purple-50 border-purple-100 hover:border-purple-300"}`}
              >
                <p className="text-xs font-medium text-purple-600 mb-1">For Production</p>
                <p className="text-2xl font-bold text-purple-900">{forProduction.length}</p>
                <p className="text-xs text-purple-600 mt-0.5">{uniqueBills(forProduction)} bills · {fmtQty(totalQty(forProduction))} MT</p>
              </div>
              <div
                onClick={() => setReportSourceFilter("all")}
                className={`cursor-pointer rounded-lg p-4 border transition-all ${reportSourceFilter === "all" ? "bg-gray-200 border-gray-400 ring-2 ring-gray-400" : "bg-gray-50 border-gray-200 hover:border-gray-400"}`}
              >
                <p className="text-xs font-medium text-gray-600 mb-1">Total Completed</p>
                <p className="text-2xl font-bold text-gray-900">{allReportOrders.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">{uniqueBills(allReportOrders)} bills · {fmtQty(totalQty(allReportOrders))} MT</p>
              </div>
            </div>

            {/* Active filter label */}
            {reportSourceFilter !== "all" && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Showing:</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${stockBadge(reportSourceFilter === "instock" ? "In Stock" : reportSourceFilter === "purchase" ? "From Purchase" : "For Production Planning")}`}>
                  {reportSourceFilter === "instock" ? "In Stock" : reportSourceFilter === "purchase" ? "From Purchase" : "For Production Planning"}
                </span>
                <button onClick={() => setReportSourceFilter("all")} className="text-xs text-gray-400 hover:text-gray-700 underline">Clear filter</button>
              </div>
            )}

            {/* Detailed Table */}
            <div className="bg-white border rounded-md shadow-sm">
              <div className="overflow-auto max-h-[calc(100vh-420px)]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Bill No.</th>
                      <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">PO Number</th>
                      <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Party Name</th>
                      <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Marketing Sales Person</th>
                      <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Product</th>
                      <th className="text-right font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Qty (MT)</th>
                      <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Source</th>
                      {showProductionCols && <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Production Order No.</th>}
                      {showProductionCols && <th className="text-right font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Qty Transferred</th>}
                      {showProductionCols && <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Batch / Remarks</th>}
                      {showPurchaseCols && <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Indent / Batch No.</th>}
                      {showProductionPlanCols && <th className="text-right font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">GP %</th>}
                      <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Date</th>
                      <th className="text-left font-semibold text-gray-900 py-3 px-4 whitespace-nowrap">Bill Copy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan={15} className="text-center py-8 text-gray-500">No invoices found for this filter.</td></tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="py-2 px-4 font-semibold">{order.billNumber || "—"}</td>
                          <td className="py-2 px-4 text-xs text-gray-500">{order.partyPONumber || "—"}</td>
                          <td className="py-2 px-4 whitespace-nowrap">{order.partyName || "—"}</td>
                          <td className="py-2 px-4 whitespace-nowrap">{order.marketingSalesPerson || "—"}</td>
                          <td className="py-2 px-4 whitespace-nowrap">{order.productName || "—"}</td>
                          <td className="py-2 px-4 text-right font-medium">{fmtQty(getInvoiceLineQty(order))}</td>
                          <td className="py-2 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stockBadge(order.inStockOrNot)}`}>
                              {order.inStockOrNot || "N/A"}
                            </span>
                          </td>
                          {showProductionCols && <td className="py-2 px-4 text-xs">{order.productionOrderNo || "—"}</td>}
                          {showProductionCols && <td className="py-2 px-4 text-right text-xs">{order.qtyTransferred !== "" && order.qtyTransferred !== null ? fmtQty(order.qtyTransferred) : "—"}</td>}
                          {showProductionCols && <td className="py-2 px-4 text-xs">{order.batchNumberRemarks || "—"}</td>}
                          {showPurchaseCols && <td className="py-2 px-4 text-xs font-medium">{order.indentSelfBatchNumber || "—"}</td>}
                          {showProductionPlanCols && <td className="py-2 px-4 text-right text-xs">{order.gpPercent !== "" && order.gpPercent !== null ? `${order.gpPercent}%` : "—"}</td>}
                          <td className="py-2 px-4 text-xs text-gray-600 whitespace-nowrap">{formatDateOnly(order.actual4)}</td>
                          <td className="py-2 px-4">
                            {order.billCopy ? (
                              <a href={order.billCopy} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                            ) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Table */}
      {activeTab !== "report" && (
      <div className="bg-white border rounded-md shadow-sm mt-4">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">
                  LGST-Sr
                </TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[130px]">
                  DO No.
                </TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">
                  Firm Name
                </TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[160px]">
                  Product
                </TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[90px]">
                  Truck Qty
                </TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">
                  Transporter Type
                </TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[140px]">
                  Transporter Rate
                </TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[110px]">
                  Truck No
                </TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[110px]">
                  Planned
                </TableHead>
                {activeTab === "history" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">
                    Bill No.
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === "history" ? 10 : 9}
                    className="text-center py-8 text-gray-500"
                  >
                    No {activeTab} invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                groupedDisplayOrders.map((group) => (
                  <Fragment key={group.key}>
                    {/* PO group header */}
                    <TableRow className="bg-slate-50">
                      <TableCell
                        colSpan={activeTab === "history" ? 10 : 9}
                        className="px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          {activeTab === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleOpen(group)}
                              className="bg-green-600 hover:bg-green-700 h-8 text-xs shrink-0"
                              disabled={submitting}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Make Invoice
                            </Button>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">
                              PO Number: {group.poNumber}
                            </span>
                            <span className="text-xs text-slate-600">
                              Party Name: {group.partyName}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 ml-auto">
                            {group.rows.length} product
                            {group.rows.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Product rows */}
                    {group.rows.map((order) => (
                      <TableRow
                        key={order.id}
                        className="hover:bg-gray-50 border-b border-gray-100"
                      >
                        <TableCell className="py-2 px-4">
                          <Badge className="bg-blue-500 text-white rounded-sm text-xs">
                            {order.lgstSrNumber || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm font-medium">
                          {order.deliveryOrderNo || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm">
                          {order.firmName || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm">
                          {order.productName || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm font-medium">
                          {getInvoiceLineQty(order) || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm">
                          {order.typeOfTransporting || "N/A"}
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm">
                          {getTransporterRateDisplay(order)}
                        </TableCell>
                        <TableCell className="py-2 px-4">
                          <Badge
                            variant="outline"
                            className="rounded-sm text-xs"
                          >
                            {order.truckNo || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-4 text-sm">
                          {order.planned4 ? (
                            <span className="text-orange-600">
                              {formatDateOnly(order.planned4)}
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        {activeTab === "history" && (
                          <TableCell className="py-2 px-4 text-sm">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">
                                  {order.billNumber || "—"}
                                </span>
                                {user?.role === "ADMIN" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-amber-600 hover:text-amber-800"
                                    title="Edit Bill"
                                    onClick={() => handleOpenAdminEditBill(order)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              {order.billCopy && (
                                <a
                                  href={order.billCopy}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  View Copy
                                </a>
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
      )}

      {/* ── Invoice Modal ─────────────────────────────────────────────────────── */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b z-10">
              <CardTitle className="text-lg">Make Invoice</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={submitting}
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            <CardContent className="p-4 lg:p-6 space-y-6">
              {/* PO info */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900">
                      PO: {selectedGroup.poNumber}
                    </p>
                    <p className="text-gray-600">
                      Party: {selectedGroup.partyName}
                    </p>
                    {selectedGroup.rows[0]?.gstNumber && (
                      <p className="text-gray-500 text-xs font-mono">
                        GST: {selectedGroup.rows[0].gstNumber}
                      </p>
                    )}
                    {selectedGroup.rows[0]?.address && (
                      <p className="text-gray-500 text-xs">
                        Address: {selectedGroup.rows[0].address}
                      </p>
                    )}
                    {selectedGroup.rows[0]?.uploadSO && (
                      <a
                        href={selectedGroup.rows[0].uploadSO}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2 mt-1"
                      >
                        <FileText className="w-3 h-3" />
                        View PO Copy
                      </a>
                    )}
                  </div>
                  <div className="text-right text-xs text-blue-600 font-medium shrink-0">
                    {selectedRowIds.size} / {selectedGroup.rows.length} Selected
                  </div>
                </div>
              </div>

              {/* Weighment details */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-blue-600 rounded-full inline-block" />
                  Weighment Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Actual Truck Qty</p>
                    <p className="font-semibold text-slate-900">
                      {fmtQty(totalActualTruckQty)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      Total Weighment Qty
                    </p>
                    <p className="font-semibold text-slate-900">
                      {fmtQty(totalWeighmentQty)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Difference</p>
                    <p
                      className={`font-semibold ${weighmentActualDiff >= 0 ? "text-green-700" : "text-amber-700"}`}
                    >
                      {weighmentActualDiff >= 0 ? "+" : ""}
                      {fmtQty(weighmentActualDiff)}
                    </p>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-[10px]">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">
                          Product
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">
                          Actual Qty
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">
                          Weighment Qty
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">
                          Diff
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">
                          Slip Image
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {weighmentGroups.map((group) => {
                        const firstLine = group.lines[0] || {};
                        const diff = group.weighmentQty - group.actualQty;
                        const slips = [
                          { label: "Slip 1", url: firstLine.imageOfSlip },
                          { label: "Slip 2", url: firstLine.imageOfSlip2 },
                          { label: "Slip 3", url: firstLine.imageOfSlip3 },
                        ].filter((slip) => slip.url);
                        return (
                          <tr
                            key={`weighment_${group.key}`}
                            className="bg-blue-50/30"
                          >
                            <td className="px-3 py-2">
                              <div className="flex flex-col">
                                <span className="text-gray-800 font-medium text-[11px]">
                                  {getWeighmentProductLabel(group)}
                                </span>
                                <span className="text-[9px] text-gray-400">
                                  {getWeighmentDeliveryLabel(group)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-700">
                              {fmtQty(group.actualQty)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-700">
                              {fmtQty(group.weighmentQty)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-bold ${diff >= 0 ? "text-green-700" : "text-amber-700"}`}
                            >
                              {diff >= 0 ? "+" : ""}
                              {fmtQty(diff)}
                            </td>
                            <td className="px-3 py-2">
                              {slips.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {slips.map((slip) => (
                                    <a
                                      key={slip.label}
                                      href={slip.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center rounded-sm bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
                                    >
                                      {slip.label}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  N/A
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Product lines table */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-green-600 rounded-full inline-block" />
                  Product Lines
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-[10px]">
                      <tr>
                        <th className="w-8 px-2 py-2">
                          <Checkbox
                            checked={
                              selectedRowIds.size === selectedGroup.rows.length
                            }
                            onCheckedChange={toggleAll}
                          />
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">
                          Logistic Details
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">
                          Product
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">
                          Qty
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600 min-w-[100px]">
                          Rate (₹)
                        </th>
                        {hasFreightAmount && (
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">
                            Freight Amount
                          </th>
                        )}
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">
                          Total (₹)
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">
                          Amt w/ Tax (₹)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {computedLines.map((line, i) => (
                        <tr
                          key={line.id}
                          className={`transition-colors ${line.isSelected ? "bg-blue-50/30" : "bg-white opacity-60"}`}
                        >
                          <td className="px-2 py-2 text-center">
                            <Checkbox
                              checked={line.isSelected}
                              onCheckedChange={() => toggleRow(line.id)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-blue-700 font-bold text-[10px]">
                                  {line.lgstSrNumber || "N/A"}
                                </span>
                                <span className="text-gray-900 font-bold text-[11px]">
                                  {line.truckNo || "N/A"}
                                </span>
                              </div>
                              <div className="text-[9px] text-gray-500 truncate max-w-[150px]">
                                {line.transporterName || "N/A"}
                              </div>
                              <div className="text-[9px] text-gray-500 truncate max-w-[150px]">
                                Rate: {getTransporterRateDisplay(line)}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="text-gray-800 font-medium text-[11px]">
                                {line.productName || "—"}
                              </span>
                              <span className="text-[9px] text-gray-400">
                                {line.deliveryOrderNo}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 font-bold">
                            {line.qty}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={productLines[i].rate}
                              onChange={(e) =>
                                updateLine(i, "rate", e.target.value)
                              }
                              className="h-7 w-20 text-right ml-auto text-xs"
                              disabled={submitting || !line.isSelected}
                            />
                          </td>
                          {hasFreightAmount && (
                            <td className="px-3 py-2 text-right text-gray-700 font-medium">
                              {Number(line.freightAmount) > 0
                                ? fmt(line.freightAmount)
                                : "-"}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right text-gray-700 font-medium">
                            {fmt(line.total)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900">
                            {fmt(line.amountWithTax)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-[10px] font-bold">
                      <tr>
                        <td
                          colSpan={hasFreightAmount ? 6 : 5}
                          className="px-3 py-2 text-right text-gray-700"
                        >
                          Grand Total (Selected)
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {fmt(grandTotal)}
                        </td>
                        <td className="px-3 py-2 text-right text-green-700 text-xs">
                          {fmt(grandWithTax)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Invoice details */}
              <div className="border-t pt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Invoice Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Enter invoice number"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    disabled={submitting}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Invoice Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    disabled={submitting}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Invoice Copy <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setInvoiceCopyFile(e.target.files?.[0] || null)
                    }
                    disabled={submitting}
                    className="h-10"
                  />
                  {invoiceCopyFile && (
                    <p className="text-xs text-green-600">
                      ✓ {invoiceCopyFile.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Info note */}
              <div className="p-3 bg-green-50 border border-green-100 rounded-md text-xs text-green-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Submitting will set <strong>Actual4</strong> to the current
                  date/time for the {selectedRowIds.size} selected row
                  {selectedRowIds.size > 1 ? "s" : ""}. The same invoice copy
                  will be linked to each selected dispatch row.
                </span>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex flex-col sm:flex-row justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={submitting}
                  className="sm:w-auto w-full"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-green-600 hover:bg-green-700 sm:w-auto w-full"
                  disabled={submitting || !invoiceNo.trim() || !invoiceDate || !invoiceCopyFile}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Submit Invoice
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin Edit Bill Modal */}
      {adminEditBillModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50 rounded-t-xl">
              <CardTitle className="text-lg">Edit Bill Details (Admin)</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setAdminEditBillModalOpen(false)}
                disabled={adminEditSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="adminBillNo">Bill Number</Label>
                <Input
                  id="adminBillNo"
                  value={adminEditBillNo}
                  onChange={(e) => setAdminEditBillNo(e.target.value)}
                  placeholder="Enter Bill Number"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminBillCopy">Bill Copy PDF / Image</Label>
                {adminEditBillCopyUrl && (
                  <p className="text-xs text-blue-600 truncate mb-1">
                    Current: <a href={adminEditBillCopyUrl} target="_blank" rel="noopener noreferrer" className="underline">View Existing Copy</a>
                  </p>
                )}
                <Input
                  id="adminBillCopy"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAdminEditBillCopyFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setAdminEditBillModalOpen(false)}
                  disabled={adminEditSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAdminEditBill}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={adminEditSubmitting}
                >
                  {adminEditSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
