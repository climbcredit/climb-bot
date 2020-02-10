// const request = require('request');
// const getQueryParamsFromObj = require('../getQueryParamsFromObj');

// const spotifyAuthorizeUrl = "https://accounts.spotify.com/authorize/";
// const spotifyTokenUrl = "https://accounts.spotify.com/api/token";
// const spotClientId = "293d670c6a75462b9a768e7860a504dc";
// const spotClientSecret = "ee5296fae9a840168144579a941913ec";
// const spotRefreshToken = "AQAZ2KeBeTHwfJcSicelAkmG03qJ0-SorhByVCJoDrBzaYSQsEdRemR2rleGAhcvEUf4yKEA4dfoyOVPmmJ4txVb1LGCBlfYEVKWEJRH_Hx74DLW56hn9Xd08EH1AB8tffY";

// const scopes = [
//     "playlist-modify-public",
//     "user-modify-playback-state",
//     "user-read-playback-state",
//     "user-read-currently-playing",
//     "user-read-recently-played"
// ];

// const scopesQuery = scopes.join("%20");

// const queryParams = getQueryParamsFromObj({
//     client_id: "293d670c6a75462b9a768e7860a504dc",
//     response_type: "code",
//     redirect_uri: "https://1stdibs.com",
//     scope: scopesQuery
// });

// const spotUrl = `${spotifyAuthorizeUrl}${queryParams}`;

// const spotRefreshOptions = {
//     url: 'https://accounts.spotify.com/api/token',
//     headers: { 'Authorization': 'Basic ' + (new Buffer(spotClientId + ':' + spotClientSecret).toString('base64')) },
//     form: {
//       grant_type: 'refresh_token',
//       refresh_token: spotRefreshToken
//     },
//     json: true
//   };

//   request.post(spotRefreshOptions, function(error, response, body) {
//     if (!error && response.statusCode === 200) {
//       var access_token = body.access_token;
//       console.log(access_token);
//     }
// });



//client ID: 293d670c6a75462b9a768e7860a504dc
//client secret: ee5296fae9a840168144579a941913ec
//aaron and aaron's sherpa refresh token: AQAZ2KeBeTHwfJcSicelAkmG03qJ0-SorhByVCJoDrBzaYSQsEdRemR2rleGAhcvEUf4yKEA4dfoyOVPmmJ4txVb1LGCBlfYEVKWEJRH_Hx74DLW56hn9Xd08EH1AB8tffY
//https://accounts.spotify.com/authorize/?client_id=5fe01282e44241328a84e7c5cc169165&response_type=code&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&scope=user-read-private%20user-read-email&state=34fFs29kd09
