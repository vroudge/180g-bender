import puppeteer from 'puppeteer';
import * as Benders from './benders'

const junoVariants = [
    'http://www.juno.co.uk/products/667343-1',
    'http://www.juno.co.uk/products/385176-1',
    'http://www.juno.co.uk/products/673898-1',
    'http://www.juno.co.uk/products/673957-1'
];
const rushhourVariants = [
    'http://www.rushhour.nl/store_detailed.php?item=56286',
    'http://www.rushhour.nl/store_detailed.php?item=59167',
    'http://www.rushhour.nl/store_detailed.php?item=100803',
    'http://www.rushhour.nl/store_detailed.php?item=71412',
];
const hardwaxVariants = [
    `https://hardwax.com/41192/`,
    `https://hardwax.com/22772/`,
    `https://hardwax.com/76816/`,
    `https://hardwax.com/74166/`
];
const sideoneVariants = [
    `https://www.sideone.pl/product-pol-19204-Otzi-grey-vinyl.html`,
    `https://www.sideone.pl/product-pol-19205-Ricochet-And-Then-Leave.html`,
    `https://www.sideone.pl/product-pol-19210-Bourgie-Bourgie.html`,
    `https://www.sideone.pl/product-pol-19194-Nowa-Aleksandria.html`,
];
const emileVariants = [
    `https://chezemile-records.com/release/6044537-Modini-Turk`,
    `https://chezemile-records.com/release/7560991-Palma-I`,
    `https://chezemile-records.com/release/4253186-Larry-Heard-Presents-Mr-White-You-Rock-Me-The-Sun-Cant-Compare`,
    `https://chezemile-records.com/release/4542111-Gil-Scott-Heron-The-Revolution-Will-Not-Be-Televised`,
];

const destinationAddress = {
    first_name: 'Valentin',
    last_name: 'Roudge',
    line1: '54 Rue Merlin',
    line2: '4eme gauche',
    city: 'Paris',
    state: 'IDF',
    zip: '75011',
    country: 'fr'
};

(async () => {
    let browser, action;

    try {
        browser = await puppeteer.launch({headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox']});

        /*
        action = await (new Benders.juno(browser, {
            variants: junoVariants,
            destinationAddress
        })).start({checkout: true});
        */
        /*
        action = await (new Benders.rushhour(browser, {
            variants: rushhourVariants,
            destinationAddress
        })).start({checkout: true});
        */
        /*
        action = await (new Benders.hardwax(browser, {
            variants: hardwaxVariants,
            destinationAddress
        })).start({checkout: true});
        */
        /*
        action = await (new Benders.sideone(browser, {
            variants: sideoneVariants,
            destinationAddress
        })).start({checkout: true});
        */

        action = await (new Benders.emile(browser, {
            variants: emileVariants,
            destinationAddress
        })).start({checkout: true});

        action ? console.log('exit', action) : console.log('exit');
        if (process.env.NODE_ENV === 'production') await browser.close();
    } catch (e) {
        console.log('error in main', e);
    }
})();
