import config from '../../config';

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

        this.page = await bro.newPage();
        try {
            for (const variant of variants) {
                console.log('hitting', variant);
                await this.page.goto(variant);
                await this.page.click(`#projector_button_basket`);
            }
            await this.page.goto(`https://www.sideone.pl/basketedit.php?mode=1`);
            await this.page.click(`#basket_go_next`);
            await this.page.waitForSelector(`#signin-form_box_left > div > a.btn.signin-form_once`);
            await this.page.click(`#signin-form_box_left > div > a.btn.signin-form_once`);
            await this.page.waitForSelector(`#deliver_to_billingaddr`);
            await this.page.click(`#deliver_to_billingaddr`);

            await this.fillShippingInfo();
            console.log('shipping info done');

            await this.page.waitForSelector(`#middle_sub > form > div.basketedit_summary > div > div.basketedit_summary_buttons.table_display > div:nth-child(3) > button`);
            await this.page.click(`#middle_sub > form > div.basketedit_summary > div > div.basketedit_summary_buttons.table_display > div:nth-child(3) > button`);

            await this.page.waitFor(2000);

            const shippingPriceRaw = await this.page.evaluate(() => {
                return document.querySelector(`div.worth_box`).textContent
            });

            if (checkout) {
                return {type: 'checkout', value: 'success'};
            } else {
                return {type: 'shipping', retailerId: this.retailerId, value: shippingPriceRaw};
            }
        } catch (e) {
            throw new Error(e);
        }
    }

    async fillShippingInfo() {
        await this.page.select(`#delivery_region`, `1143020057`);
        await this.page.type(`#delivery_firstname`, this.destinationAddress.first_name);
        await this.page.type(`#delivery_lastname`, this.destinationAddress.last_name);
        await this.page.type(`#delivery_additional`, this.destinationAddress.line2);
        await this.page.type(`#delivery_street`, `${this.destinationAddress.line1}`);
        await this.page.type(`#delivery_zipcode`, `${this.destinationAddress.zip}`);
        await this.page.type(`#delivery_city`, `${this.destinationAddress.city}`);
        await this.page.type(`#delivery_phone`, config.gram.phone);

        await this.page.select(`#client_region`, `1143020057`);
        await this.page.type(`#client_firstname_copy`, config.gram.firstName);
        await this.page.type(`#client_lastname_copy`, config.gram.lastName);
        await this.page.type(`#client_street`, config.gram.address);
        await this.page.type(`#client_zipcode`, config.gram.zip);
        await this.page.type(`#client_city`, config.gram.city);

        await this.page.type(`#client_email`, config.gram.email);
        await this.page.type(`#client_phone`, config.gram.phone);

        await this.page.click(`#terms_agree`);
        await this.page.click(`#submit_noregister`);
    }
}
