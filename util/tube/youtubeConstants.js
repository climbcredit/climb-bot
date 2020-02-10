const { YOUTUBE_API_KEY } = process.env;

module.exports = {
    youtubeVideoDataUrl: id =>
        `https://www.googleapis.com/youtube/v3/videos?id=${id}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails`,
};
