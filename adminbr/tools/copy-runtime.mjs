import {copyFile,mkdir} from "node:fs/promises";
const destination = new URL("../dist/common/money/",import.meta.url);
await mkdir(destination,{recursive:true});
await copyFile(new URL("../src/common/money/sample-money.mjs",import.meta.url),new URL("sample-money.mjs",destination));
console.log("Packaged backend sample cost calculator in backend dist.");
