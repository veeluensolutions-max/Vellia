const fs = require('fs');
const storeJs = fs.readFileSync('js/store.js', 'utf8');
const urlMatch = storeJs.match(/const SUPABASE_URL = "(.*?)"/);
const keyMatch = storeJs.match(/const SUPABASE_KEY = "(.*?)"/);

if (urlMatch && keyMatch) {
  fetch(urlMatch[1] + '/rest/v1/comercial_leads?select=id,workspace&limit=1', {
    headers: { 'apikey': keyMatch[1], 'Authorization': 'Bearer ' + keyMatch[1] }
  }).then(r => r.json()).then(data => console.log('Response:', data)).catch(e => console.error(e));
} else {
  console.log('Keys not found');
}
