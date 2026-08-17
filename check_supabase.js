const fs = require('fs');
const code = fs.readFileSync('./js/store.js', 'utf8');

const urlMatch = code.match(/SUPABASE_URL = "([^"]+)"/);
const keyMatch = code.match(/SUPABASE_KEY = "([^"]+)"/);

if (!urlMatch || !keyMatch) {
    console.log("Could not find Supabase URL or Key");
    process.exit(1);
}

const SUPABASE_URL = urlMatch[1];
const SUPABASE_KEY = keyMatch[1];

async function check() {
    try {
        const url = `${SUPABASE_URL}/rest/v1/isocinetica_calculations?select=*&limit=1`;
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            console.log(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log(text);
        } else {
            console.log("Table exists! Status: " + response.status);
            const data = await response.json();
            console.log("Data:", data);
        }
    } catch (e) {
        console.error(e);
    }
}
check();
