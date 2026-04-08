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
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: true,
    sameSite: "none", // Required for iframes and cross-site auth flows
    httpOnly: true,
  })
);

app.use(express.json());

// Session Debug Endpoint
app.get("/api/auth/debug", (req, res) => {
  res.json({
    hasSession: !!req.session,
    hasTokens: !!req.session?.tokens,
    cookieHeader: req.headers.cookie ? "Present" : "Missing",
    env: process.env.NODE_ENV,
    secure: req.secure,
    protocol: req.protocol,
    headers: req.headers
  });
});

// Helper to get OAuth2 client with current host and tokens
const getOAuth2Client = (req: express.Request, tokens?: any) => {
  // Determine redirect URI based on current host
  // Cloud Run and most proxies use x-forwarded-proto
  const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.get("host");
  
  // Force HTTPS if we're not on localhost to avoid mismatch
  const finalProtocol = host?.includes("localhost") ? protocol : "https";
  const redirectUri = `${finalProtocol}://${host}/auth/callback`;
  
  console.log(`Auth: Generated Redirect URI: ${redirectUri}`);
  console.log(`Auth: Headers - Proto: ${req.headers["x-forwarded-proto"]}, Host: ${req.headers["x-forwarded-host"]}`);
  
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  
  if (tokens) {
    client.setCredentials(tokens);
  }
  
  return client;
};

// Helper to get tokens from session or header
const getAuthTokens = (req: express.Request) => {
  if (req.session?.tokens) {
    console.log("Auth: Found tokens in session cookie");
    return req.session.tokens;
  }
  
  const tokenHeader = req.headers["x-zenith-tokens"];
  if (tokenHeader && typeof tokenHeader === "string") {
    try {
      const tokens = JSON.parse(Buffer.from(tokenHeader, 'base64').toString());
      console.log("Auth: Found tokens in x-zenith-tokens header");
      return tokens;
    } catch (e) {
      console.error("Auth: Failed to parse x-zenith-tokens header");
      return null;
    }
  }
  
  console.log("Auth: No tokens found in session or header. Cookies:", req.headers.cookie ? "Present" : "Missing");
  return null;
};

// Auth Routes
app.get("/api/auth/url", (req, res) => {
  const client = getOAuth2Client(req);
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
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
    const client = getOAuth2Client(req);
    const { tokens } = await client.getToken(code as string);
    // Essential token data
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    };
    
    req.session!.tokens = tokenData;
    
    // Base64 encode tokens for the client to store in localStorage as a backup
    const encodedTokens = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    
    console.log("Session saved for tokens:", !!req.session?.tokens);
    
    res.send(`
      <html>
        <body>
          <script>
            const tokenData = ${JSON.stringify(tokenData)};
            const encodedTokens = "${encodedTokens}";
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                tokens: tokenData,
                encodedTokens: encodedTokens
              }, '*');
              setTimeout(() => window.close(), 500);
            } else {
              localStorage.setItem('zenith_tokens', encodedTokens);
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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  
  const tokens = getAuthTokens(req);
  const isAuthenticated = !!tokens;
  
  console.log("Auth Status Check - Authenticated:", isAuthenticated);
  
  res.json({ 
    isAuthenticated,
    timestamp: Date.now(),
    debug: {
      hasSession: !!req.session,
      hasTokens: !!req.session?.tokens,
      hasHeader: !!req.headers["x-zenith-tokens"],
      cookie: req.headers.cookie ? "Present" : "Missing",
      sessionKeys: Object.keys(req.session || {}),
      nodeEnv: process.env.NODE_ENV,
      secure: req.secure,
      protocol: req.protocol,
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers["user-agent"],
      host: req.headers.host,
      ip: req.ip,
      ips: req.ips,
      xhr: req.xhr,
      cookies: req.cookies,
      signedCookies: req.signedCookies,
      sessionOptions: (req as any).sessionOptions,
      isIframe: req.headers["sec-fetch-dest"] === "iframe",
      secFetchSite: req.headers["sec-fetch-site"],
      secFetchMode: req.headers["sec-fetch-mode"],
      secFetchUser: req.headers["sec-fetch-user"],
      accept: req.headers.accept,
      acceptEncoding: req.headers["accept-encoding"],
      acceptLanguage: req.headers["accept-language"],
      connection: req.headers.connection,
      cacheControl: req.headers["cache-control"],
      pragma: req.headers.pragma,
      upgradeInsecureRequests: req.headers["upgrade-insecure-requests"],
      dnt: req.headers.dnt,
      secChUa: req.headers["sec-ch-ua"],
      secChUaMobile: req.headers["sec-ch-ua-mobile"],
      secChUaPlatform: req.headers["sec-ch-ua-platform"],
      secFetchDest: req.headers["sec-fetch-dest"],
      xForwardedFor: req.headers["x-forwarded-for"],
      xForwardedProto: req.headers["x-forwarded-proto"],
      xForwardedHost: req.headers["x-forwarded-host"],
      xRealIp: req.headers["x-real-ip"],
      xForwardedPort: req.headers["x-forwarded-port"],
      via: req.headers.via,
      xCloudTraceContext: req.headers["x-cloud-trace-context"],
      traceparent: req.headers.traceparent,
      purpose: req.headers.purpose,
      secFetchStorageAccess: req.headers["sec-fetch-storage-access"],
      priority: req.headers.priority,
      xRequestStart: req.headers["x-request-start"],
      xAppengineCity: req.headers["x-appengine-city"],
      xAppengineCitylatlong: req.headers["x-appengine-citylatlong"],
      xAppengineCountry: req.headers["x-appengine-country"],
      xAppengineRegion: req.headers["x-appengine-region"],
      xAppengineUserIp: req.headers["x-appengine-user-ip"],
      xAppengineHttps: req.headers["x-appengine-https"],
      xAppengineRequestLogId: req.headers["x-appengine-request-log-id"],
      xAppengineDefaultVersionHostname: req.headers["x-appengine-default-version-hostname"],
      xAppengineServerName: req.headers["x-appengine-server-name"],
      xAppengineVersion: req.headers["x-appengine-version"]
    }
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// Google Sheets Proxy API
app.get("/api/sheets/data", async (req, res) => {
  const tokens = getAuthTokens(req);
  if (!tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, range } = req.query;
  if (!spreadsheetId || !range) return res.status(400).json({ error: "Missing parameters" });

  try {
    const client = getOAuth2Client(req, tokens);
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId as string,
      range: range as string,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API error:", error);
    const status = typeof error.code === 'number' ? error.code : 500;
    res.status(status).json({ 
      error: error.message,
      code: error.code,
      details: error.errors
    });
  }
});

app.post("/api/sheets/append", async (req, res) => {
  const tokens = getAuthTokens(req);
  if (!tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, range, values } = req.body;
  if (!spreadsheetId || !range || !values) return res.status(400).json({ error: "Missing parameters" });

  try {
    const client = getOAuth2Client(req, tokens);
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API append error:", error);
    const status = typeof error.code === 'number' ? error.code : 500;
    res.status(status).json({ 
      error: error.message,
      code: error.code
    });
  }
});

app.post("/api/sheets/update", async (req, res) => {
  const tokens = getAuthTokens(req);
  if (!tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, range, values } = req.body;
  if (!spreadsheetId || !range || !values) return res.status(400).json({ error: "Missing parameters" });

  try {
    const client = getOAuth2Client(req, tokens);
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API update error:", error);
    const status = typeof error.code === 'number' ? error.code : 500;
    res.status(status).json({ 
      error: error.message,
      code: error.code
    });
  }
});

app.post("/api/sheets/delete-row", async (req, res) => {
  const tokens = getAuthTokens(req);
  if (!tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, sheetId, rowIndex } = req.body;
  if (!spreadsheetId || sheetId === undefined || rowIndex === undefined) return res.status(400).json({ error: "Missing parameters" });

  try {
    const client = getOAuth2Client(req, tokens);
    const sheets = google.sheets({ version: "v4", auth: client });
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
    const status = typeof error.code === 'number' ? error.code : 500;
    res.status(status).json({ 
      error: error.message,
      code: error.code
    });
  }
});

app.get("/api/sheets/metadata", async (req, res) => {
  const tokens = getAuthTokens(req);
  if (!tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId } = req.query;
  if (!spreadsheetId) return res.status(400).json({ error: "Missing parameters" });

  try {
    const client = getOAuth2Client(req, tokens);
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId as string,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API metadata error:", error);
    const status = typeof error.code === 'number' ? error.code : 500;
    res.status(status).json({ 
      error: error.message,
      code: error.code
    });
  }
});

app.post("/api/sheets/clear", async (req, res) => {
  const tokens = getAuthTokens(req);
  if (!tokens) return res.status(401).json({ error: "Unauthorized" });

  const { spreadsheetId, range } = req.body;
  if (!spreadsheetId || !range) return res.status(400).json({ error: "Missing parameters" });

  try {
    const client = getOAuth2Client(req, tokens);
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets API clear error:", error);
    const status = typeof error.code === 'number' ? error.code : 500;
    res.status(status).json({ 
      error: error.message,
      code: error.code
    });
  }
});

app.post("/api/sheets/create", async (req, res) => {
  const tokens = getAuthTokens(req);
  if (!tokens) return res.status(401).json({ error: "Unauthorized" });

  try {
    const client = getOAuth2Client(req, tokens);
    const drive = google.drive({ version: "v3", auth: client });
    
    // 1. Search for existing spreadsheet first
    const searchRes = await drive.files.list({
      q: "name = 'Zenith Finance Data' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      fields: "files(id, name)",
      pageSize: 1,
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      console.log("Found existing spreadsheet:", searchRes.data.files[0].id);
      return res.json({ spreadsheetId: searchRes.data.files[0].id, existing: true });
    }

    // 2. If not found, create a new one
    const sheets = google.sheets({ version: "v4", auth: client });
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
                      { userEnteredValue: { stringValue: "Owner" } },
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
                      { userEnteredValue: { stringValue: "InterestRate" } },
                      { userEnteredValue: { stringValue: "MinPayment" } },
                      { userEnteredValue: { stringValue: "Owner" } },
                      { userEnteredValue: { stringValue: "IsPrivate" } },
                      { userEnteredValue: { stringValue: "AssetValue" } },
                      { userEnteredValue: { stringValue: "CreditLimit" } },
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
          {
            properties: { title: "Goals" },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: "ID" } },
                      { userEnteredValue: { stringValue: "Name" } },
                      { userEnteredValue: { stringValue: "TargetAmount" } },
                      { userEnteredValue: { stringValue: "CurrentAmount" } },
                      { userEnteredValue: { stringValue: "Deadline" } },
                      { userEnteredValue: { stringValue: "Category" } },
                      { userEnteredValue: { stringValue: "Color" } },
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
    const status = typeof error.code === 'number' ? error.code : 500;
    res.status(status).json({ 
      error: error.message,
      code: error.code
    });
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

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global error handler caught:", err);
  const status = err.code || err.status || 500;
  res.status(status).json({
    error: err.message || "Internal Server Error",
    code: err.code || "INTERNAL_ERROR"
  });
});
