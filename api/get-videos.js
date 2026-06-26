const { google } = require('googleapis');

export default async function handler(req, res) {
  // Ensure it only accepts POST requests
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { uid } = req.body;
  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0'; 
  
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // STEP 1: Look up the Name associated with this UID
    const uidResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'UIDs!A2:B', 
    });

    const users = uidResponse.data.values || [];
    // Convert both to strings to ensure a safe comparison
    const userRow = users.find(row => String(row[1]).trim() === String(uid).trim());

    if (!userRow) {
      return res.status(404).json({ success: false, message: "UID not found in the database." });
    }

    const userName = userRow[0]; // Gets the name (e.g., "Faysal")

    // STEP 2: Fetch URLs assigned to this Name
    const urlResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'URLs!A2:E', 
    });

    const rows = urlResponse.data.values || [];
    
    // Filter for rows assigned to the Name where status is not "Reviewed" or "Skipped"
    const assignedVideos = rows
      .map((row, index) => ({ 
          id: index + 2, 
          assignedTo: row[0], // Column A (Index 0): Name
          url: row[1],        // Column B (Index 1): URL
          platform: row[3],   // Column D (Index 3): Platform
          status: row[4]      // Column E (Index 4): Status
      }))
      .filter(row => row.assignedTo === userName && row.status !== 'Reviewed' && row.status !== 'Skipped');

    return res.status(200).json({ success: true, assignedVideos });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}