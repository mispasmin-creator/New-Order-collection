const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bjrlxqffkydasyjfqqdw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcmx4cWZma3lkYXN5amZxcWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0ODkxOTksImV4cCI6MjA5OTA2NTE5OX0.3sHuEPfWkhTjmV27T0namA-oTBxZuJEFWCkhjNM13SA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDispatch() {
  const doNumbers = ['DO-338'];
  
  const { data: dispatchData, error: dispatchError } = await supabase
    .from('DISPATCH')
    .select('*')
    .in('"Delivery Order No."', doNumbers);
    
  if (dispatchError) {
    console.error('Error fetching DISPATCH:', dispatchError);
  } else {
    console.log('--- DISPATCH ---');
    console.dir(dispatchData, { depth: null });
  }
}

checkDispatch();
