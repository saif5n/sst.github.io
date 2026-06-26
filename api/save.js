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

    // STEP 3: APPEND/UPDATE Submissions sheet (Only if NOT skipped)
    if (!isSkipped) {
      // Prefer updating an existing submission only when the stored rowId (Col H)
      // matches the current `rowId`. This prevents merging duplicate links
      // submitted for different source rows — duplicates will be recorded.
      const submissionsIdResp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Submissions!H:H'
      });

      const idRows = submissionsIdResp.data.values || [];
      let existingRowIndex = -1;
      for (let i = 0; i < idRows.length; i++) {
        if (String(idRows[i][0]) === String(rowId)) {
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
        // Insert a new row at the top (row 2) and write the submission there.
        try {
          const meta = await sheets.spreadsheets.get({ spreadsheetId });
          const submissionsSheet = meta.data.sheets.find(s => s.properties && s.properties.title === 'Submissions');
          if (submissionsSheet && submissionsSheet.properties && typeof submissionsSheet.properties.sheetId === 'number') {
            const sheetId = submissionsSheet.properties.sheetId;
            // Insert a blank row at index 1 (zero-based) which becomes row 2 in the UI
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    insertDimension: {
                      range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: 1,
                        endIndex: 2
                      },
                      inheritFromBefore: false
                    }
                  }
                ]
              }
            });

            // Write new data into the newly inserted row (A2:H2)
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `Submissions!A2:H2`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: newRow }
            });
          } else {
            // Fallback to append if sheetId unavailable
            await sheets.spreadsheets.values.append({
              spreadsheetId,
              range: 'Submissions!A:H',
              valueInputOption: 'USER_ENTERED',
              insertDataOption: 'INSERT_ROWS',
              requestBody: { values: newRow }
            });
          }
        } catch (err) {
          // fallback to append on any error
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Submissions!A:H',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: newRow }
          });
        }
      }
    }

    // If the user skipped this video, remove any existing submission row that matches
    if (isSkipped) {
      try {
        // Fetch name and link columns (B:C) from Submissions to try matching
        const submissionsResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Submissions!B:C'
        });

        const submissionRows = submissionsResponse.data.values || [];
        let existingRowIndex = -1;
        for (let i = 0; i < submissionRows.length; i++) {
          const nameCell = String(submissionRows[i][0] || "").trim(); // Column B
          const linkCell = String(submissionRows[i][1] || "").trim(); // Column C
          if (linkCell === String(url).trim() && nameCell === String(username).trim()) {
            existingRowIndex = i + 1; // 1-based
            break;
          }
        }

        if (existingRowIndex > 0) {
          // Need the sheetId for Submissions to delete the row via batchUpdate
          const meta = await sheets.spreadsheets.get({ spreadsheetId });
          const submissionsSheet = meta.data.sheets.find(s => s.properties && s.properties.title === 'Submissions');
          if (submissionsSheet && submissionsSheet.properties && typeof submissionsSheet.properties.sheetId === 'number') {
            const sheetId = submissionsSheet.properties.sheetId;
            const startIndex = existingRowIndex - 1; // zero-based inclusive
            const endIndex = startIndex + 1; // exclusive

            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    deleteDimension: {
                      range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: startIndex,
                        endIndex: endIndex
                      }
                    }
                  }
                ]
              }
            });
          } else {
            // Fallback: clear the values in the row if we cannot get sheetId
            await sheets.spreadsheets.values.clear({
              spreadsheetId,
              range: `Submissions!A${existingRowIndex}:H${existingRowIndex}`
            });
          }
        }
      } catch (delErr) {
        console.warn('Failed to delete matching submission row on skip:', delErr.message || delErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Critical Save Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}