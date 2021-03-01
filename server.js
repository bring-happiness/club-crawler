'use strict';

const puppeteer = require('puppeteer');
const stringify = require('csv-stringify');
const fs = require('fs');

async function main() {
  const browser = await puppeteer.launch({
    headless: false, args: [
      '--start-maximized',
    ],
    defaultViewport: null,
  });
  const page = await browser.newPage();

  // await this.clickIfPresent('.bloc .bouton_valider');

  // await crawlClubIleDeFrance(page);
  await crawlAllClubs(page);

  // END
  await page.screenshot({path: './screenshots/example.png'});
  await browser.close();
}

main();

async function crawlAllClubs(page) {
  /**
   * INPUTS
   */
  const NUMBER_CLUBS_CRAWLED = 552;
  const DISTANCE_MAX_VALUE = 30;
  const BEGIN_PAGE = 10;

  page.goto('https://tenup.fft.fr/recherche/clubs');
  await page.waitFor(7000);
  await page.reload();

  const allClubs = [];

  let increment = 1;
  let totalIncrement = 1;

  //await page.type('#autocomplete-custom-search-input', 'Auvergne-Rhône-Alpes, France');
  await page.type('#autocomplete-custom-search-input', 'Paris');
  await page.waitForSelector('.autocomplete-result-list li:nth-child(1)');

  await clickIfPresent(page, '.autocomplete-result-list li:nth-child(1)')

  await page.evaluate((DISTANCE_MAX_VALUE) => {
    const slider = document.querySelector('.slider');

    slider.setAttribute('max', DISTANCE_MAX_VALUE);
    slider.value = DISTANCE_MAX_VALUE;

    document.querySelector('#edit-pratique-tennis').click();

    const eventInput = new Event('input', {bubbles: true});
    slider.dispatchEvent(eventInput);

    const eventChange = new Event('change', {bubbles: true});
    slider.dispatchEvent(eventChange);

    document.querySelector('.loader-btn').click();
  }, DISTANCE_MAX_VALUE)

  await page.waitFor(2000);

  await Promise.all([
    page.waitForNavigation(),
    clickIfPresent(page, '.loader-btn'),
    page.waitForSelector('.result-left .result-cards-container')
  ]);

  do {
    try {
      await Promise.all([
        page.waitForNavigation(),
        clickIfPresent(page, `.result-left .result-cards-container > .card-content:nth-child(${increment})`),
        page.waitForSelector('ul.menu.nav')
      ]);

      const club = await page.evaluate(() => {
        let title = document.querySelector('h1.main-title');
        title = title !== null ? title.innerHTML : '';

        const mailElement = document.querySelector('.contact-club ul.menu.nav a.meticon-MAIL');
        let email = mailElement !== null ? mailElement.getAttribute('href') : '';
        email = email.split('mailto:')[1];

        const phoneElement = document.querySelector('.contact-club ul.menu.nav .meticon-telephone');
        let phone = '';

        if (phoneElement !== null) {
          phoneElement.click();
          const phoneModalBody = document.querySelector('#modalContent .modal-body');
          phone = phoneModalBody.innerHTML;
          phone = '0' + phone.split(': 0')[1].substring(0, 9);
        }

        const websiteElement = document.querySelector('.contact-club ul.menu.nav .meticon-web');
        const website = websiteElement !== null ? websiteElement.getAttribute('href') : '';

        const facebookElement = document.querySelector('.contact-club ul.menu.nav .fa.fa-facebook');
        const facebook = facebookElement !== null ? facebookElement.getAttribute('href') : '';

        const instagramElement = document.querySelector('.contact-club ul.menu.nav .fa.fa-instagram');
        const instagram = instagramElement !== null ? instagramElement.getAttribute('href') : '';

        return {
          title,
          phone,
          email,
          website,
          facebook,
          instagram,
        };
      });

      console.log('CLUB: ' + club.title);

      await Promise.all([
        page.waitForNavigation(),
        clickIfPresent(page, 'div.nav-fiche-club > ul > li:nth-child(3) > a'),
        page.waitForSelector('.container-content-ficheClub')
      ]);

      const thirdPageInfos = await page.evaluate(() => {
        let president = document.querySelector('div.block-color-wrapper.block-new-ficheclub.block-info-club > div > div > div:nth-child(3) > p');
        president = president ? president.innerHTML : '';

        let ligue = document.querySelector('div.block-color-wrapper.block-new-ficheclub.block-info-club > div > div > div:nth-child(1) > p');
        ligue = ligue ? ligue.innerHTML : '';

        let comitee = document.querySelector('div.block-color-wrapper.block-new-ficheclub.block-info-club > div > div > div:nth-child(2) > p');
        comitee = comitee ? comitee.innerHTML : '';

        let membersNumber = document.querySelector('div.block-effectif-club--list > div:nth-child(1) > div > div > div.effectif-chiffre');
        membersNumber = membersNumber ? membersNumber.innerHTML : '';

        const select = document.querySelector('.club-page-effectif-millesimes select');

        if (select) {
          select.value = '1';
          select.dispatchEvent(new Event('change'));
        }

        return {
          president,
          ligue,
          comitee,
          membersNumber,
        }
      });

      await page.waitFor(200);

      const membersNumberLastYear = await page.evaluate(() => {
        let membersNumberLastYear = document.querySelector('div.block-effectif-club--list > div:nth-child(1) > div > div > div.effectif-chiffre');
        membersNumberLastYear = membersNumberLastYear ? membersNumberLastYear.innerHTML : '';

        return {
          membersNumberLastYear
        }
      });

      Object.assign(club, thirdPageInfos, membersNumberLastYear);

      allClubs.push(club);
    } catch (error) {
      console.log('ERROR:' + error)
    }

    try {
      await page.goBack();
      await page.goBack();

      // todo: fix because the is not every link for each page. We will need a tricks :))
      const pageNumber = Math.floor(totalIncrement / 20) + BEGIN_PAGE;
      await clickIfPresent(page, `#recherche-tournois-pagination > div > ul > li:nth-child(${pageNumber}) > a`);

      await page.waitFor(500);

    } catch (error) {
      console.log('GO BACK ERROR:' + error)
    }

    if ((increment % 20) === 0) {
      increment = 1;
    } else {
      increment++;
    }

    totalIncrement++;

  } while (totalIncrement <= NUMBER_CLUBS_CRAWLED)

  //console.log(allClubs);

  createCSV(allClubs)
}

function createCSV(clubs) {
  let data = [];
  let columns = {
    club: 'Club',
    president: 'President',
    phone: 'Telephone',
    ligue: 'Ligue',
    comitee: 'Comite',
    email: 'Email',
    website: 'Site internet',
    membersNumber: 'Nombre de membres',
    membersNumberLastYear: 'Nombre de membres l\'annee derniere',
    facebook: 'Facebook',
    instagram: 'Instagram',
  };

  clubs.forEach(club => {
    data.push([
      club.title,
      club.president,
      club.phone,
      club.ligue,
      club.comitee,
      club.email,
      club.website,
      club.membersNumber,
      club.membersNumberLastYear,
      club.facebook,
      club.instagram
    ]);
  })

  stringify(data, {header: true, columns: columns}, (err, output) => {
    if (err) throw err;

    fs.writeFile('./export/clubs.csv', output, (err) => {
      if (err) throw err;
      console.log('clubs.csv saved.');
    });
  });
}

async function clickIfPresent(page, selector, doubleClick = false) {
  return page.evaluate((selector, doubleClick) => {
    let element = document.querySelector(selector);

    if (element) {

      if (doubleClick) {
        const clickEvent = document.createEvent('MouseEvents');
        clickEvent.initEvent('dblclick', true, true);
        element.dispatchEvent(clickEvent);
      } else {
        element.click();
      }

      return true;
    }

    return false;
  }, selector, doubleClick);
}


/**
 *  OLD CRAWLER TO GET CLUBS FROM "Ile de France"
 */
async function crawlClubIleDeFrance(page) {
  await page.goto('https://tennis-idf.fr/trouver-un-club/');

  const allClubs = [];

  let increment = 0;

  try {
    do {
      const clubs = await page.evaluate(() => {
        const _clubs = document.querySelectorAll('.cspml_list_and_filter_container .list_view_holder');
        const clubs = [];

        _clubs.forEach((club) => {
          const title = club.querySelector('.cspml_details_title .cspml_popup_single_post').innerHTML;
          const _email = club.querySelector('.cspml_details_content').innerHTML;

          if (!_email.includes('@')) {
            clubs.push({
              title,
              email: ''
            });

            return;
          }

          const emailSplitted = _email.split('@');

          const firstPart = emailSplitted[0].split('<br>');
          const emailBegin = firstPart[firstPart.length - 1];

          const secondPart = emailSplitted[1].split('<br>');
          const emailEnd = secondPart[0];

          const email = `${emailBegin}@${emailEnd}`;

          clubs.push({
            title,
            email
          });
        });

        return clubs;
      })

      allClubs.push(...clubs);

      await Promise.all([
        page.waitForNavigation(),
        clickIfPresent(page, '.cspm_link_hex .next.page-numbers'),
        page.waitForSelector('.cspml_list_and_filter_container')
      ])

      increment++;

    } while (increment < 90)
  } catch {

  }

  console.log(allClubs);

  createCSV(allClubs)
}
