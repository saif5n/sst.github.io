const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ success: false, message: 'Missing uid query parameter' });

  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0';

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Keep the connection alive by sending a comment
  res.write(': connected\n\n');

  let stopped = false;
  let lastPayload = null;

  req.on('close', () => {
    stopped = true;
    try { res.end(); } catch (e) {}
  });

  const cache = require('./sheets-cache');

  async function fetchAssignedForUid() {
    // Use cached UIDs and URLs to reduce read traffic
    const users = await (async () => {
      const ids = await cache.batchGetCached(sheets, spreadsheetId, ['UIDs!A2:B'], 5 * 60 * 1000);
      return ids.data.valueRanges?.[0]?.values || [];
    })();

    const userRow = users.find(row => String(row[1]).trim() === String(uid).trim());
    if (!userRow) {
      return { error: 'UID not found' };
    }

    const userName = userRow[0];

    const urlsRange = await cache.batchGetCached(sheets, spreadsheetId, ['URLs!A2:E'], 30 * 1000);
    const rows = urlsRange.data.valueRanges?.[0]?.values || [];

    const assignedVideos = rows
      .map((row, index) => ({
        id: index + 2,
        assignedTo: row[0],
        url: row[1],
        duration: row[2] || '',
        platform: row[3] || '',
        status: row[4] || ''
      }))
      .filter(r => r.assignedTo === userName && r.status !== 'Reviewed' && r.status !== 'Skipped');

    return { assignedVideos };
  }

  // Send initial payload then poll
  try {
    const initial = await fetchAssignedForUid();
    if (initial.error) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: initial.error })}\n\n`);
    } else {
      lastPayload = JSON.stringify(initial.assignedVideos || []);
      res.write(`event: update\ndata: ${JSON.stringify({ assignedVideos: initial.assignedVideos || [] })}\n\n`);
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
  }

  const interval = setInterval(async () => {
    if (stopped) return clearInterval(interval);
    try {
      const result = await fetchAssignedForUid();
      if (result.error) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: result.error })}\n\n`);
        return;
      }

      const payload = JSON.stringify(result.assignedVideos || []);
      if (payload !== lastPayload) {
        lastPayload = payload;
        res.write(`event: update\ndata: ${JSON.stringify({ assignedVideos: result.assignedVideos || [] })}\n\n`);
      }
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  }, 30000);
};
