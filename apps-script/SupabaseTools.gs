/**
 * Supabase Tools — Order to Collection pipeline reports (FULL SCRIPT)
 *
 * SETUP
 * 1. Extensions > Apps Script, paste this whole file (replace old code).
 * 2. Reload the sheet, then run "Supabase Tools > Set Supabase Credentials"
 *    and enter the Project URL + API key.
 * 3. Run any report from the "Supabase Tools" menu.
 *
 * NOTE: "Import All Tables (raw data)" calls importAllTables(), which lives
 * in a separate file (SupabaseFullImport.gs). Keep that file in the project
 * but do NOT add another onOpen() there — only one onOpen() may exist.
 *
 * Data notes (condensed from the original comments):
 * - Arrange Logistics / Logistics Approval / Dispatch Planning / Accounts
 *   Approval have no Planned/Actual columns of their own; dates come from
 *   created_at/updated_at of po_logistics_plans / po_logistics_splits and
 *   DISPATCH.Timestamp.
 * - Logistics Approval is gated on THIS order's ORDER RECEIPT.logistics_status
 *   (not the shared plan's status), and po_logistics_plans is resolved via
 *   po_logistics_splits.plan_id (ArrangeLogistics creates one shared plan per
 *   PO group with po_id = first product line only).
 * - Accounts Approval counts both "Accounts Approved" and "Logistic Completed".
 * - TC applies only when DISPATCH."TC Required" = "Yes"; Actual = DELIVERY.
 *   Timestamp matched via D-Sr Number + Delivery Order No.
 * - Retention Actual is counted only when po_retention_records.status = 'Paid'.
 * - Make PI: Actual = po_pi_records.created_at, no Planned.
 * - "DO-Delivery Order No." is only unique WITHIN a firm, so DISPATCH and
 *   po_logistics_splits are joined by po_id; Material Return / POST DELIVERY
 *   have no po_id and still join by DO text.
 */

const SHEET_NAME = 'Delay Report';
const PAGE_SIZE = 1000;

const TABLE_JOINS = {
  'DISPATCH': { byOrderId: true },
  'po_logistics_splits': { byOrderId: true },
  // Resolved through this order's split's plan_id, not a direct po_id match.
  'po_logistics_plans': {
    joinKey: (row) => row.id,
    joinValue: (order, tableIndex) => {
      const splitRow = tableIndex['po_logistics_splits'] && tableIndex['po_logistics_splits'][order.id];
      return splitRow ? splitRow.plan_id : null;
    },
  },
  'Material Return': { joinKey: (row) => row['D.O Number'], joinValue: (order) => order['DO-Delivery Order No.'] },
  'POST DELIVERY': { joinKey: (row) => row['Order No.'], joinValue: (order) => order['DO-Delivery Order No.'] },
  'po_pi_records': { joinKey: (row) => row.po_number, joinValue: (order) => order['PARTY PO NO (As Per Po Exact)'] },
  'po_retention_records': { joinKey: (row) => row.po_number, joinValue: (order) => order['PARTY PO NO (As Per Po Exact)'] },
  // Same key as TCPage.jsx's deliveryMap: D-Sr Number + Delivery Order No.
  'DELIVERY': {
    joinKey: (row) => row['D-Sr Number'] ? row['D-Sr Number'] + '|' + (row['Delivery Order No.'] || '') : null,
    joinValue: (order, tableIndex) => {
      const dispatchRow = tableIndex['DISPATCH'] && tableIndex['DISPATCH'][order.id];
      return dispatchRow && dispatchRow['D-Sr Number'] ? dispatchRow['D-Sr Number'] + '|' + (dispatchRow['Delivery Order No.'] || '') : null;
    },
  },
};

// plannedTable/plannedCol, actualTable/actualCol: where each date lives.
// plannedCondition(order, getRecord): false => step is "Not Applicable".
// actualCondition(record, plannedRecord, order): false => actual treated as unset.
// statusTable/statusCol: where the status text lives. fixedNote: literal status text.
const STEPS = [
  { label: 'Check PO', plannedTable: 'ORDER RECEIPT', plannedCol: 'Planned 1', actualTable: 'ORDER RECEIPT', actualCol: 'Actual 1' },
  { label: 'Check for Delivery', plannedTable: 'ORDER RECEIPT', plannedCol: 'Actual 2', actualTable: 'ORDER RECEIPT', actualCol: 'check_delivery_actual' },
  { label: 'Arrange Logistics', plannedTable: 'ORDER RECEIPT', plannedCol: 'check_delivery_actual', actualTable: 'po_logistics_plans', actualCol: 'created_at', statusTable: 'ORDER RECEIPT', statusCol: 'logistics_status' },
  { label: 'Logistics Approval', plannedTable: 'po_logistics_plans', plannedCol: 'created_at', actualTable: 'po_logistics_plans', actualCol: 'updated_at', actualCondition: (r, plannedRecord, order) => order && (order.logistics_status === 'Approved' || order.logistics_status === 'Logistics Rejected'), statusTable: 'ORDER RECEIPT', statusCol: 'logistics_status' },
  { label: 'Logistic', plannedTable: 'DISPATCH', plannedCol: 'Planned1', actualTable: 'DISPATCH', actualCol: 'Actual1' },
  { label: 'Load Material', plannedTable: 'DISPATCH', plannedCol: 'Planned2', actualTable: 'DISPATCH', actualCol: 'Actual2' },
  { label: 'Wetman Entry', plannedTable: 'DISPATCH', plannedCol: 'Planned3', actualTable: 'DISPATCH', actualCol: 'Actual3' },
  { label: 'TC', plannedTable: 'DISPATCH', plannedCol: 'Actual4', actualTable: 'DELIVERY', actualCol: 'Timestamp', statusTable: 'DISPATCH', statusCol: 'Trust Certificate Made', plannedCondition: (order, getRecord) => { const d = getRecord('DISPATCH', order); return d ? d['TC Required'] === 'Yes' : order['TC Required'] === 'Yes'; }, actualCondition: (deliveryRecord, dispatchRecord) => dispatchRecord && !!dispatchRecord['Trust Certificate Made'] },
  { label: 'Management Approval', plannedTable: 'Material Return', plannedCol: 'Time Stamp', actualTable: 'Material Return', actualCol: 'Actual5' },
  { label: 'Debit Note', plannedTable: 'Material Return', plannedCol: 'Actual5', actualTable: 'Material Return', actualCol: 'Debit Note Issued At' },
  { label: 'Return of Material', plannedTable: 'Material Return', plannedCol: 'Debit Note Issued At', actualTable: 'Material Return', actualCol: 'Return Dispatched At' },
  { label: 'Retention', plannedTable: 'POST DELIVERY', plannedCol: 'Bill Date', actualTable: 'po_retention_records', actualCol: 'updated_at', actualCondition: (r) => r.status === 'Paid', statusTable: 'po_retention_records', statusCol: 'status' },
  { label: 'Make PI', actualTable: 'po_pi_records', actualCol: 'created_at', statusTable: 'po_pi_records', statusCol: 'status' },
  { label: 'Received PI Payment', plannedTable: 'po_pi_records', plannedCol: 'due_date', actualTable: 'po_pi_records', actualCol: 'received_date', statusTable: 'po_pi_records', statusCol: 'status' },
  { label: 'Manage Users', fixedNote: 'Not applicable (user administration only)' },
  { label: 'Received Accounts', plannedTable: 'ORDER RECEIPT', plannedCol: 'Planned 2', actualTable: 'ORDER RECEIPT', actualCol: 'Actual 2' },
  { label: 'Dispatch Planning', plannedTable: 'po_logistics_plans', plannedCol: 'updated_at', actualTable: 'DISPATCH', actualCol: 'Timestamp', statusTable: 'po_logistics_splits', statusCol: 'status' },
  { label: 'Accounts Approval', plannedTable: 'DISPATCH', plannedCol: 'Timestamp', actualTable: 'po_logistics_splits', actualCol: 'updated_at', actualCondition: (r) => r.status === 'Accounts Approved' || r.status === 'Logistic Completed', statusTable: 'po_logistics_splits', statusCol: 'status' },
  { label: 'Invoice', plannedTable: 'DISPATCH', plannedCol: 'Planned4', actualTable: 'DISPATCH', actualCol: 'Actual4' },
  { label: 'Bilty Update', plannedTable: 'POST DELIVERY', plannedCol: 'Planned', actualTable: 'POST DELIVERY', actualCol: 'Actual' },
  { label: 'Fullkitting', plannedTable: 'DISPATCH', plannedCol: 'Actual4', actualTable: 'DISPATCH', actualCol: 'Fullkitting Actual' },
  { label: 'Material Return', plannedTable: 'Material Return', plannedCol: 'Planned', actualTable: 'Material Return', actualCol: 'Actual' },
];

// -----------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Supabase Tools')
    .addItem('Set Supabase Credentials', 'setSupabaseCredentials')
    .addItem('Generate Delay Report', 'generateDelayReport')
    .addItem('Import All Tables (raw data)', 'importAllTables')
    .addItem('Generate Dispatch Planning Report (Pending + History)', 'generateDispatchPlanningReport')
    .addItem('Generate Invoice Report (per DISPATCH row)', 'generateInvoiceReport')
    .addItem('Generate TC Report (per DISPATCH row)', 'generateTCReport')
    .addItem('Generate Bilty Update Report (Pending + Completed)', 'generateBiltyUpdateReport')
    .addItem('Generate Fullkitting Report (Pending + Completed)', 'generateFullkittingReport')
    .addItem('Generate Accounts Approval Report (Pending + History)', 'generateAccountsApprovalReport')
    .addItem('Generate Management Approval Report (Pending + Actioned)', 'generateManagementApprovalReport')
    .addItem('Generate Credit Note Report (Pending + Issued)', 'generateCreditNoteReport')
    .addItem('Generate Sale Form 3 Report (Pending + Approved + Rejected)', 'generateSaleForm3Report')
    .addToUi();
}

function setSupabaseCredentials() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const urlResp = ui.prompt('Supabase Project URL', 'Paste it in the box below, e.g. https://xxxxx.supabase.co', ui.ButtonSet.OK_CANCEL);
  if (urlResp.getSelectedButton() !== ui.Button.OK) return;
  const url = urlResp.getResponseText().trim().replace(/\/+$/, '');

  const keyResp = ui.prompt('Supabase API Key', 'Paste it in the box below (service_role key recommended)', ui.ButtonSet.OK_CANCEL);
  if (keyResp.getSelectedButton() !== ui.Button.OK) return;
  const key = keyResp.getResponseText().trim();

  props.setProperty('SUPABASE_URL', url);
  props.setProperty('SUPABASE_KEY', key);
  ui.alert('Supabase credentials saved.');
}

function generateDelayReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const neededTables = uniq(
    STEPS.map((s) => s.plannedTable)
      .concat(STEPS.map((s) => s.actualTable))
      .concat(STEPS.map((s) => s.statusTable))
      .filter(Boolean)
      .concat(['ORDER RECEIPT'])
  );
  const tables = {};
  neededTables.forEach((name) => { tables[name] = fetchTable(baseUrl, apiKey, name); });

  const orders = tables['ORDER RECEIPT'];

  const tableIndex = {};
  neededTables.forEach((name) => {
    if (name === 'ORDER RECEIPT') return;
    const join = TABLE_JOINS[name];
    tableIndex[name] = join.byOrderId
      ? indexLatestByKey(tables[name], (row) => row.po_id || null)
      : indexLatestByKey(tables[name], (row) => join.joinKey(row));
  });

  function getRecord(table, order) {
    if (!table) return null;
    if (table === 'ORDER RECEIPT') return order;
    const join = TABLE_JOINS[table];
    const key = join.byOrderId ? order.id : join.joinValue(order, tableIndex);
    return (key !== null && key !== undefined) ? (tableIndex[table][key] || null) : null;
  }

  const headers = ['DO Number', 'Party Name', 'Product Name', 'Firm Name'];
  STEPS.forEach((s) => headers.push(s.label + ' Planned', s.label + ' Actual', s.label + ' Delay (Days)', s.label + ' Work Status', s.label + ' Status'));
  headers.push('Dispatch Planning — dispatch_record_id (po_logistics_splits)');

  const rows = orders.map((order) => {
    const row = [order['DO-Delivery Order No.'], order['Party Names'], order['Product Name'], order['Firm Name']];

    STEPS.forEach((step) => {
      const notApplicable = step.plannedCondition && !step.plannedCondition(order, getRecord);

      const plannedRecord = notApplicable ? null : getRecord(step.plannedTable, order);
      const planned = plannedRecord && step.plannedCol ? plannedRecord[step.plannedCol] : null;

      const actualRecord = notApplicable ? null : getRecord(step.actualTable, order);
      let actual = actualRecord && step.actualCol ? actualRecord[step.actualCol] : null;
      if (actual && step.actualCondition && !step.actualCondition(actualRecord, plannedRecord, order)) actual = null;

      let workStatus;
      if (notApplicable) workStatus = 'Not Applicable';
      else if (actual) workStatus = 'Completed';
      else if (planned) workStatus = 'Pending';
      else workStatus = 'Not Started';

      let status = '';
      if (notApplicable) {
        status = 'N/A';
      } else if (step.fixedNote) {
        status = step.fixedNote;
      } else if (step.statusCol) {
        const statusRecord = getRecord(step.statusTable, order);
        status = (statusRecord && statusRecord[step.statusCol]) || 'N/A';
      }

      row.push(toDate(planned), toDate(actual), delayInDays(planned, actual), workStatus, status);
    });

    const splitRecord = getRecord('po_logistics_splits', order);
    row.push(splitRecord ? splitRecord.dispatch_record_id || '' : '');

    return row;
  });

  writeReport(headers, rows, STEPS.length);
}

// Groups rows by keyFn(row) and keeps only the highest-id row per key.
function indexLatestByKey(rows, keyFn) {
  const byKey = {};
  rows.forEach((row) => {
    const key = keyFn(row);
    if (key === null || key === undefined) return;
    const existing = byKey[key];
    if (!existing || (row.id || 0) > (existing.id || 0)) byKey[key] = row;
  });
  return byKey;
}

function fetchTable(baseUrl, apiKey, table) {
  const results = [];
  let start = 0;
  let total = null;
  while (true) {
    const url = baseUrl + '/rest/v1/' + encodeURIComponent(table) + '?select=*';
    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        apikey: apiKey,
        Authorization: 'Bearer ' + apiKey,
        Range: start + '-' + (start + PAGE_SIZE - 1),
        Prefer: 'count=exact',
      },
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() >= 300) {
      throw new Error('Supabase fetch failed for "' + table + '": ' + resp.getContentText());
    }
    const page = JSON.parse(resp.getContentText());
    results.push.apply(results, page);

    // Keep paging by however many rows actually came back until Content-Range's total is reached.
    const headers = resp.getAllHeaders ? resp.getAllHeaders() : resp.getHeaders();
    const contentRange = headers['Content-Range'] || headers['content-range'];
    if (contentRange) {
      const match = /\/(\d+)$/.exec(contentRange);
      if (match) total = parseInt(match[1], 10);
    }

    if (page.length === 0) break;
    start += page.length;
    if (total !== null) {
      if (start >= total) break;
    } else if (page.length < PAGE_SIZE) {
      break;
    }
  }
  return results;
}

function toDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d;
}

function delayInDays(planned, actual) {
  if (!planned || !actual) return '';
  const p = new Date(planned);
  const a = new Date(actual);
  if (isNaN(p.getTime()) || isNaN(a.getTime())) return '';
  return Math.round(((a.getTime() - p.getTime()) / (1000 * 60 * 60 * 24)) * 100) / 100;
}

function uniq(arr) {
  return arr.filter((v, i) => arr.indexOf(v) === i);
}

function writeReport(headers, rows, stepCount) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) sheet.clear();
  else sheet = ss.insertSheet(SHEET_NAME);

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  // Each step occupies 5 columns: Planned, Actual, Delay (Days), Work Status, Status.
  const fixedCols = 4;
  const stride = 5;
  if (rows.length) {
    const rules = sheet.getConditionalFormatRules();
    for (let i = 0; i < stepCount; i++) {
      const plannedCol = fixedCols + i * stride + 1;
      const actualCol = plannedCol + 1;
      const delayCol = plannedCol + 2;
      const workStatusCol = plannedCol + 3;

      sheet.getRange(2, plannedCol, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm');
      sheet.getRange(2, actualCol, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm');
      sheet.getRange(2, delayCol, rows.length, 1).setNumberFormat('0.00');

      const delayRange = sheet.getRange(2, delayCol, rows.length, 1);
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#f4cccc').setRanges([delayRange]).build());
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground('#d9ead3').setRanges([delayRange]).build());

      const workStatusRange = sheet.getRange(2, workStatusCol, rows.length, 1);
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Completed').setBackground('#d9ead3').setRanges([workStatusRange]).build());
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Pending').setBackground('#fff2cc').setRanges([workStatusRange]).build());
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Not Started').setBackground('#f3f3f3').setRanges([workStatusRange]).build());
    }
    sheet.setConditionalFormatRules(rules);
  }

  SpreadsheetApp.getUi().alert('Delay Report generated: ' + rows.length + ' orders.');
}

// Replicates DispatchPlanningPage.jsx's Total Splits / Pending Dispatch / History.
function generateDispatchPlanningReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const splits = fetchTable(baseUrl, apiKey, 'po_logistics_splits');
  const dispatches = fetchTable(baseUrl, apiKey, 'DISPATCH');
  const plans = fetchTable(baseUrl, apiKey, 'po_logistics_plans');

  const orderById = {};
  orders.forEach((o) => { orderById[o.id] = o; });

  const planByPoId = {};
  plans.forEach((p) => {
    const existing = planByPoId[p.po_id];
    if (!existing || (p.id || 0) > (existing.id || 0)) planByPoId[p.po_id] = p;
  });
  function planningDateOf(poId) {
    const plan = planByPoId[poId];
    return plan ? plan.updated_at : null;
  }

  function pendingQtyOf(order) {
    const raw = order['Pending Qty'];
    if (raw !== null && raw !== undefined && raw !== '') return Math.max(0, Number(raw) || 0);
    return Math.max(0, (Number(order['Quantity']) || 0) - (Number(order['Delivered']) || 0));
  }

  const trackedStatuses = { Checked: true, Dispatched: true, 'Logistic Completed': true };
  const mergedSplits = splits
    .filter((s) => orderById[s.po_id] && trackedStatuses[s.status])
    .map((s) => {
      const order = orderById[s.po_id];
      return {
        source: 'split', splitId: s.id, poId: s.po_id,
        splitStatus: s.status, dispatchRecordId: s.dispatch_record_id || null,
        qty: Number(s.allocated_qty) || 0, transporterName: s.transporter_name || '',
        doNumber: order['DO-Delivery Order No.'] || '', poNumber: order['PARTY PO NO (As Per Po Exact)'] || '',
        partyName: order['Party Names'] || '', productName: order['Product Name'] || '', firmName: order['Firm Name'] || '',
      };
    });

  const checkedPoIds = {};
  mergedSplits.forEach((s) => { if (s.splitStatus === 'Checked' && !s.dispatchRecordId) checkedPoIds[s.poId] = true; });

  const dispatchedPoIds = {};
  dispatches.forEach((d) => { if (d.po_id) dispatchedPoIds[d.po_id] = true; });

  orders.forEach((order) => {
    const pendingQty = pendingQtyOf(order);
    const isEligible = order.logistics_status === 'Approved' || dispatchedPoIds[order.id];
    if (pendingQty > 0 && isEligible && !checkedPoIds[order.id]) {
      mergedSplits.push({
        source: 'synthetic', splitId: '', poId: order.id,
        splitStatus: 'Checked', dispatchRecordId: null,
        qty: pendingQty, transporterName: order['Type Of Transporting'] || '—',
        doNumber: order['DO-Delivery Order No.'] || '', poNumber: order['PARTY PO NO (As Per Po Exact)'] || '',
        partyName: order['Party Names'] || '', productName: order['Product Name'] || '', firmName: order['Firm Name'] || '',
      });
    }
  });

  const pendingRows = mergedSplits.filter((s) => s.splitStatus === 'Checked' && !s.dispatchRecordId);

  const combined = [];

  pendingRows.forEach((r) => {
    combined.push({
      doNumber: r.doNumber, poNumber: r.poNumber, partyName: r.partyName, productName: r.productName, firmName: r.firmName,
      transporterName: r.transporterName, qty: r.qty,
      planned: planningDateOf(r.poId), actual: null, status: r.splitStatus,
    });
  });

  dispatches.forEach((d) => {
    const order = d.po_id ? orderById[d.po_id] : null;
    if (!order) return;
    combined.push({
      doNumber: d['Delivery Order No.'] || order['DO-Delivery Order No.'] || '', poNumber: order['PARTY PO NO (As Per Po Exact)'] || '',
      partyName: d['Party Name'] || order['Party Names'] || '', productName: d['Product Name'] || order['Product Name'] || '', firmName: order['Firm Name'] || '',
      transporterName: d['Transporter Name'] || '', qty: d['Qty To Be Dispatched'] || '',
      planned: planningDateOf(d.po_id), actual: d['Timestamp'] || d['Date Of Dispatch'], status: 'Dispatched',
    });
  });

  orders.forEach((order) => {
    if (order.logistics_status !== 'Order Cancelled') return;
    combined.push({
      doNumber: order['DO-Delivery Order No.'] || '', poNumber: order['PARTY PO NO (As Per Po Exact)'] || '',
      partyName: order['Party Names'] || '', productName: order['Product Name'] || '', firmName: order['Firm Name'] || '',
      transporterName: '—', qty: pendingQtyOf(order),
      planned: planningDateOf(order.id), actual: order.order_cancelled_at, status: 'Order Cancelled',
    });
  });

  const historyCount = combined.length - pendingRows.length;

  writeSimpleSheet('Dispatch Planning',
    ['DO Number', 'PO Number', 'Party Name', 'Product Name', 'Firm Name', 'Transporter', 'Qty', 'Dispatch Planning Planned', 'Dispatch Planning Actual', 'Dispatch Planning Delay (Days)', 'Status'],
    combined.map((r) => [
      r.doNumber, r.poNumber, r.partyName, r.productName, r.firmName, r.transporterName, r.qty,
      toDate(r.planned), toDate(r.actual), delayInDays(r.planned, r.actual), r.status,
    ]),
    { delayCol: 10 }
  );

  SpreadsheetApp.getUi().alert(
    'Dispatch Planning (should match the app exactly):\n' +
    '  Total Splits: ' + mergedSplits.length + '\n' +
    '  Pending Dispatch (Actual blank): ' + pendingRows.length + '\n' +
    '  History (Actual filled): ' + historyCount
  );
}

// InvoicePage.jsx logic: one row per DISPATCH row with Planned4 set;
// Pending = Actual4 blank, Completed = Actual4 filled.
function generateInvoiceReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const dispatches = fetchTable(baseUrl, apiKey, 'DISPATCH');
  const orderById = {};
  orders.forEach((o) => { orderById[o.id] = o; });

  const rows = [];
  let pendingCount = 0;
  dispatches.forEach((d) => {
    if (!d.Planned4) return;
    const order = d.po_id ? orderById[d.po_id] : null;
    const isPending = !d.Actual4;
    if (isPending) pendingCount++;
    rows.push([
      d.id,
      d['Delivery Order No.'] || (order ? order['DO-Delivery Order No.'] : ''),
      order ? order['PARTY PO NO (As Per Po Exact)'] : '',
      d['Party Name'] || (order ? order['Party Names'] : ''),
      d['Product Name'] || (order ? order['Product Name'] : ''),
      order ? order['Firm Name'] : '',
      toDate(d.Planned4), toDate(d.Actual4), delayInDays(d.Planned4, d.Actual4),
      d['Bill Number'] || '', toDate(d['Bill Date']),
      isPending ? 'Pending' : 'Completed',
    ]);
  });

  writeSimpleSheet('Invoice',
    ['DISPATCH id', 'DO Number', 'PO Number', 'Party Name', 'Product Name', 'Firm Name', 'Invoice Planned', 'Invoice Actual', 'Invoice Delay (Days)', 'Bill Number', 'Bill Date', 'Status'],
    rows,
    { delayCol: 9 }
  );

  SpreadsheetApp.getUi().alert(
    'Invoice (per DISPATCH row):\n' +
    '  Total (Planned4 set): ' + rows.length + '\n' +
    '  Pending (Actual4 blank): ' + pendingCount + '\n' +
    '  Completed (Actual4 filled): ' + (rows.length - pendingCount)
  );
}

// TCPage.jsx fetchData() logic, one row per DISPATCH record:
// Actual4 set AND DISPATCH."TC Required" = 'Yes'; matched to DELIVERY by
// D-Sr Number + Delivery Order No.; Completed = DELIVERY exists AND
// "Trust Certificate Made" filled.
function generateTCReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const dispatches = fetchTable(baseUrl, apiKey, 'DISPATCH');
  const deliveries = fetchTable(baseUrl, apiKey, 'DELIVERY');

  const orderById = {};
  orders.forEach((o) => { orderById[o.id] = o; });

  const deliveryByKey = {};
  deliveries.forEach((d) => {
    if (!d['D-Sr Number']) return;
    deliveryByKey[d['D-Sr Number'] + '|' + (d['Delivery Order No.'] || '')] = d;
  });

  const rows = [];
  let pendingCount = 0;
  dispatches.forEach((d) => {
    if (!d.Actual4) return;
    if (d['TC Required'] !== 'Yes') return;
    const order = d.po_id ? orderById[d.po_id] : null;

    const deliveryRow = deliveryByKey[d['D-Sr Number'] + '|' + (d['Delivery Order No.'] || '')] || null;
    const isCompleted = !!deliveryRow && !!d['Trust Certificate Made'];
    if (!isCompleted) pendingCount++;

    const actualDate = isCompleted ? deliveryRow.Timestamp : null;

    rows.push([
      d.id, d['D-Sr Number'] || '', d['Bill Number'] || '',
      d['Delivery Order No.'] || (order ? order['DO-Delivery Order No.'] : '') || '',
      order ? order['PARTY PO NO (As Per Po Exact)'] || '' : '',
      d['Party Name'] || (order ? order['Party Names'] : '') || '',
      d['Product Name'] || (order ? order['Product Name'] : '') || '',
      order ? order['Firm Name'] || '' : '',
      toDate(d.Actual4), toDate(actualDate),
      delayInDays(d.Actual4, actualDate),
      d['Trust Certificate Made'] ? 'Uploaded' : 'Not uploaded',
      isCompleted ? 'Completed' : 'Pending',
    ]);
  });

  writeSimpleSheet('TC',
    ['DISPATCH id', 'D-Sr Number', 'Invoice No.', 'DO Number', 'PO Number', 'Party Name', 'Product Name', 'Firm Name', 'TC Planned (Invoice Actual4)', 'TC Actual (DELIVERY Timestamp)', 'TC Delay (Days)', 'Certificate File', 'Status'],
    rows,
    { delayCol: 11 }
  );

  SpreadsheetApp.getUi().alert(
    'TC (per DISPATCH row, matching the app):\n' +
    '  Total Entries: ' + rows.length + '\n' +
    '  Pending: ' + pendingCount + '\n' +
    '  Completed: ' + (rows.length - pendingCount)
  );
}

// UnifiedLogistics.jsx Bilty Update logic: deduplicated by Bill No.
// Filter: DELIVERY."Planned 3" set and Type Of Transporting not Ex-Factory.
function generateBiltyUpdateReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const deliveries = fetchTable(baseUrl, apiKey, 'DELIVERY');
  const postDeliveries = fetchTable(baseUrl, apiKey, 'POST DELIVERY');

  const firmByDoParty = {};
  const firmsByDo = {};
  orders.forEach((o) => {
    const doNo = (o['DO-Delivery Order No.'] || '').trim();
    if (!doNo) return;
    const party = (o['Party Names'] || '').trim().toLowerCase();
    const firm = o['Firm Name'] || '';
    if (party && firm) firmByDoParty[doNo + '|' + party] = firm;
    if (!firmsByDo[doNo]) firmsByDo[doNo] = {};
    if (firm) firmsByDo[doNo][firm] = true;
  });
  const firmByDoOnly = {};
  Object.keys(firmsByDo).forEach((doNo) => {
    const firms = Object.keys(firmsByDo[doNo]);
    if (firms.length === 1) firmByDoOnly[doNo] = firms[0];
  });
  function resolveFirm(doNo, partyName) {
    const cleanDo = (doNo || '').trim();
    const cleanParty = (partyName || '').trim().toLowerCase();
    if (cleanDo && cleanParty && firmByDoParty[cleanDo + '|' + cleanParty]) return firmByDoParty[cleanDo + '|' + cleanParty];
    return (cleanDo && firmByDoOnly[cleanDo]) || '';
  }

  const postByOrderNo = {};
  postDeliveries.forEach((pd) => {
    if (pd['Order No.'] && !postByOrderNo[pd['Order No.']]) postByOrderNo[pd['Order No.']] = pd;
  });
  const postByFirmBill = {};
  postDeliveries.forEach((pd) => {
    if (!pd['Bill No.']) return;
    const firm = pd['Order No.'] ? resolveFirm(pd['Order No.'], pd['Party Name'], '') : '';
    const key = firm + '::' + pd['Bill No.'];
    if (!postByFirmBill[key]) postByFirmBill[key] = pd;
  });

  const eligible = deliveries.filter((d) => {
    if (!d['Planned 3']) return false;
    const type = String(d['Type Of Transporting'] || '').toLowerCase().trim();
    return type !== 'ex-factory' && type !== 'ex factory';
  });

  const pendingGroups = {}, completedGroups = {};
  eligible.forEach((d) => {
    const firmName = resolveFirm(d['Delivery Order No.'], d['Party Name']);
    const billNo = d['Bill No.'] || '';
    const receipt = billNo ? postByFirmBill[firmName + '::' + billNo] : postByOrderNo[d['Delivery Order No.']];
    const isDone = !!(receipt && receipt['Actual']);
    const key = billNo || ('stray_' + d.id);
    const bucket = isDone ? completedGroups : pendingGroups;
    if (!bucket[key] || (d.id || 0) > (bucket[key].delivery.id || 0)) {
      bucket[key] = { delivery: d, receipt: isDone ? receipt : null, firmName };
    }
  });

  const rows = [];
  function pushGroup(key, group, isDone) {
    const d = group.delivery;
    rows.push([
      d.id, d['Delivery Order No.'] || '', d['Bill No.'] || '(no bill no. — stray)',
      d['Party Name'] || '', d['Product Name'] || '', group.firmName,
      d['Transporter Name'] || '', d['Type Of Transporting'] || '',
      toDate(d['Planned 3']), toDate(group.receipt ? group.receipt['Actual'] : null),
      delayInDays(d['Planned 3'], group.receipt ? group.receipt['Actual'] : null),
      isDone ? 'Completed' : 'Pending',
    ]);
  }
  Object.keys(pendingGroups).forEach((k) => pushGroup(k, pendingGroups[k], false));
  Object.keys(completedGroups).forEach((k) => pushGroup(k, completedGroups[k], true));

  writeSimpleSheet('Bilty Update',
    ['DELIVERY id', 'DO Number', 'Bill No.', 'Party Name', 'Product Name', 'Firm Name', 'Transporter', 'Transporter Type', 'Bilty Update Planned', 'Bilty Update Actual', 'Bilty Update Delay (Days)', 'Status'],
    rows,
    { delayCol: 11 }
  );

  SpreadsheetApp.getUi().alert(
    'Bilty Update (grouped by Bill No., matching the app\'s cards):\n' +
    '  Pending: ' + Object.keys(pendingGroups).length + '\n' +
    '  Completed: ' + Object.keys(completedGroups).length
  );
}

// FullkittingPage.jsx logic, one row per DISPATCH record with Actual4 set.
// Completed = "Fullkitting Actual" filled; Pending = blank AND ready
// (Ex-Factory: DELIVERY row exists; else DELIVERY.Actual3 filled).
// Matched by D-Sr Number only, exactly like the app.
function generateFullkittingReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const dispatches = fetchTable(baseUrl, apiKey, 'DISPATCH');
  const deliveries = fetchTable(baseUrl, apiKey, 'DELIVERY');

  const orderById = {};
  orders.forEach((o) => { orderById[o.id] = o; });

  const deliveryByDSr = {};
  deliveries.forEach((d) => {
    if (!d['D-Sr Number']) return;
    const existing = deliveryByDSr[d['D-Sr Number']];
    if (!existing) {
      deliveryByDSr[d['D-Sr Number']] = d;
      return;
    }
    const existingHasBilty = !!existing.Actual3;
    const currentHasBilty = !!d.Actual3;
    if (currentHasBilty && !existingHasBilty) {
      deliveryByDSr[d['D-Sr Number']] = d; // Bilty-done row always wins
    } else if (currentHasBilty === existingHasBilty && (d.id || 0) > (existing.id || 0)) {
      deliveryByDSr[d['D-Sr Number']] = d; // same Bilty status: keep latest id
    }
  });

  const rows = [];
  let pendingCount = 0;
  dispatches.forEach((d) => {
    if (!d.Actual4) return;
    const order = d.po_id ? orderById[d.po_id] : null;

    const type = String(d['Type Of Transporting  '] || d['Type Of Transporting'] || '').toLowerCase().trim();
    const deliveryRow = d['D-Sr Number'] ? deliveryByDSr[d['D-Sr Number']] : null;
    const isReady = (type === 'ex-factory' || type === 'ex factory') ? !!deliveryRow : !!(deliveryRow && deliveryRow.Actual3);

    const isCompleted = !!d['Fullkitting Actual'];
    if (!isCompleted && !isReady) return;
    if (!isCompleted) pendingCount++;

    rows.push([
      d.id, d['D-Sr Number'] || '',
      d['Delivery Order No.'] || (order ? order['DO-Delivery Order No.'] : ''), order ? order['PARTY PO NO (As Per Po Exact)'] : '',
      d['Party Name'] || (order ? order['Party Names'] : ''), d['Product Name'] || (order ? order['Product Name'] : ''), order ? order['Firm Name'] : '',
      d['Type Of Transporting'] || '', isReady ? 'Yes' : 'No',
      toDate(d.Actual4), toDate(d['Fullkitting Actual']), delayInDays(d.Actual4, d['Fullkitting Actual']),
      isCompleted ? 'Completed' : 'Pending',
    ]);
  });

  writeSimpleSheet('Fullkitting',
    ['DISPATCH id', 'D-Sr Number', 'DO Number', 'PO Number', 'Party Name', 'Product Name', 'Firm Name', 'Transporter Type', 'Ready For Fullkitting', 'Fullkitting Planned (Invoice Actual4)', 'Fullkitting Actual', 'Fullkitting Delay (Days)', 'Status'],
    rows,
    { delayCol: 12 }
  );

  SpreadsheetApp.getUi().alert(
    'Fullkitting (per DISPATCH row):\n' +
    '  Invoice History (Pending + Completed): ' + rows.length + '\n' +
    '  Pending: ' + pendingCount + '\n' +
    '  Completed: ' + (rows.length - pendingCount)
  );
}

// AccountsApprovalPage.jsx fetchData() logic, one row per po_logistics_splits
// record. Filter: status IN (Dispatched, Accounts Approved, Logistic Completed)
// with a matching ORDER RECEIPT. Pending = 'Dispatched'; the rest are History.
function generateAccountsApprovalReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const splits = fetchTable(baseUrl, apiKey, 'po_logistics_splits');
  const dispatches = fetchTable(baseUrl, apiKey, 'DISPATCH');

  const orderById = {};
  orders.forEach((o) => { orderById[o.id] = o; });

  const dispatchByPoId = {};
  dispatches.forEach((d) => {
    const existing = dispatchByPoId[d.po_id];
    if (!existing || (d.id || 0) > (existing.id || 0)) dispatchByPoId[d.po_id] = d;
  });

  const trackedStatuses = { Dispatched: true, 'Accounts Approved': true, 'Logistic Completed': true };
  const rows = [];
  let pendingCount = 0;
  splits.forEach((s) => {
    if (!trackedStatuses[s.status]) return;
    const order = orderById[s.po_id];
    if (!order) return;

    const isPending = s.status === 'Dispatched';
    if (isPending) pendingCount++;
    const dispatchRow = dispatchByPoId[s.po_id];
    const planned = dispatchRow ? dispatchRow.Timestamp : null;
    const actual = isPending ? null : s.updated_at;

    rows.push([
      s.id, s.po_id, order['DO-Delivery Order No.'] || '', order['PARTY PO NO (As Per Po Exact)'] || '',
      order['Party Names'] || '', order['Product Name'] || '', order['Firm Name'] || '',
      s.transporter_name || '', s.allocated_qty || '', s.payment_term_status || '', s.accounts_remarks || '',
      toDate(planned), toDate(actual), delayInDays(planned, actual),
      s.status, isPending ? 'Pending' : 'Completed',
    ]);
  });

  writeSimpleSheet('Accounts Approval',
    ['Split id', 'PO id', 'DO Number', 'PO Number', 'Party Name', 'Product Name', 'Firm Name', 'Transporter', 'Allocated Qty', 'Payment Term Status', 'Accounts Remarks', 'Accounts Approval Planned', 'Accounts Approval Actual', 'Accounts Approval Delay (Days)', 'Split Status', 'Status'],
    rows,
    { delayCol: 14 }
  );

  SpreadsheetApp.getUi().alert(
    'Accounts Approval (per po_logistics_splits row, matching the app\'s cards):\n' +
    '  Pending Approval (Dispatched): ' + pendingCount + '\n' +
    '  Approved (Accounts Approved + Logistic Completed): ' + (rows.length - pendingCount)
  );
}

function writeSimpleSheet(name, headers, rows, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (sheet) sheet.clear();
  else sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  if (options && options.delayCol && rows.length) {
    sheet.getRange(2, options.delayCol, rows.length, 1).setNumberFormat('0.00');
    const range = sheet.getRange(2, options.delayCol, rows.length, 1);
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#f4cccc').setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground('#d9ead3').setRanges([range]).build(),
    ]);
  }
}

// =======================================================================
// NEW: Management Approval + Credit Note reports
// =======================================================================

// Firm lookup for "Material Return" rows (no po_id column): DO Number + Party
// Name first, then DO Number alone only if that DO belongs to a single firm.
function buildMaterialReturnFirmResolver_(orders) {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const byDoParty = {};
  const firmsByDo = {};
  orders.forEach((o) => {
    const doNo = o['DO-Delivery Order No.'];
    if (!doNo) return;
    byDoParty[doNo + '|' + norm(o['Party Names'])] = o['Firm Name'];
    if (!firmsByDo[doNo]) firmsByDo[doNo] = {};
    firmsByDo[doNo][o['Firm Name']] = true;
  });
  const byDoOnly = {};
  Object.keys(firmsByDo).forEach((doNo) => {
    const firms = Object.keys(firmsByDo[doNo]);
    if (firms.length === 1) byDoOnly[doNo] = firms[0];
  });
  return function (doNo, partyName) {
    return byDoParty[doNo + '|' + norm(partyName)] || byDoOnly[doNo] || '';
  };
}

function isFilled_(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

// ManagementApprovalPage.jsx fetchData() logic, one row per "Material Return":
//   Actioned: Actual5 filled OR "Management Status" filled
//   Pending:  not actioned AND "Time Stamp" filled
function generateManagementApprovalReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const returns = fetchTable(baseUrl, apiKey, 'Material Return');
  const resolveFirm = buildMaterialReturnFirmResolver_(orders);

  const rows = [];
  let pendingCount = 0;
  returns.forEach((r) => {
    const isActioned = isFilled_(r['Actual5']) || isFilled_(r['Management Status']);
    const isPending = !isActioned && isFilled_(r['Time Stamp']);
    if (!isActioned && !isPending) return;
    if (isPending) pendingCount++;

    rows.push([
      r.id, r['Return No.'] || '', r['D.O Number'] || '', r['Party Name'] || '',
      r['Product Name'] || '', resolveFirm(r['D.O Number'], r['Party Name']),
      r['Qty Of Return Material'] || r['Qty'] || '', r['Reason Of Material Return'] || '',
      toDate(r['Time Stamp']), toDate(r['Actual5']), delayInDays(r['Time Stamp'], r['Actual5']),
      r['Management Status'] || '', r['Management Remarks'] || '',
      isPending ? 'Pending' : 'Actioned',
    ]);
  });

  writeSimpleSheet('Management Approval',
    ['Material Return id', 'Return No.', 'DO Number', 'Party Name', 'Product Name', 'Firm Name', 'Qty', 'Reason',
     'Management Approval Planned (Time Stamp)', 'Management Approval Actual (Actual5)', 'Management Approval Delay (Days)',
     'Management Status', 'Management Remarks', 'Status'],
    rows,
    { delayCol: 11 }
  );

  SpreadsheetApp.getUi().alert(
    'Management Approval (per Material Return row, matching the app):\n' +
    '  Pending Approval: ' + pendingCount + '\n' +
    '  Actioned: ' + (rows.length - pendingCount)
  );
}

// DebitNotePage.jsx (Credit Note page) fetchData() logic, one row per
// "Material Return" with Actual5 set:
//   Issued:  "Debit Note Issued At" filled; otherwise Pending.
function generateCreditNoteReport() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const returns = fetchTable(baseUrl, apiKey, 'Material Return');
  const dispatches = fetchTable(baseUrl, apiKey, 'DISPATCH');
  const resolveFirm = buildMaterialReturnFirmResolver_(orders);

  const billByDo = {};
  dispatches.forEach((d) => {
    const doNo = d['Delivery Order No.'];
    if (doNo && d['Bill Number'] && !billByDo[doNo]) billByDo[doNo] = d['Bill Number'];
  });

  const rows = [];
  let pendingCount = 0;
  returns.forEach((r) => {
    if (!isFilled_(r['Actual5'])) return;
    const isIssued = isFilled_(r['Debit Note Issued At']);
    if (!isIssued) pendingCount++;

    const invoiceNo = r['Invoice Number'] || r['Bill Number'] || r['Invoice No'] || billByDo[r['D.O Number']] || '';
    rows.push([
      r.id, r['Return No.'] || '', r['D.O Number'] || '', invoiceNo, r['Party Name'] || '',
      r['Product Name'] || '', resolveFirm(r['D.O Number'], r['Party Name']),
      r['Qty Of Return Material'] || r['Qty'] || '',
      r['Debit Note'] || '', r['Debit Note Number'] || '', r['Debit Note Amount'] || '',
      toDate(r['Actual5']), toDate(r['Debit Note Issued At']), delayInDays(r['Actual5'], r['Debit Note Issued At']),
      isIssued ? 'Issued' : 'Pending',
    ]);
  });

  writeSimpleSheet('Credit Note',
    ['Material Return id', 'Return No.', 'DO Number', 'Invoice No.', 'Party Name', 'Product Name', 'Firm Name', 'Qty',
     'Note Type', 'Note Number', 'Note Amount',
     'Credit Note Planned (Mgmt Approved Actual5)', 'Credit Note Actual (Issued At)', 'Credit Note Delay (Days)', 'Status'],
    rows,
    { delayCol: 14 }
  );

  SpreadsheetApp.getUi().alert(
    'Credit Note (per Material Return row, matching the app):\n' +
    '  Pending Note Issuance: ' + pendingCount + '\n' +
    '  Notes Issued: ' + (rows.length - pendingCount)
  );
}

// SaleForm3Page.jsx logic, one row per "SALE FORM 3" record whose DISPATCH row
// has Actual4 set. Status comes straight from SALE FORM 3."Status"
// (Pending / Approved / Rejected). Planned = SALE FORM 3."Planned",
// Actual = SALE FORM 3."Actual" (stays blank only while Pending).
function generateSaleForm3Report() {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');
  if (!baseUrl || !apiKey) {
    SpreadsheetApp.getUi().alert('Set Supabase credentials first (Supabase Tools > Set Supabase Credentials).');
    return;
  }

  const orders = fetchTable(baseUrl, apiKey, 'ORDER RECEIPT');
  const dispatches = fetchTable(baseUrl, apiKey, 'DISPATCH');
  const sf3 = fetchTable(baseUrl, apiKey, 'SALE FORM 3');

  const orderById = {};
  orders.forEach((o) => { orderById[o.id] = o; });
  const dispatchById = {};
  dispatches.forEach((d) => { if (d.Actual4) dispatchById[d.id] = d; });

  const counts = { Pending: 0, Approved: 0, Rejected: 0 };
  const rows = [];
  sf3.forEach((sf) => {
    const d = dispatchById[sf.dispatch_id];
    if (!d) return;
    const order = d.po_id ? orderById[d.po_id] : null;
    const status = sf['Status'] || 'Pending';
    counts[status] = (counts[status] || 0) + 1;
    const planned = sf['Planned'] || d.Actual4;
    const actual = status === 'Pending' ? null : sf['Actual'];
    rows.push([
      d.id, d['D-Sr Number'] || '',
      order ? order['PARTY PO NO (As Per Po Exact)'] || '' : '',
      d['Party Name'] || (order ? order['Party Names'] : '') || '',
      d['Delivery Order No.'] || (order ? order['DO-Delivery Order No.'] : '') || '',
      d['Product Name'] || (order ? order['Product Name'] : '') || '',
      order ? order['Firm Name'] || '' : '',
      d['Bill Number'] || '', toDate(d['Bill Date']),
      d['Qty To Be Dispatched'] || '', d['Actual Truck Qty'] || '', d['TC Required'] || 'No',
      toDate(planned), toDate(actual), delayInDays(planned, actual),
      sf['Remarks'] || '', sf['Action By'] || '', status,
    ]);
  });

  writeSimpleSheet('Sale Form 3',
    ['DISPATCH id', 'D-Sr Number', 'PO Number', 'Party Name', 'DO Number', 'Product Name', 'Firm Name', 'Invoice No.', 'Invoice Date',
     'Dispatch Qty', 'Truck Qty', 'TC Required', 'Sale Form 3 Planned', 'Sale Form 3 Actual', 'Sale Form 3 Delay (Days)',
     'Remarks', 'Action By', 'Status'],
    rows,
    { delayCol: 15 }
  );

  SpreadsheetApp.getUi().alert(
    'Sale Form 3 (matching the app):\n' +
    '  Pending: ' + counts.Pending + '\n' +
    '  Approved: ' + counts.Approved + '\n' +
    '  Rejected: ' + counts.Rejected
  );
}
