// {
//     userId: 123,
//     songUri: "spotify:track:bjabjb",
//     songId: "bjabjb",
//     songName: "My Song",
//     songArtist: "Me",
//     type: "SPOTIFY"
// }
const { SHERPA_LOCAL } = process.env;
const ROOMS = {
  sherpaDev: "GTC0CSYKU",
  music: "CRR6KVBF1",
  general: "C045ERTMN"
};
const sherpaDevResponsePrefix = `Normally I wouldn't allow this but...`;
const sherpaDevResponses = [
  `${sherpaDevResponsePrefix} You're a sherpa dev Harry!`,
  `${sherpaDevResponsePrefix} :wink:`,
  `${sherpaDevResponsePrefix} Don't tell anyone about this...`,
  `${sherpaDevResponsePrefix} I'll allow it.`,
  `${sherpaDevResponsePrefix} I'll do it... but I won't like it!`,
  `${sherpaDevResponsePrefix} :see_no_evil:`,
  `${sherpaDevResponsePrefix} :speak_no_evil:`,
  `${sherpaDevResponsePrefix} :miniondance:`,
  `${sherpaDevResponsePrefix} :parrot:`,
  `${sherpaDevResponsePrefix} :thumbsupparrot:`,
  `${sherpaDevResponsePrefix} ¯\\_(ツ)_/¯`,
  `${sherpaDevResponsePrefix} c'est la vie`,
  `${sherpaDevResponsePrefix} Darude's Sandstorm reached #1 on the charts in Norway so...`
];

const volumeControlMovedResponses = [
  `Hey I just met you,
And this is crazy,
But go to #song_requests,
to control sherpa :wink:`,
  "Hey! Head on over to #song_requests to control the volume :simple_smile:"
];
const musicControlMovedResponses = [
  `Hey I just met you,
And this is crazy,
But go to #song_requests,
to queue from sherpa :wink:`,
  "Hey! Head on over to #song_requests to play/queue songs :simple_smile:"
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
  robot.brain.set("sherpaMusicQueue", []);
};

const getQueue = robot => {
  return robot.brain.get("sherpaMusicQueue");
};

const getQueueNowPlaying = robot => {
  return robot.brain.get("sherpaMusicNowPlaying");
};

const setQueueNowPlaying = (robot, nowPlaying) => {
  return robot.brain.set("sherpaMusicNowPlaying", nowPlaying);
};

const evacuateQueueNowPlaying = robot => {
  return robot.brain.set("sherpaMusicNowPlaying", null);
};

const queueContainsSong = robot => {
  return !!getQueue(robot).length;
};

const evacuateQueue = robot => {
  robot.brain.set("sherpaMusicQueue", []);
};

const getSearchResults = robot => {
  return robot.brain.get("sherpaMusicSearchResults");
};

const setSearchResults = (robot, val) => {
  return robot.brain.set("sherpaMusicSearchResults", val);
};

const evacuateSearchResults = robot => {
  return robot.brain.set("sherpaMusicSearchResults", []);
};

const getDefaultPlaylistLookup = robot => {
  return robot.brain.get("sherpaMusicDefaultPlaylistLookup");
};

const setDefaultPlaylistLookup = (robot, lookup) => {
  return robot.brain.set("sherpaMusicDefaultPlaylistLookup", lookup);
};

const setDefaultPlaylistUriList = (robot, list) => {
  return robot.brain.set("sherpaMusicDefaultPlaylistUriList", list);
};

const getDefaultPlaylistUriList = robot => {
  return robot.brain.get("sherpaMusicDefaultPlaylistUriList");
};

const getDefaultTrackInfo = (robot, res, trackId) => {
  const lookup = getDefaultPlaylistLookup(robot);

  if (!lookup) {
    res.send("building lookup, gimme a second :cold_sweat:");
    return;
  }

  return lookup[trackId];
};

const getDefaultDevice = robot => {
  return robot.brain.get("sherpaMusicDefaultDevice");
};

const setDefaultDevice = (robot, id) => {
  return robot.brain.set("sherpaMusicDefaultDevice", id);
};

const canDoInRoom = (res, movedResponses) => {
  let canDoHere = true;
  console.log("sherpa local: ", SHERPA_LOCAL);
  if (SHERPA_LOCAL !== "true" && res.message.room !== ROOMS.music) {
    console.log("Message came from NON-STANDARD room!");
    if (res.message.room === ROOMS.sherpaDev) {
      console.log("Came from sherpa-dev... OK");
      res.send(res.random(sherpaDevResponses));
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

const canPlayInRoom = res => canDoInRoom(res, musicControlMovedResponses);

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
  canVolInRoom,
  getDefaultDevice,
  setDefaultDevice
};
