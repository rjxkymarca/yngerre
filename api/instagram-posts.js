const INSTAGRAM_USERNAME = 'yngerreproductions';
const INSTAGRAM_APP_ID = '936619743392459';

function getRouteSegment(item) {
  return item?.product_type === 'clips' ? 'reel' : 'p';
}

function getCaption(item) {
  const text = typeof item?.caption?.text === 'string' ? item.caption.text.trim() : '';
  return text || 'Contenuto Instagram pubblico dal profilo ufficiale.';
}

function normalizePost(item) {
  const code = item?.code;
  if (!code) {
    return null;
  }

  const routeSegment = getRouteSegment(item);
  const permalink = `https://www.instagram.com/${routeSegment}/${code}/`;
  const caption = getCaption(item);

  return {
    id: item.id ?? code,
    code,
    type: routeSegment === 'reel' ? 'Reel' : 'Post',
    caption,
    permalink,
    embedUrl: `${permalink}embed/captioned/`,
    thumbnailUrl: item?.image_versions2?.candidates?.[0]?.url ?? '',
    likeCount: Number.isFinite(item?.like_count) ? item.like_count : null,
    commentCount: Number.isFinite(item?.comment_count) ? item.comment_count : null
  };
}

async function fetchInstagramPosts() {
  const response = await fetch(
    `https://www.instagram.com/api/v1/feed/user/${INSTAGRAM_USERNAME}/username/?count=12`,
    {
      headers: {
        'x-ig-app-id': INSTAGRAM_APP_ID,
        'x-requested-with': 'XMLHttpRequest',
        referer: `https://www.instagram.com/${INSTAGRAM_USERNAME}/`,
        accept: 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Instagram request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map(normalizePost).filter(Boolean);
}

async function handler(_req, res) {
  try {
    const items = await fetchInstagramPosts();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=43200');
    res.status(200).json({
      username: INSTAGRAM_USERNAME,
      fetchedAt: new Date().toISOString(),
      count: items.length,
      items
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to fetch Instagram posts'
    });
  }
}

module.exports = handler;
module.exports.fetchInstagramPosts = fetchInstagramPosts;
