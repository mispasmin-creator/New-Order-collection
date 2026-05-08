const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec";

export async function fetchUsersData() {
  try {
    const response = await fetch(`${SCRIPT_URL}?sheet=USER&timestamp=${Date.now()}`);
    if (!response.ok) throw new Error('Failed to fetch user data');
    const data = await response.json();
    
    if (!data.success) {
      console.error('Error fetching user data:', data.error);
      return [];
    }
    
    return transformUserData(data.data);
  } catch (error) {
    console.error('Error in fetchUsersData:', error);
    return [];
  }
}

function transformUserData(data) {
  if (!data || data.length < 2) return [];
  
  // Find header row
  let headerRowIndex = -1;
  let headers = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row && row.length > 0 && row.some(cell => 
      cell?.toString().toLowerCase().includes("username"))) {
      headerRowIndex = i;
      headers = row.map(h => h?.toString().trim() || "");
      break;
    }
  }
  
  if (headerRowIndex === -1) return [];
  
  const users = [];
  
  // Map column indices
  const indices = {
    username: headers.findIndex(h => h.toLowerCase().includes("username")),
    password: headers.findIndex(h => h.toLowerCase().includes("password")),
    name: headers.findIndex(h => h.toLowerCase().includes("name")),
    pageAccess: headers.findIndex(h => h.toLowerCase().includes("page access") || h.toLowerCase().includes("page acess")),
  };
  
  // Start from next row after headers
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    const getVal = (index) => index >= 0 && row[index] ? row[index].toString().trim() : "";
    
    const username = getVal(indices.username);
    const password = getVal(indices.password);
    const name = getVal(indices.name);
    const pageAccessStr = getVal(indices.pageAccess);
    
    // Skip empty rows
    if (!username || !password) continue;
    
    // Parse page access
    const pageAccess = pageAccessStr 
      ? pageAccessStr.split(',').map(page => page.trim()).filter(Boolean)
      : ['Dashboard']; // Default access
    
    // Determine role based on username or other logic
    const role = determineRole(username, pageAccess);
    
    // Determine firm based on name or username
    const firm = determineFirm(username, name);
    
    const user = {
      id: username.toLowerCase(),
      username: username,
      password: password,
      name: name || username,
      role: role,
      firm: firm,
      pageAccess: pageAccess,
      rawPageAccess: pageAccessStr
    };
    
    users.push(user);
  }
  
  return users;
}

function determineRole(username, pageAccess) {
  const usernameLower = username.toLowerCase();
  
  if (usernameLower === 'admin' || usernameLower.includes('master') || usernameLower.includes('admin')) {
    return 'master';
  }
  
  if (usernameLower === 'user' || pageAccess.length <= 6) {
    return 'user';
  }
  
  if (pageAccess.length > 6) {
    return 'admin';
  }
  
  return 'user';
}

function determineFirm(username, name) {
  const usernameLower = username.toLowerCase();
  const nameLower = (name || '').toLowerCase();
  
  // Extract firm from username or name
  if (usernameLower.includes('aaa') || nameLower.includes('aaa')) return 'AAA';
  if (usernameLower.includes('bbb') || nameLower.includes('bbb')) return 'BBB';
  if (usernameLower.includes('ccc') || nameLower.includes('ccc')) return 'CCC';
  if (usernameLower.includes('ddd') || nameLower.includes('ddd')) return 'DDD';
  
  // Check for other patterns in the provided data
  if (usernameLower === 'admin') return 'ALL';
  if (usernameLower === 'user') return 'AAA'; // Assuming default
  if (usernameLower === 'purchaser') return 'EA';
  if (usernameLower === 'account') return 'ALL';
  if (usernameLower === 'yuvi') return 'ALL';
  
  return 'ALL';
}