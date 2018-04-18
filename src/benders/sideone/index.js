import config from '../../config';
import logger from '../../lib/logger';
import _ from 'lodash';
import countryCodes from "./countryCodesMap";

export default class sideone {
    constructor(browserInstance, {variants, retailerId, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.retailerId = retailerId;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        try {
            const {variants, bro} = this;
            logger.nfo('Begin Sideone bender', this.variants);

            const queriedVariants = await Promise.all(
                _.map(this.variants, (variant, variantId) => this.createPageAndAddToCart(variantId, variant))
            );

            if (_.filter(this.variants, 'available').length === 0) {
                return {type: 'all-unavailable', retailerId: this.retailerId, variants};
            }

            this.page = await this.bro.newPage();
            await this.page.waitFor(1000);
            await this.page.goto(`https://www.sideone.pl/basketedit.php?mode=1`);
            await this.page.waitForSelector(`#basket_go_next`);
            await this.page.click(`#basket_go_next`);
            await this.page.waitForSelector(`#signin-form_box_left > div > a.btn.signin-form_once`);
            await this.page.click(`#signin-form_box_left > div > a.btn.signin-form_once`);
            await this.page.waitForSelector(`#deliver_to_billingaddr`);
            await this.page.click(`#deliver_to_billingaddr`);
            await this.fillShippingInfo();
            await this.page.waitFor(5000);
            await this.page.waitForSelector(`#middle_sub > form > div.basketedit_summary > div > div.basketedit_summary_buttons.table_display > div:nth-child(3) > button`);
            await this.page.click(`#middle_sub > form > div.basketedit_summary > div > div.basketedit_summary_buttons.table_display > div:nth-child(3) > button`);
            await this.page.waitFor(1500);
            console.log('passhere');

            const shippingPrice = await this.page.evaluate(() => {
                return parseFloat(document.querySelector(`div.worth_box`).textContent.replace(/(zł)|(\s)/g, ''));
            });

            logger.nfo('End Sideone bender', this.variants);

            if (checkout) {
                await this.page.close();
                return {type: 'checkout', retailerId: this.retailerId, value: 'success'};
            } else {
                await this.page.close();
                return {
                    type: 'shipping',
                    retailerId: this.retailerId,
                    shipping: {price: shippingPrice, currency: 'pln'},
                    variants
                };
            }
        } catch (error) {
            logger.err('Bender - Error in Sideone bender', {message: error.message, stack: error.stack});
            throw error;
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

        await page.goto(variant.shopId);

        const itemIsAvailable = await page.evaluate(() => {
            return document.querySelector(`#projector_status_description`).textContent === 'W magazynie';
        });

        this.variants[variantIndex].available = itemIsAvailable;

        if (itemIsAvailable) {
            await page.click(`#projector_button_basket`);
        }
        await page.close();
        return itemIsAvailable;
    }

    async removeOneElementFromBasket() {
        await this.page.evaluate(() => {
            document.querySelector(`.productslist_product_action > a`).click()
        })
    }

    async emptyBasket() {
        await this.page.goto(`https://www.sideone.pl/basketedit.php?mode=1`);
        const elementCountInBasket = await this.page.evaluate(() => {
            return document.querySelectorAll(`.productslist_product_action > a`).length
        });

        //basket is not empty, we must clear it
        if (elementCountInBasket) {
            for (const basketElement of _.range(elementCountInBasket)) {
                console.log('remove one');

                await this.removeOneElementFromBasket();
            }
        }

        console.log('basket now empty');
    }

    async login() {
        await this.page.goto(`https://www.sideone.pl/login.php`);
        await this.page.waitForSelector(`#signin_login_input`);
        await this.page.type(`#signin_login_input`, `180gram`);
        await this.page.type(`#signin_pass_input`, `e77P90pn`);
        await this.page.waitForSelector(`button.btn.signin_button`);
        await this.page.evaluate(() => {
            return document.querySelector(`button.btn.signin_button`).click()
        });
    }

    async fillShippingInfo() {
        await this.page.select(`#client_region`, `1143020057`);
        await this.page.type(`#client_firstname_copy`, config.gram.firstName);
        await this.page.type(`#client_lastname_copy`, config.gram.lastName);
        await this.page.type(`#client_street`, config.gram.address);
        await this.page.type(`#client_zipcode`, config.gram.zip);
        await this.page.type(`#client_city`, config.gram.city);

        await this.page.select(`#delivery_region`, countryCodes[this.destinationAddress.country]);
        await this.page.type(`#delivery_firstname`, this.destinationAddress.first_name);
        await this.page.type(`#delivery_lastname`, this.destinationAddress.last_name);
        await this.page.type(`#delivery_additional`, this.destinationAddress.line2);
        await this.page.type(`#delivery_street`, `${this.destinationAddress.line1}`);
        await this.page.type(`#delivery_zipcode`, `${this.destinationAddress.zip}`);
        await this.page.type(`#delivery_city`, `${this.destinationAddress.city}`);
        await this.page.type(`#delivery_phone`, config.gram.phone);

        await this.page.type(`#client_email`, config.gram.email);
        await this.page.type(`#client_phone`, config.gram.phone);

        await this.page.evaluate(() => {
            return document.querySelector(`#terms_agree`).click()
        });
        await this.page.evaluate(() => {
            return ClNew.hideDialogMail();
        });
        await this.page.evaluate(() => {
            return ClNew.ramka();
        });
        await this.page.click(`#submit_noregister`);
    }
}
