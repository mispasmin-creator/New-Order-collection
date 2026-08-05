const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://bjrlxqffkydasyjfqqdw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcmx4cWZma3lkYXN5amZxcWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0ODkxOTksImV4cCI6MjA5OTA2NTE5OX0.3sHuEPfWkhTjmV27T0namA-oTBxZuJEFWCkhjNM13SA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: order } = await supabase.from('ORDER RECEIPT').select('*').eq('id', 469).single();
  console.log('=== ORDER RECEIPT 469 ===');
  console.log({ id: order.id, product: order['Product Name'], qty: order.Quantity, delivered: order.Delivered, pendingQty: order['Pending Qty'] });

  const { data: plans } = await supabase.from('po_logistics_plans').select('*').eq('po_id', 469).order('created_at');
  console.log('\n=== ALL po_logistics_plans for po_id 469 ===');
  (plans || []).forEach(p => console.log({ id: p.id, status: p.status, created_by: p.created_by, created_at: p.created_at }));

  const { data: splits } = await supabase.from('po_logistics_splits').select('*').eq('po_id', 469).order('created_at');
  console.log('\n=== ALL po_logistics_splits for po_id 469 ===');
  (splits || []).forEach(s => console.log({
    id: s.id, plan_id: s.plan_id, status: s.status, allocated_qty: s.allocated_qty,
    dispatch_record_id: s.dispatch_record_id, lgst_sr_number: s.lgst_sr_number,
    transporter_name: s.transporter_name, created_at: s.created_at,
  }));

  const { data: dispatches } = await supabase.from('DISPATCH').select('*').eq('po_id', 469).order('Timestamp');
  console.log('\n=== ALL DISPATCH rows for po_id 469 ===');
  (dispatches || []).forEach(d => console.log({
    id: d.id, dSr: d['D-Sr Number'], qty: d['Qty To Be Dispatched'], billNo: d['Bill Number'],
    timestamp: d.Timestamp, dateOfDispatch: d['Date Of Dispatch'], logistics_split_id: d.logistics_split_id,
    Actual1: d.Actual1, Actual3: d.Actual3, Actual4: d.Actual4,
  }));

  const totalDispatched = (dispatches || []).reduce((s, d) => s + (parseFloat(d['Qty To Be Dispatched']) || 0), 0);
  console.log('\nSum of all DISPATCH qty for po 469:', totalDispatched, '| ORDER RECEIPT Delivered:', order.Delivered);

  // Broad search for bill number containing 327 anywhere (in case of combined strings like "327, 328")
  const { data: allDispatch } = await supabase.from('DISPATCH').select('id, "Bill Number", "D-Sr Number", "Product Name", "Party Name", po_id, "Qty To Be Dispatched", Timestamp').ilike('"Bill Number"', '%327%');
  console.log('\n=== ANY DISPATCH row with Bill Number containing "327" ===');
  (allDispatch || []).forEach(d => console.log(d));

  // Check for any LGST-Sr Number around that time frame across ALL products for po 469's transporter pattern
  const { data: lgstNear } = await supabase.from('DISPATCH').select('id, "D-Sr Number", "LGST-Sr Number", "Product Name", "Party Name", po_id, "Qty To Be Dispatched", Timestamp').gte('Timestamp', '2026-07-08').lte('Timestamp', '2026-07-11');
  console.log('\n=== ALL DISPATCH rows Timestamp 8-11 July 2026 (broad scan) ===');
  (lgstNear || []).forEach(d => console.log(d));
}
main();
