const { SPOTIFY_USER_ID, SPOTIFY_PLAYLIST_ID } = process.env;

module.exports = {
  //uris
  carelessWhisperUri: "spotify:track:4jDmJ51x1o9NZB5Nxxc7gY",
  fridayUri: "spotify:track:4fK6E2UywZTJIa5kWnCD6x",
  //don't commit this
  defaultPlaylistUri: `spotify:user:${SPOTIFY_USER_ID}:playlist:${SPOTIFY_PLAYLIST_ID}`,

  //urls
  spotifyAuthorizeUrl: "https://accounts.spotify.com/authorize/",
  spotifyTokenUrl: "https://accounts.spotify.com/api/token",
  spotifyPlaybackUrl: "https://api.spotify.com/v1/me/player",
  spotifyPlaySongUrl: deviceId =>
    `https://api.spotify.com/v1/me/player/play${
      deviceId ? `?device_id=${deviceId}` : ""
    }`,
  spotifyNextSongUrl: "https://api.spotify.com/v1/me/player/next",
  spotifyPauseUrl: "https://api.spotify.com/v1/me/player/pause",
  spotifyTrackUrl: id => `https://api.spotify.com/v1/tracks/${id}`,
  spotifyDefaultPlaylistTracksUrl: `https://api.spotify.com/v1/users/${SPOTIFY_USER_ID}/playlists/${SPOTIFY_PLAYLIST_ID}/tracks`,
  spotifyDefaultPlaylistAddTrackUrl: id =>
    `https://api.spotify.com/v1/users/${SPOTIFY_USER_ID}/playlists/${SPOTIFY_PLAYLIST_ID}/tracks?uris=${id}`,
  spotifySearchAlbumUrl: q =>
    `https://api.spotify.com/v1/search?q=${q}&type=album`,
  spotifySearchArtistUrl: q =>
    `https://api.spotify.com/v1/search?q=artist:${q}&type=track&limit=6`,
  spotifySearchTrackUrl: q =>
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=6`,
  spotifyGetAlbumTracksUrl: id =>
    `https://api.spotify.com/v1/albums/${id}/tracks?limit=50`,
  spotifyShuffleUrl: "https://api.spotify.com/v1/me/player/shuffle?state=true",
  spotifyUserProfile: id => `https://api.spotify.com/v1/users/${id}`,
  spotifyDevicesUrl: `https://api.spotify.com/v1/me/player/devices`
};
