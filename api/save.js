const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const { rowId, judgement, notes } = req.body; 

    if (!rowId) throw new Error("Missing rowId in request");

    console.log(`Attempting to update row ${rowId} with ${judgement}`);

    await sheets.spreadsheets.values.update({
      spreadsheetId: '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0',
      range: `URLs!D${rowId}:F${rowId}`, // VERIFY THIS RANGE! (See below)
      valueInputOption: 'USER_ENTERED',
      requestBody: { 
        values: [[judgement, notes]] 
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Critical Save Error:", error);
    // Return the actual error to the frontend so you can see it
    return res.status(500).json({ success: false, message: error.message });
  }
}