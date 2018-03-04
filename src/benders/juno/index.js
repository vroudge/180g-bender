import _ from 'lodash';

import config from '../../config';
import logger from '../../lib/logger'
import countryCodes from './countryCodesMap'

export default class Juno {
    constructor(browserInstance, {variants, retailerId, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.retailerId = retailerId;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        const {variants, bro} = this;
        this.page = await bro.newPage();

        await this.page.setRequestInterceptionEnabled(true);
        this.page.on('request', request => {
            const intercepted = ['image', 'font'];

            if (intercepted.includes(request.resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        logger.nfo('Begin juno bender', this.variants);

        for (const [value, index] of variants.entries()) {
            await this.page.goto(index.shopId);

            const itemIsAvailable = await this.page.evaluate(() => {
                return document.querySelectorAll('a.btn.btn-cta.btn-prod-alert.mb-2').length === 0;
            });

            this.variants[value].available = itemIsAvailable;

            if (itemIsAvailable) {
                await this.page.click('.btn.btn-cta.mb-2.ml-2');
                await this.page.waitFor(1500);
            } else {
                const allUnavailable = _.filter(variants, 'available').length === 0;
                const endOfArray = value + 1 === variants.length;

                if (endOfArray && allUnavailable) {
                    return {type: 'all-unavailable', retailerId: this.retailerId, variants};
                }
            }
        }
        logger.nfo('Juno bender go to cart', this.variants);
        await this.page.goto('https://www.juno.co.uk/cart/');
        logger.nfo('Juno wait delivery country', this.variants);
        await this.page.waitForSelector(`select.delivery_country`);
        logger.nfo('Juno select delivery country', this.variants);
        await this.page.select('select.delivery_country', countryCodes[this.destinationAddress.country]);
        logger.nfo('Juno click1', this.variants);
        await this.page.click('#cart_table_container > form:nth-child(3) > div > div:nth-child(2) > div > input');
        logger.nfo('Juno shipping value get', this.variants);
        await this.page.waitForSelector(`#shipping_val`);
        const shippingPrice = await this.page.evaluate(() => {
            return document.querySelectorAll(`#shipping_val`)[0].textContent.replace('€', '');
        });

        if (checkout) {
            logger.nfo('Juno login', this.variants);
            await this.login();
            logger.nfo('Juno fill shipping info', this.variants);
            await this.fillShippingInfo();
            logger.nfo('Juno submit order', this.variants);
            await this.page.click(`#checkout-table > div:nth-child(5) > div:nth-child(1) > div.col-12.col-lg-5.pt-1.input > input`);
            logger.nfo('Click submit juno', this.variants);
            if (process.env.NODE_ENV === 'production') await this.page.click(`#co_submit_1`);
        } else {
            logger.nfo('End juno bender', this.variants);
            return {
                type: 'shipping',
                retailerId: this.retailerId,
                shipping: {price: shippingPrice, currency: 'eur'},
                variants
            };
        }
    }

    async login() {
        await this.page.goto('https://www.juno.co.uk/login/?redir=checkout');
        await this.page.waitForSelector(`#email`);
        await this.page.type(`#email`, config.accounts.juno.login);
        await this.page.type(`#password`, config.accounts.juno.password);
        await this.page.click('#login-form > tbody > tr:nth-child(4) > td.input > input');
        console.log('done login juno');
    }

    async fillShippingInfo() {
        await this.page.waitForSelector(`#first_name`);

        await this.fillField(`#first_name`, this.destinationAddress.first_name);
        await this.fillField(`#last_name`, this.destinationAddress.last_name);
        await this.fillField(`#address1`, this.destinationAddress.line1);
        await this.fillField(`#address2`, this.destinationAddress.line2);
        await this.fillField(`#town_city`, this.destinationAddress.city);
        await this.fillField(`#state_county`, this.destinationAddress.state);
        await this.fillField(`#postcode`, this.destinationAddress.zip);
        await this.fillField(`#cvv`, config.finance.cvv);
    }

    async fillField(selector, value) {
        await this.page.$eval(selector, input => input.value = '');
        await this.page.type(selector, value);
    }
}
