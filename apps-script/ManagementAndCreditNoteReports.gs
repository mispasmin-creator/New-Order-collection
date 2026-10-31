// ---------------------------------------------------------------------------
// Paste this at the END of your script, replacing the cut-off
// "// Replicates ManagementApprovalPage.jsx's own Pending/Actioned numbers..."
// comment block (that comment had no function after it).
// Uses fetchTable, writeSimpleSheet, toDate, delayInDays from the main script.
// ---------------------------------------------------------------------------

// Firm lookup for "Material Return" rows (no po_id column): DO Number + Party
// Name first, then DO Number alone only if that DO belongs to a single firm.
// Same as ManagementApprovalPage.jsx / DebitNotePage.jsx fetchData().
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

// Replicates ManagementApprovalPage.jsx fetchData(), one row per "Material
// Return" record:
//   Actioned: Actual5 filled OR "Management Status" filled
//   Pending:  not actioned AND "Time Stamp" filled
//   (rows with neither are ignored, same as the app)
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

// Replicates DebitNotePage.jsx (Credit Note page) fetchData(), one row per
// "Material Return" record:
//   Filter:  Actual5 IS NOT NULL (management-approved first)
//   Issued:  "Debit Note Issued At" filled
//   Pending: "Debit Note Issued At" blank
// Planned = Actual5, Actual = Debit Note Issued At (same as the Debit Note
// step in the main Delay Report).
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

  // Fallback invoice number from DISPATCH (first row per DO wins, like the app).
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
