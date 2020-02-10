const {
  getMusicStatus,
  playSong,
  playDefaultPlaylist,
  playNextSong,
  pause,
  resumePlayback,
  getTrackInPlaylistContext,
  findAlbumByTerm,
  findSongsByArtist,
  findSongsByTerm,
  ensureShuffleOn,
  addSongToDefaultPlaylist,
  getFullDefaultPlaylistTracklist
} = require("../util/spotify/spotifyRequester");

const {
  cleanUri,
  getUserNameById,
  setUpQueue,
  getQueue,
  queueContainsSong,
  removeSongFromQueue,
  evacuateQueue,
  getQueueNowPlaying,
  getSearchResults,
  setSearchResults,
  evacuateSearchResults,
  getDefaultTrackInfo,
  setDefaultPlaylistLookup,
  setDefaultPlaylistUriList,
  getDefaultPlaylistUriList,
  canPlayInRoom
} = require("../util/spotify/spotifyBrainHelper");

const {
  formatTrack,
  formatQueue,
  formatStatus,
  formatAlbumInfo,
  formatQueueBlame,
  formatDefaultBlame,
  formatPlayNow,
  formatSearchResults,
  formatAddToDefault
} = require("../util/spotify/spotifyFormatter");

const {
  addSongToQueue,
  addVideoToQueue,
  playNow,
  playNext
} = require("../util/spotify/spotifyQueueController");

const { closeChrome, isYoutubeUrl } = require("../util/tube/tubeHelper");

const {
  carelessWhisperUri,
  fridayUri
} = require("../util/spotify/spotifyConstants");

const get = require("lodash.get");
const shuffle = require("lodash.shuffle");
const { DIBSY_LOCAL } = process.env;
const DIBSY_VOICE = "Victoria";
const { exec } = require("child_process");

/*
TODOS FOR SPOTIFY FEATURE PARITY:
- `tube me` <- good lord


TODOS FOR OPTIMIZATION/NEW FEATURES:
- finding more than 6 results when searching
- listing contents of albums that have more that 50 tracks
- seriously audit the network calls made here and look for opportunities to not do them
- DRY up code and cleanup in general (#hackathon)
- better in-file documentation of how everything works and how objects are/should be shaped
- maybe don't keep mutating redis variables in place
- hardening and feedback against spotify errors and empty search results
- better spotify error logging, complaining loudly when rate limited (if this ever happens)
- fancier formatting /shrug
- proper documentation that the bot will pick up
- take a look at `sonos.js` and clean it up a bit-- outside the scope of this file, obvi
- rewrite all the promises to use async await and get out of the stone age :/
*/

const buildDefaultPlaylistLookup = robot => {
  return getFullDefaultPlaylistTracklist().then(tracklist => {
    const lookup = tracklist.reduce((obj, playlistTrack) => {
      obj[playlistTrack.track.uri] = playlistTrack;
      return obj;
    }, {});

    const uriList = tracklist.map(track => track.track.uri);

    setDefaultPlaylistUriList(robot, shuffle(uriList));
    setDefaultPlaylistLookup(robot, lookup);
  });
};

const setupSpotify = robot => {
  setUpQueue(robot);
  evacuateSearchResults(robot);
  return buildDefaultPlaylistLookup(robot).then(() => {
    playNext(robot);
  });
};

const transformTrackToSearchResultObj = track => {
  return {
    songUri: track.uri,
    songId: track.id,
    songName: track.name,
    songArtist: track.artists.map(a => a.name).join(", "),
    type: "SPOTIFY"
  };
};

const isSpotifyUri = term => {
  // spotify:track:* = "Copy Spotify URI"
  // open.spotify.com = "Copy Song Link"
  term = cleanUri(term);
  return !!term.match(/(spotify:track:|open\.spotify\.com)/);
};

const isNumber = term => {
  return !!term.match(/^\d+$/);
};

const getSongUriFromSearchTerm = (robot, res, term) => {
  if (isSpotifyUri(term)) {
    return Promise.resolve(term);
  } else if (isNumber(term)) {
    const index = parseInt(term);
    const searchObj = getSearchResults(robot)[index];
    if (!searchObj) {
      res.send(`no search result at index ${index}`);
    }
    return Promise.resolve((searchObj && searchObj.songUri) || null);
  } else {
    return findSongsByTerm(term).then(songs => {
      if (!songs.length) {
        res.send(`no results for search term ${term}`);
        return null;
      }
      return Promise.resolve(songs[0].uri);
    });
  }
};

const addToQueueThenNotify = (robot, res, uri) => {
  uri = cleanUri(uri);
  return addSongToQueue(robot, res, uri).then(() => {
    const queue = getQueue(robot);
    const lastSongIndex = queue.length - 1;
    const lastSong = queue[lastSongIndex];
    if (lastSong) {
      res.send(
        `#${lastSongIndex} in the queue is now "${lastSong.songName}" by ${lastSong.songArtist}`
      );
    } else {
      res.send("Song was not added to a queue properly? Sorry :(");
    }
  });
};

const playThenNotify = (robot, res, uri) => {
  uri = cleanUri(uri);
  return playNow(robot, res, uri).then(() => {
    res.send(formatPlayNow(robot));
  });
};

const addToDefaultPlaylistThenNotify = (res, uri, robot) => {
  uri = cleanUri(uri);
  return addSongToDefaultPlaylist(uri, robot).then(() => {
    res.send(formatAddToDefault());
  });
};

module.exports = robot => {
  setupSpotify(robot);

  robot.respond(/(reset|restart|reboot|rebuild) spotify/i, res => {
    res.send("Attempting to hard reboot spotify integration...");
    setupSpotify(robot)
      .then(() => {
        res.send("Successfully restarted spotify integration!");
      })
      .catch(() => {
        res.send(
          "There was an error while attempting to restart spotify integration. Check #dibsy-logs for more info"
        );
      });
  });

  robot.respond(
    /(credit|blame|who asked for this|why are you like this|regretit|credit but i regret it)\??$/i,
    res => {
      const queueNowPlaying = getQueueNowPlaying(robot);
      if (queueNowPlaying) {
        res.send(formatQueueBlame(robot));
      } else {
        getMusicStatus().then(playbackObj => {
          const trackId = get(playbackObj, "item.uri");
          const playlistTrack = getDefaultTrackInfo(robot, res, trackId);

          if (playlistTrack) {
            formatDefaultBlame(playlistTrack).then(formattedData => {
              res.send(formattedData);
            });
          }
        });
      }
    }
  );

  robot.respond(/queue\??$/i, res => {
    res.send(formatQueue(robot));
  });

  robot.respond(/queue (.*$)/i, async res => {
    if (canPlayInRoom(res)) {
      const term = res.match[1];

      if (isYoutubeUrl(term)) {
        await addVideoToQueue(robot, res, term);
        const queue = getQueue(robot);
        const lastIndex = queue.length - 1;
        const lastEntry = queue[lastIndex];
        const { videoName, videoUrl } = lastEntry;
        res.send(`#${lastIndex} in the queue is ${videoName}`);
      } else {
        getSongUriFromSearchTerm(robot, res, term).then(uri => {
          addToQueueThenNotify(robot, res, uri);
        });
      }
    }
  });

  robot.respond(/play (.*$)/i, res => {
    if (canPlayInRoom(res)) {
      const term = res.match[1];
      getSongUriFromSearchTerm(robot, res, term).then(uri => {
        playThenNotify(robot, res, uri);
      });
    }
  });

  robot.respond(/dequeue (.*$)/i, res => {
    if (canPlayInRoom(res)) {
      const index = res.match[1];
      const queue = getQueue(robot);
      const song = queue[index];
      res.send(`${formatTrack(robot, song)} removed from queue.`);
      getQueue(robot).splice(index, 1);
    }
  });

  robot.respond(/find music (.*$)/i, res => {
    const searchTerm = res.match[1];
    if (searchTerm.substring(0, 3).match(/by /)) {
      const artistTerm = searchTerm.substring(3);
      findSongsByArtist(artistTerm).then(songs => {
        const searchObjs = songs.map(transformTrackToSearchResultObj);
        setSearchResults(robot, searchObjs);
        const formattedSearchResults = formatSearchResults(robot);
        res.send(`\n${formattedSearchResults}`);
      });
    } else {
      //non-artist search term
      findSongsByTerm(searchTerm).then(songs => {
        const searchObjs = songs.map(transformTrackToSearchResultObj);
        setSearchResults(robot, searchObjs);
        if (searchObjs.length) {
          const formattedSearchResults = formatSearchResults(robot);
          res.send(`\n${formattedSearchResults}`);
        } else {
          res.send(`no results for ${searchTerm}`);
        }
      });
    }
  });

  robot.respond(/find album (.*$)/i, res => {
    const searchTerm = res.match[1];
    findAlbumByTerm(searchTerm).then(results => {
      const searchObjs = results.tracks.map(transformTrackToSearchResultObj);
      setSearchResults(robot, searchObjs);
      const formattedAlbum = formatAlbumInfo(results.album);
      const formattedSearch = formatSearchResults(robot);
      res.send(["\n", formattedAlbum, formattedSearch].join("\n"));
    });
  });

  robot.respond(/(play|resume|unpause)$/i, res => {
    if (canPlayInRoom(res)) {
      resumePlayback(robot);
    }
  });

  robot.respond(/(next|skip)/i, res => {
    if (canPlayInRoom(res)) {
      playNext(robot);
    }
  });

  robot.respond(/pause$/i, res => {
    if (canPlayInRoom(res)) {
      pause();
    }
  });

  robot.respond(/(music status\??)$/i, res => {
    getMusicStatus().then(status => {
      formatStatus(robot, res, status).then(formattedStatus => {
        res.send(formattedStatus);
      });
    });
  });

  robot.respond(/(playing\??)$/i, res => {
    getMusicStatus().then(status => {
      formatStatus(robot, res, status).then(formattedStatus => {
        res.send(formattedStatus);
      });
    });
  });

  robot.respond(/add (.+) to the playlist$/, res => {
    if (canPlayInRoom(res)) {
      const term = res.match[1];
      if (["this", "this song"].includes(term)) {
        const nowPlaying = getQueueNowPlaying(robot);
        if (nowPlaying) {
          addToDefaultPlaylistThenNotify(res, nowPlaying.songUri, robot);
        } else {
          res.send(`This song is playing from the default playlist!`);
        }
      } else {
        getSongUriFromSearchTerm(robot, res, term).then(uri => {
          addToDefaultPlaylistThenNotify(res, uri, robot);
        });
      }
    }
  });

  robot.respond(/careless whisper|whisper me/i, res => {
    if (canPlayInRoom(res)) {
      playNow(robot, res, carelessWhisperUri);
    }
  });

  robot.respond(/friday me|it\'s friday/i, res => {
    if (canPlayInRoom(res)) {
      addToQueueThenNotify(robot, res, fridayUri);
    }
  });

  robot.respond(/say (.*$)/i, res => {
    if (canPlayInRoom(res)) {
      pause();
      const message = res.match[1];
      res.send(`_${message}_`);

      //Set small delay (0.5 sec) to give music a chance to pause
      setTimeout(() => {
        exec(`say -v ${DIBSY_VOICE} ${message}`, () => {
          res.send(":blush:");
          resumePlayback(robot);
        });
      }, 500);
    }
  });

  //for testing-- logs some useful info out
  robot.respond(/spotify info/i, res => {
    //can add more stuff here as needed
    const uriList = getDefaultPlaylistUriList(robot);

    res.send(`default playlist uri list length is ${uriList.length}`);
    res.send(`next song to play off of the default should be ${uriList[0]}`);
  });
};
