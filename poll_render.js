async function checkRender() {
  const url = 'https://college-special-attendance.onrender.com';
  const now = new Date().toISOString();
  try {
    const htmlRes = await fetch(`${url}/?_t=${Date.now()}`);
    const html = await htmlRes.text();
    const match = html.match(/src="([^"]+)"/);
    console.log(`[${now}] HTML Script:`, match ? match[1] : 'No script match');

    const syncRes = await fetch(`${url}/api/system/sync-status?_t=${Date.now()}`);
    const ct = syncRes.headers.get('content-type') || '';
    if (syncRes.status === 200 && ct.includes('json')) {
      const data = await syncRes.json();
      console.log(`[${now}] SUCCESS! /api/system/sync-status is LIVE:`, JSON.stringify(data));
      return true;
    } else {
      console.log(`[${now}] sync-status HTTP ${syncRes.status} (${ct})`);
      return false;
    }
  } catch (e) {
    console.log(`[${now}] Connection error (server might be restarting):`, e.message);
    return false;
  }
}

async function loop() {
  for (let i = 0; i < 40; i++) {
    const isLive = await checkRender();
    if (isLive) {
      console.log('NEW DEPLOYMENT CONFIRMED LIVE ON RENDER!');
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  process.exit(1);
}

loop();
