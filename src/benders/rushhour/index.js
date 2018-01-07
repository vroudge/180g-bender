import config from '../../config';

export default class Rushhour {
    constructor(browserInstance, {variants, destinationAddress}) {
        this.variants = variants;
        this.bro = browserInstance;
        this.destinationAddress = destinationAddress;
        this.page = null;
    }

    async start({checkout}) {
        const {variants, bro} = this;

        this.page = await bro.newPage();

        try {
            await this.login();

            for (const variant of variants) {
                console.log(`rushhour open ${variant}`);
                const id = variant.split('item=')[1];
                const addToCart = `http://www.rushhour.nl/store_detailed.php?action=add&item=${id}`;
                await this.page.goto(addToCart);
            }
            await this.page.goto('http://www.rushhour.nl/rh_shoppingcart.php?action=checkout');
            await this.fillShippingInfo();
            await this.page.click('#main-content > form:nth-child(4) > table > tbody > tr:nth-child(18) > td:nth-child(2) > input');
            await this.page.waitForSelector(`#shipment > select`);
            console.log('before shipping');

            const shippingPriceRaw = await this.page.evaluate(() => {
                document.querySelector('#shipment > select').value = 4;
                document.querySelector(`#shipment > select`).onchange();
                return document.querySelector('#shipment > select > option:nth-child(2)').textContent
            });
            await this.page.waitForSelector(`#shipment > input[type="checkbox"]:nth-child(13)`);
            await this.page.evaluate(() => {
                document.querySelector('#shipment > input[type="checkbox"]:nth-child(13)').checked = 'checked';
                document.querySelector('#shipment > input[type="checkbox"]:nth-child(13)').onchange();
            });

            if (checkout) {
                console.log('enter checkout');
                await this.page.waitForSelector(`input.bttn`);
                console.log('done waiting selector');
                await this.page.waitFor(1000);
                await this.page.evaluate(() => {
                    document.querySelectorAll(`input.bttn`)[0].click()
                });
                await this.page.waitForSelector([
                    '#Ecom_Payment_Card_Number',
                    '#Ecom_Payment_Card_ExpDate_Month',
                    '#Ecom_Payment_Card_ExpDate_Year',
                    '#Ecom_Payment_Card_Verification'
                ]);
                await this.fillCreditCardInfo();

                return {type: 'checkout', value: 'success'}
            } else {
                return {type: 'shipping', value: shippingPriceRaw};
            }
        } catch (e) {
            throw e;
        }
    }

    async login() {
        await this.page.goto('http://www.rushhour.nl/login.php');
        await this.page.evaluate((login) => {
            document.querySelector('#main-content > form > table > tbody > tr:nth-child(1) > td:nth-child(2) > input[type="text"]').value = login;
        }, config.accounts.rushhour.login);
        await this.page.evaluate((password) => {
            document.querySelector('input[type="password"]').value = password;
        }, config.accounts.rushhour.password);
        await this.page.click('#main-content > form > table > tbody > tr:nth-child(4) > td > input');
        console.log('done login rushhour');
    }

    async fillShippingInfo() {

        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(12) > td:nth-child(2) > input`,
            `${this.destinationAddress.last_name} ${this.destinationAddress.first_name}`);
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(13) > td:nth-child(2) > input`,
            `${this.destinationAddress.line1} ${this.destinationAddress.line2}`);
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(15) > td:nth-child(2) > input`,
            this.destinationAddress.city);
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(16) > td:nth-child(2) > input[type="text"]`,
            this.destinationAddress.city);
        await this.fillField(`#main-content > form:nth-child(4) > table > tbody > tr:nth-child(14) > td:nth-child(2) > input`,
            this.destinationAddress.zip);
        await this.page.select('#main-content > form:nth-child(4) > table > tbody > tr:nth-child(17) > td:nth-child(2) > select', `75`);
        console.log('done fill shipping rushhour');
    }

    async fillCreditCardInfo() {
        await this.fillField(`#Ecom_Payment_Card_Number`, config.finance.ccNumber);
        await this.page.select('#Ecom_Payment_Card_ExpDate_Month', config.finance.expiryMonth);
        await this.page.select('#Ecom_Payment_Card_ExpDate_Year', config.finance.expiryYear);
        await this.fillField(`#Ecom_Payment_Card_Verification`, config.finance.cvv);
        await this.page.click(`#submit3`);
    }

    async fillField(selector, value) {
        await this.page.$eval(selector, input => input.value = '');
        await this.page.type(selector, value);
    }
}
