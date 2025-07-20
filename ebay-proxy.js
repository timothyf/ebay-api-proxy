// ebay-proxy.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

app.get('/search', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing UPC query parameter' });
  }

  try {
    // Get access token
    const tokenResponse = await axios.post(
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

    const accessToken = tokenResponse.data.access_token;

    // Search for item by barcode
    const ebayResponse = await axios.get(
      'https://api.ebay.com/buy/browse/v1/item_summary/search',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          q
        }
      }
    );

    res.json(ebayResponse.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'eBay proxy failed', details: err.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log(`eBay proxy running at http://localhost:${PORT}`);
});
