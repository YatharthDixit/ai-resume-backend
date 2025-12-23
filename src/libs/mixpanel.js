const Mixpanel = require('mixpanel');
const logger = require('../utils/logger');

let mixpanel = null;

if (process.env.MIXPANEL_TOKEN) {
  mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV !== 'production',
  });
  logger.info('Mixpanel initialized successfully');
} else {
  logger.warn('MIXPANEL_TOKEN is not defined in .env, Mixpanel tracking will be disabled.');
}

module.exports = mixpanel;
