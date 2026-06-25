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
    const responseUIDs = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'UIDs!A:C' });
    const users = responseUIDs.data.values || [];
    const validUser = users.find(row => row[1] === String(uid) && row[2] === String(password));

    if (!validUser) return res.status(401).json({ success: false, message: 'Invalid UID or Password.' });

    const userName = validUser[0]; // Name from UIDs Col A

    // Fetch Submissions
    const responseSubs = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Submissions!A:F' });
    const allSubs = responseSubs.data.values || [];

    // Filter for THIS user AND rows where Column E (index 4) is "Pending"
    // We add 'id: index + 1' so we know which row to update later
    const assignedVideos = allSubs
      .map((row, index) => ({ ...row, id: index + 1 })) 
      .filter(row => row[1] === userName && row[4] === "Pending") 
      .map(row => ({ 
        id: row.id,
        url: row[2], 
        platform: row[3] 
      }));

    return res.status(200).json({ success: true, username: userName, assignedVideos });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}