const request = require('request-promise');
const { YOUTUBE_API_KEY } = process.env;
const { youtubeVideoDataUrl } = require('./youtubeConstants');

const makeTubeRequest = async ({ url }) => {
    return await request({
        method: 'get',
        url,
        json: true,
    });
};

const getTubeDataById = async id => {
    const tubeData = await makeTubeRequest({
        url: youtubeVideoDataUrl(id),
    });

    const item = tubeData.items[0];
    return item;
};

module.exports = {
    getTubeDataById,
};
