import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import dotenv from "dotenv";

import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Trust proxy is required for secure cookies behind Cloud Run/Nginx
app.set("trust proxy", 1);

// Session configuration for cross-origin iframe
app.use(
  cookieSession({
    name: "zenith_session",
    keys: [process.env.SESSION_SECRET || "zenith-finance-secret"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: "none",
    httpOnly: true,
  })
);

app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/callback`
);

// Auth Routes
app.get("/api/auth/url", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
  });
  res.json({ url });
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    req.session!.tokens = tokens;
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/status", (req, res) => {
  res.json({ isAuthenticated: !!req.session?.tokens });
});

app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// Google Sheets Proxy API
app.get("/api/sheets/data", async (req, res) => {
  if (!req.session?.tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, range } = req.query;
  if (!spreadsheetId || !range) return res.status(400).json({ error: "Missing parameters" });

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId as string,
      range: range as string,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/append", async (req, res) => {
  if (!req.session?.tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, range, values } = req.body;
  if (!spreadsheetId || !range || !values) return res.status(400).json({ error: "Missing parameters" });

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API append error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/update", async (req, res) => {
  if (!req.session?.tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, range, values } = req.body;
  if (!spreadsheetId || !range || !values) return res.status(400).json({ error: "Missing parameters" });

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API update error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/delete-row", async (req, res) => {
  if (!req.session?.tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, sheetId, rowIndex } = req.body;
  if (!spreadsheetId || sheetId === undefined || rowIndex === undefined) return res.status(400).json({ error: "Missing parameters" });

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API delete error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/sheets/metadata", async (req, res) => {
  if (!req.session?.tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId } = req.query;
  if (!spreadsheetId) return res.status(400).json({ error: "Missing parameters" });

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId as string,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API metadata error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/create", async (req, res) => {
  if (!req.session?.tokens) return res.status(401).json({ error: "Unauthorized" });

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: "Zenith Finance Data" },
        sheets: [
          {
            properties: { title: "Transactions" },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: "ID" } },
                      { userEnteredValue: { stringValue: "Date" } },
                      { userEnteredValue: { stringValue: "Amount" } },
                      { userEnteredValue: { stringValue: "Category" } },
                      { userEnteredValue: { stringValue: "Description" } },
                      { userEnteredValue: { stringValue: "Type" } },
                      { userEnteredValue: { stringValue: "AccountID" } },
                      { userEnteredValue: { stringValue: "ToAccountID" } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            properties: { title: "Accounts" },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: "AccountID" } },
                      { userEnteredValue: { stringValue: "Name" } },
                      { userEnteredValue: { stringValue: "InitialBalance" } },
                      { userEnteredValue: { stringValue: "Type" } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            properties: { title: "Budgets" },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: "Category" } },
                      { userEnteredValue: { stringValue: "Amount" } },
                      { userEnteredValue: { stringValue: "Period" } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            properties: { title: "Recurring" },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: "ID" } },
                      { userEnteredValue: { stringValue: "Description" } },
                      { userEnteredValue: { stringValue: "Amount" } },
                      { userEnteredValue: { stringValue: "Category" } },
                      { userEnteredValue: { stringValue: "Type" } },
                      { userEnteredValue: { stringValue: "AccountID" } },
                      { userEnteredValue: { stringValue: "Frequency" } },
                      { userEnteredValue: { stringValue: "StartDate" } },
                      { userEnteredValue: { stringValue: "LastProcessedDate" } },
                      { userEnteredValue: { stringValue: "ToAccountID" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
const distPath = path.join(process.cwd(), "dist");
if (process.env.NODE_ENV === "production") {
  console.log("Serving from production dist folder");
  app.use(express.static(distPath, {
    maxAge: '1d',
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
    }
  }));
  app.get("*", (req, res) => {
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Production build not found. Please run npm run build.");
    }
  });
} else {
  console.log("Starting Vite in development mode");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
