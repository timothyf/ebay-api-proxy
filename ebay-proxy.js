// ebay-proxy.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs/promises';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

const upload = multer({ dest: 'uploads/' });

async function getAccessToken() {
  const response = await axios.post(
    'https://api.ebay.com/identity/v1/oauth2/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope'
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: {
        username: EBAY_CLIENT_ID,
        password: EBAY_CLIENT_SECRET
      }
    }
  );
  return response.data.access_token;
}

async function lookupBarcode(q, token) {
  try {
    const response = await axios.get(
      'https://api.ebay.com/buy/browse/v1/item_summary/search',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { q }
      }
    );
    return { barcode: q, ...response.data };
  } catch (err) {
    return { barcode: q, error: err.response?.data || err.message };
  }
}

app.get('/search', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing UPC query parameter' });
  }

  try {
    const token = await getAccessToken();
    const result = await lookupBarcode(q, token);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'eBay proxy failed', details: err.message });
  }
});

app.post('/bulk', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const content = await fs.readFile(req.file.path, 'utf8');
    const barcodes = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (barcodes.length === 0) {
      return res.status(400).json({ error: 'No valid barcodes found' });
    }

    const token = await getAccessToken();
    const results = await Promise.all(barcodes.map(q => lookupBarcode(q, token)));

    await fs.unlink(req.file.path);

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk processing failed', details: err.message });
  }
});

app.get('/bulk', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  const barcodes = q.split(',').map(b => b.trim()).filter(b => b);
  if (barcodes.length === 0) return res.status(400).json({ error: 'No valid barcodes in query' });

  try {
    const token = await getAccessToken();
    const results = await Promise.all(barcodes.map(b => lookupBarcode(b, token)));
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'GET bulk processing failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`eBay proxy running at http://localhost:${PORT}`);
});
