const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bjrlxqffkydasyjfqqdw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcmx4cWZma3lkYXN5amZxcWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0ODkxOTksImV4cCI6MjA5OTA2NTE5OX0.3sHuEPfWkhTjmV27T0namA-oTBxZuJEFWCkhjNM13SA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPostDelivery() {
  const doNumbers = ['DO-330', 'DO-331', 'DO-298', 'DO-299', 'DO-295', '330', '331', '298', '299', '295'];
  
  // 1. Check POST DELIVERY table
  const { data: postDeliveryData, error: postDeliveryError } = await supabase
    .from('POST DELIVERY')
    .select('*')
    .in('"Order No."', doNumbers);
    
  if (postDeliveryError) {
    console.error('Error fetching POST DELIVERY:', postDeliveryError);
  } else {
    console.log('--- POST DELIVERY ---');
    if (postDeliveryData.length === 0) {
      console.log('No records found in POST DELIVERY for these DO numbers.');
    } else {
      console.log(`Found ${postDeliveryData.length} records in POST DELIVERY:`);
      postDeliveryData.forEach(row => console.log(`- DO: ${row['Order No.']} | ID: ${row.id}`));
    }
  }

  // 2. Check DELIVERY table
  const { data: deliveryData, error: deliveryError } = await supabase
    .from('DELIVERY')
    .select('*')
    .in('"Delivery Order No."', doNumbers);

  if (deliveryError) {
    console.error('Error fetching DELIVERY:', deliveryError);
  } else {
    console.log('\n--- DELIVERY ---');
    if (deliveryData.length === 0) {
      console.log('No records found in DELIVERY for these DO numbers.');
    } else {
      console.log(`Found ${deliveryData.length} records in DELIVERY:`);
      deliveryData.forEach(row => console.log(`- DO: ${row['Delivery Order No.']} | ID: ${row.id}`));
    }
  }
}

checkPostDelivery();
