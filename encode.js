// encode.js
const fs = require("fs");
const key = fs.readFileSync("./b12-a10-poroshstudymate-firebase-admin-key.json", "utf8");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);