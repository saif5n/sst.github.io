const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  
  const sheets = google.sheets({ version: 'v4', auth });
  const { rowId, judgement, notes } = req.body; 

  try {
    // Update Column E (Judgement) and Column F (Notes) for the specific Row ID
    await sheets.spreadsheets.values.update({
      spreadsheetId: '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0',
      range: `Submissions!E${rowId}:F${rowId}`, 
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[judgement, notes]] },
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}