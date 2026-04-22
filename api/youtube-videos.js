const ytch = require('yt-channel-info');
const YoutubeGrabberHelper = require('yt-channel-info/app/helper');

const CHANNEL_ID = 'UC6kUWPUTwPd92a1xc9ubSfg';
const CHANNEL_NAME = 'YNG ERRE';
const AJAX_URL = 'https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const helper = YoutubeGrabberHelper.create();

function inferTrackType(title) {
  const normalizedTitle = title.toLowerCase();

  if (
    normalizedTitle.includes('full fan-made album') ||
    normalizedTitle.includes('full ep') ||
    normalizedTitle.includes('visual ep') ||
    normalizedTitle.includes('visual album') ||
    normalizedTitle.endsWith(' - ep') ||
    /\bep\b/.test(normalizedTitle)
  ) {
    return 'Progetto lungo';
  }

  if (
    normalizedTitle.includes('(mashup)') ||
    normalizedTitle.includes(' mashup') ||
    normalizedTitle.includes(' rmx') ||
    normalizedTitle.includes(' with ') ||
    normalizedTitle.includes(' x ')
  ) {
    return 'Mashup / fan edit';
  }

  return 'Singolo / brano';
}

function translatePublishedLabel(label) {
  return label
    .replace(/^streamed\s+/i, 'Pubblicato in live ')
    .replace(/\bseconds ago\b/i, 'secondi fa')
    .replace(/\bsecond ago\b/i, 'secondo fa')
    .replace(/\bminutes ago\b/i, 'minuti fa')
    .replace(/\bminute ago\b/i, 'minuto fa')
    .replace(/\bhours ago\b/i, 'ore fa')
    .replace(/\bhour ago\b/i, 'ora fa')
    .replace(/\bdays ago\b/i, 'giorni fa')
    .replace(/\bday ago\b/i, 'giorno fa')
    .replace(/\bweeks ago\b/i, 'settimane fa')
    .replace(/\bweek ago\b/i, 'settimana fa')
    .replace(/\bmonths ago\b/i, 'mesi fa')
    .replace(/\bmonth ago\b/i, 'mese fa')
    .replace(/\byears ago\b/i, 'anni fa')
    .replace(/\byear ago\b/i, 'anno fa');
}

function formatDuration(lengthSeconds, durationText) {
  if (durationText) {
    return durationText;
  }

  if (!Number.isFinite(lengthSeconds) || lengthSeconds <= 0) {
    return '';
  }

  const hours = Math.floor(lengthSeconds / 3600);
  const minutes = Math.floor((lengthSeconds % 3600) / 60);
  const seconds = lengthSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function normalizeTrack(video) {
  const title = typeof video.title === 'string' ? video.title : '';

  return {
    title,
    type: inferTrackType(title),
    duration: formatDuration(video.lengthSeconds, video.durationText),
    publishedLabel: translatePublishedLabel(video.publishedText || ''),
    videoId: video.videoId,
    viewCountText: video.viewCountText || ''
  };
}

async function fetchContinuationPage(continuation) {
  const response = await helper.makeChannelPost(AJAX_URL, {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20201021.03.00'
      }
    },
    continuation
  });

  if (response.error) {
    throw response.message;
  }

  const continuationItems =
    response.data?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems ?? [];

  const nextContinuation = continuationItems.find((item) => item.continuationItemRenderer)?.continuationItemRenderer
    ?.continuationEndpoint?.continuationCommand?.token;

  const pageVideos = continuationItems
    .filter((item) => !item.continuationItemRenderer)
    .map((item) => helper.parseVideo(item, { channelId: CHANNEL_ID, channelName: CHANNEL_NAME }));

  return {
    items: pageVideos,
    continuation: nextContinuation ?? null
  };
}

async function fetchAllChannelVideos() {
  const firstPage = await ytch.getChannelVideos({
    channelId: CHANNEL_ID,
    sortBy: 'newest',
    channelIdType: 1
  });

  const videos = [...firstPage.items];
  let continuation = firstPage.continuation;
  let pageCount = 0;

  while (continuation && pageCount < 20) {
    const nextPage = await fetchContinuationPage(continuation);
    videos.push(...nextPage.items);
    continuation = nextPage.continuation;
    pageCount += 1;
  }

  const dedupedVideos = [];
  const seenVideoIds = new Set();

  for (const video of videos) {
    if (!video?.videoId || seenVideoIds.has(video.videoId)) {
      continue;
    }

    seenVideoIds.add(video.videoId);
    dedupedVideos.push(normalizeTrack(video));
  }

  return dedupedVideos;
}

async function handler(_req, res) {
  try {
    const items = await fetchAllChannelVideos();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=43200');
    res.status(200).json({
      channelId: CHANNEL_ID,
      fetchedAt: new Date().toISOString(),
      count: items.length,
      items
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to fetch YouTube channel videos'
    });
  }
}

module.exports = handler;
module.exports.fetchAllChannelVideos = fetchAllChannelVideos;
