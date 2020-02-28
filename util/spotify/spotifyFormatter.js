const {
  getUserNameById,
  getQueue,
  getQueueNowPlaying,
  getSearchResults,
  getDefaultTrackInfo
} = require("./spotifyBrainHelper");

const { getSpotifyUserProfile } = require("./spotifyRequester");
const get = require("lodash.get");

const getMinutesAndSecondsFromMs = ms => {
  const totalSeconds = Math.floor(ms / 1000);
  const leftoverSeconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const twoDigitSeconds =
    leftoverSeconds < 10 ? `0${leftoverSeconds}` : leftoverSeconds;

  return `${minutes}:${twoDigitSeconds}`;
};

const getTimeRemainingOnPlayback = status => {
  const timeIntoTrack = get(status, "progress_ms");
  const trackLength = get(status, "item.duration_ms");
  return parseInt(trackLength) - parseInt(timeIntoTrack);
};

/*
This file is responsible for formatting the responses that sherpa will actually send
*/

const formatTrack = (robot, queueObj) => {
  const { type, userId } = queueObj;
  const userName = userId && getUserNameById(robot, userId);
  const suffix = userName ? ` (queued by ${userName})` : "";

  if (type === "SPOTIFY") {
    const { songName, songArtist } = queueObj;
    return `${songName} by ${songArtist}${suffix}`;
  }
  if (type === "YOUTUBE") {
    const { videoName } = queueObj;
    return `${videoName} via Youtube${suffix}`;
  }
  return null;
};

const formatQueue = robot => {
  const queue = getQueue(robot);
  const songs = queue.length
    ? queue.map((track, index) => {
        return `#${index}: ${formatTrack(robot, track)}`;
      })
    : [`:mask: is empty! :mask:`];

  return [`:sunglasses: The Queue :sunglasses:`, ...songs].join("\n");
};

const formatTimeRemaining = status => {
  const millisecondsRemaining = getTimeRemainingOnPlayback(status);
  const formattedTimeRemaining = getMinutesAndSecondsFromMs(
    millisecondsRemaining
  );
  return `${formattedTimeRemaining} remaining :hourglass:`;
};

const formatDefaultBlame = async item => {
  const shrug = `¯\\_(ツ)_/¯`;
  const songName = get(item, "track.name") || shrug;
  const songArtist =
    (get(item, "track.artists") || []).map(artist => artist.name).join(", ") ||
    shrug;
  const userId = get(item, "added_by.id") || shrug;
  const userProfile = await getSpotifyUserProfile(userId);
  const userName = userProfile.display_name || userProfile.id;
  return `:black_small_square: "${songName}" by ${songArtist} playing from the default playlist (added by ${userName})`;
};

const formatStatus = (robot, res, status) => {
  // the sonos script handles showing the volume here
  // (which is jank)
  const queueNowPlaying = getQueueNowPlaying(robot);
  let songTitle = get(status, "item.name");
  let songArtist = (get(status, "item.artists") || [])
    .map(artist => artist.name)
    .join(", ");

  const getBlame = new Promise((resolve, reject) => {
    if (queueNowPlaying) {
      resolve(
        `:sparkles: Requested by ${getUserNameById(
          robot,
          queueNowPlaying.userId
        )} :sparkles:`
      );
    } else {
      const trackId = get(status, "item.uri");
      const playlistTrack = getDefaultTrackInfo(robot, res, trackId);
      if (playlistTrack) {
        resolve(formatDefaultBlame(playlistTrack));
      }
    }
  });

  return getBlame.then(blame => {
    let line2;
    let link;
    let timeRemaining;

    if (!queueNowPlaying) {
      songTitle = get(status, "item.name");
      songArtist = get(status, "item.artists")
        .map(artist => artist.name)
        .join(", ");
      link = get(status, "item.external_urls.spotify");
      timeRemaining = formatTimeRemaining(status);
    }

    if (get(queueNowPlaying, "type") === "SPOTIFY") {
      songTitle = get(status, "item.name");
      songArtist = get(status, "item.artists")
        .map(artist => artist.name)
        .join(", ");
      link = get(status, "item.external_urls.spotify");
      line2 = `:black_small_square: Now playing "${songTitle}" by ${songArtist}`;
      timeRemaining = formatTimeRemaining(status);
    }

    if (get(queueNowPlaying, "type") === "YOUTUBE") {
      const { videoUrl, videoName } = queueNowPlaying;
      link = videoUrl;
      line2 = `:black_small_square: Now playing ${videoName} via YouTube`;
    }

    const lines = [
      formatQueue(robot),
      line2,
      link,
      blame,
      timeRemaining
    ].filter(el => !!el);

    return lines.join("\n\n");
  });
};

const formatQueueBlame = robot => {
  const nowPlaying = getQueueNowPlaying(robot);
  if (nowPlaying.type === "SPOTIFY") {
    const { songName, songArtist, userId } = nowPlaying;
    const userName = getUserNameById(robot, userId);

    return `:black_small_square: "${songName}" by ${songArtist} was queued by ${userName}`;
  }

  if (nowPlaying.type === "YOUTUBE") {
    const { videoName, userId, videoUrl } = nowPlaying;
    const userName = getUserNameById(robot, userId);

    return `:black_small_square: "${videoName}" via YouTube (queued by ${userName})\nlink: ${videoUrl}`;
  }
  return null;
};

const formatPlayNow = robot => {
  const nowPlaying = getQueueNowPlaying(robot);

  if (!nowPlaying) {
    return "There was a strange error playing your song? Sorry :(";
  }

  const { songName, songArtist, userId } = nowPlaying;
  const userName = getUserNameById(robot, userId);

  return `:black_small_square: Now playing "${songName}" by ${songArtist} (requested by ${userName})`;
};

const formatAlbumInfo = albumInfo => {
  const { name, artists } = albumInfo;
  const artistName = artists.map(a => a.name).join(", ");
  return `Album: ${name} by ${artistName}`;
};

const formatSearchResults = robot => {
  const currentSearchResults = getSearchResults(robot);
  return currentSearchResults
    .map((result, index) => {
      const { songName, songArtist } = result;
      return `#${index}: "${songName}" by ${songArtist}`;
    })
    .join("\n");
};

const formatAddToDefault = () => {
  return `Done! Thanks for contributing. :sunglasses:`;
};

module.exports = {
  formatTrack,
  formatQueue,
  formatStatus,
  formatQueueBlame,
  formatDefaultBlame,
  formatPlayNow,
  formatSearchResults,
  formatAlbumInfo,
  formatAddToDefault
};
