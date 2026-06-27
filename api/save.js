const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  
  const { rowId, username, url, platform, judgement, notes, duration: clientDuration } = req.body;
  const spreadsheetId = '170I3V2-Hl1KwTrnvIKtlpkxZeMvg8xXYKK2HjJtnnY0'; 
  
  const sheets = google.sheets({ version: 'v4', auth });
  const isSkipped = (judgement === 'Skipped');

  try {
    // Consolidate reads to reduce quota usage.
    const ranges = [];
    if (!clientDuration) ranges.push(`URLs!C${rowId}`);
    if (isSkipped) {
      ranges.push('Submissions!B:C');
    } else {
      ranges.push('Submissions!H:H');
    }

    const batchResponse = ranges.length > 0
      ? await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges, majorDimension: 'ROWS' })
      : { data: { valueRanges: [] } };

    const urlDurationValues = clientDuration
      ? [[clientDuration]]
      : batchResponse.data.valueRanges?.[0]?.values || [];
    const duration = String(urlDurationValues[0]?.[0] || '').trim();
    const submissionLookupRows = batchResponse.data.valueRanges?.[ranges.length > 1 ? 1 : 0]?.values || [];

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

    // STEP 3: APPEND/UPDATE Submissions sheet (Only if NOT skipped)
    if (!isSkipped) {
      const idRows = submissionLookupRows;
      let existingRowIndex = -1;
      for (let i = 0; i < idRows.length; i++) {
        if (String(idRows[i][0] || '') === String(rowId)) {
          existingRowIndex = i + 1; // 1-based row index
          break;
        }
      }

      const newRow = [[
        new Date().toLocaleString(),
        username,
        url,
        duration,
        platform,
        judgement,
        notes,
        rowId
      ]];

      if (existingRowIndex > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Submissions!A${existingRowIndex}:H${existingRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: newRow }
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Submissions!A:H',
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: newRow }
        });
      }
    }

    // If the user skipped this video, clear any existing matching submission row.
    if (isSkipped) {
      let existingRowIndex = -1;
      for (let i = 0; i < submissionLookupRows.length; i++) {
        const nameCell = String(submissionLookupRows[i][0] || '').trim();
        const linkCell = String(submissionLookupRows[i][1] || '').trim();
        if (nameCell === String(username).trim() && linkCell === String(url).trim()) {
          existingRowIndex = i + 1; // 1-based
          break;
        }
      }

      if (existingRowIndex > 0) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `Submissions!A${existingRowIndex}:H${existingRowIndex}`
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Critical Save Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}