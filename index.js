import puppeteer from "puppeteer";
import * as fs from "fs";
import "dotenv/config";

const PRODUCTS_RESPONSE_URL = "https://card.wb.ru/cards/v1/detail";
const STORES_RESPONSE_JSON = "stores-data.json";

const PRODUCT_ID_DEFAULT = 146972802;
const STORE_NAME_DEFAULT = "Казань WB";

const PRODUCT_ID = process.env.PRODUCT_ID || PRODUCT_ID_DEFAULT
const WAREHOUSE_NAME = process.env.WAREHOUSE_NAME || STORE_NAME_DEFAULT

const data = {
  warehouseId: 0,
  products: [],
};

const getStock = (sizes) => {
  const mapped = sizes
    .map((size) => {
      const stock = size.stocks.find((stock) => stock.wh === data.warehouseId);
      if (stock) {
        return [`${size.origName}`, stock.qty];
      }
    })
    .filter((size) => !!size);

  return Object.fromEntries(mapped);
};

const mapProducts = (p) =>
  data.products.push({
    art: p.id,
    stock: getStock(p.sizes, data.warehouseId),
  });

const getData = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    devtools: true,
    slowMo: 10,
  });

  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on("request", (interceptedRequest) => {
    interceptedRequest.continue();
  });

  page.on("response", async (response) => {
    if (response.url().includes(STORES_RESPONSE_JSON)) {
      const warehouses = await response.json();
      data.warehouseId = warehouses.find((wh) => wh.name === WAREHOUSE_NAME).id;
    }

    if (response.url().startsWith(PRODUCTS_RESPONSE_URL)) {
      const {
        data: { products },
      } = await response.json();

      products.map(mapProducts);
    }
  });

  await page.goto(
    `https://www.wildberries.ru/catalog/${PRODUCT_ID}/detail.aspx`,
    {
      waitUntil: "networkidle0",
    }
  );

  await browser.close();
};

await getData();

fs.writeFile("data.json", JSON.stringify(data.products), (error) => {
  if (error) {
    console.error(error);
    throw error;
  }

  console.log("Остатки артикулов записаны в файл data.json");
});
