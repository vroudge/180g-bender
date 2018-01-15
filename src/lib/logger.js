import winston from 'winston'
import config from '../config'
const WinstonLogmatic = require('winston-logmatic');

/*
 log = debug stuff
 nfo = info i kinda want to see
 err = stuff I MUST LOG
 */
export default (() => {
    const currentNodeEnv = config.env;
    const slackChannelToUse = currentNodeEnv !== 'production' ? '#notifications-dev' : '#notifications';

    const logger = new (winston.Logger)({
        transports: [
            new (winston.transports.Console)({
                level: 'debug',
                timestamp: function () {
                    return new Date();
                },
                formatter: function (options) {
                    return winston.config.colorize(options.level, options.timestamp()) + ' ' + winston.config.colorize(options.level, options.level.toUpperCase()) + ' ' + (undefined !== options.message ? options.message : '') +
                           (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
                },
                colorize: true,
                silent: false,
            }),
            new (WinstonLogmatic)({
                level: 'info',
                logmatic: {
                    token: config.api.logmatic.token,
                    defaultProps: {
                        appname: 'bender',
                        hostname: config.env,
                        createdAt: new Date(),
                    },
                },
            })
        ],
    });

    return {
        log: logger.debug,
        nfo: logger.info,
        err: logger.error,
    }
})();


