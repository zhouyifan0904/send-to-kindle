import Mercury from "@postlight/mercury-parser";
import fetch from "node-fetch";
import proxyagent from 'https-proxy-agent';
import fs from "fs";
import nodemailer from "nodemailer";
import {
  displayName,
  email,
  emailUser,
  pswd,
  targetEmail,
} from "./credentials.js";

const MIN_ARTICLE_LENGTH = 1000; // we probably didn't parse the article right if it's shorter than this

if (!email) email = "example@gmail.com";
if (!emailUser) emailUser = "example";
if (!pswd) pswd = "badpassword123";
if (!displayName) displayName = "johnsmith";
if (!targetEmail) targetEmail = "example@kindle.com";

let transporter = nodemailer.createTransport({
  host: "smtp.126.com",
  port: 465,
  secure: true,
  auth: {
    user: emailUser,
    pass: pswd,
  },
});

let url = process.argv[2];
console.log("using url:");
console.log(url);

// fetch webpage
let res = null
let https_proxy = process.env.https_proxy || ''
if (https_proxy !== '') {
  res = await fetch(url, {agent: new proxyagent.HttpsProxyAgent(process.env.https_proxy)})
} else {
  res = await fetch(url)
}
const body = await res.text();
// parse
Mercury.parse(url, { contentType: "html", html: Buffer.from(body, 'utf8') }).then((result) => {
  if (result.error) {
    console.log("error parsing:");
    return console.log(result.message);
  }
  console.log("parsed;");

  let fn = `${result.title.replace(/[\s_\/]+/g, "_")}.html`;
  let fp = `${process.argv[1].replace(
    /(\\index.js)|(\/index.js)/gm,
    ""
  )}/archive/${fn}`;

  // add title and author
  let content = `<!DOCTYPE html><html><head><title>${result.title}</title><meta name="author" content="${result.author}"></head><body>`;
  // remove images and links
  content += result.content
    .replace(/<img[^>]*>|<a[^>]*>|<\/a>/gm, "") // who wants images and links on a kindle?
    .replace(/<source[^>]*>/gm, ""); // remove <source> tags as they break kindle formatting
  content += `</body></html>`;

  // write to file
  fs.writeFile(fp, content, function (err) {
    if (err) {
      console.log("error writing file:");
      return console.log(err);
    }
    console.log("written to file: " + fn + "\nlength = " + content.length + "\nwords = " + content.split(" ").length);
    if (content.length <= MIN_ARTICLE_LENGTH) {
      console.log("article is too short");
      return;
    }
    // send file via email
    let mailOptions = {
      from: `"${displayName}}" ${email}`,
      to: targetEmail,
      subject: result.title,
      text: "Hello! Here's an article for you.",
      attachments: [
        {
          filename: fn,
          path: fp,
        },
      ],
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("error sending email:");
        console.log(error);
      } else {
        console.log("email sent: " + info.response);
      }
    });
  });
});
