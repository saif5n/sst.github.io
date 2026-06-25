const { google } = require('googleapis');

// Vercel automatically grabs the secret you pasted in Step 1
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed.');
  
  const sheets = google.sheets({ version: 'v4', auth });
  const { username, url, judgement, notes } = req.body;

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0', // <--- Put your actual Sheet ID here!
      range: 'Submissions!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[new Date().toISOString(), username, url, 'Platform', judgement, notes]] },
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}