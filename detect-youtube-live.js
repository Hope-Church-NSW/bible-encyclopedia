const fs = require('fs');
const path = require('path');

const CHANNEL_LIVE_URL = 'https://www.youtube.com/@HCNSW/live';
const CHANNEL_ID = 'UCA4fnbG89etO0KZ0tbzA2Dw';
const output = path.resolve(process.argv[2] || path.join(__dirname, 'dist', 'live-status.json'));

async function detectLiveStream() {
    const response = await fetch(CHANNEL_LIVE_URL, {
        redirect: 'follow',
        headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Mozilla/5.0 (compatible; HopeChurchLiveStatus/1.0)'
        }
    });
    if (!response.ok) throw new Error(`YouTube returned ${response.status}`);

    const html = await response.text();
    const redirectedVideoId = new URL(response.url).searchParams.get('v');
    const detailsVideoId = html.match(/"videoDetails":\{"videoId":"([A-Za-z0-9_-]{11})"/)?.[1];
    const liveVideoId = redirectedVideoId || detailsVideoId || '';
    const isLive = Boolean(liveVideoId)
        && (/"isLiveNow":true/.test(html) || /"isLiveContent":true/.test(html));

    return {
        isLive,
        videoId: isLive ? liveVideoId : null,
        channelId: CHANNEL_ID,
        channelUrl: 'https://www.youtube.com/@HCNSW',
        checkedAt: new Date().toISOString()
    };
}

detectLiveStream()
    .catch((error) => ({
        isLive: false,
        videoId: null,
        channelId: CHANNEL_ID,
        channelUrl: 'https://www.youtube.com/@HCNSW',
        checkedAt: new Date().toISOString(),
        error: error.message
    }))
    .then((status) => {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
        console.log(JSON.stringify(status));
    });
