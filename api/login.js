const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  
  const { uid, password } = req.body;
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Replace this with your actual Google Sheet ID
  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0'; 

  try {
    // 1. Fetch all data from the UIDs sheet (Columns A through F)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'UIDs!A:F', 
    });
    
    const rows = response.data.values || [];
    
    // 2. Validate the user
    // Column B (row[1]) is UID, Column C (row[2]) is Password
    const validUserRow = rows.find(row => row[1] === String(uid) && row[2] === String(password));

    if (!validUserRow) {
      return res.status(401).json({ success: false, message: 'Invalid UID or Password.' });
    }

    // Assuming Column A (row[0]) is the Username
    const username = validUserRow[0];

    // 3. Gather all videos assigned to this user from the exact same sheet
    // ASSUMPTION: Column D (row[3]) is the Video URL, Column E (row[4]) is the Platform
    const assignedVideos = rows
      .filter(row => row[1] === String(uid)) // Find all rows belonging to this UID
      .filter(row => row[3])                 // Ensure the row actually contains a URL
      .map(row => ({ 
        url: row[3], 
        platform: row[4] || "Unknown"        // Fallback in case platform column is blank
      }));

    // 4. Send the data back to script.js
    return res.status(200).json({
      success: true,
      username: username,
      assignedVideos: assignedVideos
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Database read error.' });
  }
}