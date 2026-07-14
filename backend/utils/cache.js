const NodeCache = require('node-cache');

// Standard TTL: 5 minutes (300 seconds), Check period: 60 seconds
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const getCache = (key) => {
  return cache.get(key);
};

const setCache = (key, value, ttl = 300) => {
  return cache.set(key, value, ttl);
};

const deleteCache = (key) => {
  return cache.del(key);
};

const clearCache = () => {
  return cache.flushAll();
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  clearCache,
};
