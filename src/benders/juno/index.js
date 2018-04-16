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
        const things = [];
        try {
            const {variants} = this;

            logger.nfo('Begin juno bender', this.variants);
            things.push('Starting');

            const allUnavailable = _.compact(await Promise.all(
                _.map(variants, (variant, variantId) => this.createPageAndAddToCart(variantId, variant))
            ));

            if(allUnavailable.length) return allUnavailable;

            this.page = await this.bro.newPage();
            things.push('Done with availability');
            await this.page.goto('https://www.juno.co.uk/cart/');
            things.push('Done going to cart');
            await this.page.waitForSelector(`select.delivery_country`);
            things.push('Done waiting for delivery country');
            await this.page.select('select.delivery_country', countryCodes[this.destinationAddress.country]);
            things.push('Selected delivery country');
            await this.page.click('#cart_table_container > form:nth-child(3) > div > div:nth-child(2) > div > input');
            things.push('Clicked button 1');
            await this.page.waitForSelector(`#shipping_val`);
            things.push('Done waiting for selector shipping val');
            const shippingPrice = await this.page.evaluate(() => {
                return document.querySelector(`#shipping_val`).textContent.replace('€', '');
            });

            things.push('Done calculating shipping price');

            if (checkout) {
                await this.login();
                await this.fillShippingInfo();

                if (process.env.NODE_ENV === 'production') {
                    await this.page.click(`#co_submit_1`);
                }
                return {type: 'checkout', value: 'success'}
            } else {
                logger.nfo('End juno bender', this.variants);
                return {
                    type: 'shipping',
                    retailerId: this.retailerId,
                    shipping: {price: shippingPrice, currency: 'eur'},
                    variants
                };
            }
        } catch (e) {
            logger.err('Error in Juno bender', {stack: e.stack, message: e.message, things});
            return Promise.reject(new Error(e));
        }
    }

    async createPageAndAddToCart(variantIndex, variant) {
        const page = await this.bro.newPage();

        page.setRequestInterception(true);
        page.on('request', request => {
            const intercepted = ['image', 'font', 'gif', 'jpeg', 'png'];

            if (intercepted.includes(request.resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });
        await page.goto(variant.shopId);

        const itemIsAvailable = await page.evaluate(() => {
            return document.querySelectorAll('a.btn.btn-cta.btn-prod-alert.mb-2').length === 0;
        });

        this.variants[variantIndex].available = itemIsAvailable;
        console.log(this.variants);

        if (itemIsAvailable) {
            await page.click('.btn.btn-cta.mb-2.ml-2');
            await page.waitFor(1500);
            return null;
        } else {
            const allUnavailable = _.filter(variants, 'available').length === 0;
            const endOfArray = variantIndex === this.variants.length;

            if (endOfArray && allUnavailable) {
                return {type: 'all-unavailable', retailerId: this.retailerId, variants};
            }
        }
        return null;
    }

    async login() {
        await this.page.goto('https://www.juno.co.uk/login/?redir=checkout');
        await this.page.waitForSelector(`#email`);
        await this.page.type(`#email`, config.accounts.juno.login);
        await this.page.type(`#password`, config.accounts.juno.password);
        await this.page.click('#login-form > tbody > tr:nth-child(4) > td.input > input');
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
