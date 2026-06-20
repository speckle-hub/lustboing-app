const https = require('https');
const fs = require('fs');

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status code:', res.statusCode);
        console.log('Location header:', res.headers.location);
        resolve(data);
      });
    }).on('error', reject);
  });
}

async function run() {
  const url = 'https://xhamster.com/videos/18540329';
  console.log('Fetching', url);
  const html = await fetchHTML(url);
  fs.writeFileSync('xhamster.html', html);
  console.log('Saved to xhamster.html');
}
run();
