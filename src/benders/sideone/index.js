import config from '../../config';
import logger from '../../lib/logger';
import _ from 'lodash';

export default class sideone {
    constructor(browserInstance, {variants, retailerId, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.retailerId = retailerId;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        const {variants, bro} = this;
        try {

            this.page = await bro.newPage();
            logger.nfo('Begin Sideone bender', this.variants);
            for (const [value, index] of variants.entries()) {

                await this.page.goto(index.shopId);
                logger.nfo('done goto one')
                const itemIsAvailable = await this.page.evaluate(() => {
                    return document.querySelector(`#projector_status_description`).textContent === 'W magazynie';
                });
                logger.nfo('done available')
                this.variants[value].available = itemIsAvailable;
                if (!itemIsAvailable) {
                    const allUnavailable = _.filter(variants, 'available').length === 0;

                    const endOfArray = value + 1 === variants.length;
                    if (endOfArray && allUnavailable) {

                        console.log('allunav');
                        return {type: 'all-unavailable', retailerId: this.retailerId, variants};
                    }
                } else {
                    await this.page.click(`#projector_button_basket`);
                }
            }

            logger.nfo('done add to cart')


            await this.page.goto(`https://www.sideone.pl/basketedit.php?mode=1`);
            await this.page.waitForSelector(`#basket_go_next`);
            logger.nfo('done wait basket gonext')
            await this.page.click(`#basket_go_next`);
            logger.nfo('done click basket gonext')
            await this.page.waitForSelector(`#signin-form_box_left > div > a.btn.signin-form_once`);
            await this.page.click(`#signin-form_box_left > div > a.btn.signin-form_once`);
            logger.nfo('done click signin once')
            await this.page.waitForSelector(`#deliver_to_billingaddr`);
            await this.page.click(`#deliver_to_billingaddr`);
            logger.nfo('done click deliver to billin address')
            await this.fillShippingInfo();
            logger.nfo('done fill shippinginfo')
            await this.page.waitForSelector(`#middle_sub > form > div.basketedit_summary > div > div.basketedit_summary_buttons.table_display > div:nth-child(3) > button`);
            await this.page.click(`#middle_sub > form > div.basketedit_summary > div > div.basketedit_summary_buttons.table_display > div:nth-child(3) > button`);
            logger.nfo('done fill shippinginfo')
            await this.page.waitFor(1500);
            const shippingPrice = await this.page.evaluate(() => {
                return parseFloat(document.querySelector(`div.worth_box`).textContent.replace(/(zł)|(\s)/g, ''));
            });

            logger.nfo('End Sideone bender', this.variants);

            if (checkout) {
                return {type: 'checkout', retailerId: this.retailerId, value: 'success'};
            } else {
                return {
                    type: 'shipping',
                    retailerId: this.retailerId,
                    shipping: {price: shippingPrice, currency: 'pln'},
                    variants
                };
            }
        } catch (e) {
            logger.err('error in sideone', {error: e, stack: e.stack})
        }
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
        console.log('element', elementCountInBasket);

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

        await this.page.select(`#delivery_region`, `1143020057`);
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

        await this.page.waitFor(2000);
        await this.page.click(`#submit_noregister`);
    }
}
