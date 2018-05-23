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
            logger.nfo('Begin juno bender', this.variants);

            things.push('Starting');
            const queriedVariants = await Promise.all(
                _.map(this.variants, (variant, variantId) => this.createPageAndAddToCart(variantId, variant))
            );

            if (_.filter(this.variants, 'available').length === 0) {
                return {type: 'all-unavailable', retailerId: this.retailerId, variants};
            }

            this.page = await this.bro.newPage();

            things.push('Done with availability');
            await this.page.goto('https://www.juno.co.uk/cart/');
            await this.page.waitForSelector(`input.btn.btn-primary`);
            await this.page.click(`input.btn.btn-primary`);
            await this.page.goto(`https://www.juno.co.uk/cart/change-country/`);
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
                    variants: this.variants
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
            if (request.url().endsWith('.png') || request.url().endsWith('.jpg') || request.url().endsWith('.gif'))
                request.abort();
            else
                request.continue();
        });
        const itemLink = variant.shopId.split('/products/')[1].replace('-','/');
        await page.goto(`https://www.juno.co.uk/cart/add/${itemLink}/?popup=1`);
        try {
            await page.waitForSelector(`#cart-info-messages`);

            const itemIsAvailable = await page.evaluate(() => {
                return document.querySelector('#cart-info-messages > div > span').innerHTML.includes('Added to cart');
            });

            this.variants[variantIndex].available = itemIsAvailable;
            await page.reload();
            await page.waitFor(1000);
            await page.close();
            return itemIsAvailable;
        } catch(e) {
            await page.waitFor(1000);
            await page.close();
        }
        return false
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
