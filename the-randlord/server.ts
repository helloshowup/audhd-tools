import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { google } from "googleapis";
import { demoLedger } from "./demo-ledger";
import { PLAN_HEADERS } from "./src/lib/plan-csv";
import {
  validateSheetName,
  validateNoPanOrAccountNumbers,
  sanitiseRowValues,
  validateRowIndex
} from "./src/lib/guards";

// Load environment variables (.env.local, .env)
dotenv.config();
if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local", override: true });
}
const app = express();
const PORT = 3000;

app.use(express.json());

const isDemoMode = (req: express.Request) => {
  return process.env.RANDLORD_DEMO !== '0' && (!process.env.SPREADSHEET_ID || !req.headers.authorization);
};

const REPLICATE_BASE = "https://api.replicate.com/v1";

interface PredictionInput {
  prompt: string;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[] | string;
  error?: string | null;
}

function getReplicateToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set in environment");
  }
  return token;
}

async function runPrediction(model: string, input: PredictionInput): Promise<string> {
  const token = getReplicateToken();
  const res = await fetch(`${REPLICATE_BASE}/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=25",
      "Cancel-After": "180s",
    },
    body: JSON.stringify({ input }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Replicate API error ${res.status}: ${body.slice(0, 500)}`);
  }

  let prediction: Prediction = JSON.parse(body);

  const maxAttempts = 40;
  let attempts = 0;
  while ((prediction.status === "starting" || prediction.status === "processing") && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${REPLICATE_BASE}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pollRes.ok) {
      throw new Error(`Replicate poll error ${pollRes.status}`);
    }
    prediction = await pollRes.json();
    attempts++;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(prediction.error || `Prediction ended with status: ${prediction.status}`);
  }

  const output = prediction.output;
  return Array.isArray(output) ? output.join("") : (output || "");
}

function extractJsonArray(text: string): any[] {
  const trimmed = text.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(unfenced);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {}

  const start = unfenced.indexOf("[");
  const end = unfenced.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(unfenced.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  const objStart = unfenced.indexOf("{");
  const objEnd = unfenced.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    try {
      const parsed = JSON.parse(unfenced.slice(objStart, objEnd + 1));
      if (parsed && typeof parsed === "object") return [parsed];
    } catch {}
  }

  return [];
}

const getSpreadsheetId = () => {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID environment variable is required');
  }
  return spreadsheetId;
};

const getSheetsClient = (authHeader: string | undefined) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const token = authHeader.split(' ')[1];
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  return google.sheets({ version: 'v4', auth: oauth2Client });
};

// --- API Routes ---

// Parse text into transaction data using Replicate (meta/llama-4-scout-instruct)
app.post("/api/parse-transaction", async (req, res) => {
  try {
    const { text, timezone, categories } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });

    const now = new Date();
    const categoryInstruction = Array.isArray(categories) && categories.length > 0
      ? `The user's category list is exactly: ${categories.join(', ')}. Set category to one of those exact strings, or to "" if none fits. Never invent a category name.`
      : `If unsure of the category, set category to "". Never invent a category name.`;

    const prompt = `You are a transaction parsing assistant for a budgeting app.
Extract transaction details from the user's input. The user might provide a single natural language sentence or paste a CSV/bank statement.
The current date and time is ${now.toISOString()} in the time zone ${timezone || 'Africa/Johannesburg'}. 
Assume the current year (${now.getFullYear()}) if not specified.
If a date is ambiguous (like DD/MM vs MM/DD), assume South African formatting (DD/MM).
Identify the amount, setting outflows as negative numbers and inflows as positive numbers. Ensure the amount is a valid JSON number (e.g. -536.95, not a string or using commas for decimals).

Special Rule for Virtual Cards:
If you see a line matching a load pattern (e.g., "Loaded 300.00 onto my virtual card (reference 300559281)"), it is a transfer. Set payee to "Transfer to Virtual Card", category to "", and set transferAccountId to "Virtual Card".

Category Rule:
${categoryInstruction}

Return a JSON array of objects with this exact structure (no markdown, just JSON array):
[
  {
    "date": "YYYY-MM-DD",
    "amount": <number>,
    "payee": "<string>",
    "category": "<string>",
    "memo": "<string>",
    "transferAccountId": "<string>"
  }
]

User input: "${text}"`;

    const rawOutput = await runPrediction("meta/llama-4-scout-instruct", {
      prompt,
      system_prompt: "You are an expert transaction extractor. You output valid raw JSON arrays only without conversational filler or markdown code fences.",
      max_tokens: 1024,
      temperature: 0.1,
    });

    const result = extractJsonArray(rawOutput);
    const parsedArray = Array.isArray(result) ? result : [result];
    const validCategories = Array.isArray(categories) && categories.length > 0
      ? new Set(categories.map((c: any) => String(c).trim()).filter(Boolean))
      : null;

    const normalised = parsedArray.map((item: any) => {
      if (!item || typeof item !== 'object') return item;
      let cat = typeof item.category === 'string' ? item.category.trim() : '';
      if (validCategories && !validCategories.has(cat)) {
        cat = '';
      }
      return {
        ...item,
        category: cat
      };
    });

    res.json(normalised);
  } catch (error: any) {
    console.error("Replicate transaction parsing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create/Format sheets if they don't exist
app.post("/api/sheets/setup", async (req, res) => {
  try {
    if (isDemoMode(req)) {
      return res.json({ ok: true, demo: true });
    }
    const sheets = getSheetsClient(req.headers.authorization);
    const spreadsheetId = getSpreadsheetId();
    
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
    
    const REQUIRED_SHEETS = [
      { title: 'Transactions', headers: ['Date', 'Payee', 'Amount', 'Account', 'Category', 'Budget', 'Memo', 'Cleared', 'Source', 'TransferAccount', 'TransferId'] },
      { title: 'Assignments', headers: ['Month', 'Category', 'Amount', 'Budget'] },
      { title: 'Accounts', headers: ['Name', 'Type', 'Starting Balance', 'Budget', 'Currency', 'Indicative Rate'] },
      { title: 'Categories', headers: ['Budget', 'Name', 'Category Group', 'Monthly Target', 'Archived'] },
      { title: 'Config', headers: ['Key', 'Value'] },
      { title: 'Plan', headers: [...PLAN_HEADERS] }
    ];

    const sheetsToAdd = REQUIRED_SHEETS.filter(s => !existingTitles.includes(s.title));
    
    if (sheetsToAdd.length > 0) {
      // 1. Add missing sheets
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: sheetsToAdd.map(s => ({
            addSheet: { properties: { title: s.title } }
          }))
        }
      });

      // 2. Add headers for newly created sheets
      // We can use batchUpdate for values to write multiple ranges at once
      const data = sheetsToAdd.map(s => ({
        range: `${s.title}!A1:${String.fromCharCode(65 + s.headers.length - 1)}1`,
        values: [s.headers]
      }));

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data
        }
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Sheets setup error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/appendBatch", async (req, res) => {
  try {
    if (isDemoMode(req)) {
      return res.json({ ok: true, demo: true, saved: false });
    }
    const { sheet, rows } = req.body;
    if (!sheet || !rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    if (!validateSheetName(sheet)) {
      return res.status(400).json({ error: `Sheet "${sheet}" is not allowed` });
    }
    for (const r of rows) {
      if (!Array.isArray(r)) return res.status(400).json({ error: "Rows must be arrays" });
      for (const cell of r) {
        if (!validateNoPanOrAccountNumbers(String(cell))) {
          return res.status(400).json({ error: "Payload contains prohibited account or card number patterns" });
        }
      }
    }
    const safeRows = rows.map(r => sanitiseRowValues(r));

    const sheets = getSheetsClient(req.headers.authorization);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheet}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: safeRows,
      },
    });

    res.json({ success: true, updates: response.data.updates });
  } catch (error: any) {
    console.error("Sheets appendBatch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add a generic row append endpoint
app.post("/api/sheets/append", async (req, res) => {
  try {
    if (isDemoMode(req)) {
      return res.json({ ok: true, demo: true, saved: false });
    }
    const { sheet, values } = req.body;
    if (!sheet || !values || !Array.isArray(values)) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    if (!validateSheetName(sheet)) {
      return res.status(400).json({ error: `Sheet "${sheet}" is not allowed` });
    }
    for (const cell of values) {
      if (!validateNoPanOrAccountNumbers(String(cell))) {
        return res.status(400).json({ error: "Payload contains prohibited account or card number patterns" });
      }
    }
    const safeValues = sanitiseRowValues(values);

    const sheets = getSheetsClient(req.headers.authorization);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheet}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [safeValues],
      },
    });

    res.json({ success: true, updates: response.data.updates });
  } catch (error: any) {
    console.error("Sheets append error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update a specific row
app.post("/api/sheets/updateRow", async (req, res) => {
  try {
    if (isDemoMode(req)) {
      return res.json({ ok: true, demo: true, saved: false });
    }
    const { sheet, rowIndex, values } = req.body;
    if (!sheet || !rowIndex || !values) return res.status(400).json({ error: "Invalid payload" });
    if (!validateSheetName(sheet)) return res.status(400).json({ error: `Sheet "${sheet}" is not allowed` });
    if (!validateRowIndex(Number(rowIndex))) return res.status(400).json({ error: "Invalid rowIndex: row 1 headers cannot be overwritten" });
    for (const cell of values) {
      if (!validateNoPanOrAccountNumbers(String(cell))) {
        return res.status(400).json({ error: "Payload contains prohibited account or card number patterns" });
      }
    }
    const safeValues = sanitiseRowValues(values);

    const sheets = getSheetsClient(req.headers.authorization);
    const spreadsheetId = getSpreadsheetId();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheet}!A${rowIndex}:${String.fromCharCode(65 + safeValues.length - 1)}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [safeValues] }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Sheets updateRow error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Batch update multiple ranges
app.post("/api/sheets/batchUpdateValues", async (req, res) => {
  try {
    if (isDemoMode(req)) {
      return res.json({ ok: true, demo: true, saved: false });
    }
    const { data } = req.body; // array of { range, values }
    if (!data || !Array.isArray(data)) return res.status(400).json({ error: "Invalid payload" });
    const sheets = getSheetsClient(req.headers.authorization);
    const spreadsheetId = getSpreadsheetId();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data
      }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Sheets batchUpdateValues error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a row by clearing its contents
app.post("/api/sheets/deleteRow", async (req, res) => {
  try {
    if (isDemoMode(req)) {
      return res.json({ ok: true, demo: true, saved: false });
    }
    const { sheet, rowIndex } = req.body;
    if (!sheet || !rowIndex) return res.status(400).json({ error: "Invalid payload" });
    if (!validateSheetName(sheet)) return res.status(400).json({ error: `Sheet "${sheet}" is not allowed` });
    if (!validateRowIndex(Number(rowIndex))) return res.status(400).json({ error: "Invalid rowIndex: row 1 headers cannot be cleared" });

    const sheets = getSheetsClient(req.headers.authorization);
    const spreadsheetId = getSpreadsheetId();
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheet}!A${rowIndex}:Z${rowIndex}`
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Sheets deleteRow error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Plan sheet. Its own read: UNFORMATTED_VALUE keeps numbers as numbers. It is
// deliberately NOT part of the /ledger batchGet, which depends on
// display-formatted values (the Cleared column).
app.get("/api/sheets/plan", async (req, res) => {
  try {
    if (isDemoMode(req)) {
      return res.json({ demo: true, rows: [] });
    }
    const sheets = getSheetsClient(req.headers.authorization);
    const spreadsheetId = getSpreadsheetId();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Plan!A1:M',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const values = response.data.values || [];
    const header = (values[0] || []).map(c => String(c ?? ''));
    if (header.length !== PLAN_HEADERS.length || PLAN_HEADERS.some((h, i) => header[i] !== h)) {
      return res.status(500).json({
        error: `Plan sheet row 1 must be exactly: ${PLAN_HEADERS.join(' | ')}`
      });
    }
    const rows = values.slice(1)
      .map((row, i) => ({
        rowIndex: i + 2,
        cells: PLAN_HEADERS.map((_, c) => String(row[c] ?? '')),
      }))
      .filter(r => r.cells.some(c => c.trim() !== ''));
    res.json({ rows });
  } catch (error: any) {
    console.error("Sheets plan fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get the full ledger data
app.get("/api/sheets/ledger", async (req, res) => {
  try {
    if (isDemoMode(req)) {
      return res.json(demoLedger());
    }
    const sheets = getSheetsClient(req.headers.authorization);
    const spreadsheetId = getSpreadsheetId();

    // Fetch all relevant ranges in one batch
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: ['Transactions!A2:Z', 'Assignments!A2:Z', 'Accounts!A2:Z', 'Categories!A2:Z', 'Config!A2:Z'],
    });

    const valueRanges = response.data.valueRanges || [];
    
    const transactions = (valueRanges[0].values || []).map((row, index) => ({
      rowIndex: index + 2,
      date: row[0] || '',
      payee: row[1] || '',
      amount: parseFloat(row[2]) || 0,
      account: row[3] || '',
      category: row[4] || '',
      budget: row[5] || 'Personal',
      memo: row[6] || '',
      cleared: row[7] === 'true',
      source: row[8] || 'manual',
      transferAccountId: row[9] || undefined,
      transferId: row[10] || undefined
    }));

    const assignments = (valueRanges[1].values || []).map((row, index) => ({
      rowIndex: index + 2,
      month: row[0] || '',
      category: row[1] || '',
      amount: parseFloat(row[2]) || 0,
      budget: row[3] || 'Personal'
    }));

    const accounts = (valueRanges[2].values || []).map((row, index) => ({
      rowIndex: index + 2,
      name: row[0] || '',
      type: row[1] || 'cheque',
      startingBalance: parseFloat(row[2]) || 0,
      budget: row[3] || 'Personal',
      currency: row[4] || 'ZAR',
      indicativeRate: parseFloat(row[5]) || 1
    }));

    const categories = (valueRanges[3].values || []).map((row, index) => ({
      rowIndex: index + 2,
      budget: row[0] || 'Personal',
      name: row[1] || '',
      group: row[2] || '',
      target: parseFloat(row[3]) || 0,
      archived: String(row[4]).toLowerCase() === 'true'
    }));

    const config = (valueRanges[4].values || []).map(row => ({
      key: row[0] || '',
      value: row[1] || ''
    }));

    res.json({ transactions, assignments, accounts, categories, config });
  } catch (error: any) {
    console.error("Sheets fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Chat with financial advisor persona using Replicate (anthropic/claude-4.5-haiku)
app.post("/api/ask", async (req, res) => {
  try {
    const { query, data, systemInstruction } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query" });

    const systemPrompt = systemInstruction || `You are a helpful financial assistant.
Answer the user's question based on their transaction data.
Keep your answer short, encouraging, and formatted simply.
Follow the "Neurodiverse Agency" brand principles:
- Refusal: Never pathologise difference. No deficit framing.
- Permission: No time limits, no streaks, no nagging.
- Voice: Warm, direct, sentence case.
Do not use emojis.`;

    const prompt = `System Instructions:
${systemPrompt}

Transactions Data:
${JSON.stringify(data || [], null, 2)}

User Question: "${query}"`;

    const answer = await runPrediction("anthropic/claude-4.5-haiku", {
      prompt,
      system_prompt: systemPrompt,
      max_tokens: 1024,
      temperature: 0.3,
    });

    res.json({ answer: answer.trim() });
  } catch (error: any) {
    console.error("Replicate ask error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// On Vercel the routes above are mounted by api/index.ts as a serverless
// function, and the static build is served by the CDN. Listening on a port
// there would be wrong, so this stays the local-dev entry point only.
if (!process.env.VERCEL) startServer();

export default app;
