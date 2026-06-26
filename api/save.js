const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  
  const { rowId, username, url, platform, judgement, notes } = req.body;
  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0'; 
  
  const sheets = google.sheets({ version: 'v4', auth });
  const isSkipped = (judgement === 'Skipped');

  try {
    // NEW STEP 1: Fetch the duration from Column C of the URLs sheet
    const durationResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `URLs!C${rowId}`
    });
    
    // Extract the duration value (fallback to an empty string if the cell is blank)
    const duration = durationResponse.data.values && durationResponse.data.values[0] 
        ? durationResponse.data.values[0][0] 
        : "";

    // STEP 2: UPDATE URLs sheet (Status is now Column E, Notes moved to Column F)
    if (isSkipped) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `URLs!E${rowId}:F${rowId}`, 
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Skipped', notes]] }, 
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `URLs!E${rowId}`, 
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Reviewed']] }, 
      });
    }

    // STEP 3: APPEND to Submissions sheet (Only if NOT skipped)
    if (!isSkipped) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Submissions!A:G', // Updated range to include up to Column G
        valueInputOption: 'USER_ENTERED',
        requestBody: { 
          values: [[
            new Date().toLocaleString(), // Column A
            username,                    // Column B
            url,                         // Column C
            duration,                    // Column D (New!)
            platform,                    // Column E (Shifted)
            judgement,                   // Column F (Shifted)
            notes                        // Column G (Shifted)
          ]] 
        },
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Critical Save Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}