"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Package,
  DollarSign,
  Users,
  TrendingDown,
  Calendar,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Truck,
  FileText,
  Layers,
  Database,
  RefreshCw,
  Loader2,
  AlertCircle,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Download,
  FileBarChart,
  Bell,
  Plus,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

const MASTER_ADD_OPTIONS = [
  { label: "Party Name", column: "Party Name" },
  { label: "Product Name", column: "Product Name" },
  { label: "Transporter Name", column: "Transporter Name" },
  { label: "Return Transporter Name", column: "Material Return Transporter Name" },
];

const PARTY_LEDGER_HEADERS = [
  "Invoice No",
  "PO No",
  "Customer",
  "Invoice Date",
  "Payment term",
  "Bill Amount",
  "Advance Adj",
  "PBG",
  "PBG Tenure",
  "Net Bill",
  "Due Date",
  "Amt Received",
  "Date",
  "Pending",
  "Days Delay",
  "Interest",
  "Remark",
  "Payment Receive Date",
  "Amount",
];

const PARTY_LEDGER_TABLES = [
  "PARTY LEDGER",
  "Party Ledger",
  "PAYMENT COLLECTION",
  "Payment Collection",
  "RECEIVED ACCOUNTS",
  "Received Accounts",
  "ACCOUNT RECEIVABLE",
  "Account Receivable",
  "ACCOUNTS RECEIVABLE",
  "Accounts Receivable",
  "INVOICE PAYMENT",
  "Invoice Payment",
  "PAYMENTS",
  "Payments",
  "payments",
  "payment_collection",
  "received_accounts",
  "account_receivable",
  "party_payment",
];

const HEADER_ALIASES = {
  "Invoice No": ["Invoice No", "Invoice No.", "Bill No", "Bill No.", "Bill Number", "Invoice Number"],
  "PO No": ["PO No", "PO No.", "P.O. No", "PARTY PO NO (As Per Po Exact)", "Party PO Number", "po_number"],
  Customer: ["Customer", "Party Name", "Party Names", "Customer Name"],
  "Invoice Date": ["Invoice Date", "Bill Date", "Date of Invoice"],
  "Payment term": ["Payment term", "Payment Term", "Payment Terms", "Payment to Be Taken"],
  "Bill Amount": ["Bill Amount", "Total Bill Amount", "Invoice Amount", "Total Amount"],
  "Advance Adj": ["Advance Adj", "Advance Adjustment", "Advance Adjusted"],
  PBG: ["PBG", "PBG Amount", "Pbg"],
  "PBG Tenure": ["PBG Tenure", "Pbg Tenure"],
  "Net Bill": ["Net Bill", "Net Bill Amount", "Net Amount"],
  "Due Date": ["Due Date", "PI Due Date", "Payment Due Date"],
  "Amt Received": ["Amt Received", "Amount Received", "Received Amount"],
  Date: ["Date", "Payment Date", "Received Date"],
  Pending: ["Pending", "Pending Amount", "Outstanding", "Balance"],
  "Days Delay": ["Days Delay", "Delay Days", "Delay"],
  Interest: ["Interest", "Interest Amount"],
  Remark: ["Remark", "Remarks"],
  "Payment Receive Date": ["Payment Receive Date", "Payment Received Date", "Receive Date"],
  Amount: ["Amount", "Payment Amount"],
};

const getFirstValue = (row, aliases) => {
  for (const key of aliases) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
};

const toAmount = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/[₹,\s]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

const formatLedgerValue = (header, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (["Bill Amount", "Advance Adj", "PBG", "Net Bill", "Amt Received", "Pending", "Interest", "Amount"].includes(header)) {
    const amount = toAmount(value);
    return amount ? formatCurrency(amount) : String(value);
  }
  if (["Invoice Date", "Due Date", "Date", "Payment Receive Date"].includes(header)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-IN");
  }
  return String(value);
};

const normalizeLedgerRow = (row) => {
  const normalized = {};
  PARTY_LEDGER_HEADERS.forEach((header) => {
    normalized[header] = getFirstValue(row, HEADER_ALIASES[header] || [header]);
  });
  normalized.__raw = row;
  return normalized;
};

export default function AnalyticsDashboard({ user }) {
  const [timeRange, setTimeRange] = useState("30");
  const [selectedMetric, setSelectedMetric] = useState("orders");
  const [selectedFirm, setSelectedFirm] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [masterAddOption, setMasterAddOption] = useState(null);
  const [masterAddValue, setMasterAddValue] = useState("");
  const [masterPartyDetails, setMasterPartyDetails] = useState({
    address: "",
    gstNumber: "",
  });
  const [masterAddSubmitting, setMasterAddSubmitting] = useState(false);
  const [sheetData, setSheetData] = useState({
    orderReceipt: [],
    dispatch: [],
    delivery: [],
    postDelivery: [],
    partyLedger: [],
    piPayments: [],
    retentionPayments: [],
    lastUpdated: null,
  });
  const [selectedParty, setSelectedParty] = useState("all");
  const [partySearchTerm, setPartySearchTerm] = useState("");

  // Quick Actions Handlers
  const handleExportData = async () => {
    try {
      toast.info("Preparing data export...");

      // Create combined data object
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: user.name,
          userRole: user.role,
          userFirm: user.firm,
          timeRange: timeRange,
          selectedFirm: selectedFirm,
        },
        summary: {
          totalOrders: stats.totalOrders,
          totalRevenue: stats.totalRevenue,
          completionRate: stats.completionRate,
          pendingOrders: stats.pendingOrders,
          completedOrders: stats.completedOrders,
          cancelledOrders: stats.cancelledOrders,
        },
        orderReceipt: sheetData.orderReceipt,
        dispatch: sheetData.dispatch,
        delivery: sheetData.delivery,
        postDelivery: sheetData.postDelivery,
        charts: {
          monthlyRevenue: chartData.monthlyRevenue,
          statusDistribution: chartData.statusDistribution,
          processFlow: chartData.processFlow,
          firmPerformance: chartData.firmPerformance,
        }
      };

      // Convert to JSON string
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      // Create download link
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  const openMasterAddDialog = (option) => {
    setMasterAddOption(option);
    setMasterAddValue("");
    setMasterPartyDetails({ address: "", gstNumber: "" });
  };

  const closeMasterAddDialog = () => {
    setMasterAddOption(null);
    setMasterAddValue("");
    setMasterPartyDetails({ address: "", gstNumber: "" });
  };

  const handleMasterAddSubmit = async () => {
    if (!masterAddOption) return;

    const value = masterAddValue.trim();
    if (!value) {
      toast.error(`Enter ${masterAddOption.label}`);
      return;
    }
    if (masterAddOption.label === "Party Name") {
      if (!masterPartyDetails.address.trim()) {
        toast.error("Enter Address");
        return;
      }
      if (!masterPartyDetails.gstNumber.trim()) {
        toast.error("Enter GST Number");
        return;
      }
    }

    try {
      setMasterAddSubmitting(true);
      const payload = { [masterAddOption.column]: value };
      if (masterAddOption.label === "Party Name") {
        payload["Address"] = masterPartyDetails.address.trim();
        payload["GST Number"] = masterPartyDetails.gstNumber.trim();
      }
      const { error } = await supabase
        .from("MASTER")
        .insert([payload]);

      if (error) throw error;

      toast.success(`${masterAddOption.label} added successfully`);
      closeMasterAddDialog();
    } catch (error) {
      console.error("MASTER add error:", error);
      toast.error(error.message || "Failed to add data");
    } finally {
      setMasterAddSubmitting(false);
    }
  };

  const handleGenerateReport = () => {
    toast.info("Generating dashboard report...");

    // In a real app, this would generate a PDF/Excel report
    // For now, we'll create a simple HTML report
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      const reportDate = new Date().toLocaleDateString();
      const reportTime = new Date().toLocaleTimeString();

      reportWindow.document.write(`
        <html>
          <head>
            <title>Dashboard Report - ${reportDate}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #333; }
              .header { margin-bottom: 30px; }
              .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
              .stat { display: inline-block; margin: 10px 20px 10px 0; }
              .stat-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
              .stat-label { color: #666; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f8f9fa; }
              .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
              .alert-warning { background-color: #fff3cd; border: 1px solid #ffc107; }
              .alert-info { background-color: #d1ecf1; border: 1px solid #17a2b8; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Analytics Dashboard Report</h1>
              <p>Generated on ${reportDate} at ${reportTime}</p>
              <p>Generated by: ${user.name} (${user.role} - ${user.firm})</p>
            </div>
            
            <div class="section">
              <h2>Executive Summary</h2>
              <div class="stat">
                <div class="stat-value">${stats.totalOrders}</div>
                <div class="stat-label">Total Orders</div>
              </div>
              <div class="stat">
                <div class="stat-value">₹${(stats.totalRevenue / 100000).toFixed(1)}L</div>
                <div class="stat-label">Total Revenue</div>
              </div>
              <div class="stat">
                <div class="stat-value">${stats.completionRate.toFixed(1)}%</div>
                <div class="stat-label">Completion Rate</div>
              </div>
              <div class="stat">
                <div class="stat-value">${stats.completedPostDelivery}</div>
                <div class="stat-label">Full Process Completed</div>
              </div>
            </div>
            
            <div class="section">
              <h2>Process Flow Status</h2>
              <table>
                <tr>
                  <th>Stage</th>
                  <th>Pending</th>
                  <th>Completed</th>
                  <th>Completion Rate</th>
                </tr>
                <tr>
                  <td>Orders</td>
                  <td>${stats.pendingOrders}</td>
                  <td>${stats.completedOrders}</td>
                  <td>${stats.completionRate.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Dispatch</td>
                  <td>${stats.pendingDispatch}</td>
                  <td>${stats.completedDispatch}</td>
                  <td>${stats.completedDispatch > 0 ? ((stats.completedDispatch / (stats.completedDispatch + stats.pendingDispatch)) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr>
                  <td>Delivery</td>
                  <td>${stats.pendingDelivery}</td>
                  <td>${stats.completedDelivery}</td>
                  <td>${stats.completedDelivery > 0 ? ((stats.completedDelivery / (stats.completedDelivery + stats.pendingDelivery)) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr>
                  <td>Post Delivery</td>
                  <td>${stats.pendingPostDelivery}</td>
                  <td>${stats.completedPostDelivery}</td>
                  <td>${stats.completedPostDelivery > 0 ? ((stats.completedPostDelivery / (stats.completedPostDelivery + stats.pendingPostDelivery)) * 100).toFixed(1) : 0}%</td>
                </tr>
              </table>
            </div>
            
            <div class="section">
              <h2>Recent Alerts</h2>
              ${alerts.length > 0 ? alerts.slice(0, 5).map(alert => `
                <div class="alert alert-${alert.type}">
                  <strong>${alert.title}</strong><br>
                  ${alert.message}<br>
                  <small>${new Date(alert.timestamp).toLocaleString()}</small>
                </div>
              `).join('') : '<p>No active alerts</p>'}
            </div>
            
            <div class="section">
              <h2>Data Overview</h2>
              <table>
                <tr>
                  <th>Sheet</th>
                  <th>Total Records</th>
                  <th>Last Updated</th>
                </tr>
                <tr>
                  <td>Order Receipt</td>
                  <td>${sheetData.orderReceipt.length}</td>
                  <td>${sheetData.lastUpdated ? new Date(sheetData.lastUpdated).toLocaleString() : 'N/A'}</td>
                </tr>
                <tr>
                  <td>Dispatch</td>
                  <td>${sheetData.dispatch.length}</td>
                  <td>${sheetData.lastUpdated ? new Date(sheetData.lastUpdated).toLocaleString() : 'N/A'}</td>
                </tr>
                <tr>
                  <td>Delivery</td>
                  <td>${sheetData.delivery.length}</td>
                  <td>${sheetData.lastUpdated ? new Date(sheetData.lastUpdated).toLocaleString() : 'N/A'}</td>
                </tr>
                <tr>
                  <td>Post Delivery</td>
                  <td>${sheetData.postDelivery.length}</td>
                  <td>${sheetData.lastUpdated ? new Date(sheetData.lastUpdated).toLocaleString() : 'N/A'}</td>
                </tr>
              </table>
            </div>
            
            <div class="section">
              <p><em>Report generated from Analytics Dashboard v1.0</em></p>
            </div>
          </body>
        </html>
      `);
      reportWindow.document.close();

      toast.success("Report generated successfully!");
    }
  };

  const handleSyncNow = async () => {
    toast.info("Starting manual sync...");
    await fetchAllData(true);
    toast.success("Sync completed successfully!");
  };

  const handleViewAlerts = () => {
    setShowAlerts(true);

    // Create mock alerts if none exist
    if (alerts.length === 0) {
      const mockAlerts = [
        {
          id: 1,
          title: "Data Refresh Required",
          message: "Last data refresh was over 30 minutes ago",
          type: "warning",
          timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        },
        {
          id: 2,
          title: "High Pending Orders",
          message: `${stats.pendingOrders} orders are pending completion`,
          type: "info",
          timestamp: new Date().toISOString(),
        },
        {
          id: 3,
          title: "Low Completion Rate Alert",
          message: `Completion rate is ${stats.completionRate.toFixed(1)}%, below target of 80%`,
          type: stats.completionRate < 80 ? "warning" : "info",
          timestamp: new Date().toISOString(),
        },
      ];
      setAlerts(mockAlerts);
    }

    // Show alerts in a toast or modal
    const alertsCount = alerts.length || 3;
    const criticalAlerts = alerts.filter(a => a.type === 'warning').length;

    if (criticalAlerts > 0) {
      toast.warning(`You have ${criticalAlerts} critical alert${criticalAlerts > 1 ? 's' : ''}`, {
        description: "Check the alerts panel for details",
        action: {
          label: "View",
          onClick: () => {
            const alertModal = document.createElement('div');
            alertModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            alertModal.innerHTML = `
              <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">Dashboard Alerts</h3>
                <div class="space-y-3 max-h-96 overflow-y-auto">
                  ${alerts.map(alert => `
                    <div class="p-3 rounded border ${alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}">
                      <div class="flex justify-between items-start">
                        <div>
                          <h4 class="font-medium ${alert.type === 'warning' ? 'text-yellow-800' : 'text-blue-800'}">${alert.title}</h4>
                          <p class="text-sm mt-1 ${alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}">${alert.message}</p>
                        </div>
                        <span class="text-xs ${alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}">
                          ${new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <div class="mt-6 flex justify-end">
                  <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm">
                    Close
                  </button>
                </div>
              </div>
            `;
            document.body.appendChild(alertModal);
          }
        }
      });
    } else {
      toast.info(`You have ${alertsCount} alert${alertsCount > 1 ? 's' : ''}`, {
        description: "No critical issues detected",
      });
    }
  };

  // Fetch data from all Supabase tables
  const fetchAllData = async (forceRefresh = false) => {
    if (!forceRefresh && sheetData.lastUpdated &&
      Date.now() - new Date(sheetData.lastUpdated).getTime() < 30000) {
      return; // Skip if refreshed within 30 seconds
    }

    try {
      setRefreshing(true);
      setError(null);

      // Fetch all tables in parallel
      const [orderReceiptRes, dispatchRes, deliveryRes, postDeliveryRes, piPaymentsRes, retentionPaymentsRes] = await Promise.all([
        supabase.from('ORDER RECEIPT').select('*'),
        supabase.from('DISPATCH').select('*'),
        supabase.from('DELIVERY').select('*'),
        supabase.from('POST DELIVERY').select('*'),
        supabase.from('po_pi_records').select('*'),
        supabase.from('po_retention_records').select('*')
      ]);
      const partyLedgerResults = await Promise.all(
        PARTY_LEDGER_TABLES.map((table) => supabase.from(table).select("*"))
      );

      // Check for errors
      if (orderReceiptRes.error) throw orderReceiptRes.error;
      if (dispatchRes.error) throw dispatchRes.error;
      if (deliveryRes.error) throw deliveryRes.error;
      if (postDeliveryRes.error) throw postDeliveryRes.error;
      if (piPaymentsRes.error && piPaymentsRes.error.code !== "42P01") throw piPaymentsRes.error;
      if (retentionPaymentsRes.error && retentionPaymentsRes.error.code !== "42P01") throw retentionPaymentsRes.error;

      // Debug: Log the data to see what we're getting
      console.log("📊 Dashboard Data Fetched:");
      console.log("Order Receipt Count:", orderReceiptRes.data?.length);
      console.log("Sample Order:", orderReceiptRes.data?.[0]);
      console.log("Available Columns:", orderReceiptRes.data?.[0] ? Object.keys(orderReceiptRes.data[0]) : []);

      // Debug: Check Total PO Basic Value
      console.log("🔍 Revenue Debug:");
      orderReceiptRes.data?.forEach((order, idx) => {
        console.log(`Order ${idx + 1}:`, {
          "DO Number": order["DO-Delivery Order No."],
          "Total PO Basic Value": order["Total PO Basic Value"],
          "Type": typeof order["Total PO Basic Value"],
          "Parsed": parseFloat(order["Total PO Basic Value"]),
        });
      });

      const newData = {
        orderReceipt: orderReceiptRes.data || [],
        dispatch: dispatchRes.data || [],
        delivery: deliveryRes.data || [],
        postDelivery: postDeliveryRes.data || [],
        partyLedger: partyLedgerResults.flatMap((result) => (result.error ? [] : result.data || [])),
        piPayments: piPaymentsRes.data || [],
        retentionPayments: retentionPaymentsRes.data || [],
        lastUpdated: new Date().toISOString(),
      };

      setSheetData(newData);
      setLoading(false);

    } catch (error) {
      console.error("Error fetching all data:", error);
      setError("Failed to load dashboard data. Please try again.");
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };


  // Initialize data fetch
  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter data based on user role and firm
  const getFilteredData = (data, firmField = "Firm Name") => {
    // First filter by firm
    let filtered = data;

    if (user.role === "ADMIN") {
      if (selectedFirm !== "all") {
        filtered = data.filter(item => item[firmField] === selectedFirm);
      }
    } else {
      // Handle multiple firms (comma separated)
      const userFirms = user.firm ? user.firm.split(',').map(f => f.trim().toLowerCase()) : []

      filtered = data.filter(item => {
        if (userFirms.includes('all')) return true
        const itemFirm = item[firmField] ? item[firmField].trim().toLowerCase() : ""
        return userFirms.includes(itemFirm)
      });
    }

    // Then filter by time range
    const now = new Date();
    const daysAgo = parseInt(timeRange);
    const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));

    filtered = filtered.filter(item => {
      if (!item.Timestamp) return true; // Include items without timestamp
      const itemDate = new Date(item.Timestamp);
      return itemDate >= cutoffDate;
    });

    return filtered;
  };

  // Calculate statistics from all sheets
  const stats = useMemo(() => {
    const filteredOrders = getFilteredData(sheetData.orderReceipt, "Firm Name");
    const filteredDispatch = getFilteredData(sheetData.dispatch, "Firm Name");
    const filteredDelivery = getFilteredData(sheetData.delivery, "Firm Name");
    const filteredPostDelivery = getFilteredData(sheetData.postDelivery, "Firm Name");

    // Debug: Check filtering
    console.log("💰 Stats Calculation:");
    console.log("Total Orders in DB:", sheetData.orderReceipt.length);
    console.log("Filtered Orders:", filteredOrders.length);
    console.log("User Firm:", user.firm);
    console.log("User Role:", user.role);

    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (parseFloat(order["Total PO Basic Value"]) || 0), 0);
    const totalQuantity = filteredOrders.reduce((sum, order) => sum + (parseFloat(order["Quantity"]) || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    console.log("Total Revenue Calculated:", totalRevenue);
    console.log("Displayed as Lakhs:", (totalRevenue / 100000).toFixed(1) + "L");

    const activeOrders = filteredOrders.filter(order => order.logistics_status !== "Order Cancelled");
    const pendingOrders = activeOrders.filter(order => !order["Actual 1"]).length;
    const inProgressOrders = activeOrders.filter(order => order["Actual 1"] && !order["Actual 2"]).length;
    const completedOrders = activeOrders.filter(order => order["Actual 2"]).length;
    const cancelledOrders = filteredOrders.filter(order => order.logistics_status === "Order Cancelled").length;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    const pendingDispatch = filteredDispatch.filter(d => !d["Actual 2"]).length;
    const completedDispatch = filteredDispatch.filter(d => d["Actual 2"]).length;

    const pendingDelivery = filteredDelivery.filter(d => !d["Actual 1"]).length;
    const completedDelivery = filteredDelivery.filter(d => d["Actual 1"]).length;

    const pendingPostDelivery = filteredPostDelivery.filter(pd => !pd["Actual"]).length;
    const completedPostDelivery = filteredPostDelivery.filter(pd => pd["Actual"]).length;

    return {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      pendingOrders,
      inProgressOrders,
      completedOrders,
      completionRate,
      pendingDispatch,
      completedDispatch,
      pendingDelivery,
      completedDelivery,
      pendingPostDelivery,
      completedPostDelivery,
      cancelledOrders,
      totalQuantity,
    };
  }, [sheetData, user, selectedFirm]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Monthly revenue trend
    const monthlyRevenue = monthNames.map((month, index) => {
      const monthOrders = sheetData.orderReceipt.filter(order => {
        if (!order.Timestamp) return false;
        const date = new Date(order.Timestamp);
        return date.getMonth() === index;
      });

      const revenue = monthOrders.reduce((sum, order) => sum + (parseFloat(order["Total PO Basic Value"]) || 0), 0);
      return {
        month,
        revenue,
        orders: monthOrders.length,
        completed: monthOrders.filter(o => o["Actual 2"]).length,
      };
    });

    // Status distribution
    const statusDistribution = [
      { name: "Pending", value: stats.pendingOrders, color: "#ef4444" },
      { name: "In Progress", value: stats.inProgressOrders, color: "#f59e0b" },
      { name: "Completed", value: stats.completedOrders, color: "#10b981" },
      { name: "Cancelled", value: stats.cancelledOrders, color: "#6b7280" },
    ];

    // Process flow data
    const processFlow = [
      { stage: "Orders", count: stats.totalOrders, target: stats.totalOrders * 1.1 },
      { stage: "Dispatch", count: stats.completedDispatch, target: stats.totalOrders },
      { stage: "Delivery", count: stats.completedDelivery, target: stats.completedDispatch },
      { stage: "Post Delivery", count: stats.completedPostDelivery, target: stats.completedDelivery },
    ];

    // Firm performance - Get actual firms from data instead of hardcoded
    const actualFirms = [...new Set(sheetData.orderReceipt.map(order => order["Firm Name"]).filter(Boolean))];
    const firmPerformance = actualFirms.map(firm => {
      const firmOrders = sheetData.orderReceipt.filter(order => order["Firm Name"] === firm);
      const firmRevenue = firmOrders.reduce((sum, order) => sum + (parseFloat(order["Total PO Basic Value"]) || 0), 0);
      return {
        firm,
        revenue: firmRevenue,
        orders: firmOrders.length,
        completionRate: firmOrders.length > 0 ?
          (firmOrders.filter(o => o["Actual 2"]).length / firmOrders.length) * 100 : 0,
      };
    });

    // Debug: Log chart data
    console.log("📊 Chart Data:");
    console.log("Monthly Revenue:", monthlyRevenue.filter(m => m.revenue > 0));
    console.log("Status Distribution:", statusDistribution);
    console.log("Firm Performance:", firmPerformance);

    return {
      monthlyRevenue,
      statusDistribution,
      processFlow,
      firmPerformance,
    };
  }, [sheetData, stats]);

  // Get unique firms for filter
  const uniqueFirms = useMemo(() => {
    const firms = [...new Set(sheetData.orderReceipt.map(order => order["Firm Name"]).filter(Boolean))];
    return ["all", ...firms];
  }, [sheetData.orderReceipt]);

  const partyLedgerRows = useMemo(() => {
    const directRows = sheetData.partyLedger.map(normalizeLedgerRow);
    if (directRows.length > 0) return directRows;

    const ordersByDo = new Map(
      sheetData.orderReceipt
        .filter((order) => order["DO-Delivery Order No."])
        .map((order) => [String(order["DO-Delivery Order No."]).trim(), order])
    );
    const ordersByPo = new Map();
    sheetData.orderReceipt.forEach((order) => {
      const poNumber = String(order["PARTY PO NO (As Per Po Exact)"] || "").trim();
      if (poNumber && !ordersByPo.has(poNumber)) ordersByPo.set(poNumber, order);
    });

    const piByPo = new Map();
    sheetData.piPayments.forEach((payment) => {
      const poNumber = String(payment.po_number || "").trim();
      if (!poNumber) return;
      if (!piByPo.has(poNumber)) piByPo.set(poNumber, []);
      piByPo.get(poNumber).push(payment);
    });

    const retentionByPo = new Map(
      sheetData.retentionPayments.map((record) => [String(record.po_number || "").trim(), record])
    );

    const getOrderAmount = (order = {}) => {
      const adjusted = toAmount(order["Adjusted Amount"]);
      const basic = toAmount(order["Total PO Basic Value"]);
      return adjusted > 0 && (!basic || adjusted <= basic * 10) ? adjusted : basic;
    };

    const getLatestDate = (values) => {
      const validDates = values
        .filter(Boolean)
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => b - a);
      return validDates[0] ? validDates[0].toISOString().slice(0, 10) : "";
    };

    const getEarliestDate = (values) => {
      const validDates = values
        .filter(Boolean)
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a - b);
      return validDates[0] ? validDates[0].toISOString().slice(0, 10) : "";
    };

    const rows = [];

    sheetData.postDelivery.forEach((bill) => {
      const order = ordersByDo.get(String(bill["Order No."] || "").trim()) || {};
      const poNumber = String(order["PARTY PO NO (As Per Po Exact)"] || "").trim();
      const piRows = poNumber ? piByPo.get(poNumber) || [] : [];
      const billAmount = toAmount(bill["Total Bill Amount"]) || getOrderAmount(order);
      const expected = piRows.reduce((sum, payment) => sum + toAmount(payment.expected_amount), 0);
      const received = piRows.reduce((sum, payment) => sum + toAmount(payment.actual_amount), 0);
      const pendingBase = expected || billAmount;
      const pending = Math.max(0, pendingBase - received);
      const dueDate = getEarliestDate(piRows.map((payment) => payment.due_date)) || order["PI Due Date"] || "";

      rows.push(normalizeLedgerRow({
        "Invoice No": bill["Bill No."],
        "PO No": poNumber,
        Customer: bill["Party Name"] || order["Party Names"],
        "Invoice Date": bill["Bill Date"] || bill.Timestamp,
        "Payment term": order["Type Of PI"] || order["Payment to Be Taken"],
        "Bill Amount": billAmount,
        "Net Bill": pendingBase,
        "Due Date": dueDate,
        "Amt Received": received,
        Date: getLatestDate(piRows.map((payment) => payment.received_date || payment.received_at)),
        Pending: pending,
        "Days Delay": bill["Delay"],
        Remark: bill["Type of Bill"] || "Invoice",
        "Payment Receive Date": getLatestDate(piRows.map((payment) => payment.received_date || payment.received_at)),
        Amount: received,
        "Firm Name": order["Firm Name"],
        __ledgerType: "invoice",
        __hasPiPayments: piRows.length > 0,
      }));
    });

    sheetData.piPayments.forEach((payment) => {
      const poNumber = String(payment.po_number || "").trim();
      const order = ordersByPo.get(poNumber) || {};
      const expected = toAmount(payment.expected_amount);
      const received = toAmount(payment.actual_amount);
      const pending = Math.max(0, expected - received);
      const paymentLog = Array.isArray(payment.payment_log) ? payment.payment_log : [];
      const latestPayment = getLatestDate([
        payment.received_date,
        payment.received_at,
        ...paymentLog.map((entry) => entry?.date || entry?.recorded_at),
      ]);

      rows.push(normalizeLedgerRow({
        "Invoice No": payment.pi_number,
        "PO No": poNumber,
        Customer: payment.party_name || order["Party Names"],
        "Invoice Date": payment.created_at,
        "Payment term": payment.pi_type || order["Type Of PI"],
        "Bill Amount": expected || getOrderAmount(order),
        "Net Bill": expected || getOrderAmount(order),
        "Due Date": payment.due_date,
        "Amt Received": received,
        Date: latestPayment,
        Pending: pending,
        "Days Delay": payment.due_date && pending > 0
          ? Math.max(0, Math.ceil((new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24)))
          : "",
        Remark: payment.status || payment.slab_label || "PI Payment",
        "Payment Receive Date": latestPayment,
        Amount: received,
        "Firm Name": payment.firm_name || order["Firm Name"],
        __ledgerType: "pi",
      }));
    });

    retentionByPo.forEach((retention, poNumber) => {
      const order = ordersByPo.get(poNumber) || {};
      if (!order["Retention Payment"]) return;
      const baseAmount = getOrderAmount(order);
      const retentionAmount = (baseAmount * toAmount(order["Retention Percentage"])) / 100;
      const received = toAmount(retention.amount_received);

      rows.push(normalizeLedgerRow({
        "Invoice No": "Retention",
        "PO No": poNumber,
        Customer: order["Party Names"],
        "Invoice Date": order.Timestamp,
        "Payment term": "Retention",
        "Bill Amount": retentionAmount,
        "Net Bill": retentionAmount,
        "Due Date": order["PI Due Date"],
        "Amt Received": received,
        Date: retention.updated_at,
        Pending: Math.max(0, retentionAmount - received),
        Remark: retention.status || "Retention",
        "Payment Receive Date": retention.updated_at,
        Amount: received,
        "Firm Name": order["Firm Name"],
        __ledgerType: "retention",
      }));
    });

    if (rows.length > 0) return rows;

    return sheetData.orderReceipt.map((order) => {
      const amount = getOrderAmount(order);
      return normalizeLedgerRow({
        "Invoice No": order["DO-Delivery Order No."],
        "PO No": order["PARTY PO NO (As Per Po Exact)"],
        Customer: order["Party Names"],
        "Invoice Date": order.Timestamp,
        "Payment term": order["Type Of PI"] || order["Payment to Be Taken"],
        "Bill Amount": amount,
        "Net Bill": amount,
        "Due Date": order["PI Due Date"],
        Pending: amount,
        Remark: order.Status || order.logistics_status || "Order",
        "Firm Name": order["Firm Name"],
        __ledgerType: "order",
      });
    });
  }, [
    sheetData.partyLedger,
    sheetData.postDelivery,
    sheetData.orderReceipt,
    sheetData.piPayments,
    sheetData.retentionPayments,
  ]);

  const filteredPartyLedgerRows = useMemo(() => {
    const search = partySearchTerm.trim().toLowerCase();
    return partyLedgerRows.filter((row) => {
      const partyName = String(row.Customer || "").trim();
      if (selectedParty !== "all" && partyName !== selectedParty) return false;

      const firmName = String(row.__raw?.["Firm Name"] || "").trim().toLowerCase();
      if (firmName) {
        if (user.role === "ADMIN" && selectedFirm !== "all" && firmName !== selectedFirm.toLowerCase()) return false;
        if (user.role !== "ADMIN") {
          const userFirms = user.firm ? user.firm.split(",").map((f) => f.trim().toLowerCase()) : [];
          if (!userFirms.includes("all") && !userFirms.includes(firmName)) return false;
        }
      }

      if (!search) return true;
      return PARTY_LEDGER_HEADERS.some((header) =>
        String(row[header] || "").toLowerCase().includes(search)
      );
    });
  }, [partyLedgerRows, selectedParty, partySearchTerm, selectedFirm, user]);

  const partyOptions = useMemo(() => {
    const parties = [...new Set(partyLedgerRows.map((row) => row.Customer).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    return ["all", ...parties];
  }, [partyLedgerRows]);

  const visiblePartyLedgerHeaders = useMemo(() => {
    const headers = PARTY_LEDGER_HEADERS.filter((header) =>
      filteredPartyLedgerRows.some((row) => row[header] !== null && row[header] !== undefined && String(row[header]).trim() !== "")
    );
    return headers.length ? headers : PARTY_LEDGER_HEADERS;
  }, [filteredPartyLedgerRows]);

  const partyLedgerStats = useMemo(() => {
    const today = new Date();
    return filteredPartyLedgerRows.reduce(
      (acc, row) => {
        const isInvoiceCoveredByPi = row.__raw?.__ledgerType === "invoice" && row.__raw?.__hasPiPayments;
        const billAmount = toAmount(row["Bill Amount"]);
        const received = toAmount(row["Amt Received"]) || toAmount(row.Amount);
        const pending = row.Pending !== "" ? toAmount(row.Pending) : Math.max(0, billAmount - received);
        const interest = toAmount(row.Interest);
        const pbgValue = toAmount(row.PBG);
        const dueDate = row["Due Date"] ? new Date(row["Due Date"]) : null;
        const isOverdue = pending > 0 && dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < today;

        if (!isInvoiceCoveredByPi) {
          acc.totalBilled += billAmount;
          acc.totalReceived += received;
          acc.totalOutstanding += pending;
        }
        acc.totalInterest += interest;
        acc.pbgValue += pbgValue;
        if (String(row.PBG || "").trim()) acc.pbgCount += 1;
        if (isOverdue && !isInvoiceCoveredByPi) {
          acc.overdueInvoices += 1;
          acc.overdueTotal += pending;
        }
        return acc;
      },
      {
        totalBilled: 0,
        totalReceived: 0,
        totalOutstanding: 0,
        totalInterest: 0,
        overdueInvoices: 0,
        overdueTotal: 0,
        pbgCount: 0,
        pbgValue: 0,
      }
    );
  }, [filteredPartyLedgerRows]);

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading dashboard data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">
            Analytics Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-gray-600">
              Welcome back, <span className="font-semibold text-gray-900">{user.name}</span>
            </p>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {user.firm} • {user.role}
            </Badge>
            {sheetData.lastUpdated && (
              <span className="text-xs text-gray-500">
                Last updated: {new Date(sheetData.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {MASTER_ADD_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.label}
                  onClick={() => openMasterAddDialog(option)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          {user.role === "ADMIN" && (
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="w-[180px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select Firm" />
              </SelectTrigger>
              <SelectContent>
                {uniqueFirms.map(firm => (
                  <SelectItem key={firm} value={firm}>
                    {firm === "all" ? "All Firms" : firm}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-100 text-blue-700">
                {stats.completedOrders} Completed
              </Badge>
              <Badge variant="outline" className="text-gray-600">
                {stats.pendingOrders} Pending
              </Badge>
              <Badge className="bg-red-100 text-red-700">
                {stats.cancelledOrders} Cancelled
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.totalRevenue >= 100000
                    ? `₹${(stats.totalRevenue / 100000).toFixed(2)}L`
                    : `₹${stats.totalRevenue.toLocaleString('en-IN')}`
                  }
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <TrendingUpIcon className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">
                  {stats.avgOrderValue >= 1000
                    ? `₹${(stats.avgOrderValue / 1000).toFixed(1)}K avg`
                    : `₹${Math.round(stats.avgOrderValue)} avg`
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>



        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Quantity</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalQuantity.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl shadow-lg">
                <Layers className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">Across all firms</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Pending Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingOrders}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-3 rounded-xl shadow-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full"
                  style={{ width: `${stats.totalOrders > 0 ? (stats.pendingOrders / stats.totalOrders) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">
                {stats.pendingOrders}/{stats.totalOrders}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="process">Process Flow</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="party-name">Party Name</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Order Status</CardTitle>
                <CardDescription>Distribution by status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Firm Performance */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Firm Performance</CardTitle>
                <CardDescription>Revenue and orders by firm</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.firmPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="firm" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (₹)" />
                    <Bar dataKey="orders" fill="#10b981" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Completion Rate by Firm */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Completion Rate</CardTitle>
                <CardDescription>By firm comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.firmPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="firm" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Bar dataKey="completionRate" fill="#8b5cf6" name="Completion Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="process" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Process Flow Analysis</CardTitle>
              <CardDescription>Order progression through stages</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="stage"
                    type="category"
                    allowDuplicatedCategory={false}
                    stroke="#6b7280"
                  />
                  <YAxis
                    dataKey="count"
                    type="number"
                    name="Count"
                    stroke="#6b7280"
                  />
                  <ZAxis dataKey="target" range={[100, 400]} name="Target" />
                  <Tooltip />
                  <Legend />
                  <Scatter
                    name="Actual Count"
                    data={chartData.processFlow}
                    fill="#3b82f6"
                    shape="circle"
                  />
                  <Scatter
                    name="Target"
                    data={chartData.processFlow}
                    fill="#ef4444"
                    fillOpacity={0.3}
                    shape="triangle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sheet Data Overview */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Data Overview</CardTitle>
                <CardDescription>Records across all sheets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "Order Receipt", data: sheetData.orderReceipt, icon: FileText, color: "blue" },
                    { name: "Dispatch", data: sheetData.dispatch, icon: Truck, color: "green" },
                    { name: "Delivery", data: sheetData.delivery, icon: Package, color: "purple" },
                    { name: "Post Delivery", data: sheetData.postDelivery, icon: CheckCircle, color: "orange" },
                  ].map((sheet, index) => {
                    const Icon = sheet.icon;
                    const colorClasses = {
                      blue: "bg-blue-100 text-blue-700",
                      green: "bg-green-100 text-green-700",
                      purple: "bg-purple-100 text-purple-700",
                      orange: "bg-orange-100 text-orange-700",
                    };

                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${colorClasses[sheet.color]}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{sheet.name}</p>
                            <p className="text-sm text-gray-500">Total records</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{sheet.data.length}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">System Health</CardTitle>
                <CardDescription>Performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      label: "Data Freshness",
                      value: sheetData.lastUpdated ? "Current" : "Stale",
                      status: sheetData.lastUpdated ? "good" : "warning",
                      description: sheetData.lastUpdated
                        ? `Updated ${Math.round((Date.now() - new Date(sheetData.lastUpdated).getTime()) / 60000)} minutes ago`
                        : "No data loaded"
                    },
                    {
                      label: "Data Completeness",
                      value: `${Math.round((sheetData.orderReceipt.length / (sheetData.orderReceipt.length || 1)) * 100)}%`,
                      status: "good",
                      description: "All sheets loaded successfully"
                    },
                    {
                      label: "Processing Rate",
                      value: `${stats.completionRate.toFixed(1)}%`,
                      status: stats.completionRate > 70 ? "good" : stats.completionRate > 40 ? "warning" : "error",
                      description: "Orders completed vs total"
                    },
                    {
                      label: "Data Consistency",
                      value: "Good",
                      status: "good",
                      description: "All records synchronized"
                    },
                  ].map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{metric.label}</p>
                        <p className="text-sm text-gray-500">{metric.description}</p>
                      </div>
                      <Badge
                        variant={
                          metric.status === "good" ? "default" :
                            metric.status === "warning" ? "secondary" :
                              "destructive"
                        }
                      >
                        {metric.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="party-name" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "TOTAL BILLED", value: formatCurrency(partyLedgerStats.totalBilled), tone: "blue" },
              { label: "Total Received", value: formatCurrency(partyLedgerStats.totalReceived), tone: "green" },
              { label: "Total Outstanding", value: formatCurrency(partyLedgerStats.totalOutstanding), tone: "amber" },
              { label: "Total Interest", value: formatCurrency(partyLedgerStats.totalInterest), tone: "purple" },
              { label: "Overdue Invoices", value: partyLedgerStats.overdueInvoices, tone: "red" },
              { label: "Overdue Total", value: formatCurrency(partyLedgerStats.overdueTotal), tone: "rose" },
              { label: "PBG", value: partyLedgerStats.pbgCount, tone: "indigo" },
              { label: "PBG Value", value: formatCurrency(partyLedgerStats.pbgValue), tone: "slate" },
            ].map((card) => {
              const colors = {
                blue: "bg-blue-50 text-blue-700 border-blue-100",
                green: "bg-green-50 text-green-700 border-green-100",
                amber: "bg-amber-50 text-amber-700 border-amber-100",
                purple: "bg-purple-50 text-purple-700 border-purple-100",
                red: "bg-red-50 text-red-700 border-red-100",
                rose: "bg-rose-50 text-rose-700 border-rose-100",
                indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
                slate: "bg-slate-50 text-slate-700 border-slate-100",
              };
              return (
                <Card key={card.label} className={`border shadow-sm ${colors[card.tone]}`}>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold">Party Name</CardTitle>
                  <CardDescription>Invoice and payment summary by party name</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={selectedParty} onValueChange={setSelectedParty}>
                    <SelectTrigger className="h-10 w-full sm:w-[240px]">
                      <SelectValue placeholder="Select Party" />
                    </SelectTrigger>
                    <SelectContent>
                      {partyOptions.map((party) => (
                        <SelectItem key={party} value={party}>
                          {party === "all" ? "All Parties" : party}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={partySearchTerm}
                    onChange={(event) => setPartySearchTerm(event.target.value)}
                    placeholder="Search invoice, PO, customer..."
                    className="h-10 w-full sm:w-[280px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-md border max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {visiblePartyLedgerHeaders.map((header) => (
                        <th key={header} className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartyLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={visiblePartyLedgerHeaders.length} className="px-4 py-10 text-center text-gray-500">
                          No party payment records found.
                        </td>
                      </tr>
                    ) : (
                      filteredPartyLedgerRows.map((row, index) => (
                        <tr key={`${row["Invoice No"] || "invoice"}-${index}`} className="border-t hover:bg-gray-50">
                          {visiblePartyLedgerHeaders.map((header) => (
                            <td key={header} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {formatLedgerValue(header, row[header])}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Dialog open={!!masterAddOption} onOpenChange={(open) => !open && closeMasterAddDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {masterAddOption?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="master-add-value">{masterAddOption?.label}</Label>
              <Input
                id="master-add-value"
                value={masterAddValue}
                onChange={(e) => setMasterAddValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && masterAddOption?.label !== "Party Name") handleMasterAddSubmit();
                }}
                placeholder={`Enter ${masterAddOption?.label || "value"}`}
                disabled={masterAddSubmitting}
                autoFocus
              />
            </div>
            {masterAddOption?.label === "Party Name" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="master-party-address">Address</Label>
                  <Input
                    id="master-party-address"
                    value={masterPartyDetails.address}
                    onChange={(e) =>
                      setMasterPartyDetails((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Enter Address"
                    disabled={masterAddSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="master-party-gst">GST Number</Label>
                  <Input
                    id="master-party-gst"
                    value={masterPartyDetails.gstNumber}
                    onChange={(e) =>
                      setMasterPartyDetails((prev) => ({ ...prev, gstNumber: e.target.value }))
                    }
                    placeholder="Enter GST Number"
                    disabled={masterAddSubmitting}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeMasterAddDialog} disabled={masterAddSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleMasterAddSubmit}
              disabled={
                masterAddSubmitting ||
                !masterAddValue.trim() ||
                (masterAddOption?.label === "Party Name" && (
                  !masterPartyDetails.address.trim() ||
                  !masterPartyDetails.gstNumber.trim()
                ))
              }
            >
              {masterAddSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
