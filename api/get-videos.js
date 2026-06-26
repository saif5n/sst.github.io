const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export default async function handler(req, res) {
  const { uid } = req.body;
  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0'; 
  
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'URLs!A2:E', // Adjust to your range
    });

    const rows = response.data.values || [];
    // Filter for rows assigned to the UID where status is not "Reviewed" or "Skipped"
    const assignedVideos = rows
      .map((row, index) => ({ id: index + 2, url: row[0], platform: row[1], status: row[3], assignedTo: row[2] }))
      .filter(row => row.assignedTo === uid && row.status !== 'Reviewed' && row.status !== 'Skipped');

    return res.status(200).json({ success: true, assignedVideos });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}