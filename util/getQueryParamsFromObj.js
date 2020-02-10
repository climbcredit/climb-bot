module.exports = (obj) => {
    const keys = Object.keys(obj);
    return keys.reduce((string, key, index) => {
        const suffix = index === (keys.length - 1) ? "" : "&";
        return `${string}${key}=${obj[key]}${suffix}`;
    }, "?");
};