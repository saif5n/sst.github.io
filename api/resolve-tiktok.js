const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  const requestedUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!requestedUrl) return res.status(400).json({ message: 'Missing url parameter' });

  try {
    const response = await axios.get(requestedUrl, {
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: status => status >= 200 && status < 400,
    });

    const finalUrl = response.request?.res?.responseUrl || response.config.url || requestedUrl;
    let html = null;
    if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
      html = response.data;
    }

    // If redirects did not expose the final TikTok URL, use page metadata as a fallback.
    let resolvedUrl = finalUrl;
    if (html && resolvedUrl.includes('vt.tiktok.com')) {
      const metaMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
      if (metaMatch && metaMatch[1]) {
        resolvedUrl = metaMatch[1];
      }
      const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      if (canonicalMatch && canonicalMatch[1]) {
        resolvedUrl = canonicalMatch[1];
      }
    }

    let oembedHtml = null;
    if (resolvedUrl && resolvedUrl.includes('tiktok.com')) {
      try {
        const oembedResponse = await axios.get('https://www.tiktok.com/oembed', {
          params: { url: resolvedUrl },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        });
        oembedHtml = oembedResponse.data.html;
      } catch (e) {
        console.warn('TikTok oEmbed failed:', e.message || e);
      }
    }

    return res.status(200).json({ url: resolvedUrl, html: oembedHtml });
  } catch (error) {
    console.error('resolve-tiktok handler error:', error.message || error);
    return res.status(500).json({ message: 'Unable to resolve TikTok URL', error: String(error) });
  }
}
