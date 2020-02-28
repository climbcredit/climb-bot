const { getTubeDataById } = require("./tubeRequester");
const { pause } = require("../spotify/spotifyRequester");
const { setQueueNowPlaying } = require("../spotify/spotifyBrainHelper");
const moment = require("moment");
const get = require("lodash.get");
const opn = require("opn");
const { exec } = require("child_process");

const { SHERPA_LOCAL } = process.env;

const isYoutubeUrl = url => {
  const conventionalMatch = url.match(/www\.youtube\.com\/watch\?v=(.+)/);
  const shortFormMatch = url.match(/youtu\.be\/(.+)\?(t=(\d+))?/);

  return !!(conventionalMatch || shortFormMatch);
};

const getTubeIdFromUrl = url => {
  //TODO: i am a complete fucking hack
  const conventionalMatch = url.match(/www\.youtube\.com\/watch\?v=(.+)/);
  const shortFormMatch = url.match(/youtu\.be\/(.+)\?(t=(\d+))?/);
  if (conventionalMatch) {
    return conventionalMatch[1];
  }
  if (shortFormMatch) {
    return shortFormMatch[1];
  }
  return null;
};

const getOffsetFromUrl = url => {
  //only works for shortform urls for now because i hate regular expressions
  const shortFormMatch = url.match(/youtu\.be\/(.+)\?(t=(\d+))?/);
  if (shortFormMatch) {
    const seconds = parseInt(shortFormMatch[3]);
    return seconds * 1000; //return in milliseconds
  }
  return null;
};

// {
//     videoName: "Bustin",
//     videoUrl: "https://www.youtube.com/watch?v=0tdyU_gW6WE",
//     videoId: "0tdyU_gW6WE",
//     totalTime: 36000,
//     offset: 6000,
//     userId: "1",
//     type: "YOUTUBE"
// }

const formatVideoQueueObject = async (robot, res, url) => {
  const tubeId = getTubeIdFromUrl(url);
  const { snippet, contentDetails } = await getTubeDataById(tubeId);

  const videoName = snippet.title;
  const totalTime = moment.duration(contentDetails.duration).asMilliseconds();
  const offset = getOffsetFromUrl(url);
  const userId = get(res, "message.user.id");
  const type = "YOUTUBE";
  const hasNyanpic = res.nyanpic !== undefined;
  const nyanpic = res.nyanpic;

  return {
    videoName,
    videoUrl: url,
    videoId: tubeId,
    totalTime,
    offset,
    userId,
    type,
    hasNyanpic,
    nyanpic
  };
};

const closeChrome = callback => {
  // console.log('Killing Chrome');
  // if (SHERPA_LOCAL) {
  //     callback();
  // } else {
  //     exec(`killall -9 "Google Chrome"`, (err, stdout, stderr) => {
  //         callback();
  //     });
  // }
  callback();
};

const playTubeByUrl = (robot, queueObj) => {
  const url = queueObj.videoUrl;
  setQueueNowPlaying(robot, queueObj);
  pause().catch(e => {
    robot.messageRoom("#sherpa-dev", e);
    return; //this will 403 if spot is already paused, and we don't care about that.
  });
  closeChrome(() => {
    if (queueObj.hasNyanpic) {
      robot.messageRoom("#dibsy-dev", queueObj.nyanpic);
    }
    opn(url);
  });
};

const getVideoTimeoutDuration = ({ totalTime, offset }) => {
  const vidTime = offset ? totalTime - offset : totalTime;
  return vidTime + 2500;
};

module.exports = {
  closeChrome,
  getTubeIdFromUrl,
  formatVideoQueueObject,
  playTubeByUrl,
  getVideoTimeoutDuration,
  isYoutubeUrl
};
