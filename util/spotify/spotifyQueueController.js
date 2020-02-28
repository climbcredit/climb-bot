const {
  playSong,
  playNextSong,
  getMusicStatus,
  playDefaultPlaylist,
  getTrackInfo
} = require("./spotifyRequester");

const { getTubeDataById } = require("../tube/tubeRequester");

const {
  getTubeIdFromUrl,
  formatVideoQueueObject,
  playTubeByUrl,
  getVideoTimeoutDuration,
  closeChrome
} = require("../tube/tubeHelper");

const {
  cleanUri,
  getQueue,
  getQueueNowPlaying,
  setQueueNowPlaying,
  evacuateQueueNowPlaying,
  queueContainsSong,
  getIdFromUri,
  getDefaultPlaylistUriList,
  setDefaultPlaylistUriList,
  getDefaultPlaylistLookup
} = require("./spotifyBrainHelper");

const get = require("lodash.get");
const shuffle = require("lodash.shuffle");
const runApplescript = require("run-applescript");

let _currentTimeoutId;

/*
HOW THE QUEUE WORKS:

The queue itself is stored in the robot's brain (redis).
The spotify songs in the queue are objects that look like this:

{
    songName: "Waterloo",
    songArtist: "Abba",
    songUri: "spotify:track:blahblah",
    songId: "blahblah",
    userId: "1",
    type: "SPOTIFY"
}

Youtube videos look like this:

{
    videoName: "Bustin",
    videoUrl: "https://www.youtube.com/watch?v=0tdyU_gW6WE",
    videoId: "0tdyU_gW6WE",
    totalTime: 36000,
    offset: 6000,
    userId: "1",
    type: "YOUTUBE"
}

Whenever a song is added to the queue (`sherpa queue abba super trouper`), a call is made to the Spotify API to get the time remaining on the currently playing song.
Once we get that, we set a timeout for that amount of time (+ 200 ms). This is `playNextSongAfterCurrentSongIsDone`.
When that timeout is hit, we check the playback status again. One of two things will be true:
    1) the same song is still playing (or paused). Note the time remaining, set another timeout, and check back then.
    2) playback is stopped (not paused). this happens when the last song was also queued. Invokes `playNext`.

`playNext` intelligently plays the next thing that should be playing.
If there is at least one song in the queue, it will play it, get the music status, and set a timeout to check back when that song is done.
If there is nothing in the queue, it play a song from the stored list of randomized uris from the default playlist.

Doing `sherpa play abba mamma mia` invokes `playNow`, which works basically like `playNext` except it isn't smart and plays whatever you tell it to.
It will also set up the timeout.

Some G O T C H A S:

If a song is being added to the queue or played directly, we need to pass the responder object from the script file (probably `spotify.js`).
This is so that we can pull the user ID off of it and add it to the object, so that `sherpa blame` will work.

Make sure that if you are manipulating the currently playing song that you are cancelling and resetting the timeout.
There is a `cancelTimeout` utility to help you do this. If you don't, songs will get skipped prematurely or play at weird times.
Also, make sure that every timeout is set to the `_currentTimeoutId` variable, so that it can be cleared easily.
*/

const cancelTimeout = () => {
  return _currentTimeoutId && clearTimeout(_currentTimeoutId);
};

const addSongToQueue = (robot, res, uri) => {
  const currentQueue = getQueue(robot);
  const songId = getIdFromUri(uri);
  return getTrackInfo(songId, robot).then(song => {
    const queueObj = {
      userId: get(res, "message.user.id"),
      songUri: uri,
      songId: songId,
      songName: song.name,
      songArtist: song.artists.map(artist => artist.name).join(", "),
      type: "SPOTIFY"
    };
    currentQueue.push(queueObj);
    return Promise.resolve(song);
  });
};

const addVideoToQueue = async (robot, res, url) => {
  const currentQueue = getQueue(robot);
  const videoQueueObject = await formatVideoQueueObject(robot, res, url);

  currentQueue.push(videoQueueObject);
};

const playNow = (robot, res, uri) => {
  uri = cleanUri(uri);
  const songId = getIdFromUri(uri);
  //TODO: handle case where someone tries to play a song during a tube
  cancelTimeout();
  return closeChrome(() =>
    getTrackInfo(songId, robot).then(song => {
      const queueObj = {
        userId: get(res, "message.user.id"),
        songUri: uri,
        songId: songId,
        songName: song.name,
        songArtist: song.artists.map(artist => artist.name).join(", "),
        type: "SPOTIFY"
      };
      return playSongAndSetTimeout(uri, robot).then(songToPlay => {
        setQueueNowPlaying(robot, queueObj);
        return Promise.resolve(songToPlay);
      });
    })
  );
};

const playSongWithRetry = async (songId, uri, robot, attempts) => {
  playSong(uri, robot).then(
    () => {
      console.log("Playing next song");
      return;
    },
    async err => {
      if (attempts > 10) {
        robot.messageRoom(
          "#sherpa-dev",
          `Ok, spotify is super stuck. I give up.`
        );
        throw new Error("Unable to start local spotify client");
      }
      console.log("MASSIVE SPOTIFY ERROR");
      console.log(err);
      robot.messageRoom(
        "#sherpa-dev",
        `Sherpa is doing that thing where spotify gets stuck, I'm gonna try to kick it for you: ${err}`
      );
      //   await runApplescript('tell application "Spotify" to activate');
      //   await runApplescript("delay 1");
      //   await runApplescript(
      //     `tell application "Spotify" to play track "${songId}"`
      //   );
      return playSongWithRetry(songId, uri, robot, attempts + 1);
    }
  );
};

const playSongAndSetTimeout = async (uri, robot) => {
  uri = cleanUri(uri);
  const songId = getIdFromUri(uri);
  return closeChrome(() =>
    getTrackInfo(songId, robot).then(song => {
      cancelTimeout();
      const songDuration = get(song, "duration_ms");
      if (!songDuration) {
        robot.messageRoom(
          "#sherpa-dev",
          `got an invalid duration for a song while trying to play it. song uri: ${uri} duration: ${songDuration}`
        );
        throw new Error("Invalid song duration");
      }
      return playSongWithRetry(songId, uri, robot, 0).then(() => {
        _currentTimeoutId = setTimeout(() => {
          playNext(robot);
        }, songDuration);
        return Promise.resolve(song);
      });
    })
  );
};

const playSongFromDefaultPlaylist = robot => {
  const uriList = getDefaultPlaylistUriList(robot);
  let listClone;

  if (uriList.length) {
    listClone = [...uriList];
  } else {
    const fullUriList = Object.keys(getDefaultPlaylistLookup(robot));
    listClone = shuffle(fullUriList);
  }

  const uriToPlay = listClone.shift();

  return playSongAndSetTimeout(uriToPlay, robot).then(song => {
    setDefaultPlaylistUriList(robot, listClone);
    return Promise.resolve(song);
  });
};

const playNext = robot => {
  const queueIsNotEmpty = queueContainsSong(robot);
  if (queueIsNotEmpty) {
    const songToPlay = getQueue(robot).shift();
    const type = songToPlay.type;
    if (type === "SPOTIFY") {
      setQueueNowPlaying(robot, songToPlay);
      playSongAndSetTimeout(songToPlay.songUri, robot);
    }
    if (type === "YOUTUBE") {
      const timeoutDuration = getVideoTimeoutDuration(songToPlay);
      playTubeByUrl(robot, songToPlay);
      playNextSongAfterTubeIsDone(robot, timeoutDuration);
    }
  } else {
    evacuateQueueNowPlaying(robot);
    playSongFromDefaultPlaylist(robot);
  }
};

const playNextSongAfterTubeIsDone = (robot, timeoutDuration) => {
  cancelTimeout();
  _currentTimeoutId = setTimeout(() => {
    return playNext(robot);
  }, timeoutDuration);
};

module.exports = {
  addSongToQueue,
  addVideoToQueue,
  playNext,
  playNow
};
