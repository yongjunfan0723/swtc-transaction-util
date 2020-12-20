const program = require('commander');
const fs = require("fs");
const readlineSync = require("readline-sync");
const JCCExchange = require("jcc_exchange").JCCExchange;
const JingchangWallet = require("jcc_wallet").JingchangWallet;
const config = require("./config");

program
  .usage('[options] <file ...>')
  .option('-A, --address <path>', "平台方钱包地址")
  .option('-P, --password <path>', "keystore密码")
  .option('-f, --feeAccount <path>', "收费钱包地址")
  .option('-n, --rateNum <path>', "费率分子")
  .option('-d, --rateDen <path>', "费率分母")
  .option('-c, --currency <path>', "收费token名称")
  .parse(process.argv);

const setBrokerage = async () => {
  const { address, feeAccount, rateNum, rateDen, currency } = program;
  let password = program.password;
  try {
    if (!password) {
      password = readlineSync.question("Please Enter Password:", { hideEchoBack: true });
    }
    const keystore = fs.readFileSync("./keystore/wallet.json", { encoding: "utf-8" });
    const instance = new JingchangWallet(JSON.parse(keystore), true, false);
    const secret = await instance.getSecretWithAddress(password, address);
    // const nodes = await config.getRpcNodes();
    const nodes = config.rpcNodes;
    JCCExchange.init(nodes);
    let hash = await JCCExchange.setBrokerage(address, secret, feeAccount, Number(rateNum), Number(rateDen), currency);
    console.log("设置挂单手续费成功: ", hash);
  } catch (error) {
    console.log("设置挂单手续费失败: ", error.message);
  }
}

setBrokerage();