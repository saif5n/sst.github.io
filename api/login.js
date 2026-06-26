const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const DEV_BYPASS = process.env.NODE_ENV === 'development';
  if (DEV_BYPASS) {
    req.session = req.session || {};
    req.session.user = {
      id: 'test-user',
      role: 'admin'
    };
    return res.status(200).json({ success: true, username: 'dev-user', assignedVideos: [] });
  }

  const { uid, password } = req.body;
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0'; 

  try {
    // 1. Fetch UIDs to identify the user name
    const uidsResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'UIDs!A:C' });
    const users = uidsResponse.data.values || [];
    
    // Added .trim() to ensure accidental whitespace doesn't break logins
    const validUser = users.find(row => 
        String(row[1]).trim() === String(uid).trim() && 
        String(row[2]).trim() === String(password).trim()
    );

    if (!validUser) return res.status(401).json({ success: false, message: 'Invalid UID or Password.' });

    const targetName = String(validUser[0]).trim(); // This is the Name from UIDs

    // 2. Fetch URLs sheet (Updated range to E to grab the status column)
    const urlsResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'URLs!A:E' });
    const allRows = urlsResponse.data.values || [];

    console.log("Looking for Name:", targetName);
    
    const assignedVideos = allRows
      .map((row, index) => ({ rowData: row, id: index + 1 }))
      .filter(item => {
          const row = item.rowData;
          const nameInSheet = String(row[0] || "").trim();
          const statusInSheet = String(row[4] || "").trim().toLowerCase(); // Column E
          return nameInSheet === targetName && statusInSheet === 'pending';
      })
      .map(item => ({
        id: item.id,
        url: item.rowData[1],        // Column B
        duration: item.rowData[2],   // Column C - ADD THIS
        platform: item.rowData[3]    // Column D
      }));

    return res.status(200).json({ success: true, username: targetName, assignedVideos });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}