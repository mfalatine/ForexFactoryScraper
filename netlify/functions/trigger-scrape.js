/* Netlify Function (CommonJS): Trigger GitHub Actions workflow to run scraper */

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GH_OWNER || 'mfalatine';
  const repo = process.env.GH_REPO || 'ForexFactoryScraper';
  const workflow = process.env.GH_WORKFLOW || 'scrape.yml';
  const ref = process.env.GITHUB_REF || 'main';

  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing GITHUB_TOKEN env var' }) };
  }

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { start_date, days } = input || {};

  const payload = { ref, inputs: {} };
  if (start_date) payload.inputs.start_date = start_date;
  if (days) payload.inputs.days = String(days);

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'netlify-function-trigger'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'GitHub API error', status: resp.status, details: text, url }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Function runtime error', details: String(err) }) };
  }
};


