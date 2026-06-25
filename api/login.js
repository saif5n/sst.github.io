const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { uid, password } = req.body;
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0'; 

  try {
    // 1. Fetch UIDs to identify the user name
    const uidsResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'UIDs!A:C' });
    const users = uidsResponse.data.values || [];
    const validUser = users.find(row => row[1] === String(uid) && row[2] === String(password));

    if (!validUser) return res.status(401).json({ success: false, message: 'Invalid UID or Password.' });

    const targetName = String(validUser[0]).trim(); // This is the Name from UIDs

    // 2. Fetch URLs sheet
    const urlsResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'URLs!A:D' });
    const allRows = urlsResponse.data.values || [];

    // DEBUGGING: Log to Vercel logs so you can see what the server is reading
    console.log("Looking for Name:", targetName);
    
    // 3. Filter the data
    const assignedVideos = allRows
      .map((row, index) => ({ rowData: row, id: index + 1 }))
      .filter(item => {
          const row = item.rowData;
          // Column A: Name (index 0)
          // Column B: URL (index 1)
          // Column C: Platform (index 2)
          // Column D: Status (index 3)
          const nameInSheet = String(row[0] || "").trim();
          const statusInSheet = String(row[3] || "").trim().toLowerCase();

          // DEBUGGING: Remove this console.log after you confirm it works
          // console.log(`Checking row: ${nameInSheet} | Status: ${statusInSheet}`);

          return nameInSheet === targetName && statusInSheet === 'pending';
      })
      .map(item => ({
        id: item.id,
        url: item.rowData[1], // Column B
        platform: item.rowData[2] // Column C
      }));

    return res.status(200).json({ success: true, username: targetName, assignedVideos });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}