const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  
  const { rowId, username, url, platform, judgement, notes } = req.body;
  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0'; 
  
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 1. UPDATE URLs sheet (Mark as Reviewed/Skipped)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `URLs!D${rowId}`, // Column D is Status
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[judgement]] }, 
    });

    // 2. APPEND to Submissions sheet
    // Columns: Timestamp, Name, URL, Platform, Judgement, Notes
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Submissions!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: { 
        values: [[
          new Date().toISOString(), // Timestamp
          username, 
          url, 
          platform, 
          judgement, 
          notes
        ]] 
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Critical Save Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}