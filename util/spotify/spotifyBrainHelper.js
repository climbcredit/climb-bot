// {
//     userId: 123,
//     songUri: "spotify:track:bjabjb",
//     songId: "bjabjb",
//     songName: "My Song",
//     songArtist: "Me",
//     type: "SPOTIFY"
// }
const { DIBSY_LOCAL } = process.env;
const ROOMS = {
  dibsyDev: "C02G01D6D",
  music: "C7PR0RE02",
  general: "C0255MGHL"
};
const dibsyDevResponsePrefix = `Normally I wouldn't allow this but...`;
const dibsyDevResponses = [
  `${dibsyDevResponsePrefix} You're a dibsy dev Harry!`,
  `${dibsyDevResponsePrefix} :wink:`,
  `${dibsyDevResponsePrefix} Don't tell anyone about this...`,
  `${dibsyDevResponsePrefix} I'll allow it.`,
  `${dibsyDevResponsePrefix} I'll do it... but I won't like it!`,
  `${dibsyDevResponsePrefix} :see_no_evil:`,
  `${dibsyDevResponsePrefix} :speak_no_evil:`,
  `${dibsyDevResponsePrefix} :miniondance:`,
  `${dibsyDevResponsePrefix} :parrot:`,
  `${dibsyDevResponsePrefix} :thumbsupparrot:`,
  `${dibsyDevResponsePrefix} ¯\\_(ツ)_/¯`,
  `${dibsyDevResponsePrefix} c'est la vie`,
  `${dibsyDevResponsePrefix} Darude's Sandstorm reached #1 on the charts in Norway so...`
];

const volumeControlMovedResponses = [
  "Sorry! Volume control has been moved to #music",
  `Hey I just met you,
And this is crazy,
But go to #music,
to control dibsy :wink:`,
  "Hey! Head on over to #music to control the volume :simple_smile:"
];
const musicControlMovedResponses = [
  "Sorry! Music control has been moved to #music",
  `Hey I just met you,
And this is crazy,
But go to #music,
to queue from dibsy :wink:`,
  "Hey! Head on over to #music to play/queue songs :simple_smile:"
];

// this really only matters if you choose
// "Share > Copy Song Link"
// https://open.spotify.com/track/5XLC8xoqyua4U7wJiZAWik?si=PCAMNnhZROeMjC1zrM0L5A
// spotify:track:5XLC8xoqyua4U7wJiZAWik
// without using `cleanUri`, any `open.spotify.com` uris
// that contain any query parameters will be posted as
//   body: { uris: [ 'https://open.spotify.com/track/5XLC8xoqyua4U7wJiZAWik?si=PCAMNnhZROeMjC1zrM0L5A' ] } }
// it needs to be formatted as
//   body: { uris: [ 'https://open.spotify.com/track/5XLC8xoqyua4U7wJiZAWik' ] } }
const cleanUri = uri => {
  if (uri.indexOf("?") > -1) {
    return uri.split("?")[0];
  }
  return uri;
};

const getIdFromUri = uri => {
  const cleanedUri = cleanUri(uri);
  if (typeof cleanedUri === "string") {
    return cleanedUri
      .replace(/spotify:track:|https?:\/\/open\.spotify\.com\/track\//, "")
      .trim();
  }
  return uri;
};

const getUserNameById = (robot, id) => {
  // Use slack's syntax for rendering user's display name
  // https://api.slack.com/changelog/2017-09-the-one-about-usernames#mentioning_users_in_messages
  return `<@${id}>`;
};

const setUpQueue = robot => {
  robot.brain.set("dibsyMusicQueue", []);
};

const getQueue = robot => {
  return robot.brain.get("dibsyMusicQueue");
};

const getQueueNowPlaying = robot => {
  return robot.brain.get("dibsyMusicNowPlaying");
};

const setQueueNowPlaying = (robot, nowPlaying) => {
  return robot.brain.set("dibsyMusicNowPlaying", nowPlaying);
};

const evacuateQueueNowPlaying = robot => {
  return robot.brain.set("dibsyMusicNowPlaying", null);
};

const queueContainsSong = robot => {
  return !!getQueue(robot).length;
};

const evacuateQueue = robot => {
  robot.brain.set("dibsyMusicQueue", []);
};

const getSearchResults = robot => {
  return robot.brain.get("dibsyMusicSearchResults");
};

const setSearchResults = (robot, val) => {
  return robot.brain.set("dibsyMusicSearchResults", val);
};

const evacuateSearchResults = robot => {
  return robot.brain.set("dibsyMusicSearchResults", []);
};

const getDefaultPlaylistLookup = robot => {
  return robot.brain.get("dibsyMusicDefaultPlaylistLookup");
};

const setDefaultPlaylistLookup = (robot, lookup) => {
  return robot.brain.set("dibsyMusicDefaultPlaylistLookup", lookup);
};

const setDefaultPlaylistUriList = (robot, list) => {
  return robot.brain.set("dibsyMusicDefaultPlaylistUriList", list);
};

const getDefaultPlaylistUriList = robot => {
  return robot.brain.get("dibsyMusicDefaultPlaylistUriList");
};

const getDefaultTrackInfo = (robot, res, trackId) => {
  const lookup = getDefaultPlaylistLookup(robot);

  if (!lookup) {
    res.send("building lookup, gimme a second :cold_sweat:");
    return;
  }

  return lookup[trackId];
};

const canDoInRoom = (res, movedResponses) => {
  let canDoHere = true;
  if (DIBSY_LOCAL !== "true" && res.message.room !== ROOMS.music) {
    console.log("Message came from NON-STANDARD room!");
    if (res.message.room === ROOMS.dibsyDev) {
      console.log("Came from dibsy-dev... OK");
      res.send(res.random(dibsyDevResponses));
    } else if (res.message.room === ROOMS.general) {
      res.send(res.random(movedResponses));
      canDoHere = false;
    } else {
      console.log("Denied!");
      res.send(":no_entry_sign: :no_good: :no_bell:");
      canDoHere = false;
    }
  }
  return canDoHere;
};

const canPlayInRoom = res => true; //canDoInRoom(res, musicControlMovedResponses);

const canVolInRoom = res => canDoInRoom(res, volumeControlMovedResponses);

module.exports = {
  cleanUri,
  getUserNameById,
  getIdFromUri,
  setUpQueue,
  getQueue,
  queueContainsSong,
  evacuateQueue,
  setQueueNowPlaying,
  getQueueNowPlaying,
  evacuateQueueNowPlaying,
  getSearchResults,
  setSearchResults,
  evacuateSearchResults,
  getDefaultPlaylistLookup,
  getDefaultTrackInfo,
  setDefaultPlaylistLookup,
  getDefaultPlaylistUriList,
  setDefaultPlaylistUriList,
  canPlayInRoom,
  canVolInRoom
};
