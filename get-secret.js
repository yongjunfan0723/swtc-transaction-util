const program = require('commander');
const fs = require("fs");
const readlineSync = require("readline-sync");
const { JingchangWallet, jtWallet } = require("jcc_wallet");

program
  .usage('[options] <file ...>')
  .option('-A, --address <path>', "钱包地址")
  .option('-P, --password <path>', "密码")
  .parse(process.argv);

const address = program.address;
if (address && !jtWallet.isValidAddress(address)) {
  console.log("钱包地址不合法")
  process.exit(0);
}

const getSecret = async () => {
  try {
    let password = program.password;
    if (!password) {
      password = readlineSync.question("Please Enter Password:", { hideEchoBack: true });
    }
    const keystore = fs.readFileSync("./keystore/wallet.json", { encoding: "utf-8" });
    const instance = new JingchangWallet(JSON.parse(keystore), true, false);
    instance.getSecretWithAddress(password, address).then((secret) => {
      if (jtWallet.isValidSecret(secret)) {
        console.log(`${address} 密钥`, secret)
        return secret;
      }
    }).catch((error) => {
      console.log(error.message)
    });
  } catch (error) {
    console.log(error)
  }
}
getSecret()