import axios from 'axios';
import * as cheerio from 'cheerio'; // Ajusta a importação de cheerio


async function extractContent() {
    const sitemapUrl = 'http://exaengenharia.com/sitemap.xml';

    try {
        // Baixa o arquivo sitemap
        const sitemapResponse = await axios.get(sitemapUrl);
        const sitemapData = sitemapResponse.data;

        // Extrai as URLs do sitemap
        const urls = [...sitemapData.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);

        console.log('URLs encontradas no sitemap:', urls);

        // Para cada URL, pega o conteúdo
        for (const url of urls) {
            try {
                const pageResponse = await axios.get(url);
                const html = pageResponse.data;

                // Usa cheerio para processar o HTML
                const $ = cheerio.load(html);
                const textContent = $('body').text().replace(/\s+/g, ' ').trim();

                console.log(`Conteúdo da página ${url}:`);
                console.log(textContent);
                console.log('----------------------------------------');
            } catch (error) {
                console.error(`Erro ao processar a URL ${url}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Erro ao processar o sitemap:', error.message);
    }
}

extractContent();
