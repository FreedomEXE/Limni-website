import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.SCRAPER_PORT || 3002;

app.use(cors());
app.use(express.json());

let browser;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

// Scrape OANDA sentiment
app.get('/scrape/oanda', async (req, res) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://www.oanda.com/forex-trading/analysis/forex-order-book', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for sentiment data to load
    await page.waitForSelector('.order-book-table', { timeout: 10000 });

    const sentimentData = await page.evaluate(() => {
      const results = [];
      const rows = document.querySelectorAll('.order-book-table tbody tr');

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const pair = cells[0]?.textContent?.trim();
          const longText = cells[1]?.textContent?.trim();
          const shortText = cells[2]?.textContent?.trim();

          if (pair && longText && shortText) {
            const long = parseFloat(longText.replace('%', ''));
            const short = parseFloat(shortText.replace('%', ''));

            if (!isNaN(long) && !isNaN(short)) {
              results.push({
                pair: pair.replace('/', ''),
                long,
                short,
              });
            }
          }
        }
      });

      return results;
    });

    await page.close();

    res.json({
      provider: 'OANDA',
      data: sentimentData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('OANDA scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scrape ForexClientSentiment
app.get('/scrape/forexclientsentiment', async (req, res) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://www.forexclientsentiment.com', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for sentiment data table
    await page.waitForSelector('.sentiment-table, table', { timeout: 10000 });

    const sentimentData = await page.evaluate(() => {
      const results = [];
      const tables = document.querySelectorAll('table');

      tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const pair = cells[0]?.textContent?.trim();
            const longText = cells[1]?.textContent?.trim() || cells[2]?.textContent?.trim();
            const shortText = cells[2]?.textContent?.trim() || cells[1]?.textContent?.trim();

            if (pair && longText && shortText) {
              const long = parseFloat(longText.replace(/[^\d.]/g, ''));
              const short = parseFloat(shortText.replace(/[^\d.]/g, ''));

              if (!isNaN(long) && !isNaN(short)) {
                results.push({
                  pair: pair.replace(/[^A-Z]/g, ''),
                  long,
                  short,
                });
              }
            }
          }
        });
      });

      return results;
    });

    await page.close();

    res.json({
      provider: 'FOREXCLIENTSENTIMENT',
      data: sentimentData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ForexClientSentiment scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scrape Myfxbook sentiment
app.get('/scrape/myfxbook', async (req, res) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://www.myfxbook.com/community/outlook', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for outlook table
    await page.waitForSelector('table.outlookSymbolsTableContent', { timeout: 10000 });

    const sentimentData = await page.evaluate(() => {
      const results = [];
      const rows = document.querySelectorAll('table.outlookSymbolsTableContent tbody tr');

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const pair = cells[0]?.textContent?.trim();
          const shortText = cells[1]?.textContent?.trim();
          const longText = cells[2]?.textContent?.trim();

          if (pair && longText && shortText) {
            const long = parseFloat(longText.replace('%', ''));
            const short = parseFloat(shortText.replace('%', ''));

            if (!isNaN(long) && !isNaN(short)) {
              results.push({
                pair: pair.replace('/', ''),
                long,
                short,
              });
            }
          }
        }
      });

      return results;
    });

    await page.close();

    res.json({
      provider: 'MYFXBOOK',
      data: sentimentData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Myfxbook scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', browser: !!browser });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Sentiment scraper running on http://localhost:${PORT}`);
});
