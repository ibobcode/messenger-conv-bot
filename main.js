require('dotenv').config()
const puppeteer = require("puppeteer");
const fs = require("fs");
const request = require("request-promise");
const express = require('express');
const app = express();

let actions = [];

function actionParser(txt) {
  return new Promise(resolve => {
    for (let action of actions) {
      if (action.trigger.type === "text" && action.trigger.content === txt) {
        return resolve(action);
      }
    };
    return resolve(null);
  });
}

async function focusInput(page) {
  await page.evaluate(() => document.getElementsByClassName("_1mf")[0].click());
}

async function typeText(page, text) {
  if (text) {
    await page.keyboard.type(` ${text}`);
  }
}

async function applyTags(page, tags) {
  if (tags && tags.length > 0) {
    for (let tag of tags) {
      await page.keyboard.type(tag);
      await page.waitFor(
        () =>
          document
            .getElementsByClassName("_5rpu")[0]
            .getAttribute("aria-expanded") === "true"
      );
      await page.keyboard.press("Enter");
    }
  }
}

async function applyAttachement(page, link) {
  if (link) {
    console.log("There is a link", link);
    await page.keyboard.type(` ${link}`);
    await page.waitFor(".fbNubFlyoutAttachments");
  }
}

async function uploadPicture(page, upload) {
  if (upload && upload.length > 0) {
    const r = Math.floor(Math.random() * upload.length);
    console.log("UPLOAD");
    const fileData = await request({
      uri: upload[r],
      encoding: null
    });
    fs.writeFileSync("./file.jpg", fileData);
    const fileInput = await page.$("._4e5e");
    await fileInput.uploadFile("./file.jpg");
  }
}

async function uploadPicture(page, fetch) {
  if (fetch) {
    let data = await request({
      uri: fetch.apiUrl,
    });
    fetch.dataPath.forEach(path => {
      data = data[path];
    });
    console.log(data);
    await uploadPicture(page, [data]);
  }
}


console.log("START");

(async () => {
  actions = await request({
    uri: "https://raw.githubusercontent.com/ibobcode/messenger-conv-bot/master/actions.json",
  });
  actions = JSON.parse(actions);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
  ]
  });
  const page = await browser.newPage();
  console.log("PAGE OPENED");
  // page.setDefaultTimeout({
  //   navigation: 10000, 
  //   waitForSelector: 12000,
  // });
  await page.goto("https://www.messenger.com/t/2323944144316918");
  await page.evaluate(text => {
    document.getElementById("email").value = text;
  }, process.env.MAIL);
  await page.evaluate(text => {
    document.getElementById("pass").value = text;
  }, process.env.PASS);
  await page.evaluate(() => document.getElementById("loginbutton").click());
  console.log("LOGGED IN");
  await page.waitForNavigation();
  await page.waitFor(".__i_");
  let saved = null;
  while (true) {
    let lastMessage = await page.evaluate(() => {
      a = document.getElementsByClassName("_3058");
      return Promise.resolve(a[a.length - 1].textContent);
    });
    if (lastMessage !== saved) {
      console.log("Potential command:", lastMessage);
      saved = lastMessage;
      if (lastMessage === '@help') {
        await focusInput(page);
        await typeText(page, 'AVAILABLE COMMANDS: ');
        for (let action of actions) {
          await typeText(page, `${action.trigger.content}, `);
        }
        await page.keyboard.press("Enter");
      }
      let action = await actionParser(lastMessage);
      console.log("ACTION:", action);
      if (action) {
        await focusInput(page);
        await applyTags(page, action.tags);
        await typeText(page, action.text);
        await applyAttachement(page, action.link);
        await uploadPicture(page, action.upload);
        await fetchApi(page, action.fetchApi);
        await page.keyboard.press("Enter");
      }
    }
    await page.waitFor(1000);
  }
})();

app.get('/', function (req, res) {
  res.send('Alive!');
})
app.listen(process.env.PORT, function () {
  console.log('Example app listening on port 3000!');
})
