const request = require("request-promise");
const get = require("lodash.get");

const {
  defaultPlaylistUri,
  spotifyAuthorizeUrl,
  spotifyPlaybackUrl,
  spotifyPlaySongUrl,
  spotifyTokenUrl,
  spotifyNextSongUrl,
  spotifyPauseUrl,
  spotifyTrackUrl,
  spotifyDefaultPlaylistTracksUrl,
  spotifySearchAlbumUrl,
  spotifySearchArtistUrl,
  spotifySearchTrackUrl,
  spotifyGetAlbumTracksUrl,
  spotifyShuffleUrl,
  spotifyDefaultPlaylistAddTrackUrl,
  spotifyUserProfile
} = require("./spotifyConstants");

//ENVIRONMENT VARIABLES
const spotClientId = process.env.SPOTIFY_CLIENT_ID;
const spotClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const spotRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
const isLocal = process.env.DIBSY_LOCAL;
const MESSAGE_LENGTH_LIMIT = 3500;
const LOG_CHANNEL = "#dibsy-logs";
const BACKTICKS = "```";
const MESSAGE_INTERVAL = 500;
let messageQueue = [];
let messageQueueRunning;

const messageHeader = (msgType, command) =>
  `*${command}* - ${msgType} (${new Date()}):`;
const stringifyMsg = msgObj => JSON.stringify(msgObj, null, 4);

// Slack's API recommends sending no more than 4000 characters in a message
// Sending more than that will result in a message getting split up, which screws up our formatting
// This helper ensures that a single message will not exceed 4000 chars, by breaking it into multiple messages
const splitMessage = (msgType, command, msgObj) => {
  const fullMessage = stringifyMsg(msgObj);
  const splitMessages = fullMessage.split(/\n/).reduce(
    (messages, line) => {
      const idx = messages.length - 1;
      const currentMsg = messages[idx];
      if (
        Buffer.from(`${currentMsg}\n${line}`).length <= MESSAGE_LENGTH_LIMIT
      ) {
        messages[idx] = `${currentMsg}\n${line}`;
      } else {
        messages.push(line);
      }
      return messages;
    },
    [""]
  );
  return splitMessages.map(
    (msg, i) => `
${messageHeader(`${msgType} ${i + 1}/${splitMessages.length}`, command)}
${BACKTICKS}${msg}${BACKTICKS}
`
  );
};

const startMessageQueue = robot => {
  messageQueueRunning = true;
  setInterval(() => {
    if (messageQueue.length) {
      robot.messageRoom(LOG_CHANNEL, messageQueue.shift());
    }
  }, MESSAGE_INTERVAL);
};

const addToMessageQueue = (robot, messages) => {
  messageQueue = messageQueue.concat(messages);
  return !messageQueueRunning && startMessageQueue(robot);
};

const logRequest = (robot, command, req) => {
  const messages = splitMessage("Request", command, req);
  return !isLocal && addToMessageQueue(robot, messages);
};

//Remove unwanted fields
const ommissions = [
  ["body", "item", "available_markets"],
  ["body", "item", "album", "available_markets"],
  ["body", "album", "available_markets"],
  ["body", "available_markets"]
];

// There are better ways to do this but... ¯\_(ツ)_/¯
const removeFields = res => {
  const formattedObj = JSON.parse(JSON.stringify(res));
  if (get(formattedObj, ommissions[0])) {
    delete formattedObj.body.item.available_markets;
  }

  if (get(formattedObj, ommissions[1])) {
    delete formattedObj.body.item.album.available_markets;
  }

  if (get(formattedObj, ommissions[2])) {
    delete formattedObj.body.album.available_markets;
  }

  if (get(formattedObj, ommissions[3])) {
    delete formattedObj.body.available_markets;
  }

  return formattedObj;
};

const logResponse = (robot, command, res) => {
  const messages = splitMessage("Response", command, removeFields(res));
  return !isLocal && addToMessageQueue(robot, messages);
};

//Helper functions for structuring headers
const _getRefreshHeaders = () => {
  return {
    Authorization:
      "Basic " +
      new Buffer(spotClientId + ":" + spotClientSecret).toString("base64")
  };
};

const _getApiHeaders = token => {
  return { Authorization: `Bearer ${token}` };
};

//chain off of this to get a new access token for your request
const refetchAccessToken = () => {
  const refreshOptions = {
    method: "post",
    url: spotifyTokenUrl,
    headers: _getRefreshHeaders(),
    form: {
      grant_type: "refresh_token",
      refresh_token: spotRefreshToken
    },
    json: true
  };

  return request(refreshOptions).then(body => {
    return Promise.resolve({ token: body.access_token });
  });
};

//make basic spotify requests
const _makeSpotRequest = ({ robot, command, url, method, body }) => {
  return refetchAccessToken()
    .then(({ token }) => {
      const shouldContainBody = ["put", "post"].includes(method);
      const requestObj = {
        method,
        url,
        headers: _getApiHeaders(token),
        json: true,
        resolveWithFullResponse: true
      };
      if (shouldContainBody) {
        requestObj.body = body ? body : {};
      }
      if (robot) {
        logRequest(robot, command, requestObj);
      }
      return request(requestObj);
    })
    .then(res => {
      if (robot) {
        logResponse(robot, command, res);
      }
      return res.body;
    });
};

//returns a music status object from spotify
//TODO: document this shape
const getMusicStatus = robot => {
  return _makeSpotRequest({
    robot,
    command: "Get Music Status",
    url: spotifyPlaybackUrl,
    method: "get"
  });
};

const getTrackInfo = (trackId, robot) => {
  return _makeSpotRequest({
    robot,
    command: "Get Track Info",
    url: spotifyTrackUrl(trackId),
    method: "get"
  });
};

const getSpotifyUserProfile = (userId, robot) => {
  return _makeSpotRequest({
    robot,
    command: "Get User Name",
    url: spotifyUserProfile(userId),
    method: "get"
  });
};

const playSong = (songUri, robot) => {
  return _makeSpotRequest({
    robot,
    command: "Play Song",
    url: spotifyPlaySongUrl,
    method: "put",
    body: {
      uris: [songUri]
    }
  });
};

const resumePlayback = robot => {
  return _makeSpotRequest({
    robot,
    command: "Resume Playback",
    url: spotifyPlaySongUrl,
    method: "put"
  });
};

const playDefaultPlaylist = robot => {
  return _makeSpotRequest({
    robot,
    command: "Play Default Playlist",
    url: spotifyPlaySongUrl,
    method: "put",
    body: {
      context_uri: defaultPlaylistUri
    }
  });
};

const _addPageOfPlaylistTracksToArray = (url, tracklist) => {
  return _makeSpotRequest({
    url,
    method: "get"
  }).then(response => {
    tracklist.push(...response.items);
    if (response.next) {
      return _addPageOfPlaylistTracksToArray(response.next, tracklist);
    } else {
      return Promise.resolve(tracklist);
    }
  });
};

const getFullDefaultPlaylistTracklist = () => {
  const tracklist = [];
  return _addPageOfPlaylistTracksToArray(
    spotifyDefaultPlaylistTracksUrl,
    tracklist
  );
};

//next song. use this to skip a song on the default. this is not called when there is a song in the queue
const playNextSong = robot => {
  return refetchAccessToken().then(({ token }) => {
    const command = "Play Next Song";
    const requestObj = {
      method: "post",
      url: spotifyNextSongUrl,
      headers: _getApiHeaders(token),
      json: true,
      body: {}
    };

    if (robot) {
      logRequest(robot, command, requestObj);
    }

    return request(requestObj).then(res => {
      if (robot) {
        logResponse(robot, command, res);
      }
      return res;
    });
  });
};

//pause the currently playing song
const pause = () => {
  return _makeSpotRequest({
    url: spotifyPauseUrl,
    method: "put"
  });
};

const ensureShuffleOn = () => {
  return _makeSpotRequest({
    url: spotifyShuffleUrl,
    method: "put"
  });
};

const findAlbumTracksById = id => {
  return _makeSpotRequest({
    url: spotifyGetAlbumTracksUrl(id),
    method: "get"
  });
};

const findAlbumByTerm = term => {
  return _makeSpotRequest({
    url: spotifySearchAlbumUrl(term),
    method: "get"
  }).then(results => {
    const firstResult = results.albums.items[0];
    const id = firstResult.id;
    return findAlbumTracksById(id).then(tracks => {
      return Promise.resolve({
        album: firstResult,
        tracks: tracks.items
      });
    });
  });
};

const findSongsByTerm = term => {
  return _makeSpotRequest({
    url: spotifySearchTrackUrl(term),
    method: "get"
  }).then(results => {
    return Promise.resolve(results.tracks.items);
  });
};

const findSongsByArtist = artist => {
  return _makeSpotRequest({
    url: spotifySearchArtistUrl(artist),
    method: "get"
  }).then(results => {
    return Promise.resolve(results.tracks.items);
  });
};

const addSongToDefaultPlaylist = (uri, robot) => {
  return _makeSpotRequest({
    robot,
    command: "Add Song to Default Playlist",
    url: spotifyDefaultPlaylistAddTrackUrl(uri),
    method: "post"
  });
};

module.exports = {
  refetchAccessToken,
  getMusicStatus,
  playSong,
  playDefaultPlaylist,
  playNextSong,
  pause,
  resumePlayback,
  getTrackInfo,
  findAlbumByTerm,
  findSongsByTerm,
  findSongsByArtist,
  ensureShuffleOn,
  addSongToDefaultPlaylist,
  getFullDefaultPlaylistTracklist,
  getSpotifyUserProfile
};
