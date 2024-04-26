import express from 'express';
import path from 'path';
import puppeteer from 'puppeteer';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';

const app = express();
const PORT = 3000;

app.use(express.json());

// Configuration du transporteur d'e-mails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'votre_email',
    pass: 'Mot de passe email'
  },
  tls: {
    rejectUnauthorized: false // Désactiver la vérification SSL //Pour assurer l'accès a votre compte email
  }
});

// Route pour servir le fichier HTML
const __dirname = path.resolve();
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route pour recevoir les données du formulaire et effectuer le scraping et l'envoi d'e-mails
app.post('/sendData', async (req, res) => {
  const { nom, prenom, email } = req.body;

  console.log('Données du formulaire reçues :');
  console.log('Nom:', nom);
  console.log('Prénom:', prenom);
  console.log('Email:', email);

  try {
    // Lancer le scraping des données
    const mergedData = await scrapeData();

    // Enregistrer les données dans un fichier Excel
    await saveDataToExcel(mergedData);

    // Envoyer un e-mail avec le fichier Excel en pièce jointe
    await sendEmailWithAttachment(nom, prenom, email);

    // Réponse indiquant que les données ont été reçues avec succès et l'e-mail envoyé
    res.json({ message: 'Données du formulaire reçues avec succès et e-mail envoyé avec pièce jointe !' });
  } catch (error) {
    console.error('Erreur lors du processus :', error);
    res.status(500).json({ error: 'Une erreur est survenue lors du processus' });
  }
});

// Fonction pour effectuer le scraping des données d'Amazon , Fnac et eBay 
async function scrapeData() {
  const browser = await puppeteer.launch();

  // Extraction des données d'Amazon
  const amazonData = await extractAmazonData(browser);

  // Extraction des données d'Amazon
  const fnacData = await extractfnacData(browser);

  // Extraction des données d'eBay
  const ebayData = await extractEbayData(browser);

  // Fermeture du navigateur
  await browser.close();

  // Fusion des données d'Amazon et d'eBay
  const mergedData = [...amazonData, /*...fnacData, */...ebayData];

  return mergedData;
}

// Fonction pour extraire les données d'Amazon
async function extractAmazonData(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.amazon.fr/');

  // Attente que le champ de recherche soit chargé
  await page.waitForSelector('#twotabsearchtextbox');

  // Saisie de la recherche "Sony PlayStation 5 Console"
  await page.type('#twotabsearchtextbox', 'Console Sony PlayStation 5');
  await page.keyboard.press('Enter');

  // Attente des résultats de la recherche
  await page.waitForSelector('.s-result-item');

  // Extraction des titres et des prix des résultats de la recherche
  const consoles = await page.$$eval('.s-result-item', consoleElements => {
    return consoleElements.map(consoleElement => {
      const titleElement = consoleElement.querySelector('h2');
      const title = titleElement ? titleElement.innerText.trim() : 'Titre non disponible';

      const priceElement = consoleElement.querySelector('.a-price .a-offscreen');
      const price = priceElement ? priceElement.innerText.trim() : 'Prix non disponible';

      return { site: 'Amazon', title, price };
    });
  });

  await page.close();
  return consoles;
}

// Fonction pour extraire les données de Fnac
/*async function extractfnacData(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.fnac.com/');

  // Attente que le champ de recherche soit chargé
  await page.waitForSelector('#Fnac_Search');

  // Saisie de la recherche "Sony PlayStation 5 Console"
  await page.type('#Fnac_Search', 'Console Sony PlayStation 5');
  await page.keyboard.press('Enter');

  // Attente des résultats de la recherche
  await page.waitForSelector('.s-result-item'); // a changé .s-result-item

  // Extraction des titres et des prix des résultats de la recherche
  const consoles = await page.$$eval('.s-result-item', consoleElements => {
    return consoleElements.map(consoleElement => {
      const titleElement = consoleElement.querySelector('h2');
      const title = titleElement ? titleElement.innerText.trim() : 'Titre non disponible';

      const priceElement = consoleElement.querySelector('.a-price .a-offscreen');
      const price = priceElement ? priceElement.innerText.trim() : 'Prix non disponible';

      return { site: 'Fnac', title, price };
    });
  });

  await page.close();
  return consoles;
}
*/

// Fonction pour extraire les données d'eBay
async function extractEbayData(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.ebay.fr/');

  // Saisie de la recherche "Sony PlayStation 5 Console"
  await page.type('#gh-ac', 'Console Sony PlayStation 5');
  await page.click('#gh-btn');

  // Attente des résultats de la recherche
  await page.waitForSelector('.s-item');

  // Extraction des titres et des prix des résultats de la recherche
  const consoles = await page.$$eval('.s-item', consoleElements => {
    return consoleElements.map(consoleElement => {
      const titleElement = consoleElement.querySelector('.s-item__title');
      const title = titleElement ? titleElement.innerText.trim() : 'Titre non disponible';

      const priceElement = consoleElement.querySelector('.s-item__price');
      const price = priceElement ? priceElement.innerText.trim() : 'Prix non disponible';

      return { site: 'eBay', title, price };
    });
  });

  await page.close();
  return consoles;
}

// Fonction pour enregistrer les données dans un fichier Excel
async function saveDataToExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Consoles_PS5');
  worksheet.addRow(['Site', 'Titre', 'Prix']);
  data.forEach(item => {
    worksheet.addRow([item.site, item.title, item.price]);
  });
  await workbook.xlsx.writeFile('ps5_prices_new.xlsx');
  console.log('Les données ont été enregistrées dans "ps5_prices_new.xlsx"');
}

// Fonction pour envoyer un e-mail avec un fichier Excel en pièce jointe
async function sendEmailWithAttachment(nom, prenom, email) {
  const mailOptions = {
    from: 'Votre email',
    to: email,
    subject: 'Bonjour ' + nom + ' ' + prenom,
    text: 'Bonjour ' + prenom + ',\n\nCeci est un e-mail de test avec fichier Excel en pièce jointe.\n\nCordialement,\nVotre équipe',
    attachments: [
      {
        filename: 'ps5_prices_new.xlsx',
        path: './ps5_prices_new.xlsx'
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  console.log('E-mail envoyé avec succès à', email);
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

