import convict from 'convict';

const conf = convict({
    env: {
        doc: 'The application environment.',
        format: ['production', 'development'],
        default: 'development',
        env: 'NODE_ENV',
    },
    api: {
        queue: {
            port: {
                doc: 'The redis port',
                format: 'port',
                default: 6379,
                env: 'API_QUEUE_PORT',
            },
            host: {
                doc: 'The redis host',
                format: String,
                default: 'localhost',
                env: 'API_QUEUE_HOST',
            },
            password: {
                doc: 'The redis password',
                format: String,
                default: '',
                env: 'API_QUEUE_PASSWORD',
            },
        },
        logmatic: {
            token: {
                doc: 'The token for logmatic logging',
                format: String,
                default: 'XkyH-i19SQONm0UHtz_L2A',
            },
        },
    },
    gram: {
        firstName: {
            format: String,
            default: `Louis`
        },
        lastName: {
            format: String,
            default: `De Larrard`
        },
        companyName: {
            format: String,
            default: `180gram SAS`
        },
        countryCode: {
            format: String,
            default: `FR`
        },
        zip: {
            format: String,
            default: `14076`
        },
        city: {
            format: String,
            default: `Caen`
        },
        address: {
            format: String,
            default: `17 Rue Claude Bloch`
        },
        email: {
            format: String,
            default: `valentin@180gram.io`
        },
        phone: {
            format: String,
            default: `+33651483128`
        },
    },
    accounts: {
        juno: {
            login: {
                format: String,
                default: 'v.roudge@gmail.com',
            },
            password: {
                format: String,
                default: 'e77P90pn',
            }
        },
        rushhour: {
            login: {
                format: String,
                default: 'v.roudge@gmail.com',
            },
            password: {
                format: String,
                default: 'e77p90pn',
            },
        },
        hardwax: {
            login: {
                format: String,
                default: '',
            },
            password: {
                format: String,
                default: '',
            },
        },
        coldcuts: {
            login: {
                format: String,
                default: '',
            },
            password: {
                format: String,
                default: '',
            },
        },
        sideone: {
            login: {
                format: String,
                default: '180gram',
            },
            password: {
                format: String,
                default: 'e77P90pn',
            },
        },
        emile: {
            login: {
                format: String,
                default: '',
            },
            password: {
                format: String,
                default: '',
            },
        },
        misbits: {
            login: {
                format: String,
                default: '',
            },
            password: {
                format: String,
                default: '',
            },
        },
    },
    finance: {
        ccNumber: {
            doc: `Credit card number`,
            format: String,
            default: `4242424242424242`,
            env: 'CC_NUMBER'
        },
        expiryMonth: {
            doc: `Credit card expiration month`,
            format: String,
            default: `12`,
            env: `CC_EXPIRY_MONTH`
        },
        expiryYear: {
            doc: `Credit card expiration year`,
            format: String,
            default: `2020`,
            env: `CC_EXPIRY_YEAR_LONG`
        },
        expiryYearShort: {
            doc: `Credit card expiration year`,
            format: String,
            default: `20`,
            env: `CC_EXPIRY_YEAR_SHORT`
        },
        cvv: {
            doc: `Credit card cvv`,
            format: String,
            default: `123`,
            env: `CC_CVV`
        }
    }
});

//Build queue DSN
//redis://[:password@]host[:port][/db-number][?option=value]
const getRedisDsn = (config) => {
    const pass = config.get('api.queue.password') ? `${config.get('api.queue.password')}@` : '';
    return `redis://${pass}${config.get('api.queue.host')}:${config.get('api.queue.port')}`;
};

conf.set('api.queue.dsn', getRedisDsn(conf));

export default conf.getProperties();
